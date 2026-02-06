/**
 * H2O Smart DCA Bot - 入口文件
 */

// WSL2 環境 IPv6 不通，強制 Node.js (undici) 使用 IPv4
import { setDefaultAutoSelectFamily } from 'net';
import dns from 'dns';
setDefaultAutoSelectFamily(false);
dns.setDefaultResultOrder('ipv4first');

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

  console.log('✅ Bot token found');

  // 建立並啟動 Bot
  const bot = createBot(botToken);

  console.log('✅ Bot instance created');

  // 啟動定時任務排程器
  startScheduler();

  // 啟動 Bot
  console.log('🚀 Starting bot polling...');
  
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
  console.log('✅ Bot is now listening for messages...');
}

main().catch((error) => {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
});
