/**
 * H2O Smart DCA - 倉位管理服務
 */

import { DCAPosition, DCAConfig, PositionStatus, IntervalType, INTERVAL_MS } from '../../../shared/types/index.js';
import { suiClient } from './sui-client.js';

/**
 * 倉位存儲（簡單實作，生產環境應使用數據庫）
 */
class PositionStorage {
  private positions: Map<string, DCAPosition> = new Map();

  save(position: DCAPosition) {
    this.positions.set(position.id, position);
  }

  get(id: string): DCAPosition | undefined {
    return this.positions.get(id);
  }

  getByOwner(owner: string): DCAPosition[] {
    return Array.from(this.positions.values()).filter(
      (pos) => pos.owner === owner
    );
  }

  getAll(): DCAPosition[] {
    return Array.from(this.positions.values());
  }

  delete(id: string) {
    this.positions.delete(id);
  }
}

export class PositionService {
  private storage = new PositionStorage();

  /**
   * 創建新倉位
   */
  async createPosition(
    owner: string,
    config: DCAConfig
  ): Promise<DCAPosition> {
    try {
      // 生成倉位 ID
      const id = `h2o_dca_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;

      // 計算週期間隔（毫秒）
      const intervalMs = INTERVAL_MS[config.interval];

      // 計算第一次執行時間
      const now = Date.now();
      const nextExecutionTime = now + intervalMs;

      // 創建倉位對象
      const position: DCAPosition = {
        id,
        owner,
        vaultId: '', // 暫時留空，未來可以為每個倉位創建獨立 vault

        sourceToken: config.sourceToken,
        targetTokens: config.targetTokens,

        amountPerPeriod: BigInt(
          parseFloat(config.amountPerPeriod) * 1_000_000
        ), // USDC 有 6 位小數
        intervalMs,
        totalPeriods: config.totalPeriods,
        executedPeriods: 0,
        nextExecutionTime,

        strategy: config.strategy,
        limitPrice: config.limitPrice,

        totalInvested: 0n,
        totalAcquired: 0n,
        averagePrice: 0n,

        status: PositionStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      };

      // TODO: 實際應該調用合約創建倉位
      // 1. 用戶授權 USDC 給合約
      // 2. 合約鎖定總金額 (amountPerPeriod * totalPeriods)
      // 3. 將資金轉為 H2OUSD 存入金庫
      // 4. 創建倉位記錄

      // 保存倉位
      this.storage.save(position);

      console.log(`✅ Created position: ${id}`);
      console.log(`   Owner: ${owner}`);
      console.log(
        `   Amount: ${config.amountPerPeriod} USDC × ${config.totalPeriods} periods`
      );
      console.log(`   Next execution: ${new Date(nextExecutionTime).toISOString()}`);

      return position;
    } catch (error) {
      console.error('Failed to create position:', error);
      throw error;
    }
  }

  /**
   * 獲取倉位詳情
   */
  getPosition(id: string): DCAPosition | undefined {
    return this.storage.get(id);
  }

  /**
   * 獲取用戶的所有倉位
   */
  getUserPositions(owner: string): DCAPosition[] {
    return this.storage.getByOwner(owner);
  }

  /**
   * 獲取所有活躍倉位（用於排程器）
   */
  getActivePositions(): DCAPosition[] {
    return this.storage
      .getAll()
      .filter((pos) => pos.status === PositionStatus.ACTIVE);
  }

  /**
   * 暫停倉位
   */
  async pausePosition(id: string): Promise<boolean> {
    const position = this.storage.get(id);
    if (!position) {
      return false;
    }

    position.status = PositionStatus.PAUSED;
    position.updatedAt = Date.now();
    this.storage.save(position);

    console.log(`⏸ Paused position: ${id}`);
    return true;
  }

  /**
   * 恢復倉位
   */
  async resumePosition(id: string): Promise<boolean> {
    const position = this.storage.get(id);
    if (!position) {
      return false;
    }

    if (position.status !== PositionStatus.PAUSED) {
      return false;
    }

    // 重新計算下次執行時間
    position.nextExecutionTime = Date.now() + position.intervalMs;
    position.status = PositionStatus.ACTIVE;
    position.updatedAt = Date.now();
    this.storage.save(position);

    console.log(`▶️ Resumed position: ${id}`);
    return true;
  }

  /**
   * 關閉倉位
   */
  async closePosition(id: string): Promise<boolean> {
    const position = this.storage.get(id);
    if (!position) {
      return false;
    }

    // TODO: 實際應該調用合約
    // 1. 停止定投排程
    // 2. 從金庫提取剩餘 H2OUSD
    // 3. Burn H2OUSD 換回 USDC
    // 4. 將 USDC 退回用戶錢包

    position.status = PositionStatus.CLOSED;
    position.updatedAt = Date.now();
    this.storage.save(position);

    console.log(`❌ Closed position: ${id}`);
    return true;
  }

  /**
   * 執行定投
   */
  async executeDCA(positionId: string): Promise<boolean> {
    const position = this.storage.get(positionId);
    if (!position) {
      console.error(`Position not found: ${positionId}`);
      return false;
    }

    if (position.status !== PositionStatus.ACTIVE) {
      console.log(`Position ${positionId} is not active, skipping`);
      return false;
    }

    if (Date.now() < position.nextExecutionTime) {
      console.log(`Position ${positionId} not ready for execution yet`);
      return false;
    }

    try {
      console.log(`🔄 Executing DCA for position ${positionId}...`);

      // TODO: 實際執行流程：
      // 1. 從金庫取出 amountPerPeriod 的 H2OUSD
      // 2. Burn H2OUSD 換回 USDC
      // 3. 使用 Cetus Aggregator 找最佳路徑
      // 4. 執行交易買入目標代幣
      // 5. 將買到的代幣發送給用戶

      // 模擬執行
      const amountInUsdc = Number(position.amountPerPeriod) / 1_000_000;
      const mockPrice = 3.5 + Math.random() * 0.5; // 模擬 SUI 價格
      const amountAcquired = amountInUsdc / mockPrice;

      console.log(`   Amount spent: ${amountInUsdc} USDC`);
      console.log(`   Price: ${mockPrice.toFixed(4)} USDC`);
      console.log(`   Acquired: ${amountAcquired.toFixed(4)} SUI`);

      // 更新倉位統計
      position.executedPeriods += 1;
      position.totalInvested += position.amountPerPeriod;
      position.totalAcquired += BigInt(Math.floor(amountAcquired * 1e9)); // SUI 9 decimals

      // 更新平均價格
      if (position.totalAcquired > 0n) {
        position.averagePrice =
          (position.totalInvested * 1000n) / position.totalAcquired;
      }

      // 計算下次執行時間
      position.nextExecutionTime = Date.now() + position.intervalMs;

      // 檢查是否完成所有期數
      if (position.executedPeriods >= position.totalPeriods) {
        position.status = PositionStatus.COMPLETED;
        console.log(`✅ Position ${positionId} completed all periods`);
      }

      position.updatedAt = Date.now();
      this.storage.save(position);

      console.log(
        `✅ DCA executed for ${positionId} (${position.executedPeriods}/${position.totalPeriods})`
      );

      return true;
    } catch (error) {
      console.error(`Failed to execute DCA for ${positionId}:`, error);
      return false;
    }
  }

  /**
   * 計算倉位收益統計
   */
  async getPositionYield(positionId: string) {
    const position = this.storage.get(positionId);
    if (!position) {
      return null;
    }

    // TODO: 從鏈上查詢實際收益
    // 1. 查詢用戶在金庫中的 H2OUSD 餘額
    // 2. 計算當前 H2OUSD 價值
    // 3. 計算總收益 = 當前價值 - 總投入

    // 模擬收益數據
    const totalInvestedUsdc = Number(position.totalInvested) / 1_000_000;
    const mockYieldRate = 0.12; // 12% APY
    const timeHeldDays =
      (Date.now() - position.createdAt) / (1000 * 60 * 60 * 24);
    const estimatedYield = (totalInvestedUsdc * mockYieldRate * timeHeldDays) / 365;

    return {
      totalInvested: totalInvestedUsdc,
      currentValue: totalInvestedUsdc + estimatedYield,
      totalYield: estimatedYield,
      apy: mockYieldRate,
    };
  }
}

// 導出單例實例
export const positionService = new PositionService();
