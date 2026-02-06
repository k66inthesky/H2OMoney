# H2O Smart DCA Telegram Bot

會賺錢的定投機器人 - 讓等待期間的錢也能生息。

## 功能特點

- 🤖 **Telegram Bot 介面** - 友善的對話式操作
- 💰 **智能定投** - 定期自動買入目標代幣
- 📈 **收益優化** - 閒置資金自動存入生息金庫
- 🔄 **多策略支援** - 固定金額、限價、多幣種
- ⏰ **自動執行** - 無需手動操作，定時自動買入

## 前置需求

- Node.js >= 18.0.0
- Telegram Bot Token ([從 @BotFather 獲取](https://t.me/botfather))
- Sui Testnet 錢包（用於 keeper 操作）

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 配置環境變數

複製 `.env.example` 為 `.env` 並填入你的配置：

```bash
cp .env.example .env
```

編輯 `.env`：

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
SUI_NETWORK=TESTNET
```

### 3. 運行 Bot

開發模式（熱重載）：

```bash
npm run dev
```

生產模式：

```bash
npm run build
npm start
```

## 已部署的合約

Bot 連接到以下 Sui Testnet 合約：

- **Package ID**: `0x80c0e4bad8df4871589581ff679ce214a18c7357b063376c3f425b73a34a05f0`
- **Vault Config**: `0x629a54343d8ec44e333edd9793d1df573c5329f37743d194ddb3a5b853f904ce`
- **H2OUSD Treasury**: `0x1a38f77f1d6f2de33e72034b398a9d4734ece6eb3d30dff04b33c40aeb9a4e9e`

## Bot 指令

### 基本指令

- `/start` - 啟動機器人
- `/help` - 查看幫助說明
- `/connect` - 連接 Sui 錢包

### 倉位管理

- `/new` - 建立新的定投倉位
- `/list` - 查看所有倉位
- `/status <id>` - 查看倉位詳情
- `/pause <id>` - 暫停定投
- `/resume <id>` - 恢復定投
- `/close <id>` - 關閉倉位

### 收益查詢

- `/yield` - 查看收益統計

## 使用流程

### 1. 建立定投倉位

```
用戶: /new
Bot:  選擇定投策略：
      1. 固定金額
      2. 智能限價
      3. 多幣種

用戶: 1
Bot:  選擇目標代幣：SUI / CETUS / DEEP

用戶: SUI
Bot:  設定每期投入金額（USDC）：

用戶: 100
Bot:  選擇定投週期：每日 / 每週 / 每兩週 / 每月

用戶: 每週
Bot:  定投幾期？

用戶: 4
Bot:  確認建立 Smart DCA 倉位...
```

### 2. 查看倉位

```
用戶: /list
Bot:  📋 你的 Smart DCA 倉位

      🟢 h2o_dca_abc123
         USDC → SUI
         100 USDC / 每週
         進度：1/4 期
```

### 3. 查看詳情

```
用戶: /status h2o_dca_abc123
Bot:  📊 倉位詳情

      ID: h2o_dca_abc123
      狀態: 🟢 運行中

      累計投入: 100 USDC
      累計獲得: 25.5 SUI
      平均價格: 3.92 USDC

      累計收益: 5.2 USDC
      當前 APY: ~12%
```

## 架構說明

```
bot/
├── src/
│   ├── index.ts           # 入口文件
│   ├── bot.ts             # Bot 初始化與對話流程
│   ├── commands/          # 指令處理
│   │   └── index.ts
│   ├── services/          # 業務邏輯層
│   │   ├── sui-client.ts       # Sui 區塊鏈交互
│   │   ├── position-service.ts # 倉位管理
│   │   └── index.ts
│   └── scheduler/         # 定時任務
│       └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 定時任務

Bot 包含以下自動執行任務：

1. **執行待處理的 DCA** - 每 5 分鐘
   - 檢查到期的倉位
   - 從金庫提取資金
   - 通過 Cetus Aggregator 執行交易
   - 發送執行通知

2. **檢查 CLMM 重置** - 每小時
   - 檢查 LP 位置是否需要重置
   - 自動調整到最優區間

3. **更新收益統計** - 每 30 分鐘
   - 計算累積收益
   - 更新 APY

## 開發說明

### 添加新指令

1. 在 `commands/index.ts` 中添加處理函數
2. 在 `bot.ts` 中註冊指令
3. 更新 `BOT_CONFIG.MESSAGES.HELP`

### 添加新服務

1. 在 `services/` 目錄下創建新文件
2. 實作業務邏輯
3. 在 `services/index.ts` 中導出

### 測試

```bash
# 類型檢查
npm run typecheck

# Linting
npm run lint
```

## 注意事項

⚠️ **當前限制**：

1. 錢包連接功能需要配合 WebApp 實作
2. 倉位數據存儲在內存中（重啟會丟失）
3. 實際的合約調用部分使用模擬數據
4. Cetus Aggregator 整合待完成

📝 **生產部署前需要**：

1. 添加數據庫存儲（PostgreSQL / MongoDB）
2. 完成錢包連接流程
3. 整合 Cetus SDK 執行實際交易
4. 添加錯誤監控與告警
5. 實作用戶通知系統

## 相關資源

- [Sui 文檔](https://docs.sui.io/)
- [Grammy Bot Framework](https://grammy.dev/)
- [Cetus Protocol](https://www.cetus.zone/)
- [專案主 README](../README.md)

## License

MIT
