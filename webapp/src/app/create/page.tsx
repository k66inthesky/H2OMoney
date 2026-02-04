'use client';

import { useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowRight,
  Check,
  Droplets,
  TrendingUp,
  Target,
} from 'lucide-react';

type Strategy = 'fixed' | 'limit' | 'multi';
type Interval = 'daily' | 'weekly' | 'biweekly' | 'monthly';

const strategies = [
  {
    id: 'fixed' as Strategy,
    name: '固定金額',
    description: '每期投入相同金額，簡單穩定',
    icon: <Droplets className="h-6 w-6" />,
  },
  {
    id: 'limit' as Strategy,
    name: '智能限價',
    description: '只在目標價格以下買入，等待期間持續生息',
    icon: <Target className="h-6 w-6" />,
  },
  {
    id: 'multi' as Strategy,
    name: '多幣種定投',
    description: '同時定投多個代幣，分散風險',
    icon: <TrendingUp className="h-6 w-6" />,
  },
];

const tokens = ['SUI', 'CETUS', 'DEEP'];

const intervals = [
  { id: 'daily' as Interval, name: '每日', ms: 24 * 60 * 60 * 1000 },
  { id: 'weekly' as Interval, name: '每週', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'biweekly' as Interval, name: '每兩週', ms: 14 * 24 * 60 * 60 * 1000 },
  { id: 'monthly' as Interval, name: '每月', ms: 30 * 24 * 60 * 60 * 1000 },
];

export default function CreatePage() {
  const account = useCurrentAccount();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [strategy, setStrategy] = useState<Strategy>('fixed');
  const [targetToken, setTargetToken] = useState('SUI');
  const [amount, setAmount] = useState('100');
  const [interval, setInterval] = useState<Interval>('weekly');
  const [periods, setPeriods] = useState('4');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!account) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <Wallet className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">請先連接錢包</h1>
        <p className="text-muted-foreground mb-6">
          連接你的 Sui 錢包以建立定投倉位
        </p>
      </div>
    );
  }

  const totalAmount = parseFloat(amount || '0') * parseInt(periods || '0');
  const estimatedYield = totalAmount * 0.08; // 假設 8% APY

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // TODO: 調用合約建立倉位
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    router.push('/dashboard');
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">建立 Smart DCA</h1>
        <p className="text-muted-foreground">
          設定你的智能定投策略，讓等待期間的錢也能生息
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? 'bg-h2o-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step > s ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 4 && (
              <div
                className={`h-0.5 w-8 ${
                  step > s ? 'bg-h2o-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Strategy */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">選擇定投策略</h2>
          <div className="grid gap-4">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setStrategy(s.id);
                  setStep(2);
                }}
                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                  strategy === s.id
                    ? 'border-h2o-500 bg-h2o-50 dark:bg-h2o-950'
                    : 'hover:border-h2o-300'
                }`}
              >
                <div className="h-12 w-12 rounded-lg bg-h2o-100 dark:bg-h2o-900 flex items-center justify-center text-h2o-600 dark:text-h2o-400">
                  {s.icon}
                </div>
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {s.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Token & Amount */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">設定定投參數</h2>

          <div>
            <label className="block text-sm font-medium mb-2">目標代幣</label>
            <div className="flex gap-2">
              {tokens.map((token) => (
                <button
                  key={token}
                  onClick={() => setTargetToken(token)}
                  className={`px-4 py-2 rounded-lg border font-medium transition-all ${
                    targetToken === token
                      ? 'border-h2o-500 bg-h2o-50 text-h2o-600 dark:bg-h2o-950 dark:text-h2o-400'
                      : 'hover:border-h2o-300'
                  }`}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              每期投入金額 (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="10"
              max="100000"
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-h2o-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              最小 10 USDC，最大 100,000 USDC
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
            >
              上一步
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!amount || parseFloat(amount) < 10}
              className="flex-1 px-6 py-3 rounded-lg bg-h2o-500 text-white font-medium hover:bg-h2o-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Interval & Periods */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">設定週期</h2>

          <div>
            <label className="block text-sm font-medium mb-2">定投週期</label>
            <div className="grid grid-cols-2 gap-2">
              {intervals.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setInterval(i.id)}
                  className={`px-4 py-3 rounded-lg border font-medium transition-all ${
                    interval === i.id
                      ? 'border-h2o-500 bg-h2o-50 text-h2o-600 dark:bg-h2o-950 dark:text-h2o-400'
                      : 'hover:border-h2o-300'
                  }`}
                >
                  {i.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">定投期數</label>
            <input
              type="number"
              value={periods}
              onChange={(e) => setPeriods(e.target.value)}
              placeholder="4"
              min="1"
              max="365"
              className="w-full px-4 py-3 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-h2o-500"
            />
            <p className="text-xs text-muted-foreground mt-1">
              最少 1 期，最多 365 期
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
            >
              上一步
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!periods || parseInt(periods) < 1}
              className="flex-1 px-6 py-3 rounded-lg bg-h2o-500 text-white font-medium hover:bg-h2o-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一步
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">確認定投設定</h2>

          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">策略</span>
              <span className="font-medium">
                {strategies.find((s) => s.id === strategy)?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">目標代幣</span>
              <span className="font-medium">{targetToken}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">每期金額</span>
              <span className="font-medium">{amount} USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">週期</span>
              <span className="font-medium">
                {intervals.find((i) => i.id === interval)?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">期數</span>
              <span className="font-medium">{periods} 期</span>
            </div>
            <hr />
            <div className="flex justify-between text-lg">
              <span className="font-medium">總投入</span>
              <span className="font-bold">{totalAmount.toFixed(2)} USDC</span>
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 p-4">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
              <TrendingUp className="h-5 w-5" />
              收益優化已啟用
            </div>
            <p className="text-sm text-green-600 dark:text-green-500">
              等待期間資金將自動存入生息金庫，預估額外收益：
              <span className="font-semibold">
                {' '}
                ~${estimatedYield.toFixed(2)} ({((estimatedYield / totalAmount) * 100).toFixed(1)}%)
              </span>
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(3)}
              className="px-6 py-3 rounded-lg border font-medium hover:bg-muted transition-colors"
            >
              上一步
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-h2o-500 text-white font-medium hover:bg-h2o-600 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  建立中...
                </>
              ) : (
                <>
                  確認建立
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
