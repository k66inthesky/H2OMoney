/// H2O Smart DCA - 主金庫合約 V2
/// 使用 H2OUSD Receipt Token 模式
/// 用戶存入 USDC，獲得 H2OUSD 代幣作為收據
/// H2OUSD 價值 = (金庫總資產 / H2OUSD 總供應量)
module h2o_smart_dca::h2o_vault_v2 {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::event;
    use h2o_smart_dca::h2o_usd::{Self, H2O_USD};

    // ============ 錯誤碼 ============
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_VAULT_PAUSED: u64 = 4;
    const E_ZERO_SUPPLY: u64 = 5;
    const E_INSUFFICIENT_H2OUSD: u64 = 6;

    // ============ 常數 ============
    const PRECISION: u64 = 1_000_000; // 6 decimals

    // ============ 結構 ============

    /// 全局金庫配置
    public struct VaultConfig<phantom T> has key {
        id: UID,
        admin: address,

        // H2OUSD Treasury Cap（控制 mint/burn）
        h2ousd_treasury: TreasuryCap<H2O_USD>,

        // 金庫資產
        usdc_balance: Balance<T>,           // 金庫持有的 USDC
        total_assets: u64,                   // 總資產（包括投資在 CLMM 的）

        // 統計數據
        total_deposited: u64,                // 累計存入
        total_withdrawn: u64,                // 累計提取
        total_yield_earned: u64,             // 累計收益
        total_users: u64,

        // 設定
        fee_rate: u64,                       // 費率（basis points）
        is_paused: bool,

        created_at: u64,
        updated_at: u64,
    }

    /// 用戶存款記錄（用於追蹤）
    public struct DepositRecord has key, store {
        id: UID,
        owner: address,
        vault_id: ID,
        usdc_deposited: u64,
        h2ousd_minted: u64,
        timestamp: u64,
    }

    /// 提款記錄
    public struct WithdrawRecord has key, store {
        id: UID,
        owner: address,
        vault_id: ID,
        h2ousd_burned: u64,
        usdc_withdrawn: u64,
        timestamp: u64,
    }

    // ============ 事件 ============

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        admin: address,
        timestamp: u64,
    }

    public struct Deposited has copy, drop {
        vault_id: ID,
        user: address,
        usdc_amount: u64,
        h2ousd_minted: u64,
        h2ousd_value: u64,          // 當時 1 H2OUSD 的價值
        timestamp: u64,
    }

    public struct Withdrawn has copy, drop {
        vault_id: ID,
        user: address,
        h2ousd_burned: u64,
        usdc_amount: u64,
        h2ousd_value: u64,          // 當時 1 H2OUSD 的價值
        timestamp: u64,
    }

    public struct YieldAccrued has copy, drop {
        vault_id: ID,
        yield_amount: u64,
        new_total_assets: u64,
        new_h2ousd_value: u64,
        timestamp: u64,
    }

    // ============ 初始化 ============

    /// 創建新的金庫
    /// 需要先創建 H2OUSD 代幣並傳入 TreasuryCap
    public fun create_vault<T>(
        h2ousd_treasury: TreasuryCap<H2O_USD>,
        clock: &Clock,
        ctx: &mut TxContext
    ): VaultConfig<T> {
        let admin = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        let vault = VaultConfig<T> {
            id: object::new(ctx),
            admin,
            h2ousd_treasury,
            usdc_balance: balance::zero<T>(),
            total_assets: 0,
            total_deposited: 0,
            total_withdrawn: 0,
            total_yield_earned: 0,
            total_users: 0,
            fee_rate: 30, // 0.3%
            is_paused: false,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(VaultCreated {
            vault_id: object::id(&vault),
            admin,
            timestamp,
        });

        vault
    }

    // ============ 核心功能 ============

    /// 存入 USDC，獲得 H2OUSD
    /// H2OUSD 數量 = USDC 數量 / 當前 H2OUSD 價值
    public fun deposit<T>(
        vault: &mut VaultConfig<T>,
        usdc: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<H2O_USD>, DepositRecord) {
        assert!(!vault.is_paused, E_VAULT_PAUSED);

        let user = tx_context::sender(ctx);
        let usdc_amount = coin::value(&usdc);
        assert!(usdc_amount > 0, E_INVALID_AMOUNT);

        let timestamp = clock::timestamp_ms(clock);

        // 計算應該 mint 多少 H2OUSD
        let h2ousd_to_mint = calculate_h2ousd_to_mint(vault, usdc_amount);

        // 記錄當前 H2OUSD 價值（用於事件）
        let h2ousd_value = get_h2ousd_value(vault);

        // 將 USDC 加入金庫
        let usdc_balance = coin::into_balance(usdc);
        balance::join(&mut vault.usdc_balance, usdc_balance);

        // 更新總資產
        vault.total_assets = vault.total_assets + usdc_amount;
        vault.total_deposited = vault.total_deposited + usdc_amount;
        vault.updated_at = timestamp;

        // Mint H2OUSD 給用戶
        let h2ousd = h2o_usd::mint(
            &mut vault.h2ousd_treasury,
            h2ousd_to_mint,
            user,
            ctx
        );

        // 創建存款記錄
        let record = DepositRecord {
            id: object::new(ctx),
            owner: user,
            vault_id: object::id(vault),
            usdc_deposited: usdc_amount,
            h2ousd_minted: h2ousd_to_mint,
            timestamp,
        };

        event::emit(Deposited {
            vault_id: object::id(vault),
            user,
            usdc_amount,
            h2ousd_minted: h2ousd_to_mint,
            h2ousd_value,
            timestamp,
        });

        (h2ousd, record)
    }

    /// 提取 USDC，銷毀 H2OUSD
    /// USDC 數量 = H2OUSD 數量 * 當前 H2OUSD 價值
    public fun withdraw<T>(
        vault: &mut VaultConfig<T>,
        h2ousd: Coin<H2O_USD>,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<T>, WithdrawRecord) {
        assert!(!vault.is_paused, E_VAULT_PAUSED);

        let user = tx_context::sender(ctx);
        let h2ousd_amount = coin::value(&h2ousd);
        assert!(h2ousd_amount > 0, E_INVALID_AMOUNT);

        let timestamp = clock::timestamp_ms(clock);

        // 計算應該返還多少 USDC
        let usdc_to_return = calculate_usdc_to_return(vault, h2ousd_amount);

        // 檢查金庫是否有足夠的 USDC
        assert!(balance::value(&vault.usdc_balance) >= usdc_to_return, E_INSUFFICIENT_BALANCE);

        // 記錄當前 H2OUSD 價值
        let h2ousd_value = get_h2ousd_value(vault);

        // Burn H2OUSD
        h2o_usd::burn(&mut vault.h2ousd_treasury, h2ousd);

        // 從金庫提取 USDC
        let usdc_balance = balance::split(&mut vault.usdc_balance, usdc_to_return);
        let usdc_coin = coin::from_balance(usdc_balance, ctx);

        // 更新總資產
        vault.total_assets = vault.total_assets - usdc_to_return;
        vault.total_withdrawn = vault.total_withdrawn + usdc_to_return;
        vault.updated_at = timestamp;

        // 創建提款記錄
        let record = WithdrawRecord {
            id: object::new(ctx),
            owner: user,
            vault_id: object::id(vault),
            h2ousd_burned: h2ousd_amount,
            usdc_withdrawn: usdc_to_return,
            timestamp,
        };

        event::emit(Withdrawn {
            vault_id: object::id(vault),
            user,
            h2ousd_burned: h2ousd_amount,
            usdc_amount: usdc_to_return,
            h2ousd_value,
            timestamp,
        });

        (usdc_coin, record)
    }

    /// 記錄收益（由 keeper 或 admin 調用）
    /// 當金庫從 CLMM 或其他來源賺取收益時調用
    public fun accrue_yield<T>(
        vault: &mut VaultConfig<T>,
        yield_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(sender == vault.admin, E_NOT_OWNER);

        let timestamp = clock::timestamp_ms(clock);

        // 更新總資產（增加收益）
        vault.total_assets = vault.total_assets + yield_amount;
        vault.total_yield_earned = vault.total_yield_earned + yield_amount;
        vault.updated_at = timestamp;

        let new_h2ousd_value = get_h2ousd_value(vault);

        event::emit(YieldAccrued {
            vault_id: object::id(vault),
            yield_amount,
            new_total_assets: vault.total_assets,
            new_h2ousd_value,
            timestamp,
        });
    }

    // ============ 計算函數 ============

    /// 計算應該 mint 多少 H2OUSD
    /// 如果是第一次存款，1:1 mint
    /// 否則：H2OUSD = USDC / (總資產 / 總供應量)
    fun calculate_h2ousd_to_mint<T>(
        vault: &VaultConfig<T>,
        usdc_amount: u64
    ): u64 {
        let total_supply = h2o_usd::total_supply(&vault.h2ousd_treasury);

        if (total_supply == 0) {
            // 第一次存款，1:1 mint
            usdc_amount
        } else {
            // H2OUSD = USDC * (總供應量 / 總資產)
            let h2ousd_amount = (usdc_amount * total_supply) / vault.total_assets;
            h2ousd_amount
        }
    }

    /// 計算應該返還多少 USDC
    /// USDC = H2OUSD * (總資產 / 總供應量)
    fun calculate_usdc_to_return<T>(
        vault: &VaultConfig<T>,
        h2ousd_amount: u64
    ): u64 {
        let total_supply = h2o_usd::total_supply(&vault.h2ousd_treasury);
        assert!(total_supply > 0, E_ZERO_SUPPLY);

        // USDC = H2OUSD * (總資產 / 總供應量)
        let usdc_amount = (h2ousd_amount * vault.total_assets) / total_supply;
        usdc_amount
    }

    /// 獲取當前 1 H2OUSD 的價值（以 USDC 計）
    /// 價值 = 總資產 / 總供應量
    public fun get_h2ousd_value<T>(vault: &VaultConfig<T>): u64 {
        let total_supply = h2o_usd::total_supply(&vault.h2ousd_treasury);

        if (total_supply == 0) {
            // 還沒有人存款，價值為 1.0 USDC
            PRECISION
        } else {
            // 價值 = 總資產 / 總供應量
            (vault.total_assets * PRECISION) / total_supply
        }
    }

    // ============ 查詢函數 ============

    public fun get_total_assets<T>(vault: &VaultConfig<T>): u64 {
        vault.total_assets
    }

    public fun get_total_supply<T>(vault: &VaultConfig<T>): u64 {
        h2o_usd::total_supply(&vault.h2ousd_treasury)
    }

    public fun get_usdc_balance<T>(vault: &VaultConfig<T>): u64 {
        balance::value(&vault.usdc_balance)
    }

    public fun get_total_deposited<T>(vault: &VaultConfig<T>): u64 {
        vault.total_deposited
    }

    public fun get_total_yield_earned<T>(vault: &VaultConfig<T>): u64 {
        vault.total_yield_earned
    }

    public fun is_paused<T>(vault: &VaultConfig<T>): bool {
        vault.is_paused
    }

    // ============ 管理函數 ============

    public fun pause<T>(vault: &mut VaultConfig<T>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        vault.is_paused = true;
    }

    public fun unpause<T>(vault: &mut VaultConfig<T>, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == vault.admin, E_NOT_OWNER);
        vault.is_paused = false;
    }

    // ============ 測試 ============

    #[test_only]
    use std::option;
}
