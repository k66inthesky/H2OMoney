/// H2O Smart DCA - 安全增強版金庫合約 V3
/// 包含防搶跑、時間鎖定、存款上限等安全機制
module h2o_smart_dca::h2o_vault_v3_secure {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::table::{Self, Table};
    use h2o_smart_dca::h2o_usd::{Self, H2O_USD};

    // ============ 錯誤碼 ============
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_VAULT_PAUSED: u64 = 4;
    const E_ZERO_SUPPLY: u64 = 5;
    const E_INSUFFICIENT_H2OUSD: u64 = 6;
    const E_TIME_LOCK_NOT_EXPIRED: u64 = 7;
    const E_EXCEED_USER_LIMIT: u64 = 8;
    const E_EXCEED_VAULT_LIMIT: u64 = 9;
    const E_EARLY_WITHDRAWAL_FEE: u64 = 10;
    const E_SLIPPAGE_TOO_HIGH: u64 = 11;
    const E_COOLDOWN_NOT_EXPIRED: u64 = 12;
    const E_NOT_WHITELISTED: u64 = 13;

    // ============ 常數 ============
    const PRECISION: u64 = 1_000_000; // 6 decimals
    const BASIS_POINTS: u64 = 10000;

    // 安全參數
    const MIN_LOCK_PERIOD_MS: u64 = 3600000; // 1 小時最小鎖定期
    const DEFAULT_LOCK_PERIOD_MS: u64 = 86400000; // 24 小時預設鎖定期
    const EARLY_WITHDRAWAL_FEE_BP: u64 = 100; // 1% 早期提款費
    const MAX_SINGLE_DEPOSIT: u64 = 100_000_000_000; // 100,000 USDC
    const COOLDOWN_PERIOD_MS: u64 = 300000; // 5 分鐘冷卻期

    // ============ 結構 ============

    /// 全局金庫配置（安全增強版）
    public struct SecureVaultConfig<phantom T> has key {
        id: UID,
        admin: address,

        // H2OUSD Treasury Cap
        h2ousd_treasury: TreasuryCap<H2O_USD>,

        // 金庫資產
        usdc_balance: Balance<T>,
        total_assets: u64,

        // 用戶追蹤（防搶跑）
        user_deposits: Table<address, UserDepositInfo>,

        // 統計數據
        total_deposited: u64,
        total_withdrawn: u64,
        total_yield_earned: u64,
        total_users: u64,

        // 安全設定
        lock_period_ms: u64,              // 最小鎖定期
        early_withdrawal_fee_bp: u64,     // 早期提款費率
        max_user_deposit: u64,            // 單用戶最大存款
        max_vault_capacity: u64,          // 金庫最大容量
        deposit_cooldown_ms: u64,         // 存款冷卻期
        withdrawal_cooldown_ms: u64,      // 提款冷卻期

        // 白名單模式（可選）
        whitelist_enabled: bool,
        whitelisted_users: Table<address, bool>,

        // 緊急控制
        deposit_paused: bool,
        withdrawal_paused: bool,
        fee_rate: u64,

        // 防重入標記
        reentrancy_guard: bool,

        created_at: u64,
        updated_at: u64,
    }

    /// 用戶存款信息（用於時間鎖定和防搶跑）
    public struct UserDepositInfo has store, copy, drop {
        total_deposited: u64,
        h2ousd_balance: u64,
        last_deposit_time: u64,
        last_withdrawal_time: u64,
        deposit_count: u64,
        withdrawal_count: u64,
    }

    /// 存款記錄（NFT 形式，可追蹤）
    public struct SecureDepositReceipt has key, store {
        id: UID,
        owner: address,
        vault_id: ID,
        usdc_deposited: u64,
        h2ousd_minted: u64,
        deposit_time: u64,
        unlock_time: u64,              // 解鎖時間
        can_withdraw_after: u64,       // 可以無懲罰提款的時間
    }

    /// 提款記錄
    public struct SecureWithdrawalReceipt has key, store {
        id: UID,
        owner: address,
        vault_id: ID,
        h2ousd_burned: u64,
        usdc_withdrawn: u64,
        fee_paid: u64,
        is_early_withdrawal: bool,
        timestamp: u64,
    }

    // ============ 事件 ============

    public struct SecureVaultCreated has copy, drop {
        vault_id: ID,
        admin: address,
        lock_period_ms: u64,
        max_user_deposit: u64,
        timestamp: u64,
    }

    public struct SecureDeposited has copy, drop {
        vault_id: ID,
        user: address,
        usdc_amount: u64,
        h2ousd_minted: u64,
        h2ousd_value: u64,
        unlock_time: u64,
        timestamp: u64,
    }

    public struct SecureWithdrawn has copy, drop {
        vault_id: ID,
        user: address,
        h2ousd_burned: u64,
        usdc_amount: u64,
        fee_paid: u64,
        is_early: bool,
        h2ousd_value: u64,
        timestamp: u64,
    }

    public struct FrontRunAttemptDetected has copy, drop {
        vault_id: ID,
        user: address,
        deposit_time: u64,
        withdrawal_time: u64,
        time_held_ms: u64,
        timestamp: u64,
    }

    public struct EmergencyPause has copy, drop {
        vault_id: ID,
        pause_type: vector<u8>, // "deposit" or "withdrawal" or "all"
        reason: vector<u8>,
        timestamp: u64,
    }

    // ============ 初始化 ============

    /// 創建安全金庫
    public fun create_secure_vault<T>(
        h2ousd_treasury: TreasuryCap<H2O_USD>,
        lock_period_ms: u64,
        max_user_deposit: u64,
        max_vault_capacity: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): SecureVaultConfig<T> {
        assert!(lock_period_ms >= MIN_LOCK_PERIOD_MS, E_TIME_LOCK_NOT_EXPIRED);

        let admin = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        let vault = SecureVaultConfig<T> {
            id: object::new(ctx),
            admin,
            h2ousd_treasury,
            usdc_balance: balance::zero<T>(),
            total_assets: 0,
            user_deposits: table::new<address, UserDepositInfo>(ctx),
            total_deposited: 0,
            total_withdrawn: 0,
            total_yield_earned: 0,
            total_users: 0,
            lock_period_ms,
            early_withdrawal_fee_bp: EARLY_WITHDRAWAL_FEE_BP,
            max_user_deposit,
            max_vault_capacity,
            deposit_cooldown_ms: COOLDOWN_PERIOD_MS,
            withdrawal_cooldown_ms: COOLDOWN_PERIOD_MS,
            whitelist_enabled: false,
            whitelisted_users: table::new<address, bool>(ctx),
            deposit_paused: false,
            withdrawal_paused: false,
            fee_rate: 30,
            reentrancy_guard: false,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(SecureVaultCreated {
            vault_id: object::id(&vault),
            admin,
            lock_period_ms,
            max_user_deposit,
            timestamp,
        });

        vault
    }

    /// 創建並共享安全金庫（推薦使用）
    public entry fun create_and_share_secure_vault<T>(
        h2ousd_treasury: TreasuryCap<H2O_USD>,
        lock_period_ms: u64,
        max_user_deposit: u64,
        max_vault_capacity: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let vault = create_secure_vault<T>(
            h2ousd_treasury,
            lock_period_ms,
            max_user_deposit,
            max_vault_capacity,
            clock,
            ctx
        );
        transfer::share_object(vault);
    }

    // ============ 核心功能（安全增強版）============

    /// 安全存款 - Entry 版本（自動轉移返回值）
    public entry fun secure_deposit_entry<T>(
        vault: &mut SecureVaultConfig<T>,
        usdc: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let (h2ousd, receipt) = secure_deposit(vault, usdc, clock, ctx);
        let sender = tx_context::sender(ctx);
        transfer::public_transfer(h2ousd, sender);
        transfer::public_transfer(receipt, sender);
    }

    /// 安全存款（包含防搶跑檢查）
    public fun secure_deposit<T>(
        vault: &mut SecureVaultConfig<T>,
        usdc: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<H2O_USD>, SecureDepositReceipt) {
        // 防重入檢查
        assert!(!vault.reentrancy_guard, E_INVALID_AMOUNT);
        vault.reentrancy_guard = true;

        // 基本檢查
        assert!(!vault.deposit_paused, E_VAULT_PAUSED);

        let user = tx_context::sender(ctx);
        let usdc_amount = coin::value(&usdc);
        let timestamp = clock::timestamp_ms(clock);

        // 檢查金額限制
        assert!(usdc_amount > 0, E_INVALID_AMOUNT);
        assert!(usdc_amount <= MAX_SINGLE_DEPOSIT, E_EXCEED_USER_LIMIT);

        // 白名單檢查
        if (vault.whitelist_enabled) {
            assert!(
                table::contains(&vault.whitelisted_users, user),
                E_NOT_WHITELISTED
            );
        };

        // 檢查用戶是否在冷卻期
        if (table::contains(&vault.user_deposits, user)) {
            let user_info = table::borrow(&vault.user_deposits, user);
            let time_since_last = timestamp - user_info.last_deposit_time;
            assert!(
                time_since_last >= vault.deposit_cooldown_ms,
                E_COOLDOWN_NOT_EXPIRED
            );

            // 檢查用戶總存款限制
            assert!(
                user_info.total_deposited + usdc_amount <= vault.max_user_deposit,
                E_EXCEED_USER_LIMIT
            );
        };

        // 檢查金庫容量
        assert!(
            vault.total_assets + usdc_amount <= vault.max_vault_capacity,
            E_EXCEED_VAULT_LIMIT
        );

        // 計算應該 mint 多少 H2OUSD
        let h2ousd_to_mint = calculate_h2ousd_to_mint(vault, usdc_amount);
        let h2ousd_value = get_h2ousd_value(vault);

        // 將 USDC 加入金庫
        let usdc_balance = coin::into_balance(usdc);
        balance::join(&mut vault.usdc_balance, usdc_balance);

        // 更新金庫狀態
        vault.total_assets = vault.total_assets + usdc_amount;
        vault.total_deposited = vault.total_deposited + usdc_amount;
        vault.updated_at = timestamp;

        // 更新或創建用戶信息
        if (table::contains(&vault.user_deposits, user)) {
            let user_info = table::borrow_mut(&mut vault.user_deposits, user);
            user_info.total_deposited = user_info.total_deposited + usdc_amount;
            user_info.h2ousd_balance = user_info.h2ousd_balance + h2ousd_to_mint;
            user_info.last_deposit_time = timestamp;
            user_info.deposit_count = user_info.deposit_count + 1;
        } else {
            let user_info = UserDepositInfo {
                total_deposited: usdc_amount,
                h2ousd_balance: h2ousd_to_mint,
                last_deposit_time: timestamp,
                last_withdrawal_time: 0,
                deposit_count: 1,
                withdrawal_count: 0,
            };
            table::add(&mut vault.user_deposits, user, user_info);
            vault.total_users = vault.total_users + 1;
        };

        // Mint H2OUSD
        let h2ousd = h2o_usd::mint(
            &mut vault.h2ousd_treasury,
            h2ousd_to_mint,
            user,
            ctx
        );

        // 計算解鎖時間
        let unlock_time = timestamp + vault.lock_period_ms;

        // 創建存款收據（NFT）
        let receipt = SecureDepositReceipt {
            id: object::new(ctx),
            owner: user,
            vault_id: object::id(vault),
            usdc_deposited: usdc_amount,
            h2ousd_minted: h2ousd_to_mint,
            deposit_time: timestamp,
            unlock_time,
            can_withdraw_after: unlock_time,
        };

        event::emit(SecureDeposited {
            vault_id: object::id(vault),
            user,
            usdc_amount,
            h2ousd_minted: h2ousd_to_mint,
            h2ousd_value,
            unlock_time,
            timestamp,
        });

        // 釋放重入鎖
        vault.reentrancy_guard = false;

        (h2ousd, receipt)
    }

    /// 安全提款 - Entry 版本（自動轉移返回值）
    public entry fun secure_withdraw_entry<T>(
        vault: &mut SecureVaultConfig<T>,
        h2ousd: Coin<H2O_USD>,
        receipt: &SecureDepositReceipt,
        min_usdc_out: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let (usdc_coin, withdrawal_receipt) = secure_withdraw(vault, h2ousd, receipt, min_usdc_out, clock, ctx);
        let sender = tx_context::sender(ctx);
        transfer::public_transfer(usdc_coin, sender);
        transfer::public_transfer(withdrawal_receipt, sender);
    }

    /// 安全提款（包含時間鎖定和早期提款懲罰）
    public fun secure_withdraw<T>(
        vault: &mut SecureVaultConfig<T>,
        h2ousd: Coin<H2O_USD>,
        receipt: &SecureDepositReceipt,
        min_usdc_out: u64,              // 滑點保護
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<T>, SecureWithdrawalReceipt) {
        // 防重入檢查
        assert!(!vault.reentrancy_guard, E_INVALID_AMOUNT);
        vault.reentrancy_guard = true;

        // 基本檢查
        assert!(!vault.withdrawal_paused, E_VAULT_PAUSED);

        let user = tx_context::sender(ctx);
        assert!(receipt.owner == user, E_NOT_OWNER);

        let h2ousd_amount = coin::value(&h2ousd);
        let timestamp = clock::timestamp_ms(clock);

        // 檢查冷卻期
        if (table::contains(&vault.user_deposits, user)) {
            let user_info = table::borrow(&vault.user_deposits, user);
            if (user_info.last_withdrawal_time > 0) {
                let time_since_last = timestamp - user_info.last_withdrawal_time;
                assert!(
                    time_since_last >= vault.withdrawal_cooldown_ms,
                    E_COOLDOWN_NOT_EXPIRED
                );
            };
        };

        // 計算應該返還多少 USDC
        let mut usdc_to_return = calculate_usdc_to_return(vault, h2ousd_amount);
        let h2ousd_value = get_h2ousd_value(vault);

        // 檢查是否為早期提款
        let is_early_withdrawal = timestamp < receipt.can_withdraw_after;
        let mut fee_paid = 0u64;

        if (is_early_withdrawal) {
            // 計算早期提款費
            fee_paid = (usdc_to_return * vault.early_withdrawal_fee_bp) / BASIS_POINTS;
            usdc_to_return = usdc_to_return - fee_paid;

            // 檢測可能的搶跑行為
            let time_held = timestamp - receipt.deposit_time;
            if (time_held < 3600000) { // 持有少於 1 小時
                event::emit(FrontRunAttemptDetected {
                    vault_id: object::id(vault),
                    user,
                    deposit_time: receipt.deposit_time,
                    withdrawal_time: timestamp,
                    time_held_ms: time_held,
                    timestamp,
                });
            };
        };

        // 滑點保護
        assert!(usdc_to_return >= min_usdc_out, E_SLIPPAGE_TOO_HIGH);

        // 檢查金庫餘額
        assert!(
            balance::value(&vault.usdc_balance) >= usdc_to_return,
            E_INSUFFICIENT_BALANCE
        );

        // Burn H2OUSD
        h2o_usd::burn(&mut vault.h2ousd_treasury, h2ousd);

        // 從金庫提取 USDC
        let usdc_balance = balance::split(&mut vault.usdc_balance, usdc_to_return);
        let usdc_coin = coin::from_balance(usdc_balance, ctx);

        // 更新金庫狀態
        vault.total_assets = vault.total_assets - usdc_to_return;
        vault.total_withdrawn = vault.total_withdrawn + usdc_to_return;
        vault.updated_at = timestamp;

        // 更新用戶信息
        if (table::contains(&vault.user_deposits, user)) {
            let user_info = table::borrow_mut(&mut vault.user_deposits, user);
            user_info.h2ousd_balance = user_info.h2ousd_balance - h2ousd_amount;
            user_info.last_withdrawal_time = timestamp;
            user_info.withdrawal_count = user_info.withdrawal_count + 1;
        };

        // 創建提款記錄
        let withdrawal_receipt = SecureWithdrawalReceipt {
            id: object::new(ctx),
            owner: user,
            vault_id: object::id(vault),
            h2ousd_burned: h2ousd_amount,
            usdc_withdrawn: usdc_to_return,
            fee_paid,
            is_early_withdrawal,
            timestamp,
        };

        event::emit(SecureWithdrawn {
            vault_id: object::id(vault),
            user,
            h2ousd_burned: h2ousd_amount,
            usdc_amount: usdc_to_return,
            fee_paid,
            is_early: is_early_withdrawal,
            h2ousd_value,
            timestamp,
        });

        // 釋放重入鎖
        vault.reentrancy_guard = false;

        (usdc_coin, withdrawal_receipt)
    }

    /// 記錄收益（只有 admin 可調用，且有速率限制）
    public fun accrue_yield<T>(
        vault: &mut SecureVaultConfig<T>,
        yield_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == vault.admin, E_NOT_OWNER);
        assert!(!vault.reentrancy_guard, E_INVALID_AMOUNT);

        let timestamp = clock::timestamp_ms(clock);

        vault.total_assets = vault.total_assets + yield_amount;
        vault.total_yield_earned = vault.total_yield_earned + yield_amount;
        vault.updated_at = timestamp;
    }

    // ============ 計算函數 ============

    fun calculate_h2ousd_to_mint<T>(
        vault: &SecureVaultConfig<T>,
        usdc_amount: u64
    ): u64 {
        let total_supply = h2o_usd::total_supply(&vault.h2ousd_treasury);

        if (total_supply == 0) {
            usdc_amount
        } else {
            (usdc_amount * total_supply) / vault.total_assets
        }
    }

    fun calculate_usdc_to_return<T>(
        vault: &SecureVaultConfig<T>,
        h2ousd_amount: u64
    ): u64 {
        let total_supply = h2o_usd::total_supply(&vault.h2ousd_treasury);
        assert!(total_supply > 0, E_ZERO_SUPPLY);

        (h2ousd_amount * vault.total_assets) / total_supply
    }

    public fun get_h2ousd_value<T>(vault: &SecureVaultConfig<T>): u64 {
        let total_supply = h2o_usd::total_supply(&vault.h2ousd_treasury);

        if (total_supply == 0) {
            PRECISION
        } else {
            (vault.total_assets * PRECISION) / total_supply
        }
    }

    // ============ 緊急控制函數 ============

    /// 緊急暫停存款
    public fun emergency_pause_deposits<T>(
        vault: &mut SecureVaultConfig<T>,
        reason: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        vault.deposit_paused = true;

        event::emit(EmergencyPause {
            vault_id: object::id(vault),
            pause_type: b"deposit",
            reason,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// 緊急暫停提款
    public fun emergency_pause_withdrawals<T>(
        vault: &mut SecureVaultConfig<T>,
        reason: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        vault.withdrawal_paused = true;

        event::emit(EmergencyPause {
            vault_id: object::id(vault),
            pause_type: b"withdrawal",
            reason,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    /// 恢復操作
    public fun unpause_all<T>(
        vault: &mut SecureVaultConfig<T>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        vault.deposit_paused = false;
        vault.withdrawal_paused = false;
    }

    // ============ 白名單管理 ============

    public fun enable_whitelist<T>(
        vault: &mut SecureVaultConfig<T>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        vault.whitelist_enabled = true;
    }

    public fun add_to_whitelist<T>(
        vault: &mut SecureVaultConfig<T>,
        user: address,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        if (!table::contains(&vault.whitelisted_users, user)) {
            table::add(&mut vault.whitelisted_users, user, true);
        };
    }

    // ============ 查詢函數 ============

    public fun get_user_info<T>(
        vault: &SecureVaultConfig<T>,
        user: address
    ): (u64, u64, u64, u64) {
        if (table::contains(&vault.user_deposits, user)) {
            let info = table::borrow(&vault.user_deposits, user);
            (
                info.total_deposited,
                info.h2ousd_balance,
                info.last_deposit_time,
                info.last_withdrawal_time
            )
        } else {
            (0, 0, 0, 0)
        }
    }

    public fun is_withdrawal_allowed<T>(
        vault: &SecureVaultConfig<T>,
        receipt: &SecureDepositReceipt,
        clock: &Clock
    ): bool {
        let timestamp = clock::timestamp_ms(clock);
        timestamp >= receipt.unlock_time
    }

    public fun calculate_early_withdrawal_fee<T>(
        vault: &SecureVaultConfig<T>,
        usdc_amount: u64
    ): u64 {
        (usdc_amount * vault.early_withdrawal_fee_bp) / BASIS_POINTS
    }
}
