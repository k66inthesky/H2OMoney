/**
 * H2O Smart DCA Bot - 指令處理
 */

import type { BotContext } from '../bot.js';
import { ConversationStep, StrategyType } from '../../../shared/types/index.js';
import { BOT_CONFIG } from '../../../shared/constants/index.js';

// /start - 啟動機器人
export async function startCommand(ctx: BotContext) {
  await ctx.reply(BOT_CONFIG.MESSAGES.WELCOME, {
    parse_mode: 'Markdown',
  });
}

// /help - 幫助說明
export async function helpCommand(ctx: BotContext) {
  await ctx.reply(BOT_CONFIG.MESSAGES.HELP, {
    parse_mode: 'Markdown',
  });
}

// /connect - 連接錢包
export async function connectCommand(ctx: BotContext) {
  // TODO: 實作錢包連接（可能需要 Web App 配合）
  await ctx.reply(
    `🔗 *連接 Sui 錢包*

請點擊下方按鈕連接你的錢包：`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🔗 連接錢包',
              url: `${process.env.WEBAPP_URL || 'https://h2omoney.app'}/connect?tgId=${ctx.from?.id}`,
            },
          ],
        ],
      },
    }
  );
}

// /new - 建立新定投
export async function newCommand(ctx: BotContext) {
  // 檢查錢包連接
  if (!ctx.session.walletAddress) {
    // 暫時跳過錢包檢查，方便測試
    // await ctx.reply(BOT_CONFIG.MESSAGES.NO_WALLET);
    // return;
  }

  ctx.session.conversation = {
    step: ConversationStep.SELECT_STRATEGY,
    data: {},
  };

  await ctx.reply(
    `🌊 *建立新的 Smart DCA 倉位*

選擇定投策略：`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 固定金額', callback_data: 'strategy_fixed' },
          ],
          [
            { text: '💹 智能限價', callback_data: 'strategy_limit' },
          ],
          [
            { text: '🎯 多幣種定投', callback_data: 'strategy_multi' },
          ],
        ],
      },
    }
  );
}

// /list - 查看所有倉位
export async function listCommand(ctx: BotContext) {
  // TODO: 從鏈上查詢用戶的所有倉位
  const positions = await getMockPositions();

  if (positions.length === 0) {
    await ctx.reply(BOT_CONFIG.MESSAGES.NO_POSITIONS);
    return;
  }

  let message = '📋 *你的 Smart DCA 倉位*\n\n';

  for (const pos of positions) {
    const statusEmoji = pos.status === 'active' ? '🟢' : pos.status === 'paused' ? '🟡' : '✅';
    message += `${statusEmoji} *${pos.id}*\n`;
    message += `   ${pos.sourceToken} → ${pos.targetToken}\n`;
    message += `   ${pos.amountPerPeriod} USDC / ${pos.interval}\n`;
    message += `   進度：${pos.executedPeriods}/${pos.totalPeriods} 期\n\n`;
  }

  message += '使用 /status <id> 查看詳情';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

// /status <id> - 查看倉位詳情
export async function statusCommand(ctx: BotContext) {
  const args = ctx.message?.text?.split(' ').slice(1);
  const positionId = args?.[0];

  if (!positionId) {
    await ctx.reply('請提供倉位 ID，例如：/status h2o_dca_abc123');
    return;
  }

  // TODO: 從鏈上查詢倉位詳情
  const position = await getMockPosition(positionId);

  if (!position) {
    await ctx.reply(BOT_CONFIG.MESSAGES.POSITION_NOT_FOUND);
    return;
  }

  const statusText = position.status === 'active' ? '🟢 運行中' :
                     position.status === 'paused' ? '🟡 已暫停' : '✅ 已完成';

  await ctx.reply(
    `📊 *倉位詳情*

*ID:* \`${position.id}\`
*狀態:* ${statusText}

*定投設定:*
• 投入代幣：${position.sourceToken}
• 目標代幣：${position.targetToken}
• 每期金額：${position.amountPerPeriod} USDC
• 週期：${position.interval}
• 進度：${position.executedPeriods}/${position.totalPeriods} 期

*統計數據:*
• 累計投入：${position.totalInvested} USDC
• 累計獲得：${position.totalAcquired} ${position.targetToken}
• 平均價格：${position.averagePrice} USDC

*收益優化:*
• 金庫餘額：${position.vaultBalance} H2OUSD
• 累計收益：${position.yieldEarned} USDC
• 當前 APY：~12%

⏰ 下次執行：${position.nextExecutionTime}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          position.status === 'active'
            ? [{ text: '⏸ 暫停', callback_data: `pause_${position.id}` }]
            : position.status === 'paused'
            ? [{ text: '▶️ 恢復', callback_data: `resume_${position.id}` }]
            : [],
          [{ text: '❌ 關閉倉位', callback_data: `close_${position.id}` }],
        ].filter(row => row.length > 0),
      },
    }
  );
}

// /pause <id> - 暫停定投
export async function pauseCommand(ctx: BotContext) {
  const args = ctx.message?.text?.split(' ').slice(1);
  const positionId = args?.[0];

  if (!positionId) {
    await ctx.reply('請提供倉位 ID，例如：/pause h2o_dca_abc123');
    return;
  }

  // TODO: 調用合約暫停倉位
  await ctx.reply(`⏸ 倉位 \`${positionId}\` 已暫停\n\n資金將繼續在生息金庫中賺取收益。`, {
    parse_mode: 'Markdown',
  });
}

// /resume <id> - 恢復定投
export async function resumeCommand(ctx: BotContext) {
  const args = ctx.message?.text?.split(' ').slice(1);
  const positionId = args?.[0];

  if (!positionId) {
    await ctx.reply('請提供倉位 ID，例如：/resume h2o_dca_abc123');
    return;
  }

  // TODO: 調用合約恢復倉位
  await ctx.reply(`▶️ 倉位 \`${positionId}\` 已恢復\n\n下次執行時間：${getNextExecutionTime()}`, {
    parse_mode: 'Markdown',
  });
}

// /close <id> - 關閉倉位
export async function closeCommand(ctx: BotContext) {
  const args = ctx.message?.text?.split(' ').slice(1);
  const positionId = args?.[0];

  if (!positionId) {
    await ctx.reply('請提供倉位 ID，例如：/close h2o_dca_abc123');
    return;
  }

  await ctx.reply(
    `⚠️ *確認關閉倉位*

倉位 ID: \`${positionId}\`

關閉後：
• 剩餘資金將退回你的錢包
• 累計的收益將一併提取
• 此操作無法撤銷

確定要關閉嗎？`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 確認關閉', callback_data: `confirm_close_${positionId}` },
            { text: '❌ 取消', callback_data: 'cancel_close' },
          ],
        ],
      },
    }
  );
}

// /yield - 查看收益統計
export async function yieldCommand(ctx: BotContext) {
  // TODO: 從鏈上查詢收益數據
  const yieldStats = await getMockYieldStats();

  await ctx.reply(
    `💰 *收益統計*

*總覽:*
• 總存入：${yieldStats.totalDeposited} USDC
• 當前餘額：${yieldStats.currentBalance} H2OUSD
• 總收益：${yieldStats.totalYield} USDC

*收益來源:*
• BrandUSD 底層收益：${yieldStats.yieldFromBrandUsd} USDC
• CLMM LP 手續費：${yieldStats.yieldFromClmm} USDC

*當前 APY:* ~${yieldStats.currentApy}%

📈 收益每小時自動累積，無需手動操作`,
    { parse_mode: 'Markdown' }
  );
}

// ============ Mock 數據（開發用）============

async function getMockPositions() {
  return [
    {
      id: 'h2o_dca_abc123',
      sourceToken: 'USDC',
      targetToken: 'SUI',
      amountPerPeriod: '100',
      interval: '每週',
      totalPeriods: 4,
      executedPeriods: 1,
      status: 'active',
    },
    {
      id: 'h2o_dca_def456',
      sourceToken: 'USDC',
      targetToken: 'CETUS',
      amountPerPeriod: '50',
      interval: '每日',
      totalPeriods: 30,
      executedPeriods: 15,
      status: 'active',
    },
  ];
}

async function getMockPosition(id: string) {
  return {
    id,
    sourceToken: 'USDC',
    targetToken: 'SUI',
    amountPerPeriod: '100',
    interval: '每週',
    totalPeriods: 4,
    executedPeriods: 1,
    status: 'active',
    totalInvested: '100',
    totalAcquired: '25.5',
    averagePrice: '3.92',
    vaultBalance: '305.2',
    yieldEarned: '5.2',
    nextExecutionTime: '2026-02-11 00:00 UTC',
  };
}

async function getMockYieldStats() {
  return {
    totalDeposited: '1000',
    currentBalance: '1052.3',
    totalYield: '52.3',
    yieldFromBrandUsd: '32.1',
    yieldFromClmm: '20.2',
    currentApy: 12.5,
  };
}

function getNextExecutionTime(): string {
  const next = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return next.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
}
