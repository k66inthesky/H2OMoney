#!/usr/bin/env node

/**
 * H2OMoney - Prompt 去敏腳本
 * 
 * 使用方式：
 * node scripts/sanitize-prompts.js
 * 
 * 這個腳本會讀取 docs/ai-disclosure/prompts-log.md
 * 並產生去敏版本到 docs/ai-disclosure/prompts-sanitized.md
 */

const fs = require('fs');
const path = require('path');

// 去敏規則 - 根據你的實際情況調整這些 patterns
const REDACTION_RULES = [
  // API Keys (常見格式)
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: '[REDACTED_API_KEY]' },
  { pattern: /api[_-]?key['":\s]*['"]*[a-zA-Z0-9_-]{20,}['"]*]/gi, replacement: '[REDACTED_API_KEY]' },
  
  // Telegram Bot Token
  { pattern: /\d{8,10}:[A-Za-z0-9_-]{35}/g, replacement: '[REDACTED_BOT_TOKEN]' },
  
  // 私鑰 (Sui/ETH 格式)
  { pattern: /0x[a-fA-F0-9]{64}/g, replacement: '[REDACTED_SECRET]' },
  { pattern: /suiprivkey[a-zA-Z0-9]{40,}/g, replacement: '[REDACTED_SECRET]' },
  
  // 助記詞 (12/24 個單詞)
  { pattern: /\b([a-z]+\s){11,23}[a-z]+\b/gi, replacement: '[REDACTED_MNEMONIC]' },
  
  // Email
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
  
  // 內部 URL (根據你的情況調整)
  { pattern: /https?:\/\/localhost[:\d]*/g, replacement: '[REDACTED_LOCAL_URL]' },
  { pattern: /https?:\/\/192\.168\.\d+\.\d+[:\d]*/g, replacement: '[REDACTED_INTERNAL_URL]' },
  { pattern: /https?:\/\/10\.\d+\.\d+\.\d+[:\d]*/g, replacement: '[REDACTED_INTERNAL_URL]' },
  
  // 錢包地址 (如果需要隱藏的話，取消下面的註解)
  // { pattern: /0x[a-fA-F0-9]{40,64}/g, replacement: '[REDACTED_WALLET]' },
];

// 額外的自訂敏感詞列表
const SENSITIVE_WORDS = [
  // 在這裡加入你的敏感詞
  // { word: 'my-secret-project', replacement: '[REDACTED_PROJECT]' },
];

function sanitize(content) {
  let result = content;
  
  // 套用正則規則
  for (const rule of REDACTION_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  
  // 套用敏感詞替換
  for (const item of SENSITIVE_WORDS) {
    result = result.replaceAll(item.word, item.replacement);
  }
  
  return result;
}

function main() {
  const inputPath = path.join(__dirname, '../docs/ai-disclosure/prompts-log.md');
  const outputPath = path.join(__dirname, '../docs/ai-disclosure/prompts-sanitized.md');
  
  // 檢查輸入檔案是否存在
  if (!fs.existsSync(inputPath)) {
    console.error('❌ 找不到 prompts-log.md');
    console.log('請先在 docs/ai-disclosure/prompts-log.md 記錄你的 prompts');
    process.exit(1);
  }
  
  // 讀取原始內容
  const originalContent = fs.readFileSync(inputPath, 'utf-8');
  
  // 去敏
  const sanitizedContent = sanitize(originalContent);
  
  // 加入標頭說明
  const header = `<!-- 
  ⚠️ 這是自動產生的去敏版本
  產生時間: ${new Date().toISOString()}
  原始檔案: prompts-log.md
  
  請在提交前人工檢查是否有遺漏的敏感資訊！
-->

`;
  
  // 寫入去敏版本
  fs.writeFileSync(outputPath, header + sanitizedContent, 'utf-8');
  
  console.log('✅ 去敏完成！');
  console.log(`   輸入: ${inputPath}`);
  console.log(`   輸出: ${outputPath}`);
  console.log('');
  console.log('⚠️  請人工檢查輸出檔案，確保沒有遺漏的敏感資訊');
}

main();
