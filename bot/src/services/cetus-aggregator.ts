/**
 * H2O Smart DCA - Cetus Aggregator SDK wrapper
 */

import { AggregatorClient, Env, type RouterDataV3 } from '@cetusprotocol/aggregator-sdk';
import { SuiClient } from '@mysten/sui/client';
import type { Signer } from '@mysten/sui/cryptography';
import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import BN from 'bn.js';
import { NETWORK, TOKENS } from '../utils/constants.js';

const DEFAULT_CETUS_API_URL = 'https://api-sui.cetus.zone/router_v3';

type TokenInfo = {
  address: string;
  decimals: number;
};

function normalizeNetwork(value?: string): 'testnet' | 'mainnet' {
  if (!value) return 'testnet';
  const normalized = value.toLowerCase();
  if (normalized === 'testnet' || normalized === 'mainnet') {
    return normalized;
  }
  throw new Error(`Unsupported SUI_NETWORK: ${value}`);
}

function toEnv(network: 'testnet' | 'mainnet'): Env {
  return network === 'mainnet' ? Env.Mainnet : Env.Testnet;
}

function getTokenInfo(symbol: string): TokenInfo {
  const token = (TOKENS as Record<string, TokenInfo>)[symbol];
  if (!token || !token.address || token.address.includes('...')) {
    throw new Error(`Unsupported target token: ${symbol}`);
  }
  return token;
}

export class CetusAggregatorService {
  private readonly endpoint: string;
  private readonly network: 'testnet' | 'mainnet';
  private readonly clients = new Map<string, AggregatorClient>();

  constructor() {
    this.endpoint = process.env.CETUS_AGGREGATOR_URL?.trim() || DEFAULT_CETUS_API_URL;
    this.network = normalizeNetwork(process.env.SUI_NETWORK);
  }

  private getClientForSigner(signer: string): AggregatorClient {
    const cached = this.clients.get(signer);
    if (cached) {
      return cached;
    }

    const networkConfig = this.network === 'mainnet' ? NETWORK.MAINNET : NETWORK.TESTNET;
    const client = new AggregatorClient({
      endpoint: this.endpoint,
      signer,
      env: toEnv(this.network),
      client: new SuiClient({ url: networkConfig.rpcUrl }),
    });

    this.clients.set(signer, client);
    return client;
  }

  async findRouters(params: {
    signer: string;
    fromSymbol: string;
    toSymbol: string;
    amountIn: bigint;
  }): Promise<{ router: RouterDataV3; toDecimals: number }> {
    const fromToken =
      params.fromSymbol === 'USDC' ? TOKENS.USDC : getTokenInfo(params.fromSymbol);
    const toToken = getTokenInfo(params.toSymbol);
    const client = this.getClientForSigner(params.signer);

    const router = await client.findRouters({
      from: fromToken.address,
      target: toToken.address,
      amount: new BN(params.amountIn.toString()),
      byAmountIn: true,
    });

    if (!router || router.error) {
      const message = router?.error?.msg || 'Cetus Aggregator failed to find route';
      throw new Error(message);
    }

    return { router, toDecimals: toToken.decimals };
  }

  async buildRouterSwap(params: {
    signer: string;
    router: RouterDataV3;
    inputCoin: TransactionObjectArgument;
    slippage: number;
    txb: Transaction;
  }): Promise<TransactionObjectArgument> {
    const client = this.getClientForSigner(params.signer);
    return client.routerSwap({
      router: params.router,
      inputCoin: params.inputCoin,
      slippage: params.slippage,
      txb: params.txb,
    });
  }

  async devInspectTransaction(signer: string, txb: Transaction) {
    const client = this.getClientForSigner(signer);
    return client.devInspectTransactionBlock(txb);
  }

  async sendTransaction(signer: string, txb: Transaction, keypair: Signer) {
    const client = this.getClientForSigner(signer);
    return client.sendTransaction(txb, keypair);
  }
}

export const cetusAggregatorService = new CetusAggregatorService();
