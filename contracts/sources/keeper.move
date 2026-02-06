/// H2O Smart DCA - Keeper 自動執行管理
/// 管理定時任務、自動執行 DCA、觸發重置、計算 keeper 獎勵
module h2o_smart_dca::keeper {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::vec_set::{Self, VecSet};

    // ============ 錯誤碼 ============
    const E_NOT_KEEPER: u64 = 1;
    const E_TASK_NOT_FOUND: u64 = 2;
    const E_TASK_NOT_READY: u64 = 3;
    const E_ALREADY_REGISTERED: u64 = 4;
    const E_INSUFFICIENT_REWARD: u64 = 5;
    const E_NOT_ADMIN: u64 = 6;

    // ============ 常數 ============
    const TASK_TYPE_DCA: u8 = 0;
    const TASK_TYPE_REBALANCE: u8 = 1;
    const TASK_TYPE_YIELD_HARVEST: u8 = 2;

    const TASK_STATUS_PENDING: u8 = 0;
    const TASK_STATUS_EXECUTING: u8 = 1;
    const TASK_STATUS_COMPLETED: u8 = 2;
    const TASK_STATUS_FAILED: u8 = 3;

    const BASIS_POINTS: u64 = 10000;
    const MIN_KEEPER_STAKE: u64 = 100_000_000; // 100 USDC

    // ============ 結構 ============

    /// Keeper 註冊表
    public struct KeeperRegistry has key {
        id: UID,
        admin: address,
        keepers: VecSet<address>,          // 已註冊的 keeper 列表
        keeper_stakes: Table<address, u64>, // Keeper 質押金額
        total_tasks_executed: u64,
        total_rewards_paid: u64,
        min_stake: u64,
        reward_rate: u64,                   // 獎勵比例（basis points）
    }

    /// 執行任務
    public struct ExecutionTask has key, store {
        id: UID,
        task_type: u8,
        target_id: ID,                      // 目標對象 ID（DCA Position / CLMM Position）
        next_execution_time: u64,
        interval_ms: u64,
        priority: u8,
        retry_count: u64,
        max_retries: u64,
        status: u8,
        assigned_keeper: Option<address>,
        reward_amount: u64,
        created_at: u64,
        updated_at: u64,
    }

    /// 執行紀錄
    public struct ExecutionLog has key, store {
        id: UID,
        task_id: ID,
        keeper: address,
        execution_time: u64,
        gas_used: u64,
        reward_paid: u64,
        success: bool,
        error_message: vector<u8>,
    }

    // ============ 事件 ============

    public struct KeeperRegistered has copy, drop {
        keeper: address,
        stake_amount: u64,
        timestamp: u64,
    }

    public struct KeeperUnregistered has copy, drop {
        keeper: address,
        returned_stake: u64,
        timestamp: u64,
    }

    public struct TaskRegistered has copy, drop {
        task_id: ID,
        task_type: u8,
        target_id: ID,
        next_execution_time: u64,
        timestamp: u64,
    }

    public struct TaskExecuted has copy, drop {
        task_id: ID,
        keeper: address,
        success: bool,
        reward_paid: u64,
        timestamp: u64,
    }

    public struct TaskFailed has copy, drop {
        task_id: ID,
        keeper: address,
        retry_count: u64,
        error_message: vector<u8>,
        timestamp: u64,
    }

    public struct RebalanceTriggered has copy, drop {
        position_id: ID,
        keeper: address,
        timestamp: u64,
    }

    // ============ 初始化 ============

    fun init(ctx: &mut TxContext) {
        let registry = KeeperRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            keepers: vec_set::empty<address>(),
            keeper_stakes: table::new<address, u64>(ctx),
            total_tasks_executed: 0,
            total_rewards_paid: 0,
            min_stake: MIN_KEEPER_STAKE,
            reward_rate: 50, // 0.5% 基礎獎勵
        };
        transfer::share_object(registry);
    }

    // ============ Keeper 管理 ============

    /// 註冊成為 Keeper
    public fun register_keeper(
        registry: &mut KeeperRegistry,
        stake_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let keeper = tx_context::sender(ctx);
        assert!(!vec_set::contains(&registry.keepers, &keeper), E_ALREADY_REGISTERED);
        assert!(stake_amount >= registry.min_stake, E_INSUFFICIENT_REWARD);

        let timestamp = clock::timestamp_ms(clock);

        vec_set::insert(&mut registry.keepers, keeper);
        table::add(&mut registry.keeper_stakes, keeper, stake_amount);

        event::emit(KeeperRegistered {
            keeper,
            stake_amount,
            timestamp,
        });
    }

    /// 取消註冊 Keeper
    public fun unregister_keeper(
        registry: &mut KeeperRegistry,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let keeper = tx_context::sender(ctx);
        assert!(vec_set::contains(&registry.keepers, &keeper), E_NOT_KEEPER);

        let timestamp = clock::timestamp_ms(clock);
        let stake = table::remove(&mut registry.keeper_stakes, keeper);
        vec_set::remove(&mut registry.keepers, &keeper);

        event::emit(KeeperUnregistered {
            keeper,
            returned_stake: stake,
            timestamp,
        });
    }

    // ============ 任務管理 ============

    /// 註冊新任務
    public fun register_task(
        registry: &KeeperRegistry,
        task_type: u8,
        target_id: ID,
        next_execution_time: u64,
        interval_ms: u64,
        priority: u8,
        max_retries: u64,
        reward_amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ExecutionTask {
        let timestamp = clock::timestamp_ms(clock);

        let task = ExecutionTask {
            id: object::new(ctx),
            task_type,
            target_id,
            next_execution_time,
            interval_ms,
            priority,
            retry_count: 0,
            max_retries,
            status: TASK_STATUS_PENDING,
            assigned_keeper: option::none(),
            reward_amount,
            created_at: timestamp,
            updated_at: timestamp,
        };

        event::emit(TaskRegistered {
            task_id: object::id(&task),
            task_type,
            target_id,
            next_execution_time,
            timestamp,
        });

        task
    }

    /// 認領任務（Keeper 調用）
    public fun claim_task(
        registry: &KeeperRegistry,
        task: &mut ExecutionTask,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let keeper = tx_context::sender(ctx);
        assert!(vec_set::contains(&registry.keepers, &keeper), E_NOT_KEEPER);
        assert!(task.status == TASK_STATUS_PENDING, E_TASK_NOT_READY);

        let timestamp = clock::timestamp_ms(clock);
        assert!(timestamp >= task.next_execution_time, E_TASK_NOT_READY);

        task.status = TASK_STATUS_EXECUTING;
        task.assigned_keeper = option::some(keeper);
        task.updated_at = timestamp;
    }

    /// 完成任務執行
    public fun complete_task(
        registry: &mut KeeperRegistry,
        task: &mut ExecutionTask,
        success: bool,
        gas_used: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): ExecutionLog {
        let keeper = tx_context::sender(ctx);
        assert!(task.assigned_keeper == option::some(keeper), E_NOT_KEEPER);

        let timestamp = clock::timestamp_ms(clock);

        if (success) {
            // 成功執行，發放獎勵
            task.status = TASK_STATUS_COMPLETED;
            task.next_execution_time = timestamp + task.interval_ms;
            task.retry_count = 0;

            registry.total_tasks_executed = registry.total_tasks_executed + 1;
            registry.total_rewards_paid = registry.total_rewards_paid + task.reward_amount;

            event::emit(TaskExecuted {
                task_id: object::id(task),
                keeper,
                success: true,
                reward_paid: task.reward_amount,
                timestamp,
            });
        } else {
            // 執行失敗
            task.retry_count = task.retry_count + 1;

            if (task.retry_count >= task.max_retries) {
                task.status = TASK_STATUS_FAILED;
            } else {
                task.status = TASK_STATUS_PENDING;
            };

            event::emit(TaskFailed {
                task_id: object::id(task),
                keeper,
                retry_count: task.retry_count,
                error_message: b"Execution failed",
                timestamp,
            });
        };

        task.assigned_keeper = option::none();
        task.updated_at = timestamp;

        // 建立執行紀錄
        ExecutionLog {
            id: object::new(ctx),
            task_id: object::id(task),
            keeper,
            execution_time: timestamp,
            gas_used,
            reward_paid: if (success) { task.reward_amount } else { 0 },
            success,
            error_message: if (success) { b"" } else { b"Execution failed" },
        }
    }

    /// 觸發重置（任何人都可調用）
    public fun trigger_rebalance(
        registry: &KeeperRegistry,
        position_id: ID,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let keeper = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);

        // 驗證 keeper 已註冊
        assert!(vec_set::contains(&registry.keepers, &keeper), E_NOT_KEEPER);

        event::emit(RebalanceTriggered {
            position_id,
            keeper,
            timestamp,
        });
    }

    // ============ 獎勵計算 ============

    /// 計算任務獎勵
    public fun calculate_reward(
        base_reward: u64,
        gas_used: u64,
        priority: u8
    ): u64 {
        // 基礎獎勵 + Gas 補償 + 優先級獎金
        let gas_compensation = gas_used / 2; // 補償 50% gas
        let priority_bonus = (base_reward * (priority as u64) * 10) / 100;

        base_reward + gas_compensation + priority_bonus
    }

    // ============ 管理函數 ============

    /// 更新最小質押要求（僅管理員）
    public fun update_min_stake(
        registry: &mut KeeperRegistry,
        new_min_stake: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
        registry.min_stake = new_min_stake;
    }

    /// 更新獎勵比例（僅管理員）
    public fun update_reward_rate(
        registry: &mut KeeperRegistry,
        new_rate: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
        registry.reward_rate = new_rate;
    }

    // ============ 查詢函數 ============

    public fun is_keeper(registry: &KeeperRegistry, addr: address): bool {
        vec_set::contains(&registry.keepers, &addr)
    }

    public fun get_keeper_count(registry: &KeeperRegistry): u64 {
        vec_set::size(&registry.keepers)
    }

    public fun get_task_status(task: &ExecutionTask): u8 {
        task.status
    }

    public fun get_next_execution_time(task: &ExecutionTask): u64 {
        task.next_execution_time
    }

    public fun is_task_ready(task: &ExecutionTask, clock: &Clock): bool {
        task.status == TASK_STATUS_PENDING &&
        clock::timestamp_ms(clock) >= task.next_execution_time
    }

    public fun get_total_tasks_executed(registry: &KeeperRegistry): u64 {
        registry.total_tasks_executed
    }

    public fun get_total_rewards_paid(registry: &KeeperRegistry): u64 {
        registry.total_rewards_paid
    }

    // ============ 測試 ============

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx)
    }

    #[test_only]
    use std::option::{Self, Option};
}
