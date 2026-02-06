/**
 * H2O Smart DCA Bot - 定時任務排程器
 */

import cron from 'node-cron';
import { positionService, suiClient } from '../services/index.js';

// 定時任務配置
interface ScheduledTask {
  name: string;
  schedule: string;
  handler: () => Promise<void>;
}

const tasks: ScheduledTask[] = [
  {
    name: 'Execute Pending DCAs',
    schedule: '*/5 * * * *', // 每 5 分鐘
    handler: executePendingDCAs,
  },
  {
    name: 'Check Rebalance',
    schedule: '0 * * * *', // 每小時
    handler: checkRebalance,
  },
  {
    name: 'Update Yield Stats',
    schedule: '*/30 * * * *', // 每 30 分鐘
    handler: updateYieldStats,
  },
];

export function startScheduler() {
  console.log('📅 Starting scheduler...');

  for (const task of tasks) {
    cron.schedule(task.schedule, async () => {
      console.log(`⏰ Running task: ${task.name}`);
      try {
        await task.handler();
        console.log(`✅ Task completed: ${task.name}`);
      } catch (error) {
        console.error(`❌ Task failed: ${task.name}`, error);
      }
    });

    console.log(`   - ${task.name} (${task.schedule})`);
  }

  console.log('✅ Scheduler started');
}

/**
 * 執行待處理的 DCA 定投
 */
async function executePendingDCAs() {
  console.log('   Checking for pending DCA executions...');

  const activePositions = positionService.getActivePositions();
  const now = Date.now();
  let executedCount = 0;

  for (const position of activePositions) {
    // 檢查是否到執行時間
    if (now >= position.nextExecutionTime) {
      console.log(`   Position ${position.id} is ready for execution`);

      try {
        const success = await positionService.executeDCA(position.id);
        if (success) {
          executedCount++;
          console.log(`   ✅ Successfully executed DCA for ${position.id}`);

          // TODO: 發送通知給用戶（通過 Telegram）
          // await notifyUser(position.owner, {
          //   type: 'DCA_EXECUTED',
          //   positionId: position.id,
          //   period: position.executedPeriods,
          // });
        } else {
          console.log(`   ❌ Failed to execute DCA for ${position.id}`);
        }
      } catch (error) {
        console.error(`   Error executing DCA for ${position.id}:`, error);
      }
    }
  }

  console.log(`   Processed ${executedCount} of ${activePositions.length} positions`);
}

/**
 * 檢查是否需要重置 CLMM 區間
 */
async function checkRebalance() {
  // TODO: 實作
  // 1. 查詢所有活躍的 CLMM 位置
  // 2. 檢查當前價格是否接近區間邊界
  // 3. 如果需要重置：
  //    a. 移除流動性
  //    b. 收集手續費
  //    c. 計算新的最優區間
  //    d. 重新添加流動性

  console.log('   Checking CLMM positions for rebalance...');

  // Mock: 模擬檢查
  const positions = await getCLMMPositions();
  let rebalanceCount = 0;

  for (const position of positions) {
    const needsRebalance = await checkPositionNeedsRebalance(position);
    if (needsRebalance) {
      console.log(`   Rebalancing position: ${position.id}`);
      // await rebalancePosition(position);
      rebalanceCount++;
    }
  }

  console.log(`   Rebalanced ${rebalanceCount} positions`);
}

/**
 * 更新收益統計
 */
async function updateYieldStats() {
  // TODO: 實作
  // 1. 查詢所有金庫
  // 2. 計算累積收益
  // 3. 更新鏈上狀態

  console.log('   Updating yield statistics...');

  // Mock: 模擬更新
  const vaults = await getAllVaults();

  for (const vault of vaults) {
    // 計算新收益（簡化：每小時 0.001%）
    const hourlyRate = 0.00001;
    const newYield = vault.balance * hourlyRate;

    console.log(`   Vault ${vault.id}: +${newYield.toFixed(4)} yield`);
    // await accrueYield(vault.id, newYield);
  }

  console.log(`   Updated ${vaults.length} vaults`);
}

// ============ Mock 數據（開發用）============

async function getPendingPositions() {
  // 返回到期需要執行的倉位
  return [];
}

async function getCLMMPositions() {
  // 返回所有 CLMM 位置
  return [
    { id: 'clmm_001', tickLower: 100, tickUpper: 200, currentTick: 150 },
  ];
}

async function checkPositionNeedsRebalance(position: any): Promise<boolean> {
  // 檢查是否需要重置（當前 tick 接近邊界 5% 內）
  const range = position.tickUpper - position.tickLower;
  const threshold = range * 0.05;

  return (
    position.currentTick <= position.tickLower + threshold ||
    position.currentTick >= position.tickUpper - threshold
  );
}

async function getAllVaults() {
  return [
    { id: 'vault_001', balance: 1000 },
    { id: 'vault_002', balance: 500 },
  ];
}
