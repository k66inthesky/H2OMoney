'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import Link from 'next/link';
import {
  Plus,
  TrendingUp,
  Wallet,
  Clock,
  ArrowUpRight,
  Pause,
  Play,
} from 'lucide-react';

export default function DashboardPage() {
  const account = useCurrentAccount();

  if (!account) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-20 text-center">
        <Wallet className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">請先連接錢包</h1>
        <p className="text-muted-foreground mb-6">
          連接你的 Sui 錢包以查看定投倉位
        </p>
      </div>
    );
  }

  // Mock data
  const stats = {
    totalBalance: '2,500.00',
    totalYield: '125.50',
    activePositions: 3,
    currentApy: 12.5,
  };

  const positions = [
    {
      id: 'h2o_dca_abc123',
      targetToken: 'SUI',
      amountPerPeriod: '100',
      interval: '每週',
      progress: { current: 2, total: 4 },
      status: 'active',
      nextExecution: '2026-02-11 00:00',
      totalInvested: '200',
      totalAcquired: '51.2',
      yieldEarned: '8.5',
    },
    {
      id: 'h2o_dca_def456',
      targetToken: 'CETUS',
      amountPerPeriod: '50',
      interval: '每日',
      progress: { current: 15, total: 30 },
      status: 'active',
      nextExecution: '2026-02-05 00:00',
      totalInvested: '750',
      totalAcquired: '1,250',
      yieldEarned: '12.3',
    },
    {
      id: 'h2o_dca_ghi789',
      targetToken: 'DEEP',
      amountPerPeriod: '200',
      interval: '每月',
      progress: { current: 1, total: 6 },
      status: 'paused',
      nextExecution: '-',
      totalInvested: '200',
      totalAcquired: '4,000',
      yieldEarned: '3.2',
    },
  ];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">儀表板</h1>
          <p className="text-muted-foreground">管理你的 Smart DCA 倉位</p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-lg bg-h2o-500 text-white px-4 py-2 font-medium hover:bg-h2o-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          建立定投
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="總餘額"
          value={`$${stats.totalBalance}`}
          icon={<Wallet className="h-5 w-5" />}
          trend="+5.2%"
        />
        <StatCard
          label="累計收益"
          value={`$${stats.totalYield}`}
          icon={<TrendingUp className="h-5 w-5" />}
          trend="+12.5%"
        />
        <StatCard
          label="活躍倉位"
          value={stats.activePositions.toString()}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="當前 APY"
          value={`${stats.currentApy}%`}
          icon={<ArrowUpRight className="h-5 w-5" />}
          highlight
        />
      </div>

      {/* Positions List */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">定投倉位</h2>
        </div>
        <div className="divide-y">
          {positions.map((position) => (
            <PositionRow key={position.id} position={position} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  trend,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? 'bg-h2o-50 border-h2o-200 dark:bg-h2o-950 dark:border-h2o-800' : 'bg-card'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={highlight ? 'text-h2o-500' : 'text-muted-foreground'}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend && (
          <span className="text-sm text-green-500 font-medium">{trend}</span>
        )}
      </div>
    </div>
  );
}

function PositionRow({ position }: { position: any }) {
  const progress =
    (position.progress.current / position.progress.total) * 100;

  return (
    <Link
      href={`/position/${position.id}`}
      className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
    >
      {/* Token Icon */}
      <div className="h-10 w-10 rounded-full bg-h2o-100 dark:bg-h2o-900 flex items-center justify-center text-h2o-600 dark:text-h2o-400 font-semibold">
        {position.targetToken.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{position.targetToken}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              position.status === 'active'
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-400'
            }`}
          >
            {position.status === 'active' ? '運行中' : '已暫停'}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          {position.amountPerPeriod} USDC / {position.interval}
        </div>
      </div>

      {/* Progress */}
      <div className="hidden sm:block w-32">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>進度</span>
          <span>
            {position.progress.current}/{position.progress.total}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-h2o-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Yield */}
      <div className="hidden md:block text-right">
        <div className="text-sm font-medium text-green-600">
          +${position.yieldEarned}
        </div>
        <div className="text-xs text-muted-foreground">收益</div>
      </div>

      {/* Action */}
      <button
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        onClick={(e) => {
          e.preventDefault();
          // Toggle pause/resume
        }}
      >
        {position.status === 'active' ? (
          <Pause className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Play className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </Link>
  );
}
