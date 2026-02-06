/// H2O Smart DCA - 定投策略模組
/// 提供多種 DCA 策略實現：固定金額、限價、價值平均、多幣種
module h2o_smart_dca::strategy {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::vec_map::{Self, VecMap};

    // ============ 錯誤碼 ============
    const E_INVALID_STRATEGY: u64 = 1;
    const E_PRICE_TOO_HIGH: u64 = 2;
    const E_INVALID_ALLOCATION: u64 = 3;
    const E_TARGET_NOT_REACHED: u64 = 4;

    // ============ 常數 ============
    const STRATEGY_FIXED: u8 = 0;
    const STRATEGY_LIMIT: u8 = 1;
    const STRATEGY_VALUE_AVG: u8 = 2;
    const STRATEGY_MULTI_TOKEN: u8 = 3;

    const BASIS_POINTS: u64 = 10000;
    const PRICE_PRECISION: u64 = 1_000_000;

    // ============ 結構 ============

    /// 固定金額策略配置
    public struct FixedAmountStrategy has store, copy, drop {
        amount_per_period: u64,
    }

    /// 限價策略配置
    public struct LimitPriceStrategy has store, copy, drop {
        amount_per_period: u64,
        limit_price: u64,           // 限價（以 USDC 計價）
        use_average_price: bool,    // 是否使用 N 日均價
        average_periods: u64,       // 均價計算週期數
    }

    /// 價值平均策略配置
    public struct ValueAveragingStrategy has store, copy, drop {
        target_value: u64,          // 目標總價值
        target_periods: u64,        // 達成目標的期數
        max_amount_per_period: u64, // 單期最大金額
    }

    /// 多幣種策略配置
    public struct MultiTokenStrategy has store, copy, drop {
        amount_per_period: u64,
        allocations: VecMap<vector<u8>, u64>, // 代幣 -> 百分比
    }

    // ============ 策略執行結果 ============

    /// 策略執行結果
    public struct ExecutionResult has copy, drop {
        should_execute: bool,
        amount_to_spend: u64,
        reason: vector<u8>,
    }

    // ============ 固定金額策略 ============

    /// 建立固定金額策略
    public fun create_fixed_amount_strategy(
        amount_per_period: u64
    ): FixedAmountStrategy {
        FixedAmountStrategy {
            amount_per_period,
        }
    }

    /// 評估固定金額策略
    public fun evaluate_fixed_amount(
        strategy: &FixedAmountStrategy,
        _current_price: u64,
        _ctx: &mut TxContext
    ): ExecutionResult {
        // 固定金額策略總是執行
        ExecutionResult {
            should_execute: true,
            amount_to_spend: strategy.amount_per_period,
            reason: b"Fixed amount strategy",
        }
    }

    // ============ 限價策略 ============

    /// 建立限價策略
    public fun create_limit_price_strategy(
        amount_per_period: u64,
        limit_price: u64,
        use_average_price: bool,
        average_periods: u64
    ): LimitPriceStrategy {
        LimitPriceStrategy {
            amount_per_period,
            limit_price,
            use_average_price,
            average_periods,
        }
    }

    /// 評估限價策略
    public fun evaluate_limit_price(
        strategy: &LimitPriceStrategy,
        current_price: u64,
        average_price: u64,
        _ctx: &mut TxContext
    ): ExecutionResult {
        let price_to_compare = if (strategy.use_average_price) {
            average_price
        } else {
            current_price
        };

        if (price_to_compare <= strategy.limit_price) {
            ExecutionResult {
                should_execute: true,
                amount_to_spend: strategy.amount_per_period,
                reason: b"Price below limit",
            }
        } else {
            ExecutionResult {
                should_execute: false,
                amount_to_spend: 0,
                reason: b"Price above limit",
            }
        }
    }

    // ============ 價值平均策略 ============

    /// 建立價值平均策略
    public fun create_value_averaging_strategy(
        target_value: u64,
        target_periods: u64,
        max_amount_per_period: u64
    ): ValueAveragingStrategy {
        ValueAveragingStrategy {
            target_value,
            target_periods,
            max_amount_per_period,
        }
    }

    /// 評估價值平均策略
    public fun evaluate_value_averaging(
        strategy: &ValueAveragingStrategy,
        current_period: u64,
        current_value: u64,
        current_price: u64,
        _ctx: &mut TxContext
    ): ExecutionResult {
        // 計算目標價值 = (總目標價值 / 總期數) * 當前期數
        let target_value_now = (strategy.target_value * current_period) / strategy.target_periods;

        // 如果當前價值低於目標，需要買入
        if (current_value < target_value_now) {
            let value_gap = target_value_now - current_value;

            // 計算需要買入的金額
            let amount_needed = (value_gap * PRICE_PRECISION) / current_price;

            // 限制單期最大金額
            let amount_to_spend = if (amount_needed > strategy.max_amount_per_period) {
                strategy.max_amount_per_period
            } else {
                amount_needed
            };

            ExecutionResult {
                should_execute: true,
                amount_to_spend,
                reason: b"Below target value",
            }
        } else {
            // 當前價值已達或超過目標，本期不買入
            ExecutionResult {
                should_execute: false,
                amount_to_spend: 0,
                reason: b"Target value reached",
            }
        }
    }

    // ============ 多幣種策略 ============

    /// 建立多幣種策略
    public fun create_multi_token_strategy(
        amount_per_period: u64,
        allocations: VecMap<vector<u8>, u64>
    ): MultiTokenStrategy {
        // 驗證配置總和為 100%
        let mut total = 0u64;
        let mut i = 0;
        let size = vec_map::size(&allocations);

        while (i < size) {
            let (_, percentage) = vec_map::get_entry_by_idx(&allocations, i);
            total = total + *percentage;
            i = i + 1;
        };

        assert!(total == 100, E_INVALID_ALLOCATION);

        MultiTokenStrategy {
            amount_per_period,
            allocations,
        }
    }

    /// 計算多幣種配置金額
    public fun calculate_multi_token_amounts(
        strategy: &MultiTokenStrategy
    ): VecMap<vector<u8>, u64> {
        let mut amounts = vec_map::empty<vector<u8>, u64>();
        let mut i = 0;
        let size = vec_map::size(&strategy.allocations);

        while (i < size) {
            let (token, percentage) = vec_map::get_entry_by_idx(&strategy.allocations, i);
            let amount = (strategy.amount_per_period * *percentage) / 100;
            vec_map::insert(&mut amounts, *token, amount);
            i = i + 1;
        };

        amounts
    }

    // ============ 輔助函數 ============

    /// 計算移動平均價格
    public fun calculate_moving_average(
        prices: &vector<u64>,
        periods: u64
    ): u64 {
        let len = (prices.length() as u64);

        if (len == 0) {
            return 0
        };

        let periods_to_use = if (periods > len) { len } else { periods };
        let mut sum = 0u64;
        let mut i = len - periods_to_use;

        while (i < len) {
            sum = sum + *prices.borrow(i);
            i = i + 1;
        };

        sum / periods_to_use
    }

    /// 檢查策略類型是否有效
    public fun is_valid_strategy_type(strategy_type: u8): bool {
        strategy_type == STRATEGY_FIXED ||
        strategy_type == STRATEGY_LIMIT ||
        strategy_type == STRATEGY_VALUE_AVG ||
        strategy_type == STRATEGY_MULTI_TOKEN
    }

    /// 獲取策略類型名稱
    public fun get_strategy_name(strategy_type: u8): vector<u8> {
        if (strategy_type == STRATEGY_FIXED) {
            b"Fixed Amount"
        } else if (strategy_type == STRATEGY_LIMIT) {
            b"Limit Price"
        } else if (strategy_type == STRATEGY_VALUE_AVG) {
            b"Value Averaging"
        } else if (strategy_type == STRATEGY_MULTI_TOKEN) {
            b"Multi Token"
        } else {
            b"Unknown"
        }
    }

    // ============ Getters ============

    public fun get_fixed_amount(strategy: &FixedAmountStrategy): u64 {
        strategy.amount_per_period
    }

    public fun get_limit_price(strategy: &LimitPriceStrategy): u64 {
        strategy.limit_price
    }

    public fun get_target_value(strategy: &ValueAveragingStrategy): u64 {
        strategy.target_value
    }

    public fun get_allocations(strategy: &MultiTokenStrategy): &VecMap<vector<u8>, u64> {
        &strategy.allocations
    }

    // ============ 策略常數 ============

    public fun strategy_fixed(): u8 { STRATEGY_FIXED }
    public fun strategy_limit(): u8 { STRATEGY_LIMIT }
    public fun strategy_value_avg(): u8 { STRATEGY_VALUE_AVG }
    public fun strategy_multi_token(): u8 { STRATEGY_MULTI_TOKEN }
}
