/**
 * H2O Smart DCA - Sui 客戶端服務
 */

import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { TransactionBlock } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { NETWORK, CONTRACT_ADDRESSES, TOKENS } from '../../../shared/constants/index.js';

export class SuiClientService {
  private client: SuiClient;
  private keypair: Ed25519Keypair | null = null;

  constructor(network: 'TESTNET' | 'MAINNET' = 'TESTNET') {
    this.client = new SuiClient({ url: NETWORK[network].rpcUrl });
  }

  /**
   * 設置簽名密鑰對（用於 keeper 或 admin 操作）
   */
  setKeypair(privateKey: string) {
    const keyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
    this.keypair = Ed25519Keypair.fromSecretKey(keyBytes);
  }

  /**
   * 獲取地址
   */
  getAddress(): string {
    if (!this.keypair) {
      throw new Error('Keypair not set');
    }
    return this.keypair.getPublicKey().toSuiAddress();
  }

  /**
   * 查詢金庫狀態
   */
  async getVaultState() {
    try {
      const vaultObject = await this.client.getObject({
        id: CONTRACT_ADDRESSES.VAULT_CONFIG,
        options: {
          showContent: true,
          showOwner: true,
        },
      });

      if (vaultObject.data?.content?.dataType !== 'moveObject') {
        throw new Error('Invalid vault object');
      }

      const fields = vaultObject.data.content.fields as any;

      return {
        id: CONTRACT_ADDRESSES.VAULT_CONFIG,
        totalAssets: BigInt(fields.total_assets || 0),
        totalDeposited: BigInt(fields.total_deposited || 0),
        totalWithdrawn: BigInt(fields.total_withdrawn || 0),
        totalYieldEarned: BigInt(fields.total_yield_earned || 0),
        totalUsers: Number(fields.total_users || 0),
        depositPaused: Boolean(fields.deposit_paused),
        withdrawalPaused: Boolean(fields.withdrawal_paused),
      };
    } catch (error) {
      console.error('Failed to get vault state:', error);
      throw error;
    }
  }

  /**
   * 查詢用戶在金庫中的存款信息
   */
  async getUserDepositInfo(userAddress: string) {
    try {
      // TODO: 需要實作從 Table 中查詢用戶信息的方法
      // 暫時返回模擬數據
      return {
        totalDeposited: 0n,
        h2ousdBalance: 0n,
        lastDepositTime: 0,
        lastWithdrawalTime: 0,
      };
    } catch (error) {
      console.error('Failed to get user deposit info:', error);
      throw error;
    }
  }

  /**
   * 查詢用戶的所有 H2OUSD 和 Receipt
   */
  async getUserAssets(userAddress: string) {
    try {
      const objects = await this.client.getOwnedObjects({
        owner: userAddress,
        options: {
          showType: true,
          showContent: true,
        },
      });

      const h2ousdCoins: any[] = [];
      const receipts: any[] = [];

      for (const obj of objects.data) {
        const type = obj.data?.type;
        if (!type) continue;

        // 檢查是否為 H2OUSD Coin
        if (type.includes('::h2o_usd::H2O_USD>')) {
          h2ousdCoins.push({
            id: obj.data.objectId,
            balance: (obj.data.content as any)?.fields?.balance || '0',
          });
        }

        // 檢查是否為 DepositReceipt
        if (type.includes('::SecureDepositReceipt')) {
          const fields = (obj.data.content as any)?.fields;
          receipts.push({
            id: obj.data.objectId,
            owner: fields?.owner,
            vaultId: fields?.vault_id,
            usdcDeposited: fields?.usdc_deposited,
            h2ousdMinted: fields?.h2ousd_minted,
            depositTime: fields?.deposit_time,
            unlockTime: fields?.unlock_time,
            canWithdrawAfter: fields?.can_withdraw_after,
          });
        }
      }

      return {
        h2ousdCoins,
        receipts,
        totalH2OUSD: h2ousdCoins.reduce(
          (sum, coin) => sum + BigInt(coin.balance),
          0n
        ),
      };
    } catch (error) {
      console.error('Failed to get user assets:', error);
      throw error;
    }
  }

  /**
   * 存款到金庫
   */
  async deposit(
    usdcCoinId: string,
    amount: bigint
  ): Promise<SuiTransactionBlockResponse> {
    if (!this.keypair) {
      throw new Error('Keypair not set');
    }

    try {
      const tx = new TransactionBlock();

      // 分割 USDC coin 如果需要
      const [coinToUse] = tx.splitCoins(tx.object(usdcCoinId), [amount]);

      // 調用 secure_deposit_entry
      tx.moveCall({
        target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::h2o_vault_v3_secure::secure_deposit_entry`,
        arguments: [
          tx.object(CONTRACT_ADDRESSES.VAULT_CONFIG), // vault
          coinToUse, // usdc coin
          tx.object('0x6'), // clock
        ],
        typeArguments: [TOKENS.USDC.address],
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return result;
    } catch (error) {
      console.error('Failed to deposit:', error);
      throw error;
    }
  }

  /**
   * 從金庫提款
   */
  async withdraw(
    h2ousdCoinId: string,
    receiptId: string,
    minUsdcOut: bigint
  ): Promise<SuiTransactionBlockResponse> {
    if (!this.keypair) {
      throw new Error('Keypair not set');
    }

    try {
      const tx = new TransactionBlock();

      // 調用 secure_withdraw_entry
      tx.moveCall({
        target: `${CONTRACT_ADDRESSES.PACKAGE_ID}::h2o_vault_v3_secure::secure_withdraw_entry`,
        arguments: [
          tx.object(CONTRACT_ADDRESSES.VAULT_CONFIG), // vault
          tx.object(h2ousdCoinId), // h2ousd coin
          tx.object(receiptId), // receipt
          tx.pure.u64(minUsdcOut), // min_usdc_out
          tx.object('0x6'), // clock
        ],
        typeArguments: [TOKENS.USDC.address],
      });

      const result = await this.client.signAndExecuteTransactionBlock({
        signer: this.keypair,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showEvents: true,
        },
      });

      return result;
    } catch (error) {
      console.error('Failed to withdraw:', error);
      throw error;
    }
  }

  /**
   * 計算 H2OUSD 當前價值
   */
  async getH2OUSDValue(): Promise<number> {
    try {
      const vaultState = await this.getVaultState();

      // 查詢 H2OUSD 總供應量
      // TODO: 需要實作查詢 TreasuryCap 的方法
      // 暫時使用估算值
      const totalSupply = vaultState.totalDeposited;

      if (totalSupply === 0n) {
        return 1.0; // 初始價值 1:1
      }

      // H2OUSD Value = Total Assets / Total Supply
      const value = Number(vaultState.totalAssets) / Number(totalSupply);

      return value;
    } catch (error) {
      console.error('Failed to get H2OUSD value:', error);
      return 1.0; // 發生錯誤時返回默認值
    }
  }

  /**
   * 查詢交易狀態
   */
  async getTransaction(digest: string) {
    return await this.client.getTransactionBlock({
      digest,
      options: {
        showEffects: true,
        showEvents: true,
        showInput: true,
      },
    });
  }

  /**
   * 獲取用戶餘額
   */
  async getBalance(address: string, coinType: string): Promise<bigint> {
    try {
      const balance = await this.client.getBalance({
        owner: address,
        coinType,
      });
      return BigInt(balance.totalBalance);
    } catch (error) {
      console.error('Failed to get balance:', error);
      return 0n;
    }
  }

  /**
   * 獲取 Gas Coins
   */
  async getGasCoins(address: string) {
    const coins = await this.client.getCoins({
      owner: address,
      coinType: '0x2::sui::SUI',
    });
    return coins.data;
  }
}

// 導出單例實例
export const suiClient = new SuiClientService('TESTNET');
