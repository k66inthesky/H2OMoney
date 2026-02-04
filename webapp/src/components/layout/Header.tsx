'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Droplets, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';

const navLinks = [
  { href: '/', label: '首頁' },
  { href: '/dashboard', label: '儀表板' },
  { href: '/create', label: '建立定投' },
  { href: '/yield', label: '收益分析' },
  { href: '/docs', label: '文檔' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-h2o-500 text-white">
            <Droplets className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">
            H2O <span className="text-h2o-500">Smart DCA</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-h2o-500 ${
                pathname === link.href
                  ? 'text-h2o-500'
                  : 'text-muted-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Wallet Connect */}
        <div className="hidden md:block">
          <ConnectButton />
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col p-4 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-h2o-100 text-h2o-600 dark:bg-h2o-900 dark:text-h2o-400'
                    : 'hover:bg-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 px-4">
              <ConnectButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
