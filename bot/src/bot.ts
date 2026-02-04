/**
 * H2O Smart DCA Bot - Bot 初始化
 */

import { Bot, Context, session, SessionFlavor } from 'grammy';
import {
  startCommand,
  helpCommand,
  newCommand,
  listCommand,
  statusCommand,
  pauseCommand,
  resumeCommand,
  closeCommand,
  yieldCommand,
  connectCommand,
} from './commands/index.js';
import { ConversationState, ConversationStep } from '../../shared/types/index.js';

// Session 類型
interface SessionData {
  conversation: ConversationState;
  walletAddress?: string;
}

export type BotContext = Context & SessionFlavor<SessionData>;

// 初始 Session 數據
function initialSession(): SessionData {
  return {
    conversation: {
      step: ConversationStep.IDLE,
      data: {},
    },
  };
}

export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // 使用 session 中間件
  bot.use(session({ initial: initialSession }));

  // 錯誤處理
  bot.catch((err) => {
    console.error('Bot error:', err);
  });

  // 註冊指令
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('connect', connectCommand);
  bot.command('new', newCommand);
  bot.command('list', listCommand);
  bot.command('status', statusCommand);
  bot.command('pause', pauseCommand);
  bot.command('resume', resumeCommand);
  bot.command('close', closeCommand);
  bot.command('yield', yieldCommand);

  // 處理文字訊息（對話流程）
  bot.on('message:text', handleTextMessage);

  // 處理 Callback Query（按鈕點擊）
  bot.on('callback_query:data', handleCallbackQuery);

  return bot;
}

async function handleTextMessage(ctx: BotContext) {
  const { conversation } = ctx.session;
  const text = ctx.message?.text;

  if (!text || conversation.step === ConversationStep.IDLE) {
    return;
  }

  // 根據對話步驟處理輸入
  switch (conversation.step) {
    case ConversationStep.ENTER_AMOUNT:
      await handleAmountInput(ctx, text);
      break;
    case ConversationStep.ENTER_PERIODS:
      await handlePeriodsInput(ctx, text);
      break;
    default:
      // 忽略其他情況
      break;
  }
}

async function handleAmountInput(ctx: BotContext, text: string) {
  const amount = parseFloat(text);

  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ 請輸入有效的金額（數字）');
    return;
  }

  if (amount < 10) {
    await ctx.reply('❌ 最小金額為 10 USDC');
    return;
  }

  if (amount > 100000) {
    await ctx.reply('❌ 最大金額為 100,000 USDC');
    return;
  }

  ctx.session.conversation.data.amountPerPeriod = text;
  ctx.session.conversation.step = ConversationStep.SELECT_INTERVAL;

  await ctx.reply(
    '選擇定投週期：',
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '每日', callback_data: 'interval_daily' },
            { text: '每週', callback_data: 'interval_weekly' },
          ],
          [
            { text: '每兩週', callback_data: 'interval_biweekly' },
            { text: '每月', callback_data: 'interval_monthly' },
          ],
        ],
      },
    }
  );
}

async function handlePeriodsInput(ctx: BotContext, text: string) {
  const periods = parseInt(text, 10);

  if (isNaN(periods) || periods <= 0) {
    await ctx.reply('❌ 請輸入有效的期數（正整數）');
    return;
  }

  if (periods > 365) {
    await ctx.reply('❌ 最大期數為 365 期');
    return;
  }

  ctx.session.conversation.data.totalPeriods = periods;
  ctx.session.conversation.step = ConversationStep.CONFIRM;

  const { data } = ctx.session.conversation;
  const totalAmount = parseFloat(data.amountPerPeriod || '0') * periods;

  await ctx.reply(
    `📊 *確認你的 Smart DCA 設定：*

• 策略：固定金額
• 投入：${data.amountPerPeriod} USDC × ${periods} 期 = ${totalAmount} USDC
• 目標：${data.targetTokens?.[0]?.symbol || 'SUI'}
• 週期：${getIntervalText(data.interval)}

💰 *收益優化已自動啟用：*
• 等待期間資金存入生息金庫
• 預估額外收益：~8-20% APY

確認建立？`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ 確認建立', callback_data: 'confirm_create' },
            { text: '❌ 取消', callback_data: 'cancel_create' },
          ],
        ],
      },
    }
  );
}

async function handleCallbackQuery(ctx: BotContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  await ctx.answerCallbackQuery();

  // 策略選擇
  if (data.startsWith('strategy_')) {
    const strategy = data.replace('strategy_', '');
    ctx.session.conversation.data.strategy = strategy as any;
    ctx.session.conversation.step = ConversationStep.SELECT_TARGET_TOKEN;

    await ctx.editMessageText(
      '選擇目標代幣：',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'SUI', callback_data: 'token_SUI' },
              { text: 'CETUS', callback_data: 'token_CETUS' },
            ],
            [
              { text: 'DEEP', callback_data: 'token_DEEP' },
            ],
          ],
        },
      }
    );
    return;
  }

  // 代幣選擇
  if (data.startsWith('token_')) {
    const token = data.replace('token_', '');
    ctx.session.conversation.data.targetTokens = [
      { token: '', symbol: token, percentage: 100 },
    ];
    ctx.session.conversation.step = ConversationStep.ENTER_AMOUNT;

    await ctx.editMessageText(
      `已選擇 ${token}\n\n請輸入每期投入金額（USDC）：`
    );
    return;
  }

  // 週期選擇
  if (data.startsWith('interval_')) {
    const interval = data.replace('interval_', '');
    ctx.session.conversation.data.interval = interval as any;
    ctx.session.conversation.step = ConversationStep.ENTER_PERIODS;

    await ctx.editMessageText('請輸入定投期數（例如：4 表示執行 4 期）：');
    return;
  }

  // 確認建立
  if (data === 'confirm_create') {
    const { data: configData } = ctx.session.conversation;

    // TODO: 實際調用合約建立倉位
    const positionId = `h2o_dca_${Date.now().toString(36)}`;

    await ctx.editMessageText(
      `✅ *Smart DCA 倉位已建立！*

📋 倉位 ID: \`${positionId}\`

🔄 *運作流程：*
1. 資金已轉換為 H2OUSD
2. 資金已投入生息金庫
3. 每${getIntervalText(configData.interval)}自動執行定投

⏰ 下次執行：${getNextExecutionTime(configData.interval)}

使用 /status ${positionId} 查看詳情`,
      { parse_mode: 'Markdown' }
    );

    // 重置對話狀態
    ctx.session.conversation = {
      step: ConversationStep.IDLE,
      data: {},
    };
    return;
  }

  // 取消建立
  if (data === 'cancel_create') {
    ctx.session.conversation = {
      step: ConversationStep.IDLE,
      data: {},
    };

    await ctx.editMessageText('❌ 已取消建立定投倉位');
    return;
  }
}

function getIntervalText(interval?: string): string {
  const map: Record<string, string> = {
    daily: '每日',
    weekly: '每週',
    biweekly: '每兩週',
    monthly: '每月',
  };
  return map[interval || ''] || interval || '';
}

function getNextExecutionTime(interval?: string): string {
  const now = new Date();
  const msMap: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };
  const ms = msMap[interval || ''] || msMap.weekly;
  const next = new Date(now.getTime() + ms);
  return next.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
}
