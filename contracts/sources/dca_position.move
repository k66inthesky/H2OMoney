/// H2O Smart DCA - DCA 倉位管理
/// 管理定投倉位的建立、執行、暫停、關閉
module h2o_smart_dca::dca_position {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::vec_map::{Self, VecMap};

    // ============ 錯誤碼 ============
    const E_NOT_OWNER: u64 = 1;
    const E_POSITION_NOT_ACTIVE: u64 = 2;
    const E_POSITION_ALREADY_PAUSED: u64 = 3;
    const E_POSITION_NOT_PAUSED: u64 = 4;
    const E_INVALID_AMOUNT: u64 = 5;
    const E_INVALID_INTERVAL: u64 = 6;
    const E_NOT_YET_EXECUTABLE: u64 = 7;
    const E_ALL_PERIODS_EXECUTED: u64 = 8;

    // ============ 常數 ============
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PAUSED: u8 = 1;
    const STATUS_COMPLETED: u8 = 2;
    const STATUS_CLOSED: u8 = 3;

    const STRATEGY_FIXED: u8 = 0;
    const STRATEGY_LIMIT: u8 = 1;
    const STRATEGY_VALUE_AVG: u8 = 2;
    const STRATEGY_MULTI_TOKEN: u8 = 3;

    // ============ 結構 ============

    /// DCA 倉位
    public struct DCAPosition has key, store {
        id: UID,
        owner: address,
        vault_id: ID,                  // 關聯的金庫 ID

        // 定投參數
        source_token: vector<u8>,      // 投入代幣類型名稱
        target_tokens: VecMap<vector<u8>, u64>, // 目標代幣 -> 百分比
        amount_per_period: u64,        // 每期金額
        interval_ms: u64,              // 間隔（毫秒）
        total_periods: u64,            // 總期數
        executed_periods: u64,         // 已執行期數
        next_execution_time: u64,      // 下次執行時間

        // 策略
        strategy: u8,
        limit_price: u64,              // 限價（可選，0 表示不限價）

        // 統計
        total_invested: u64,
        total_acquired: u64,
        average_price: u64,

        // 狀態
        status: u8,
        created_at: u64,
        updated_at: u64,
    }

    /// DCA 執行紀錄
    public struct ExecutionRecord has key, store {
        id: UID,
        position_id: ID,
        period_number: u64,
        amount_spent: u64,
        amount_received: u64,
        price: u64,
        timestamp: u64,
    }

    // ============ 事件 ============

    public struct PositionCreated has copy, drop {
        position_id: ID,
        owner: address,
        vault_id: ID,
        amount_per_period: u64,
        total_periods: u64,
        strategy: u8,
        timestamp: u64,
    }

    public struct DCAExecuted has copy, drop {
        position_id: ID,
        period_number: u64,
        amount_spent: u64,
        amount_received: u64,
        price: u64,
        timestamp: u64,
    }

    public struct PositionPaused has copy, drop {
        position_id: ID,
        timestamp: u64,
    }

    public struct PositionResumed has copy, drop {
        position_id: ID,
        next_execution_time: u64,
        timestamp: u64,
    }

    public struct PositionClosed has copy, drop {
        position_id: ID,
        total_invested: u64,
        total_acquired: u64,
        timestamp: u64,
    }

    // ============ 公開函數 ============

    /// 建立新的 DCA 倉位
    public fun create_position(
        vault_id: ID,
        source_token: vector<u8>,
        target_token: vector<u8>,
        amount_per_period: u64,
        interval_ms: u64,
        total_periods: u64,
        strategy: u8,
        limit_price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): DCAPosition {
        assert!(amount_per_period > 0, E_INVALID_AMOUNT);
        assert!(interval_ms > 0, E_INVALID_INTERVAL);

        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        // 建立目標代幣映射（單一代幣 100%）
        let mut target_tokens = vec_map::empty<vector<u8>, u64>();
        vec_map::insert(&mut target_tokens, target_token, 100);

        let position = DCAPosition {
            id: object::new(ctx),
            owner: sender,
            vault_id,
            source_token,
            target_tokens,
            amount_per_period,
            interval_ms,
            total_periods,
            executed_periods: 0,
            next_execution_time: timestamp + interval_ms,
            strategy,
            limit_price,
            total_invested: 0,
            total_acquired: 0,
            average_price: 0,
            status: STATUS_ACTIVE,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(PositionCreated {
            position_id: object::id(&position),
            owner: sender,
            vault_id,
            amount_per_period,
            total_periods,
            strategy,
            timestamp,
        });

        position
    }

    /// 建立多幣種 DCA 倉位
    public fun create_multi_token_position(
        vault_id: ID,
        source_token: vector<u8>,
        target_tokens: VecMap<vector<u8>, u64>,
        amount_per_period: u64,
        interval_ms: u64,
        total_periods: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): DCAPosition {
        assert!(amount_per_period > 0, E_INVALID_AMOUNT);
        assert!(interval_ms > 0, E_INVALID_INTERVAL);

        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        let position = DCAPosition {
            id: object::new(ctx),
            owner: sender,
            vault_id,
            source_token,
            target_tokens,
            amount_per_period,
            interval_ms,
            total_periods,
            executed_periods: 0,
            next_execution_time: timestamp + interval_ms,
            strategy: STRATEGY_MULTI_TOKEN,
            limit_price: 0,
            total_invested: 0,
            total_acquired: 0,
            average_price: 0,
            status: STATUS_ACTIVE,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(PositionCreated {
            position_id: object::id(&position),
            owner: sender,
            vault_id,
            amount_per_period,
            total_periods,
            strategy: STRATEGY_MULTI_TOKEN,
            timestamp,
        });

        position
    }

    /// 執行 DCA（由 keeper 調用）
    public fun execute_dca(
        position: &mut DCAPosition,
        amount_received: u64,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ExecutionRecord {
        assert!(position.status == STATUS_ACTIVE, E_POSITION_NOT_ACTIVE);
        assert!(position.executed_periods < position.total_periods, E_ALL_PERIODS_EXECUTED);

        let timestamp = clock::timestamp_ms(clock);
        assert!(timestamp >= position.next_execution_time, E_NOT_YET_EXECUTABLE);

        let period_number = position.executed_periods + 1;
        let amount_spent = position.amount_per_period;

        // 更新統計
        position.total_invested = position.total_invested + amount_spent;
        position.total_acquired = position.total_acquired + amount_received;
        position.executed_periods = period_number;

        // 計算平均價格
        if (position.total_acquired > 0) {
            position.average_price = (position.total_invested * 1_000_000) / position.total_acquired;
        };

        // 更新下次執行時間或標記完成
        if (position.executed_periods >= position.total_periods) {
            position.status = STATUS_COMPLETED;
        } else {
            position.next_execution_time = timestamp + position.interval_ms;
        };

        position.updated_at = timestamp;

        event::emit(DCAExecuted {
            position_id: object::id(position),
            period_number,
            amount_spent,
            amount_received,
            price,
            timestamp,
        });

        ExecutionRecord {
            id: object::new(ctx),
            position_id: object::id(position),
            period_number,
            amount_spent,
            amount_received,
            price,
            timestamp,
        }
    }

    /// 暫停 DCA 倉位
    public fun pause_position(
        position: &mut DCAPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(position.owner == sender, E_NOT_OWNER);
        assert!(position.status == STATUS_ACTIVE, E_POSITION_NOT_ACTIVE);

        let timestamp = clock::timestamp_ms(clock);
        position.status = STATUS_PAUSED;
        position.updated_at = timestamp;

        event::emit(PositionPaused {
            position_id: object::id(position),
            timestamp,
        });
    }

    /// 恢復 DCA 倉位
    public fun resume_position(
        position: &mut DCAPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(position.owner == sender, E_NOT_OWNER);
        assert!(position.status == STATUS_PAUSED, E_POSITION_NOT_PAUSED);

        let timestamp = clock::timestamp_ms(clock);
        position.status = STATUS_ACTIVE;
        position.next_execution_time = timestamp + position.interval_ms;
        position.updated_at = timestamp;

        event::emit(PositionResumed {
            position_id: object::id(position),
            next_execution_time: position.next_execution_time,
            timestamp,
        });
    }

    /// 關閉 DCA 倉位
    public fun close_position(
        position: &mut DCAPosition,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(position.owner == sender, E_NOT_OWNER);

        let timestamp = clock::timestamp_ms(clock);

        event::emit(PositionClosed {
            position_id: object::id(position),
            total_invested: position.total_invested,
            total_acquired: position.total_acquired,
            timestamp,
        });

        position.status = STATUS_CLOSED;
        position.updated_at = timestamp;
    }

    // ============ 查詢函數 ============

    public fun get_owner(position: &DCAPosition): address {
        position.owner
    }

    public fun get_status(position: &DCAPosition): u8 {
        position.status
    }

    public fun is_active(position: &DCAPosition): bool {
        position.status == STATUS_ACTIVE
    }

    public fun is_executable(position: &DCAPosition, clock: &Clock): bool {
        position.status == STATUS_ACTIVE &&
        position.executed_periods < position.total_periods &&
        clock::timestamp_ms(clock) >= position.next_execution_time
    }

    public fun get_next_execution_time(position: &DCAPosition): u64 {
        position.next_execution_time
    }

    public fun get_executed_periods(position: &DCAPosition): u64 {
        position.executed_periods
    }

    public fun get_total_periods(position: &DCAPosition): u64 {
        position.total_periods
    }

    public fun get_amount_per_period(position: &DCAPosition): u64 {
        position.amount_per_period
    }

    public fun get_total_invested(position: &DCAPosition): u64 {
        position.total_invested
    }

    public fun get_total_acquired(position: &DCAPosition): u64 {
        position.total_acquired
    }

    public fun get_average_price(position: &DCAPosition): u64 {
        position.average_price
    }

    public fun get_strategy(position: &DCAPosition): u8 {
        position.strategy
    }

    public fun get_limit_price(position: &DCAPosition): u64 {
        position.limit_price
    }
}
