"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  ExternalLink,
  Github,
  BookOpen,
  Terminal,
  Activity,
  Layers,
  Coins,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { tryGetPolicyContractId } from "@/lib/config";

export const MarketingFooter: React.FC = () => {
  const [contractId, setContractId] = useState<string>(() => tryGetPolicyContractId() || "guard2.sergeo-guard.testnet");

  useEffect(() => {
    setContractId(tryGetPolicyContractId() || "guard2.sergeo-guard.testnet");
  }, []);
  return (
    <footer className="w-full border-t border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 text-slate-600 dark:text-slate-400 py-16 px-6 sm:px-10 lg:px-16 transition-colors">
      <div className="max-w-[1440px] mx-auto space-y-12">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <ScopeGuardLogo size={28} className="w-7 h-7" />
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Scope<span className="text-brand-blue">Guard</span>
              </span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
              Give your agents a budget, not your private keys. Onchain guardrails and policy enforcement for autonomous capital on NEAR Protocol.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-green/10 border border-mint-green/20 text-mint-greenDark dark:text-mint-green text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-mint-green" />
                <span>NEAR Testnet Active</span>
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                ScopeGuard Contract
              </span>
            </div>
          </div>

          {/* Product Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#arena" className="hover:text-slate-900 dark:hover:text-white transition">
                  Live Attack Arena
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white transition">
                  Security Console
                </Link>
              </li>
              <li>
                <Link href="/create" className="hover:text-slate-900 dark:hover:text-white transition">
                  Issue Passkey
                </Link>
              </li>
              <li>
                <Link href="/#bento" className="hover:text-slate-900 dark:hover:text-white transition">
                  14-Layer Policy Radar
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition">
                  3-Step Protocol Setup
                </Link>
              </li>
            </ul>
          </div>

          {/* Onchain Checks */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Security Layers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="hover:text-slate-900 dark:hover:text-white transition cursor-default">
                  Rule 1: Registered Agent
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-white transition cursor-default">
                  Rule 3: Velocity Anti-Spam
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-white transition cursor-default">
                  Rule 4: Contract Allowlist
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-white transition cursor-default">
                  Rule 6: Daily Spending Cap
                </span>
              </li>
              <li>
                <span className="hover:text-slate-900 dark:hover:text-white transition cursor-default">
                  Rule 8: Timelock Quarantine
                </span>
              </li>
            </ul>
          </div>

          {/* Documentation & Developers */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Developers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/docs"
                  className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1 text-brand-blue"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Documentation</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://near-faucet.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>Testnet Faucet</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </a>
              </li>
              <li>
                <a
                  href={`https://testnet.nearblocks.io/address/${contractId || ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
                >
                  <span>NEAR Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Sergeo01/Scopeguard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <Link
                  href="/docs#cli"
                  className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>CLI Reference</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="pt-8 border-t border-slate-200 dark:border-obsidian-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-500 dark:text-slate-400">
            ScopeGuard: Protocol-level agent credential security on NEAR Protocol. Built for autonomous agents.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-slate-900 dark:hover:text-white transition">
              Documentation
            </Link>
            <a
              href="https://github.com/Sergeo01/Scopeguard"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition"
            >
              Source Code
            </a>
            <a
              href={`https://testnet.nearblocks.io/address/${contractId || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition"
            >
              Onchain Contract
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
