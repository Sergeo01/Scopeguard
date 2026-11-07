"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Copy,
  Check,
  Menu,
  BookOpen,
  Github,
  Sliders,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { WalletButton } from "@/components/WalletButton";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";

export const TopStatusBar: React.FC<{
  onOpenMobileMenu?: () => void;
  onOpenDocs?: () => void;
}> = ({
  onOpenMobileMenu,
}) => {
  const { user, accountId, isAdmin } = useWallet();
  const [copied, setCopied] = useState(false);
  const [isAgentPaused, setIsAgentPaused] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/state")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.budget) {
          setIsAgentPaused(!!data.budget.paused);
        }
      })
      .catch(() => {});
  }, []);

  const copyGuard = () => {
    navigator.clipboard.writeText("guard2.sergeo-guard.testnet");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const displayName = user?.displayName || (accountId ? accountId.split(".")[0] : "");

  return (
    <header className="w-full bg-white dark:bg-obsidian-950 border-b border-slate-200 dark:border-obsidian-800 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between transition-colors sticky top-0 z-40">
      {/* Left: Mobile Brand or Desktop Greeting */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Trigger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-obsidian-850 transition"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Mobile Brand Identity */}
        <Link href="/" className="flex items-center gap-2 lg:hidden group">
          <ScopeGuardLogo size={24} className="w-6 h-6 transition-transform group-hover:scale-105" />
          <span className="font-bold text-base tracking-tight leading-none text-slate-900 dark:text-white">
            Scope<span className="text-brand-blue">Guard</span>
          </span>
        </Link>

        {/* Desktop Greeting & Live Status Pills */}
        <div className="hidden lg:flex items-center gap-3 min-w-0">
          {user ? (
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {getGreeting()}, <span className="text-brand-blue capitalize">{displayName}</span>
            </h2>
          ) : (
            <h2 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
              Welcome to <span className="text-brand-blue">ScopeGuard</span>
            </h2>
          )}

          {/* Admin Cockpit Pill */}
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 dark:bg-obsidian-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-obsidian-800 flex items-center gap-1.5 transition"
              title="Open Platform Admin Cockpit"
            >
              <Sliders className="w-3 h-3 text-brand-blue" />
              <span>Admin Cockpit</span>
            </Link>
          )}

          {/* Protocol Guard Status with Live Indicator */}
          {isAgentPaused === null ? (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-mono text-slate-500 bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
              <span>Syncing...</span>
            </span>
          ) : isAgentPaused ? (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-mono font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Guard Paused</span>
            </span>
          ) : (
            <span className="rounded-full px-2.5 py-0.5 text-xs font-mono font-medium bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mint-green" />
              <span>Guard Active</span>
            </span>
          )}

          {/* Guard Contract Address */}
          <button
            type="button"
            onClick={copyGuard}
            className="hidden xl:inline-flex rounded-full px-2.5 py-0.5 text-xs font-mono font-medium bg-slate-100 dark:bg-obsidian-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-obsidian-800 items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-obsidian-850 transition"
            title="Click to copy Guard contract address"
          >
            <span>guard2.sergeo-guard.testnet</span>
            {copied ? (
              <Check className="w-3 h-3 text-mint-green" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Right Actions: GitHub, Docs & Wallet Trigger */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://github.com/Sergeo01/Scopeguard"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-obsidian-900 hover:bg-slate-200 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-obsidian-800 transition"
          title="View ScopeGuard GitHub Repository"
        >
          <Github className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </a>

        <Link
          href="/docs"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-obsidian-900 hover:bg-slate-200 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-obsidian-800 transition"
          title="Open documentation and integration guide"
        >
          <BookOpen className="w-3.5 h-3.5 text-brand-blue" />
          <span>Docs</span>
        </Link>

        <WalletButton />
      </div>
    </header>
  );
};
