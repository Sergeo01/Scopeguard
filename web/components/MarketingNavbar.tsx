"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Shield,
  ArrowRight,
  Terminal,
  Lock,
  Copy,
  Check,
  Menu,
  X,
  BookOpen,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";
import { useDocs } from "@/context/DocsContext";

export const MarketingNavbar: React.FC = () => {
  const { user, isConnected, openAuthModal } = useWallet();
  const { openDocs } = useDocs();
  const [copied, setCopied] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const copyContract = () => {
    navigator.clipboard.writeText("guard2.sergeo-guard.testnet");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navLinks = [
    { label: "The Disease", href: "#problem" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Bento Radar", href: "#bento" },
    { label: "Attack Arena", href: "#arena" },
    { label: "Ecosystem", href: "#ecosystem" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Main Glassmorphism Navigation Bar */}
      <nav className="w-full bg-white/85 dark:bg-[#080B11]/85 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-6 shrink-0">
            <Link href="/" className="flex items-center gap-3 group">
              <ScopeGuardLogo className="w-8 h-8 transition-transform group-hover:scale-105" size={32} />
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Scope<span className="text-blue-500">Guard</span>
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  v0.2.0
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
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60 transition"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={openDocs}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60 transition flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>Docs</span>
            </button>
          </div>

          {/* Desktop Right Hand Actions */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {/* Quick-copy Guard contract address pill */}
            <button
              type="button"
              onClick={copyContract}
              title="Copy ScopeGuard Smart Contract on NEAR Testnet"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 transition"
            >
              <Lock className="w-3 h-3 text-emerald-500" />
              <span className="text-slate-500 dark:text-slate-400">guard2.sergeo...</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-slate-400" />
              )}
            </button>

            <ThemeToggle />

            {/* Auth / Console CTA */}
            {user || isConnected ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Open Security Console</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70 border border-slate-200 dark:border-slate-700 transition"
                >
                  Sign In
                </button>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold shadow-md transition"
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
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080B11] px-4 pt-3 pb-6 space-y-3">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openDocs();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span>Documentation</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
              <button
                type="button"
                onClick={copyContract}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
              >
                <span>guard2.sergeo-guard.testnet</span>
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>

              {user || isConnected ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold text-center border border-slate-200 dark:border-slate-700"
                  >
                    Sign In
                  </button>
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold text-center"
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
