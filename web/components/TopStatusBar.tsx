"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Sparkles,
  Lock,
  Copy,
  Check,
  Menu,
  BookOpen,
  AlertTriangle,
  Github,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { WalletButton } from "@/components/WalletButton";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";

export const TopStatusBar: React.FC<{
  onOpenMobileMenu?: () => void;
  onOpenDocs?: () => void;
}> = ({
  onOpenMobileMenu,
  onOpenDocs,
}) => {
  const { accountId } = useWallet();
  const [copied, setCopied] = useState(false);
  const [isAgentPaused, setIsAgentPaused] = useState(false);

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

  const displayName = accountId ? accountId.split(".")[0] : "Sergeo";

  return (
    <header className="w-full bg-white/80 dark:bg-obsidian-950/85 border-b border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between transition-all sticky top-0 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Left: Mobile Brand / Desktop Greeting */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Trigger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-obsidian-850 transition"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Mobile Brand Identity (Hidden on Desktop where sidebar is pinned) */}
        <Link href="/" className="flex items-center gap-2 lg:hidden group">
          <ScopeGuardLogo size={24} className="w-6 h-6 transition-transform group-hover:scale-105" />
          <span className="font-extrabold text-base tracking-tight leading-none">
            <span className="text-slate-900 dark:text-white">Scope</span>
            <span className="text-blue-600 dark:text-blue-500">Guard</span>
          </span>
        </Link>

        {/* Desktop Greeting & Live Status Pills (Hidden on mobile to avoid cluttered multi-row wrap) */}
        <div className="hidden lg:flex items-center gap-3 min-w-0">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">
            {getGreeting()}, <span className="text-blue-600 dark:text-blue-400 capitalize">{displayName}</span>
          </h2>

          {/* Pill 1: Verified Protection Pill */}
          <span className="rounded-full px-3 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5 shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>7 Rules Enforced</span>
          </span>

          {/* Pill 2: Protocol Guard Status with Live Indicator */}
          {isAgentPaused ? (
            <span className="rounded-full px-3 py-0.5 text-xs font-semibold bg-amber-600 text-white flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-200 animate-pulse" />
              <AlertTriangle className="w-3 h-3" />
              <span>Circuit Breaker Active (Paused)</span>
            </span>
          ) : (
            <span className="rounded-full px-3 py-0.5 text-xs font-semibold bg-blue-600 text-white flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              <Sparkles className="w-3 h-3 fill-white" />
              <span>Protocol Guard Active</span>
            </span>
          )}

          {/* Pill 3: Network / Guard Contract Address */}
          <button
            type="button"
            onClick={copyGuard}
            className="hidden xl:inline-flex rounded-full px-3 py-0.5 text-xs font-mono font-medium bg-slate-100 dark:bg-obsidian-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 items-center gap-1.5 hover:bg-slate-200/70 dark:hover:bg-obsidian-850 transition"
            title="Click to copy Guard contract address"
          >
            <Lock className="w-3 h-3 text-slate-400" />
            <span>guard2.sergeo-guard.testnet</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Right Actions: GitHub, Docs & Wallet Trigger (Single sleek row) */}
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="https://github.com/sergeob/scopeguard"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-obsidian-900 hover:bg-slate-200/70 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition shadow-xs"
          title="View ScopeGuard GitHub Repository"
        >
          <Github className="w-3.5 h-3.5" />
          <span>GitHub</span>
        </a>

        <button
          type="button"
          onClick={onOpenDocs}
          className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 transition shadow-xs cursor-pointer"
          title="Open documentation and integration guide"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Docs Guide</span>
        </button>

        <WalletButton />
      </div>
    </header>
  );
};
