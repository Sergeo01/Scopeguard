"use client";

import React from "react";
import { ShieldCheck, Lock, AlertTriangle, ArrowRight, Scale, Clock } from "lucide-react";

interface WorstCaseBoundIndicatorProps {
  dailyCap?: number | string;
  vaultBalance?: string;
}

export const WorstCaseBoundIndicator: React.FC<WorstCaseBoundIndicatorProps> = ({
  dailyCap = 500,
  vaultBalance = "350",
}) => {
  const capNum = Number(dailyCap) || 0;
  const vaultNum = Number(vaultBalance) || 0;
  const bound = (vaultNum > 0 && capNum > 0) ? Math.min(vaultNum, capNum) : (vaultNum || capNum || 350);

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-5 sm:p-6 shadow-xs space-y-4">
      {/* Header with Title and Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                LOSS BOUND
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Enforced Bound
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Worst-Case Loss Bound: {bound} mUSD
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>Zero Human Intervention Required</span>
          </span>
        </div>
      </div>

      {/* Primary Explicit Invariant Statement */}
      <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50">
        <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
          Without human intervention, the maximum loss is bounded by min(vault balance, rolling 24h cap) per asset because all high-value actions enter timelock quarantine requiring explicit owner settlement.
        </p>
      </div>

      {/* Comparison Grid: Unprotected vs ScopeGuard Bounded */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Without ScopeGuard (Unbounded Loss) */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Standard Full-Access Key</span>
            </span>
            <span className="font-mono text-[11px] font-bold text-rose-600 dark:text-rose-400">
              Uncapped Risk
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
            If compromised overnight while unattended, an injected agent drains 100% of available funds immediately with no daily cap, no quarantine delay, and no recourse.
          </p>
          <div className="pt-1 flex items-center justify-between text-[11px] font-mono border-t border-slate-200 dark:border-slate-800/80">
            <span className="text-slate-500">Unattended Exposure:</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">Total Wallet Wipeout</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Uncapped Vault Drain:</span>
            <span className="text-rose-600 dark:text-rose-400 font-medium">All {vaultBalance} mUSD Drained</span>
          </div>
        </div>

        {/* With ScopeGuard (Enforced Bound) */}
        <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ScopeGuard Scoped Passkey</span>
            </span>
            <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              Bounded at {bound} mUSD
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
            Even under continuous malicious prompt injection while owner sleeps, spending stops at {bound} mUSD. Large amounts require explicit owner settlement signatures.
          </p>
          <div className="pt-1 flex items-center justify-between text-[11px] font-mono border-t border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-slate-500">Unattended Exposure:</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Max {bound} mUSD (min of vault and cap)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500">Active Vault Pot:</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{vaultBalance} mUSD</span>
          </div>
        </div>
      </div>
    </div>
  );
};
