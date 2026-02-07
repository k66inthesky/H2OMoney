/**
 * H2O Smart DCA - StableLayer SDK wrapper
 */

import { StableLayerClient } from '../vendor/stable-layer-sdk/index.js';

function normalizeNetwork(value?: string): 'testnet' | 'mainnet' {
  if (!value) return 'testnet';
  const normalized = value.toLowerCase();
  if (normalized === 'testnet' || normalized === 'mainnet') {
    return normalized;
  }
  throw new Error(`Unsupported SUI_NETWORK: ${value}`);
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  if (typeof value === 'string') {
    return BigInt(value);
  }
  throw new Error('StableLayer SDK returned unsupported value type');
}

export class StableLayerService {
  private readonly network: 'testnet' | 'mainnet';
  private readonly brandUsdType: string;

  constructor() {
    this.network = normalizeNetwork(process.env.SUI_NETWORK);
    this.brandUsdType = process.env.STABLELAYER_BRAND_USD_TYPE?.trim() || '';
  }

  private createClient(sender: string): StableLayerClient {
    return new StableLayerClient({
      network: this.network,
      sender,
    });
  }

  async getBrandUsdTotalSupply(sender: string): Promise<bigint> {
    if (!this.brandUsdType) {
      throw new Error('STABLELAYER_BRAND_USD_TYPE is required');
    }
    const client = this.createClient(sender);
    const supply = await client.getTotalSupplyByCoinType(this.brandUsdType);
    return toBigInt(supply);
  }
}

export const stableLayerService = new StableLayerService();
