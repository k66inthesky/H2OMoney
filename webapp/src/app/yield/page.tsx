'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { Wallet, TrendingUp, Droplets, Zap, RefreshCw } from 'lucide-react';

export default function YieldPage() {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-20 text-center">
        <Wallet className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">請先連接錢包</h1>
        <p className="text-muted-foreground">連接你的 Sui 錢包以查看收益分析</p>
      </div>
    );
  }

  // Mock data
  const yieldData = {
    totalDeposited: 2500,
    currentBalance: 2625.5,
    totalYield: 125.5,
    brandUsdYield: 75.3,
    clmmYield: 50.2,
    currentApy: 12.5,
    rebalanceCount: 8,
    lastRebalance: '2026-02-03 14:30 UTC',
  };

  const yieldHistory = [
    { date: '2026-02-04', brandUsd: 2.5, clmm: 1.8, total: 4.3 },
    { date: '2026-02-03', brandUsd: 2.4, clmm: 2.1, total: 4.5 },
    { date: '2026-02-02', brandUsd: 2.3, clmm: 1.5, total: 3.8 },
    { date: '2026-02-01', brandUsd: 2.5, clmm: 1.9, total: 4.4 },
    { date: '2026-01-31', brandUsd: 2.2, clmm: 2.3, total: 4.5 },
    { date: '2026-01-30', brandUsd: 2.4, clmm: 1.7, total: 4.1 },
    { date: '2026-01-29', brandUsd: 2.3, clmm: 2.0, total: 4.3 },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">收益分析</h1>
        <p className="text-muted-foreground">追蹤你的雙層收益表現</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">總存入</span>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">
            ${yieldData.totalDeposited.toLocaleString()}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">當前餘額</span>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold">
            ${yieldData.currentBalance.toLocaleString()}
          </div>
          <div className="text-sm text-green-500">
            +${yieldData.totalYield} ({((yieldData.totalYield / yieldData.totalDeposited) * 100).toFixed(2)}%)
          </div>
        </div>

        <div className="rounded-xl border bg-gradient-to-br from-h2o-50 to-h2o-100 dark:from-h2o-950 dark:to-h2o-900 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-h2o-600 dark:text-h2o-400">當前 APY</span>
            <Zap className="h-4 w-4 text-h2o-500" />
          </div>
          <div className="text-2xl font-bold text-h2o-600 dark:text-h2o-400">
            {yieldData.currentApy}%
          </div>
          <div className="text-sm text-h2o-500">雙層收益</div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">重置次數</span>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold">{yieldData.rebalanceCount}</div>
          <div className="text-xs text-muted-foreground">
            上次：{yieldData.lastRebalance}
          </div>
        </div>
      </div>

      {/* Yield Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Layer 1: BrandUSD */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Droplets className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">第一層：BrandUSD 底層收益</h3>
              <p className="text-sm text-muted-foreground">
                Bucket Protocol 抵押資產收益
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">累計收益</span>
              <span className="font-semibold text-blue-600">
                +${yieldData.brandUsdYield}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">佔比</span>
              <span>
                {((yieldData.brandUsdYield / yieldData.totalYield) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">預估 APY</span>
              <span>~5%</span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-sm text-blue-700 dark:text-blue-300">
            BrandUSD 會自動增值，像「會長大的穩定幣」
          </div>
        </div>

        {/* Layer 2: CLMM */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold">第二層：Cetus CLMM 手續費</h3>
              <p className="text-sm text-muted-foreground">
                集中流動性做市收益
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">累計收益</span>
              <span className="font-semibold text-purple-600">
                +${yieldData.clmmYield}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">佔比</span>
              <span>
                {((yieldData.clmmYield / yieldData.totalYield) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">預估 APY</span>
              <span>~7-15%</span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-purple-50 dark:bg-purple-950 text-sm text-purple-700 dark:text-purple-300">
            窄區間策略 + 自動重置 = 收益最大化
          </div>
        </div>
      </div>

      {/* Yield History */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h3 className="font-semibold">每日收益紀錄</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium">日期</th>
                <th className="text-right p-4 font-medium">BrandUSD 收益</th>
                <th className="text-right p-4 font-medium">CLMM 收益</th>
                <th className="text-right p-4 font-medium">總收益</th>
              </tr>
            </thead>
            <tbody>
              {yieldHistory.map((day) => (
                <tr key={day.date} className="border-b last:border-0">
                  <td className="p-4">{day.date}</td>
                  <td className="p-4 text-right text-blue-600">
                    +${day.brandUsd.toFixed(2)}
                  </td>
                  <td className="p-4 text-right text-purple-600">
                    +${day.clmm.toFixed(2)}
                  </td>
                  <td className="p-4 text-right font-medium text-green-600">
                    +${day.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
