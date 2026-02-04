/// H2O Smart DCA - 主金庫合約
/// 管理用戶存款、H2OUSD 轉換、收益追蹤
module h2o_smart_dca::h2o_vault {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};

    // ============ 錯誤碼 ============
    const E_INSUFFICIENT_BALANCE: u64 = 1;
    const E_INVALID_AMOUNT: u64 = 2;
    const E_NOT_OWNER: u64 = 3;
    const E_VAULT_PAUSED: u64 = 4;

    // ============ 常數 ============
    const BASIS_POINTS: u64 = 10000;

    // ============ 結構 ============

    /// 全局金庫配置
    public struct VaultConfig has key {
        id: UID,
        admin: address,
        total_deposited: u64,
        total_users: u64,
        fee_rate: u64,  // 以 basis points 計算，如 30 = 0.3%
        is_paused: bool,
    }

    /// 用戶金庫
    public struct UserVault<phantom T> has key, store {
        id: UID,
        owner: address,
        balance: Balance<T>,
        h2o_usd_balance: u64,     // H2OUSD 餘額（追蹤用）
        total_deposited: u64,     // 累計存入
        total_yield_earned: u64,  // 累計收益
        created_at: u64,
        updated_at: u64,
    }

    /// 金庫收據（存款證明）
    public struct VaultReceipt has key, store {
        id: UID,
        vault_id: ID,
        owner: address,
        amount: u64,
        h2o_usd_amount: u64,
        timestamp: u64,
    }

    // ============ 事件 ============

    public struct VaultCreated has copy, drop {
        vault_id: ID,
        owner: address,
        timestamp: u64,
    }

    public struct Deposited has copy, drop {
        vault_id: ID,
        owner: address,
        amount: u64,
        h2o_usd_minted: u64,
        timestamp: u64,
    }

    public struct Withdrawn has copy, drop {
        vault_id: ID,
        owner: address,
        amount: u64,
        h2o_usd_burned: u64,
        timestamp: u64,
    }

    public struct YieldAccrued has copy, drop {
        vault_id: ID,
        yield_amount: u64,
        new_balance: u64,
        timestamp: u64,
    }

    // ============ 初始化 ============

    fun init(ctx: &mut TxContext) {
        let config = VaultConfig {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            total_deposited: 0,
            total_users: 0,
            fee_rate: 30, // 0.3% 費率
            is_paused: false,
        };
        transfer::share_object(config);
    }

    // ============ 公開函數 ============

    /// 建立新的用戶金庫
    public fun create_vault<T>(
        clock: &Clock,
        ctx: &mut TxContext
    ): UserVault<T> {
        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        let vault = UserVault<T> {
            id: object::new(ctx),
            owner: sender,
            balance: balance::zero<T>(),
            h2o_usd_balance: 0,
            total_deposited: 0,
            total_yield_earned: 0,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(VaultCreated {
            vault_id: object::id(&vault),
            owner: sender,
            timestamp,
        });

        vault
    }

    /// 存入資金到金庫
    public fun deposit<T>(
        vault: &mut UserVault<T>,
        coin: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ): VaultReceipt {
        let sender = tx_context::sender(ctx);
        assert!(vault.owner == sender, E_NOT_OWNER);

        let amount = coin::value(&coin);
        assert!(amount > 0, E_INVALID_AMOUNT);

        let timestamp = clock::timestamp_ms(clock);

        // 將 coin 轉入金庫
        let coin_balance = coin::into_balance(coin);
        balance::join(&mut vault.balance, coin_balance);

        // 1:1 mint H2OUSD（簡化版本，實際需對接 StableLayer）
        let h2o_usd_amount = amount;
        vault.h2o_usd_balance = vault.h2o_usd_balance + h2o_usd_amount;
        vault.total_deposited = vault.total_deposited + amount;
        vault.updated_at = timestamp;

        event::emit(Deposited {
            vault_id: object::id(vault),
            owner: sender,
            amount,
            h2o_usd_minted: h2o_usd_amount,
            timestamp,
        });

        // 返回收據
        VaultReceipt {
            id: object::new(ctx),
            vault_id: object::id(vault),
            owner: sender,
            amount,
            h2o_usd_amount,
            timestamp,
        }
    }

    /// 從金庫提取資金
    public fun withdraw<T>(
        vault: &mut UserVault<T>,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<T> {
        let sender = tx_context::sender(ctx);
        assert!(vault.owner == sender, E_NOT_OWNER);
        assert!(balance::value(&vault.balance) >= amount, E_INSUFFICIENT_BALANCE);

        let timestamp = clock::timestamp_ms(clock);

        // 計算要 burn 的 H2OUSD
        let h2o_usd_to_burn = amount;
        assert!(vault.h2o_usd_balance >= h2o_usd_to_burn, E_INSUFFICIENT_BALANCE);

        // 更新狀態
        vault.h2o_usd_balance = vault.h2o_usd_balance - h2o_usd_to_burn;
        vault.updated_at = timestamp;

        event::emit(Withdrawn {
            vault_id: object::id(vault),
            owner: sender,
            amount,
            h2o_usd_burned: h2o_usd_to_burn,
            timestamp,
        });

        // 提取資金
        let withdrawn_balance = balance::split(&mut vault.balance, amount);
        coin::from_balance(withdrawn_balance, ctx)
    }

    /// 記錄收益（由 keeper 調用）
    public fun accrue_yield<T>(
        vault: &mut UserVault<T>,
        yield_amount: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let timestamp = clock::timestamp_ms(clock);

        vault.h2o_usd_balance = vault.h2o_usd_balance + yield_amount;
        vault.total_yield_earned = vault.total_yield_earned + yield_amount;
        vault.updated_at = timestamp;

        event::emit(YieldAccrued {
            vault_id: object::id(vault),
            yield_amount,
            new_balance: vault.h2o_usd_balance,
            timestamp,
        });
    }

    // ============ 查詢函數 ============

    public fun get_balance<T>(vault: &UserVault<T>): u64 {
        balance::value(&vault.balance)
    }

    public fun get_h2o_usd_balance<T>(vault: &UserVault<T>): u64 {
        vault.h2o_usd_balance
    }

    public fun get_owner<T>(vault: &UserVault<T>): address {
        vault.owner
    }

    public fun get_total_deposited<T>(vault: &UserVault<T>): u64 {
        vault.total_deposited
    }

    public fun get_total_yield_earned<T>(vault: &UserVault<T>): u64 {
        vault.total_yield_earned
    }

    // ============ 測試 ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
