import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'H2O Smart DCA - 會賺錢的定投機器人',
  description:
    '基於 Sui 區塊鏈的智能定投機器人，讓等待期間的錢也能自動生息。整合 Cetus 聚合器與 StableLayer，實現雙層收益。',
  keywords: ['DCA', 'DeFi', 'Sui', 'Cetus', 'StableLayer', '定投', '加密貨幣'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <footer className="border-t py-6 text-center text-sm text-muted-foreground">
              <p>H2O Smart DCA - Sui Vibe Hackathon 2026</p>
              <p className="mt-1">Powered by Cetus & StableLayer</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
