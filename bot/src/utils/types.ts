/**
 * H2O Smart DCA Bot - 類型定義
 */

// ============ DCA 倉位 ============

export interface DCAPosition {
  id: string;
  owner: string;
  vaultId: string;
  sourceToken: string;
  targetTokens: TokenAllocation[];
  amountPerPeriod: bigint;
  intervalMs: number;
  totalPeriods: number;
  executedPeriods: number;
  nextExecutionTime: number;
  strategy: StrategyType;
  limitPrice?: number;
  totalInvested: bigint;
  totalAcquired: bigint;
  averagePrice: bigint;
  txDigest?: string;
  status: PositionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TokenAllocation {
  token: string;
  symbol: string;
  percentage: number;
}

export enum StrategyType {
  FIXED = 'fixed',
  LIMIT = 'limit_price',
  VALUE_AVG = 'value_averaging',
  MULTI_TOKEN = 'multi_token',
}

export enum PositionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CLOSED = 'closed',
}

// ============ 定投設定 ============

export interface DCAConfig {
  sourceToken: string;
  targetTokens: TokenAllocation[];
  amountPerPeriod: string;
  interval: IntervalType;
  totalPeriods: number;
  strategy: StrategyType;
  limitPrice?: number;
  enableYield: boolean;
  autoCompound: boolean;
}

export enum IntervalType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

export const INTERVAL_MS: Record<IntervalType, number> = {
  [IntervalType.DAILY]: 24 * 60 * 60 * 1000,
  [IntervalType.WEEKLY]: 7 * 24 * 60 * 60 * 1000,
  [IntervalType.BIWEEKLY]: 14 * 24 * 60 * 60 * 1000,
  [IntervalType.MONTHLY]: 30 * 24 * 60 * 60 * 1000,
};

// ============ Bot 對話狀態 ============

export interface ConversationState {
  step: ConversationStep;
  data: Partial<DCAConfig>;
}

export enum ConversationStep {
  IDLE = 'idle',
  SELECT_STRATEGY = 'select_strategy',
  SELECT_TARGET_TOKEN = 'select_target_token',
  ENTER_AMOUNT = 'enter_amount',
  SELECT_INTERVAL = 'select_interval',
  ENTER_PERIODS = 'enter_periods',
  ENABLE_YIELD = 'enable_yield',
  CONFIRM = 'confirm',
}

// ============ 金庫狀態 ============

export interface VaultState {
  id: string;
  owner: string;
  balance: bigint;
  h2oUsdBalance: bigint;
  totalDeposited: bigint;
  totalYieldEarned: bigint;
  createdAt: number;
  updatedAt: number;
}

// ============ 收益統計 ============

export interface YieldStats {
  totalDeposited: bigint;
  currentBalance: bigint;
  totalYield: bigint;
  yieldFromBrandUsd: bigint;
  yieldFromClmm: bigint;
  currentApy: number;
  lastUpdated: number;
}

// ============ 執行紀錄 ============

export interface ExecutionRecord {
  id: string;
  positionId: string;
  periodNumber: number;
  amountSpent: bigint;
  amountReceived: bigint;
  price: bigint;
  timestamp: number;
  txDigest?: string;
}
