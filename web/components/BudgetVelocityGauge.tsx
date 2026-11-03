"use client";

import React from "react";
import { CreditCard, Fuel, Gauge, Clock, ShieldCheck, TrendingDown, Timer, Crosshair, Shield } from "lucide-react";

export interface BudgetVelocityGaugeProps {
  gasBudgetNearTotal: number;
  gasBudgetNearRemaining: number;
  dailyCapTotal: number;
  dailyCapSpent: number;
  velocityUsed: number;
  velocityMax: number;
  windowResetsAt?: string;
  vaultBalance?: number | string;
  highWaterMark?: number | string;
  maxDrawdownBps?: number | null;
  leaseExpiresAt?: number | string | null;
  canaryMethodsCount?: number;
  intentRecipientsCount?: number;
}

export const BudgetVelocityGauge: React.FC<BudgetVelocityGaugeProps> = ({
  gasBudgetNearTotal,
  gasBudgetNearRemaining,
  dailyCapTotal,
  dailyCapSpent,
  velocityUsed,
  velocityMax,
  windowResetsAt = "in 8 minutes",
  vaultBalance = 350,
  highWaterMark = 350,
  maxDrawdownBps = 1500,
  leaseExpiresAt = null,
  canaryMethodsCount = 2,
  intentRecipientsCount = 0,
}) => {
  const dailyRemaining = Math.max(0, dailyCapTotal - dailyCapSpent);
  const dailySpentPercent = Math.min(
    100,
    Math.round((dailyCapSpent / (dailyCapTotal || 1)) * 100)
  );

  const gasRemainingPercent = Math.min(
    100,
    Math.round((gasBudgetNearRemaining / (gasBudgetNearTotal || 1)) * 100)
  );

  const velocityPercent = Math.min(
    100,
    Math.round((velocityUsed / (velocityMax || 1)) * 100)
  );
  const isVelocityNearCap = velocityPercent >= 80;

  // Drawdown breaker calculations
  const balanceNum = typeof vaultBalance === "string" ? parseFloat(vaultBalance) || 0 : vaultBalance;
  const hwmNum = typeof highWaterMark === "string" ? parseFloat(highWaterMark) || balanceNum : (highWaterMark || balanceNum);
  const effectiveBps = maxDrawdownBps ?? 1500;
  const maxDrawdownPercent = (effectiveBps / 100).toFixed(1);
  const floorThreshold = Math.floor((hwmNum * (10000 - effectiveBps)) / 10000);
  const cushionRemaining = Math.max(0, balanceNum - floorThreshold);
  const totalCushion = Math.max(1, hwmNum - floorThreshold);
  const cushionPercent = Math.min(100, Math.max(0, Math.round((cushionRemaining / totalCushion) * 100)));
  const isDrawdownBreached = balanceNum < floorThreshold;

  // Lease countdown calculation
  let leaseText = "Perpetual (No Expiry)";
  let isLeaseExpired = false;
  if (leaseExpiresAt) {
    const expiresSec = typeof leaseExpiresAt === "string" ? Math.floor(Number(leaseExpiresAt) / 1_000_000_000) : Math.floor(leaseExpiresAt / 1_000_000_000);
    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = expiresSec - nowSec;
    if (remainingSec <= 0) {
      isLeaseExpired = true;
      leaseText = "Lease Expired";
    } else {
      const hours = Math.floor(remainingSec / 3600);
      const mins = Math.floor((remainingSec % 3600) / 60);
      leaseText = hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`;
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-obsidian-800">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Agent Spending Limits & Safeguards</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enforced by NEAR protocol keys and the onchain ScopeGuard contract
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400 px-2.5 py-0.5 rounded bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800">
            Rolling 24h Window
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Daily Spend Cap */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-mint-greenDark dark:text-mint-green" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Daily Spending Cap</span>
            </div>
            <span className="text-xs font-mono font-bold text-mint-greenDark dark:text-mint-green">
              ${dailyRemaining}.00 Left
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-obsidian-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-mint-green rounded-full transition-all duration-300"
                style={{ width: `${dailySpentPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>${dailyCapSpent} of ${dailyCapTotal} max</span>
              <span>{dailySpentPercent}% used</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-obsidian-800 leading-relaxed">
            Resets automatically every 24 hours onchain. Your agent cannot spend more than this limit.
          </p>
        </div>

        {/* Metric 2: Net Drawdown Breaker */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className={`w-3.5 h-3.5 ${isDrawdownBreached ? "text-rose-500" : "text-amber-500"}`} />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Drawdown Breaker</span>
            </div>
            <span className={`text-xs font-mono font-bold ${isDrawdownBreached ? "text-rose-500" : "text-slate-900 dark:text-white"}`}>
              {maxDrawdownPercent}% Max
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-obsidian-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isDrawdownBreached ? "bg-rose-500" : cushionPercent < 25 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${cushionPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Vault: ${balanceNum} (Peak: ${hwmNum})</span>
              <span>Floor: ${floorThreshold}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-obsidian-800 leading-relaxed">
            Stops portfolio drainage. Reaching floor trips emergency auto-pause immediately.
          </p>
        </div>

        {/* Metric 3: Burst Speed Limit */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Velocity Speed Throttle</span>
            </div>
            <span
              className={`text-xs font-mono font-bold ${
                isVelocityNearCap ? "text-rose-500" : "text-slate-900 dark:text-white"
              }`}
            >
              {velocityUsed} of {velocityMax} calls
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-obsidian-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isVelocityNearCap ? "bg-rose-500" : "bg-slate-700 dark:bg-slate-400"
                }`}
                style={{ width: `${velocityPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>10-minute window</span>
              <span>Resets {windowResetsAt}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-obsidian-800 leading-relaxed">
            Stops runaway bot loops. Repeated rejected actions trip the emergency circuit breaker.
          </p>
        </div>

        {/* Metric 4: Gas Fuel */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="w-3.5 h-3.5 text-brand-blue" />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Network Gas Fuel</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
              {gasBudgetNearRemaining.toFixed(2)} NEAR
            </span>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full bg-slate-200 dark:bg-obsidian-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-blue rounded-full transition-all duration-300"
                style={{ width: `${gasRemainingPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{gasBudgetNearRemaining.toFixed(2)} of {gasBudgetNearTotal.toFixed(2)} NEAR</span>
              <span>Gas only</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-obsidian-800 leading-relaxed">
            Reserved strictly for blockchain transaction fees. The agent cannot transfer this away.
          </p>
        </div>
      </div>

      {/* Autonomous Risk Safeguards Strip */}
      <div className="p-3 rounded-lg bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Timer className={`w-3.5 h-3.5 ${isLeaseExpired ? "text-rose-500" : "text-brand-blue"}`} />
            <span className="text-slate-600 dark:text-slate-400">Task Lease:</span>
            <span className={`font-mono font-semibold ${isLeaseExpired ? "text-rose-500" : "text-slate-900 dark:text-white"}`}>
              {leaseText}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-600 dark:text-slate-400">Canary Decoy Tripwires:</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {canaryMethodsCount} armed
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-brand-blue" />
            <span className="text-slate-600 dark:text-slate-400">IntentShield:</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white">
              {intentRecipientsCount > 0 ? `${intentRecipientsCount} allowlisted` : "Restricted"}
            </span>
          </div>
        </div>

        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          Onchain ScopeGuard Verification
        </span>
      </div>
    </div>
  );
};
