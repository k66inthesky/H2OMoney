/// H2O Smart DCA - 收益優化器
/// 管理 BrandUSD 轉換、CLMM LP 操作、自動重置
module h2o_smart_dca::yield_optimizer {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};

    // ============ 錯誤碼 ============
    const E_NOT_AUTHORIZED: u64 = 1;
    const E_INSUFFICIENT_BALANCE: u64 = 2;
    const E_REBALANCE_TOO_SOON: u64 = 3;
    const E_INVALID_RANGE: u64 = 4;
    const E_POSITION_NOT_FOUND: u64 = 5;

    // ============ 常數 ============
    const MIN_REBALANCE_INTERVAL_MS: u64 = 3600000; // 1 小時
    const BASIS_POINTS: u64 = 10000;
    const PRICE_PRECISION: u64 = 1_000_000;

    // ============ 結構 ============

    /// CLMM 流動性位置
    public struct CLMMPosition has key, store {
        id: UID,
        owner: address,
        vault_id: ID,
        pool_id: ID,                   // Cetus CLMM Pool ID

        // 區間設定
        tick_lower: u64,
        tick_upper: u64,

        // 流動性數據
        liquidity: u128,
        token_a_amount: u64,
        token_b_amount: u64,

        // 收益追蹤
        fees_earned_a: u64,
        fees_earned_b: u64,

        // 重置紀錄
        last_rebalance_time: u64,
        rebalance_count: u64,

        created_at: u64,
        updated_at: u64,
    }

    /// 收益優化配置
    public struct OptimizerConfig has key {
        id: UID,
        admin: address,

        // 重置參數
        rebalance_threshold: u64,      // 觸發重置的偏移閾值（basis points）
        min_rebalance_interval: u64,   // 最小重置間隔

        // 費用設定
        keeper_reward_rate: u64,       // Keeper 獎勵比例

        // 統計
        total_rebalances: u64,
        total_fees_collected: u64,
    }

    // ============ 事件 ============

    public struct CLMMPositionCreated has copy, drop {
        position_id: ID,
        owner: address,
        pool_id: ID,
        tick_lower: u64,
        tick_upper: u64,
        liquidity: u128,
        timestamp: u64,
    }

    public struct LiquidityAdded has copy, drop {
        position_id: ID,
        token_a_added: u64,
        token_b_added: u64,
        liquidity_delta: u128,
        timestamp: u64,
    }

    public struct LiquidityRemoved has copy, drop {
        position_id: ID,
        token_a_removed: u64,
        token_b_removed: u64,
        liquidity_delta: u128,
        timestamp: u64,
    }

    public struct PositionRebalanced has copy, drop {
        position_id: ID,
        old_tick_lower: u64,
        old_tick_upper: u64,
        new_tick_lower: u64,
        new_tick_upper: u64,
        fees_collected_a: u64,
        fees_collected_b: u64,
        timestamp: u64,
    }

    public struct FeesCollected has copy, drop {
        position_id: ID,
        fees_a: u64,
        fees_b: u64,
        timestamp: u64,
    }

    // ============ 初始化 ============

    fun init(ctx: &mut TxContext) {
        let config = OptimizerConfig {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            rebalance_threshold: 500,     // 5% 偏移觸發重置
            min_rebalance_interval: MIN_REBALANCE_INTERVAL_MS,
            keeper_reward_rate: 100,      // 1% keeper 獎勵
            total_rebalances: 0,
            total_fees_collected: 0,
        };
        transfer::share_object(config);
    }

    // ============ 公開函數 ============

    /// 建立 CLMM 流動性位置
    public fun create_clmm_position(
        vault_id: ID,
        pool_id: ID,
        tick_lower: u64,
        tick_upper: u64,
        initial_liquidity: u128,
        token_a_amount: u64,
        token_b_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): CLMMPosition {
        assert!(tick_lower < tick_upper, E_INVALID_RANGE);

        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        let position = CLMMPosition {
            id: object::new(ctx),
            owner: sender,
            vault_id,
            pool_id,
            tick_lower,
            tick_upper,
            liquidity: initial_liquidity,
            token_a_amount,
            token_b_amount,
            fees_earned_a: 0,
            fees_earned_b: 0,
            last_rebalance_time: timestamp,
            rebalance_count: 0,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(CLMMPositionCreated {
            position_id: object::id(&position),
            owner: sender,
            pool_id,
            tick_lower,
            tick_upper,
            liquidity: initial_liquidity,
            timestamp,
        });

        position
    }

    /// 增加流動性
    public fun add_liquidity(
        position: &mut CLMMPosition,
        token_a_amount: u64,
        token_b_amount: u64,
        liquidity_delta: u128,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(position.owner == sender, E_NOT_AUTHORIZED);

        let timestamp = clock::timestamp_ms(clock);

        position.token_a_amount = position.token_a_amount + token_a_amount;
        position.token_b_amount = position.token_b_amount + token_b_amount;
        position.liquidity = position.liquidity + liquidity_delta;
        position.updated_at = timestamp;

        event::emit(LiquidityAdded {
            position_id: object::id(position),
            token_a_added: token_a_amount,
            token_b_added: token_b_amount,
            liquidity_delta,
            timestamp,
        });
    }

    /// 移除流動性
    public fun remove_liquidity(
        position: &mut CLMMPosition,
        liquidity_delta: u128,
        clock: &Clock,
        ctx: &mut TxContext
    ): (u64, u64) {
        let sender = tx_context::sender(ctx);
        assert!(position.owner == sender, E_NOT_AUTHORIZED);
        assert!(position.liquidity >= liquidity_delta, E_INSUFFICIENT_BALANCE);

        let timestamp = clock::timestamp_ms(clock);

        // 計算移除的代幣數量（按比例）
        let ratio = (liquidity_delta * (PRICE_PRECISION as u128)) / position.liquidity;
        let token_a_removed = ((position.token_a_amount as u128) * ratio / (PRICE_PRECISION as u128)) as u64;
        let token_b_removed = ((position.token_b_amount as u128) * ratio / (PRICE_PRECISION as u128)) as u64;

        position.token_a_amount = position.token_a_amount - token_a_removed;
        position.token_b_amount = position.token_b_amount - token_b_removed;
        position.liquidity = position.liquidity - liquidity_delta;
        position.updated_at = timestamp;

        event::emit(LiquidityRemoved {
            position_id: object::id(position),
            token_a_removed,
            token_b_removed,
            liquidity_delta,
            timestamp,
        });

        (token_a_removed, token_b_removed)
    }

    /// 重置區間（Rebalance）
    public fun rebalance(
        position: &mut CLMMPosition,
        config: &mut OptimizerConfig,
        new_tick_lower: u64,
        new_tick_upper: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(new_tick_lower < new_tick_upper, E_INVALID_RANGE);

        let timestamp = clock::timestamp_ms(clock);

        // 檢查重置間隔
        assert!(
            timestamp >= position.last_rebalance_time + config.min_rebalance_interval,
            E_REBALANCE_TOO_SOON
        );

        let old_tick_lower = position.tick_lower;
        let old_tick_upper = position.tick_upper;

        // 收集當前費用
        let fees_a = position.fees_earned_a;
        let fees_b = position.fees_earned_b;

        // 更新位置
        position.tick_lower = new_tick_lower;
        position.tick_upper = new_tick_upper;
        position.fees_earned_a = 0;
        position.fees_earned_b = 0;
        position.last_rebalance_time = timestamp;
        position.rebalance_count = position.rebalance_count + 1;
        position.updated_at = timestamp;

        // 更新全局統計
        config.total_rebalances = config.total_rebalances + 1;
        config.total_fees_collected = config.total_fees_collected + fees_a + fees_b;

        event::emit(PositionRebalanced {
            position_id: object::id(position),
            old_tick_lower,
            old_tick_upper,
            new_tick_lower,
            new_tick_upper,
            fees_collected_a: fees_a,
            fees_collected_b: fees_b,
            timestamp,
        });
    }

    /// 收集手續費
    public fun collect_fees(
        position: &mut CLMMPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ): (u64, u64) {
        let sender = tx_context::sender(ctx);
        assert!(position.owner == sender, E_NOT_AUTHORIZED);

        let timestamp = clock::timestamp_ms(clock);
        let fees_a = position.fees_earned_a;
        let fees_b = position.fees_earned_b;

        position.fees_earned_a = 0;
        position.fees_earned_b = 0;
        position.updated_at = timestamp;

        event::emit(FeesCollected {
            position_id: object::id(position),
            fees_a,
            fees_b,
            timestamp,
        });

        (fees_a, fees_b)
    }

    /// 記錄費用（由外部調用，模擬費用累積）
    public fun accrue_fees(
        position: &mut CLMMPosition,
        fees_a: u64,
        fees_b: u64,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let timestamp = clock::timestamp_ms(clock);

        position.fees_earned_a = position.fees_earned_a + fees_a;
        position.fees_earned_b = position.fees_earned_b + fees_b;
        position.updated_at = timestamp;
    }

    // ============ 查詢函數 ============

    public fun get_liquidity(position: &CLMMPosition): u128 {
        position.liquidity
    }

    public fun get_tick_range(position: &CLMMPosition): (u64, u64) {
        (position.tick_lower, position.tick_upper)
    }

    public fun get_token_amounts(position: &CLMMPosition): (u64, u64) {
        (position.token_a_amount, position.token_b_amount)
    }

    public fun get_fees_earned(position: &CLMMPosition): (u64, u64) {
        (position.fees_earned_a, position.fees_earned_b)
    }

    public fun get_rebalance_count(position: &CLMMPosition): u64 {
        position.rebalance_count
    }

    public fun get_last_rebalance_time(position: &CLMMPosition): u64 {
        position.last_rebalance_time
    }

    public fun needs_rebalance(
        position: &CLMMPosition,
        current_tick: u64,
        config: &OptimizerConfig
    ): bool {
        let range = position.tick_upper - position.tick_lower;
        let threshold = (range * config.rebalance_threshold) / BASIS_POINTS;

        // 如果當前 tick 接近邊界，需要重置
        current_tick <= position.tick_lower + threshold ||
        current_tick >= position.tick_upper - threshold
    }

    // ============ 測試 ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }
}
