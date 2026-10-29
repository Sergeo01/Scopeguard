"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Sparkles,
  Lock,
  ExternalLink,
  Copy,
  Check,
  Menu,
  Palette,
  Coins,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { useLogo } from "@/context/LogoContext";
import { WalletButton } from "@/components/WalletButton";

export const TopStatusBar: React.FC<{
  onOpenMobileMenu?: () => void;
  onOpenDocs?: () => void;
}> = ({
  onOpenMobileMenu,
  onOpenDocs,
}) => {
  const { accountId } = useWallet();
  const { setShowSelector } = useLogo();
  const [copied, setCopied] = useState(false);

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
    <header className="w-full bg-white/70 dark:bg-obsidian-950/70 border-b border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-colors sticky top-0 z-40">
      {/* Left: Greeting & Status Pills */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {getGreeting()}, <span className="text-blue-600 dark:text-blue-400 capitalize">{displayName}</span>
            </h2>

            {/* Pill 1: Verified Protection Pill (mint background, green checkmark icon) */}
            <span className="rounded-full px-3 py-0.5 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>7 Rules Enforced</span>
            </span>

            {/* Pill 2: Primary Status Pill (solid royal blue with sparkle icon) */}
            <span className="rounded-full px-3 py-0.5 text-xs font-semibold bg-blue-600 text-white flex items-center gap-1.5 shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)]">
              <Sparkles className="w-3 h-3 fill-white" />
              <span>Protocol Guard Active</span>
            </span>

            {/* Pill 3: Network / Guard Pill */}
            <button
              type="button"
              onClick={copyGuard}
              className="hidden sm:inline-flex rounded-full px-3 py-0.5 text-xs font-mono font-medium bg-slate-100 dark:bg-obsidian-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 items-center gap-1.5 hover:bg-slate-200/70 dark:hover:bg-obsidian-850 transition"
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
      </div>

      {/* Right Actions: Docs, Logo Selector & Wallet Trigger */}
      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        <button
          type="button"
          onClick={onOpenDocs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 transition shadow-xs cursor-pointer"
          title="Open documentation & integration guide"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Docs Guide</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSelector(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-obsidian-900 hover:bg-slate-200/70 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition shadow-xs cursor-pointer"
        >
          <Palette className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Logo Concepts</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            5
          </span>
        </button>

        <WalletButton />
      </div>
    </header>
  );
};
