"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  PlusCircle,
  ExternalLink,
  Copy,
  Check,
  Lock,
  Menu,
  X,
  Shield,
  Activity,
  Terminal,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { WalletButton } from "@/components/WalletButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { isAdmin } = useWallet();
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const copyContract = () => {
    navigator.clipboard.writeText("guard2.sergeo-guard.testnet");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navLinks = [
    { href: "/", label: "Overview", icon: Sparkles },
    { href: "/#arena", label: "Attack Arena", icon: Terminal },
    { href: "/dashboard", label: "Security Console", icon: LayoutDashboard },
    { href: "/create", label: "Issue Passkey", icon: PlusCircle },
    ...(isAdmin ? [{ href: "/admin", label: "Platform Admin", icon: Shield }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-obsidian-950/90 backdrop-blur-md transition-colors">
      <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <ScopeGuardLogo className="w-9 h-9 transition-transform group-hover:scale-105" size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  ScopeGuard
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  NEAR Testnet
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Scoped passkeys for AI agents
              </p>
            </div>
          </Link>
        </div>

        {/* Center Nav Links: Desktop */}
        <nav className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800/80">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? "bg-white dark:bg-obsidian-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/50 dark:border-slate-700/50"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-obsidian-850"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Info: Guard Contract, Theme Toggle, Wallet */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={copyContract}
            className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 dark:hover:bg-obsidian-850 text-xs text-slate-700 dark:text-slate-300 transition shadow-xs"
            title="Copy Smart Contract address"
          >
            <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="text-slate-500 dark:text-slate-400">Guard:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 text-xs font-semibold">
              guard2.sergeo-guard.testnet
            </span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
            )}
          </button>

          <a
            href="https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex p-2 rounded-xl bg-slate-100/80 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200/60 dark:hover:bg-obsidian-850 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-xs"
            title="Inspect on NearBlocks Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <ThemeToggle />

          <WalletButton />

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-obsidian-950/95 backdrop-blur-md px-4 py-4 space-y-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                  isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-obsidian-850"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Contract: guard2.sergeo-guard.testnet</span>
            <button
              type="button"
              onClick={copyContract}
              className="text-emerald-600 dark:text-emerald-400 font-semibold"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
