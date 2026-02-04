/**
 * H2O Smart DCA Bot - 入口文件
 */

import 'dotenv/config';
import { createBot } from './bot.js';
import { startScheduler } from './scheduler/index.js';

async function main() {
  console.log('🌊 Starting H2O Smart DCA Bot...');

  // 檢查必要環境變數
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  // 建立並啟動 Bot
  const bot = createBot(botToken);

  // 啟動定時任務排程器
  startScheduler();

  // 啟動 Bot
  await bot.start({
    onStart: (botInfo) => {
      console.log(`✅ Bot started as @${botInfo.username}`);
      console.log('📋 Available commands:');
      console.log('   /start - 啟動機器人');
      console.log('   /new - 建立新定投');
      console.log('   /list - 查看所有倉位');
      console.log('   /yield - 查看收益');
      console.log('   /help - 幫助說明');
    },
  });
}

main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
