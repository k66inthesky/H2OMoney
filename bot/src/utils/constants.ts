/**
 * H2O Smart DCA - Bot 常數（從 shared 複製）
 */

// ============ 合約地址 (Testnet) ============

export const CONTRACT_ADDRESSES = {
  // H2O Smart DCA Package (V3)
  PACKAGE_ID: '0x80c0e4bad8df4871589581ff679ce214a18c7357b063376c3f425b73a34a05f0',

  // H2OUSD TreasuryCap
  H2OUSD_TREASURY_CAP: '0x1a38f77f1d6f2de33e72034b398a9d4734ece6eb3d30dff04b33c40aeb9a4e9e',

  // Secure Vault (Shared Object)
  VAULT_CONFIG: '0x629a54343d8ec44e333edd9793d1df573c5329f37743d194ddb3a5b853f904ce',

  // Original Package ID (for reference)
  ORIGINAL_PACKAGE_ID: '0x1823aa8a2c15773de65c06ccb5e801be4edb8e4266513dd680865f6ff5220f2c',
} as const;

// ============ 代幣地址 ============

export const TOKENS = {
  SUI: {
    address: '0x2::sui::SUI',
    symbol: 'SUI',
    name: 'Sui',
    decimals: 9,
    iconUrl: 'https://cryptologos.cc/logos/sui-sui-logo.png',
  },
  USDC: {
    address: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    decimals: 6,
    iconUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
} as const;

// ============ 網路配置 ============

export const NETWORK = {
  MAINNET: {
    rpcUrl: 'https://fullnode.mainnet.sui.io:443',
    explorerUrl: 'https://suiscan.xyz/mainnet',
  },
  TESTNET: {
    rpcUrl: 'https://fullnode.testnet.sui.io:443',
    explorerUrl: 'https://suiscan.xyz/testnet',
  },
} as const;

// ============ Bot 配置 ============

export const BOT_CONFIG = {
  MESSAGES: {
    WELCOME: `
🌊 *歡迎使用 H2O Smart DCA！*

會賺錢的定投機器人 - 讓等待期間的錢也能生息。

📋 *主要功能：*
• 智能定投 - 定期自動買入目標代幣
• 收益優化 - 閒置資金自動存入生息金庫
• 多策略支援 - 固定金額、限價、多幣種

使用 /new 開始建立你的第一個定投倉位
使用 /help 查看所有指令
    `,
    HELP: `
📖 *H2O Smart DCA 指令說明*

🔗 *錢包相關*
/connect - 連接 Sui 錢包

💰 *定投管理*
/new - 建立新定投倉位
/list - 查看所有倉位
/status <id> - 查看倉位詳情
/pause <id> - 暫停定投
/resume <id> - 恢復定投
/close <id> - 關閉倉位

📊 *收益查詢*
/yield - 查看收益統計

⚙️ *設定*
/settings - 偏好設定
/help - 顯示此說明
    `,
    NO_WALLET: '❌ 請先使用 /connect 連接錢包',
    NO_POSITIONS: '📭 你還沒有任何定投倉位，使用 /new 建立一個吧！',
    POSITION_NOT_FOUND: '❌ 找不到指定的倉位',
    INVALID_INPUT: '❌ 輸入格式不正確，請重試',
  },
} as const;
