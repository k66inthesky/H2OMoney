# H2OMoney 💧💰

> Telegram Arbitrage Bot on Sui - Powered by Cetus & stablelayer

[![Sui](https://img.shields.io/badge/Sui-Move%202024-blue)](https://sui.io)
[![Cetus](https://img.shields.io/badge/Cetus-Aggregator-green)](https://www.cetus.zone/)
[![stablelayer](https://img.shields.io/badge/stablelayer-SDK-purple)](https://stablelayer.site/)

## 🌊 Overview

H2OMoney is a Telegram-based arbitrage bot that leverages Sui blockchain's speed and Cetus/stablelayer protocols to identify and execute profitable DeFi arbitrage opportunities.

**Hackathon:** Sui Vibe Hackathon 2026  
**Tracks:** Cetus + stablelayer  
**Team Size:** 2

## ✨ Features

- 🤖 **Telegram Bot Interface** - Easy-to-use chat commands
- 📊 **Real-time Arbitrage Detection** - Monitor price differences across pools
- ⚡ **Fast Execution** - Leverage Sui's high TPS for quick trades
- 🔄 **Cetus Aggregator Integration** - Optimal swap routing
- 💎 **stablelayer Integration** - Stablecoin arbitrage opportunities
- 📈 **Web Dashboard** - Track your bot's performance

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Bot   │────▶│   Bot Server     │────▶│   Sui Network   │
│   (User CLI)    │     │   (TypeScript)   │     │   (Move 2024)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
           ┌──────────────┐      ┌──────────────┐
           │    Cetus     │      │  stablelayer │
           │  Aggregator  │      │     SDK      │
           └──────────────┘      └──────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Sui CLI
- Telegram Bot Token (from @BotFather)

### Installation

```bash
# Clone the repository
git clone https://github.com/[YOUR_USERNAME]/H2OMoney.git
cd H2OMoney

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Build contracts
cd contracts
sui move build

# Start the bot
cd ../bot
npm run dev
```

### Environment Variables

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Sui Network
SUI_NETWORK=testnet  # or mainnet
SUI_PRIVATE_KEY=your_private_key

# Optional
LOG_LEVEL=info
```

## 📁 Project Structure

```
H2OMoney/
├── contracts/          # Sui Move smart contracts
│   ├── sources/
│   └── Move.toml
├── bot/                # Telegram Bot (TypeScript)
│   └── src/
├── webapp/             # Web Dashboard
│   └── src/
├── docs/
│   └── ai-disclosure/  # AI usage disclosure (required)
└── scripts/
```

## 🤖 Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot |
| `/balance` | Check wallet balance |
| `/opportunities` | List current arbitrage opportunities |
| `/execute <id>` | Execute an arbitrage |
| `/history` | View transaction history |
| `/settings` | Configure bot settings |

## 🔗 Live Demo

- **Telegram Bot:** [@H2OMoneyBot](https://t.me/H2OMoneyBot)
- **Web Dashboard:** [https://h2omoney.vercel.app](https://h2omoney.vercel.app)
- **Deployed Contract:** `0x...` (Sui Mainnet/Testnet)

## 📜 AI Disclosure

This project was developed with AI assistance as part of the Sui Vibe Hackathon 2026 requirements.

**AI Tools Used:**
- Claude Code CLI (claude-sonnet-4-20250514)

Full prompt disclosure: [docs/ai-disclosure/prompts-sanitized.md](./docs/ai-disclosure/prompts-sanitized.md)

## 🛠️ Tech Stack

- **Blockchain:** Sui (Move 2024)
- **Smart Contracts:** Move
- **Backend:** TypeScript, Node.js
- **Frontend:** React, Next.js, @mysten/dapp-kit
- **Bot Framework:** grammy / telegraf
- **Protocols:** Cetus Aggregator, Cetus SDK v2, stablelayer SDK

## 📄 License

MIT License - see [LICENSE](./LICENSE)

## 🙏 Acknowledgments

- [Sui Foundation](https://sui.io)
- [Cetus Protocol](https://www.cetus.zone/)
- [stablelayer](https://stablelayer.site/)
- [HOH Community](https://github.com/hoh-zone)

---

**Built with 💧 for Sui Vibe Hackathon 2026**
