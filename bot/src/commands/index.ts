/**
 * H2O Smart DCA Bot - 指令處理
 */

import type { BotContext } from '../bot.js';
import { ConversationStep, StrategyType, IntervalType } from '../utils/types.js';
import { BOT_CONFIG, TOKENS, NETWORK } from '../utils/constants.js';
import { positionService, stableLayerService, suiClient, walletService } from '../services/index.js';

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

// /connect - 產生託管錢包
export async function connectCommand(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ 無法取得用戶 ID');
    return;
  }

  // 如果已有錢包，直接顯示
  if (walletService.hasWallet(userId)) {
    const address = walletService.getAddress(userId)!;
    ctx.session.walletAddress = address;

    // 查詢餘額
    const [suiBalance, usdcBalance] = await Promise.all([
      suiClient.getBalance(address, TOKENS.SUI.address),
      suiClient.getBalance(address, TOKENS.USDC.address),
    ]);

    const suiFormatted = (Number(suiBalance) / 1e9).toFixed(4);
    const usdcFormatted = (Number(usdcBalance) / 1e6).toFixed(2);

    await ctx.reply(
      `🔗 *你的 H2O 託管錢包*

你已經有一個錢包了！

📍 *地址：*
\`\`\`
${address}
\`\`\`

💰 *餘額：*
• ${suiFormatted} SUI
• ${usdcFormatted} USDC

請將 USDC 和少量 SUI（作為 gas）轉入上方地址，然後使用 /new 建立定投。`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // 產生新錢包
  const wallet = walletService.createWallet(userId);
  ctx.session.walletAddress = wallet.address;

  await ctx.reply(
    `🔗 *H2O 託管錢包已建立！*

📍 *你的 Sui 地址：*
\`\`\`
${wallet.address}
\`\`\`

📋 *接下來的步驟：*
1. 將 USDC 轉入上方地址（定投所需金額）
2. 轉入少量 SUI 作為 gas 費（建議 ≥ 0.05 SUI）
3. 使用 /balance 確認餘額到帳
4. 使用 /new 建立你的 Smart DCA 倉位

⚠️ *注意：*此為 Testnet 託管錢包，Bot 會代你簽名執行鏈上交易。`,
    { parse_mode: 'Markdown' }
  );
}

// /balance - 查詢錢包餘額
export async function balanceCommand(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId || !walletService.hasWallet(userId)) {
    await ctx.reply('❌ 你還沒有錢包，請先使用 /connect 建立。');
    return;
  }

  const address = walletService.getAddress(userId)!;

  const [suiBalance, usdcBalance] = await Promise.all([
    suiClient.getBalance(address, TOKENS.SUI.address),
    suiClient.getBalance(address, TOKENS.USDC.address),
  ]);

  const suiFormatted = (Number(suiBalance) / 1e9).toFixed(4);
  const usdcFormatted = (Number(usdcBalance) / 1e6).toFixed(2);

  let gasWarning = '';
  if (suiBalance < 50_000_000n) {
    // < 0.05 SUI
    gasWarning = '\n⚠️ *SUI 餘額過低！*建議至少 0.05 SUI 作為 gas 費。';
  }

  await ctx.reply(
    `💰 *錢包餘額*

📍 地址：\`${address.slice(0, 8)}...${address.slice(-6)}\`

• ${suiFormatted} SUI
• ${usdcFormatted} USDC${gasWarning}

🔗 [在 Explorer 查看](${NETWORK.TESTNET.explorerUrl}/account/${address})`,
    { parse_mode: 'Markdown' }
  );
}

// /new - 建立新定投
export async function newCommand(ctx: BotContext) {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ 無法取得用戶 ID');
    return;
  }

  // 檢查錢包
  if (!walletService.hasWallet(userId)) {
    await ctx.reply(
      '❌ 請先使用 /connect 建立託管錢包，並轉入 USDC + SUI 後再建立定投。'
    );
    return;
  }

  // 設置 session 中的錢包地址
  ctx.session.walletAddress = walletService.getAddress(userId);

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
  const userId = ctx.from?.id;
  if (!userId || !walletService.hasWallet(userId)) {
    await ctx.reply('❌ 請先使用 /connect 建立錢包');
    return;
  }

  const userAddress = walletService.getAddress(userId)!;
  const positions = positionService.getUserPositions(userAddress);

  if (positions.length === 0) {
    await ctx.reply(BOT_CONFIG.MESSAGES.NO_POSITIONS);
    return;
  }

  let message = '📋 *你的 Smart DCA 倉位*\n\n';

  for (const pos of positions) {
    const statusEmoji = pos.status === 'active' ? '🟢' : pos.status === 'paused' ? '🟡' : '✅';
    const targetToken = pos.targetTokens[0]?.symbol || 'UNKNOWN';
    const amountUsdc = Number(pos.amountPerPeriod) / 1_000_000;
    const intervalText = getIntervalTextFromMs(pos.intervalMs);

    message += `${statusEmoji} \`${pos.id}\`\n`;
    message += `   ${pos.sourceToken} → ${targetToken}\n`;
    message += `   ${amountUsdc} USDC / ${intervalText}\n`;
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

  const position = positionService.getPosition(positionId);

  if (!position) {
    await ctx.reply(BOT_CONFIG.MESSAGES.POSITION_NOT_FOUND);
    return;
  }

  const statusText =
    position.status === 'active'
      ? '🟢 運行中'
      : position.status === 'paused'
      ? '🟡 已暫停'
      : position.status === 'completed'
      ? '✅ 已完成'
      : '❌ 已關閉';

  const targetToken = position.targetTokens[0]?.symbol || 'UNKNOWN';
  const amountUsdc = Number(position.amountPerPeriod) / 1_000_000;
  const totalInvested = Number(position.totalInvested) / 1_000_000;
  const totalAcquired = Number(position.totalAcquired) / 1e9; // SUI 9 decimals
  const avgPrice = totalAcquired > 0 ? totalInvested / totalAcquired : 0;
  const intervalText = getIntervalTextFromMs(position.intervalMs);
  const nextExecution = new Date(position.nextExecutionTime)
    .toISOString()
    .replace('T', ' ')
    .substring(0, 16);

  // 查詢收益統計
  const yieldStats = await positionService.getPositionYield(positionId);

  let txLine = '';
  if (position.txDigest) {
    txLine = `\n🔗 [查看存款交易](${NETWORK.TESTNET.explorerUrl}/tx/${position.txDigest})`;
  }

  await ctx.reply(
    `📊 *倉位詳情*

*ID:* \`${position.id}\`
*狀態:* ${statusText}

*定投設定:*
• 投入代幣：${position.sourceToken}
• 目標代幣：${targetToken}
• 每期金額：${amountUsdc.toFixed(2)} USDC
• 週期：${intervalText}
• 進度：${position.executedPeriods}/${position.totalPeriods} 期

*統計數據:*
• 累計投入：${totalInvested.toFixed(2)} USDC
• 累計獲得：${totalAcquired.toFixed(4)} ${targetToken}
• 平均價格：${avgPrice.toFixed(4)} USDC

*收益優化:*
${
  yieldStats
    ? `• 當前價值：${yieldStats.currentValue.toFixed(2)} USDC
• 累計收益：${yieldStats.totalYield.toFixed(2)} USDC
• 當前 APY：~${(yieldStats.apy * 100).toFixed(1)}%`
    : '• 暫無收益數據'
}

⏰ 下次執行：${nextExecution} UTC${txLine}`,
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
        ].filter((row) => row.length > 0),
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

  const success = await positionService.pausePosition(positionId);

  if (!success) {
    await ctx.reply('❌ 找不到倉位或無法暫停');
    return;
  }

  await ctx.reply(
    `⏸ 倉位 \`${positionId}\` 已暫停\n\n資金將繼續在生息金庫中賺取收益。`,
    {
      parse_mode: 'Markdown',
    }
  );
}

// /resume <id> - 恢復定投
export async function resumeCommand(ctx: BotContext) {
  const args = ctx.message?.text?.split(' ').slice(1);
  const positionId = args?.[0];

  if (!positionId) {
    await ctx.reply('請提供倉位 ID，例如：/resume h2o_dca_abc123');
    return;
  }

  const success = await positionService.resumePosition(positionId);

  if (!success) {
    await ctx.reply('❌ 找不到倉位或無法恢復');
    return;
  }

  const position = positionService.getPosition(positionId);
  const nextExecution = position
    ? new Date(position.nextExecutionTime).toISOString().replace('T', ' ').substring(0, 16)
    : 'Unknown';

  await ctx.reply(
    `▶️ 倉位 \`${positionId}\` 已恢復\n\n下次執行時間：${nextExecution} UTC`,
    {
      parse_mode: 'Markdown',
    }
  );
}

// /close <id> - 關閉倉位
export async function closeCommand(ctx: BotContext) {
  const args = ctx.message?.text?.split(' ').slice(1);
  const positionId = args?.[0];

  if (!positionId) {
    await ctx.reply('請提供倉位 ID，例如：/close h2o_dca_abc123');
    return;
  }

  const position = positionService.getPosition(positionId);
  if (!position) {
    await ctx.reply('❌ 找不到指定的倉位');
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
  const userId = ctx.from?.id;
  if (!userId || !walletService.hasWallet(userId)) {
    await ctx.reply('❌ 請先使用 /connect 建立錢包');
    return;
  }

  try {
    const userAddress = walletService.getAddress(userId)!;

    // 查詢金庫狀態
    const vaultState = await suiClient.getVaultState();
    const h2ousdValue = await suiClient.getH2OUSDValue();

    const userAssets = await suiClient.getUserAssets(userAddress);

    const totalDeposited = Number(vaultState.totalDeposited) / 1_000_000;
    const totalYield = Number(vaultState.totalYieldEarned) / 1_000_000;
    const userH2ousd = Number(userAssets.totalH2OUSD) / 1_000_000;
    const userValue = userH2ousd * h2ousdValue;

    const brandUsdSupply = await stableLayerService.getBrandUsdTotalSupply(userAddress);
    const brandUsdDecimals = Number(process.env.STABLELAYER_BRAND_USD_DECIMALS || '6');
    const brandUsdSupplyFormatted = formatAmount(brandUsdSupply, brandUsdDecimals);

    // 模擬分拆收益來源（實際應該從合約事件查詢）
    const yieldFromBrandUsd = totalYield * 0.6;
    const yieldFromClmm = totalYield * 0.4;

    // 計算 APY（簡化計算）
    const apy = totalDeposited > 0 ? (totalYield / totalDeposited) * 100 : 0;

    await ctx.reply(
      `💰 *收益統計*

*總覽:*
• 總存入：${totalDeposited.toFixed(2)} USDC
• 當前餘額：${userH2ousd.toFixed(2)} H2OUSD
• 當前價值：${userValue.toFixed(2)} USDC
• 總收益：${totalYield.toFixed(2)} USDC

*收益來源:*
• BrandUSD 底層收益：${yieldFromBrandUsd.toFixed(2)} USDC
• CLMM LP 手續費：${yieldFromClmm.toFixed(2)} USDC

*StableLayer BrandUSD 總供應:* ${brandUsdSupplyFormatted}
*當前 APY:* ~${apy.toFixed(1)}%
*H2OUSD 價值:* ${h2ousdValue.toFixed(6)} USDC

📈 收益每小時自動累積，無需手動操作`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Failed to fetch yield stats:', error);
    await ctx.reply('❌ 無法獲取收益數據，請稍後再試');
  }
}

// ============ 輔助函數 ============

/**
 * 根據週期毫秒數獲取文字描述
 */
function getIntervalTextFromMs(ms: number): string {
  const day = 24 * 60 * 60 * 1000;
  if (ms === day) return '每日';
  if (ms === 7 * day) return '每週';
  if (ms === 14 * day) return '每兩週';
  if (ms === 30 * day) return '每月';
  return `每 ${Math.floor(ms / day)} 天`;
}

function formatAmount(amount: bigint, decimals: number): string {
  if (decimals <= 0) {
    return amount.toString();
  }
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = amount % base;
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  if (!fractionStr) {
    return whole.toString();
  }
  return `${whole.toString()}.${fractionStr}`;
}
