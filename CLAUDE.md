# H2OMoney - Sui Vibe Hackathon 2026

## 專案概述
H2OMoney 是一款基於 Sui 區塊鏈的 Telegram 套利機器人，整合 Cetus 聚合器和 stablelayer SDK，為用戶提供自動化的 DeFi 套利服務。

**參賽賽道：** Cetus + stablelayer（雙賽道）

## 技術棧

### 區塊鏈層
- **Sui Move 2024** - 智能合約開發（必須使用最新語法）
- **Sui SDK (TypeScript)** - 最新版本，不使用 deprecated API
- **Cetus Aggregator** - https://github.com/CetusProtocol/aggregator
- **Cetus SDK v2** - https://github.com/CetusProtocol/cetus-sdk-v2
- **stablelayer SDK** - https://github.com/StableLayer/stable-layer-sdk

### 應用層
- **Telegram Bot API** - grammy 或 telegraf 框架
- **TypeScript** - 主要開發語言
- **Node.js** - 運行環境

### 前端（dApp 展示頁）
- **React / Next.js** - 展示套利數據和機器人狀態
- **@mysten/dapp-kit** - Sui 錢包連接

## 開發規範

### Move 合約
- 使用 Move 2024 edition 語法
- 合約部署到 Sui testnet/mainnet
- 遵循 Sui Move 最佳實踐

### TypeScript
- 嚴格模式 (strict: true)
- 使用 ESM 模組
- 錯誤處理必須完整

### 代碼風格
- 變數/函數：camelCase
- 類型/介面：PascalCase
- 常數：UPPER_SNAKE_CASE
- 檔案名：kebab-case

## 專案結構
```
H2OMoney/
├── CLAUDE.md                    # 此配置文件
├── README.md                    # 專案說明（部署和運行指南）
├── contracts/                   # Sui Move 智能合約
│   ├── sources/
│   └── Move.toml
├── bot/                         # Telegram Bot
│   ├── src/
│   └── package.json
├── webapp/                      # dApp 展示頁面
│   ├── src/
│   └── package.json
├── docs/
│   └── ai-disclosure/           # AI 使用披露（黑客松必需）
│       ├── prompts-log.md       # 原始 prompt 記錄
│       └── prompts-sanitized.md # 去敏版本（提交用）
└── .env.example                 # 環境變數範例
```

## AI 使用披露規則（黑客松強制要求）

### 使用的 AI 工具
- **Claude Code CLI** (Anthropic)
- 模型版本：[每次記錄時更新]

### Prompt 記錄要求
1. 每次重要對話後，將 prompt 摘要記錄到 `docs/ai-disclosure/prompts-log.md`
2. 提交前製作去敏版本到 `prompts-sanitized.md`

### 去敏規則
將以下內容替換：
- API Keys → `[REDACTED_API_KEY]`
- 私鑰/助記詞 → `[REDACTED_SECRET]`
- 個人郵件 → `[REDACTED_EMAIL]`
- 內部 URL → `[REDACTED_URL]`
- Telegram Bot Token → `[REDACTED_BOT_TOKEN]`
- 錢包地址（如需保密）→ `[REDACTED_WALLET]`

## 開發指令

### 合約
```bash
cd contracts
sui move build
sui move test
sui client publish --gas-budget 100000000
```

### Bot
```bash
cd bot
npm install
npm run dev
```

### WebApp
```bash
cd webapp
npm install
npm run dev
```

## 注意事項
- ⚠️ 專案必須在 2026/1/27 之後創建（commit history 可驗證）
- ⚠️ 必須有可運行的 Web App，不接受只有代碼的提交
- ⚠️ 所有代碼必須開源
- ⚠️ AI 使用必須完整披露，否則取消資格

## 參考資源
- [Cetus Aggregator 文檔](https://github.com/CetusProtocol/aggregator)
- [stablelayer 文檔](https://docs.stablelayer.site/)
- [Sui Move 官方文檔](https://docs.sui.io/concepts/sui-move-concepts)
- [Sui SDK 文檔](https://sdk.mystenlabs.com/typescript)
