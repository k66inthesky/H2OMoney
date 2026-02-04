'use client';

import Link from 'next/link';
import { ArrowRight, Droplets, TrendingUp, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="water-bg text-white py-24 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm backdrop-blur-sm">
            <Droplets className="h-4 w-4" />
            <span>Sui Vibe Hackathon 2026</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            H2O Smart DCA
          </h1>
          <p className="text-2xl md:text-3xl mb-4 opacity-90">
            會賺錢的定投機器人
          </p>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto opacity-80">
            讓等待期間的錢也能自動生息。透過 BrandUSD 底層收益與 Cetus CLMM
            手續費，實現 8-20% APY 雙層收益。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-h2o-600 px-8 py-4 text-lg font-semibold hover:bg-white/90 transition-colors"
            >
              開始定投
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-white/50 px-8 py-4 text-lg font-semibold hover:bg-white/10 transition-colors"
            >
              了解更多
            </Link>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Problem */}
            <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-8 border border-red-200 dark:border-red-900">
              <h3 className="text-xl font-semibold text-red-600 mb-4">
                傳統 DCA 的問題
              </h3>
              <div className="space-y-4 text-red-700 dark:text-red-400">
                <p>存入 400 USDC → 等待 4 週 → 每週買 100 USDC 的 SUI</p>
                <p className="font-semibold">
                  問題：300 USDC 在等待期間完全沒收益 ❌
                </p>
                <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <p className="text-sm">等待買入的錢是「死錢」</p>
                </div>
              </div>
            </div>

            {/* Solution */}
            <div className="bg-green-50 dark:bg-green-950/20 rounded-2xl p-8 border border-green-200 dark:border-green-900">
              <h3 className="text-xl font-semibold text-green-600 mb-4">
                H2O Smart DCA 解決方案
              </h3>
              <div className="space-y-4 text-green-700 dark:text-green-400">
                <p>存入 400 USDC → 自動轉 H2OUSD 生息 → 每週取出 100 買 SUI</p>
                <p className="font-semibold">
                  等待期間的錢也在賺利息 ✅
                </p>
                <div className="mt-4 p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <p className="text-sm">
                    預估額外收益：8-20% APY
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">核心功能</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            像水一樣靈活，像複利一樣強大
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Droplets className="h-8 w-8" />}
              title="雙層收益"
              description="BrandUSD 底層收益 + Cetus CLMM 手續費，雙重收益來源"
            />
            <FeatureCard
              icon={<TrendingUp className="h-8 w-8" />}
              title="智能定投"
              description="支援固定金額、限價買入、多幣種等多種策略"
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8" />}
              title="自動重置"
              description="金庫機器人自動調整 LP 區間，確保收益最大化"
            />
            <FeatureCard
              icon={<Shield className="h-8 w-8" />}
              title="非託管設計"
              description="資金存放鏈上合約，安全透明，隨時可提取"
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-4">運作流程</h2>
          <p className="text-muted-foreground text-center mb-12">
            簡單四步驟，開始你的智能定投之旅
          </p>

          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number={1}
              title="設定策略"
              description="選擇定投金額、週期、目標代幣"
            />
            <StepCard
              number={2}
              title="存入資金"
              description="USDC 自動轉換為 H2OUSD 並存入生息金庫"
            />
            <StepCard
              number={3}
              title="自動執行"
              description="每期自動從金庫提取並透過 Cetus 買入"
            />
            <StepCard
              number={4}
              title="收穫收益"
              description="獲得目標代幣 + 等待期間的生息收益"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">準備好開始了嗎？</h2>
          <p className="text-muted-foreground mb-8">
            使用 Telegram Bot 或 Web App 開始你的第一筆智能定投
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://t.me/H2OSmartDCABot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0088cc] text-white px-8 py-4 text-lg font-semibold hover:bg-[#0088cc]/90 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.248-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.752-.244-1.349-.374-1.297-.789.027-.216.324-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141a.506.506 0 01.171.325c.016.093.036.306.02.472z" />
              </svg>
              Telegram Bot
            </a>
            <Link
              href="/create"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-h2o-500 text-white px-8 py-4 text-lg font-semibold hover:bg-h2o-600 transition-colors"
            >
              Web App 開始
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card-hover rounded-2xl border bg-card p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-h2o-100 text-h2o-600 dark:bg-h2o-900 dark:text-h2o-400">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-h2o-500 text-white text-xl font-bold">
        {number}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
