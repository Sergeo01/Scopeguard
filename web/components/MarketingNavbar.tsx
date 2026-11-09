"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  ArrowRight,
  Lock,
  Copy,
  Check,
  Menu,
  X,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";
import { tryGetPolicyContractId } from "@/lib/config";

export const MarketingNavbar: React.FC = () => {
  const { user, isConnected, openAuthModal } = useWallet();
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contractId, setContractId] = useState<string>(() => tryGetPolicyContractId() || "guard2.sergeo-guard.testnet");

  useEffect(() => {
    setContractId(tryGetPolicyContractId() || "guard2.sergeo-guard.testnet");
  }, []);

  const copyContract = () => {
    if (contractId) {
      navigator.clipboard.writeText(contractId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navLinks = [
    { label: "The Disease", href: "#problem" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Policy Radar", href: "#bento" },
    { label: "Attack Arena", href: "#arena" },
    { label: "Ecosystem", href: "#ecosystem" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full">
      <nav className="w-full bg-white/95 dark:bg-obsidian-950/95 backdrop-blur-md border-b border-slate-200 dark:border-obsidian-800 transition-colors">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo and Title */}
          <div className="flex items-center gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-3 group">
              <ScopeGuardLogo className="w-8 h-8 transition-transform group-hover:scale-105" size={32} />
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  Scope<span className="text-brand-blue">Guard</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 text-slate-600 dark:text-slate-400">
                  v0.4.0
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Center Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-850 transition"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/compare"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-850 transition flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>Compare</span>
            </Link>
            <Link
              href="/docs"
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-850 transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
              <span>Docs</span>
            </Link>
          </div>

          {/* Desktop Right Hand Actions */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {/* Quick-copy Guard contract address pill */}
            <button
              type="button"
              onClick={copyContract}
              title="Copy ScopeGuard Smart Contract on NEAR Testnet"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-900 dark:hover:bg-obsidian-850 border border-slate-200 dark:border-obsidian-800 text-slate-700 dark:text-slate-300 transition"
            >
              <span className="w-2 h-2 rounded-full bg-mint-green inline-block" />
              <span className="text-slate-500 dark:text-slate-400">{contractId ? `${contractId.slice(0, 14)}...` : "guard contract"}</span>
              {copied ? (
                <Check className="w-3 h-3 text-mint-green" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <ThemeToggle />

            {/* Auth or Console CTA */}
            {user || isConnected ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAuthModal()}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-850 border border-slate-200 dark:border-obsidian-800 transition"
                >
                  Sign In
                </button>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold transition"
                >
                  <span>Launch Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-950 px-4 pt-3 pb-6 space-y-3">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-900"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/compare"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-900 flex items-center gap-2"
              >
                <Shield className="w-4 h-4 text-emerald-500" />
                <span>Attack Comparison</span>
              </Link>
              <Link
                href="/docs"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-obsidian-900 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-brand-blue" />
                <span>Documentation</span>
              </Link>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-obsidian-800 space-y-2">
              <button
                type="button"
                onClick={copyContract}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-obsidian-900 text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-obsidian-800"
              >
                <span>{contractId || "guard2.sergeo-guard.testnet"}</span>
                {copied ? <Check className="w-4 h-4 text-mint-green" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>

              {user || isConnected ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-bold"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Open Security Console</span>
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthModal();
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-900 dark:hover:bg-obsidian-850 text-slate-900 dark:text-white text-xs font-semibold text-center border border-slate-200 dark:border-obsidian-800"
                  >
                    Sign In
                  </button>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full px-3 py-2 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold text-center"
                  >
                    Console
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};
