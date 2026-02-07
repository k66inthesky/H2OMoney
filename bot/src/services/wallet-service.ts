/**
 * H2O Smart DCA - 託管錢包服務
 *
 * 為每個 Telegram 用戶產生 Sui keypair，
 * 用戶把 USDC + SUI 轉到該地址，Bot 代為簽名執行鏈上交易。
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WALLETS_PATH = path.resolve(__dirname, '../../data/wallets.json');

interface WalletRecord {
  userId: number;
  address: string;
  secretKey: string; // Sui bech32 secret key (suiprivkey...)
  createdAt: number;
}

interface WalletsFile {
  wallets: Record<string, WalletRecord>;
}

class WalletService {
  private wallets: Map<number, WalletRecord> = new Map();

  constructor() {
    this.load();
  }

  /**
   * 從 wallets.json 載入已有錢包
   */
  private load() {
    try {
      if (fs.existsSync(WALLETS_PATH)) {
        const raw = fs.readFileSync(WALLETS_PATH, 'utf-8');
        const data: WalletsFile = JSON.parse(raw);
        for (const [key, record] of Object.entries(data.wallets)) {
          this.wallets.set(record.userId, record);
        }
        console.log(`📁 Loaded ${this.wallets.size} wallet(s) from storage`);
      }
    } catch (error) {
      console.error('Failed to load wallets:', error);
    }
  }

  /**
   * 持久化到 wallets.json
   */
  private save() {
    const data: WalletsFile = { wallets: {} };
    for (const [userId, record] of this.wallets) {
      data.wallets[String(userId)] = record;
    }

    const dir = path.dirname(WALLETS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(WALLETS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 為用戶建立新錢包
   */
  createWallet(userId: number): WalletRecord {
    if (this.wallets.has(userId)) {
      return this.wallets.get(userId)!;
    }

    const keypair = new Ed25519Keypair();
    const address = keypair.getPublicKey().toSuiAddress();
    const secretKey = keypair.getSecretKey();

    const record: WalletRecord = {
      userId,
      address,
      secretKey,
      createdAt: Date.now(),
    };

    this.wallets.set(userId, record);
    this.save();

    console.log(`🔑 Created wallet for user ${userId}: ${address}`);
    return record;
  }

  /**
   * 用戶是否已有錢包
   */
  hasWallet(userId: number): boolean {
    return this.wallets.has(userId);
  }

  /**
   * 取得用戶錢包資訊
   */
  getWallet(userId: number): WalletRecord | undefined {
    return this.wallets.get(userId);
  }

  /**
   * 取得用戶地址
   */
  getAddress(userId: number): string | undefined {
    return this.wallets.get(userId)?.address;
  }

  /**
   * 透過地址取得 userId
   */
  getUserIdByAddress(address: string): number | undefined {
    for (const [userId, record] of this.wallets.entries()) {
      if (record.address === address) {
        return userId;
      }
    }
    return undefined;
  }

  /**
   * 從存儲重建 keypair 用於簽名
   */
  getKeypair(userId: number): Ed25519Keypair {
    const record = this.wallets.get(userId);
    if (!record) {
      throw new Error(`No wallet found for user ${userId}`);
    }

    if (record.secretKey.startsWith('suiprivkey')) {
      return Ed25519Keypair.fromSecretKey(record.secretKey);
    }

    const decoded = Buffer.from(record.secretKey, 'base64').toString('utf-8');
    if (!decoded.startsWith('suiprivkey')) {
      throw new Error('Invalid stored secret key format');
    }
    return Ed25519Keypair.fromSecretKey(decoded);
  }

  /**
   * 透過地址取得 keypair
   */
  getKeypairByAddress(address: string): Ed25519Keypair {
    const userId = this.getUserIdByAddress(address);
    if (userId === undefined) {
      throw new Error(`No wallet found for address ${address}`);
    }
    return this.getKeypair(userId);
  }
}

export const walletService = new WalletService();
