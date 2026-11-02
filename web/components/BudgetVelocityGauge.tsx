"use client";

import React from "react";
import { CreditCard, Fuel, Gauge, Clock, ShieldCheck } from "lucide-react";

export interface BudgetVelocityGaugeProps {
  gasBudgetNearTotal: number;
  gasBudgetNearRemaining: number;
  dailyCapTotal: number;
  dailyCapSpent: number;
  velocityUsed: number;
  velocityMax: number;
  windowResetsAt?: string;
}

export const BudgetVelocityGauge: React.FC<BudgetVelocityGaugeProps> = ({
  gasBudgetNearTotal,
  gasBudgetNearRemaining,
  dailyCapTotal,
  dailyCapSpent,
  velocityUsed,
  velocityMax,
  windowResetsAt = "in 8 minutes",
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

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 sm:p-7 space-y-5 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Agent Spending Limits & Safeguards</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enforced by NEAR protocol keys and the onchain ScopeGuard contract
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          Rolling 24h Window
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1: Daily Spend Cap */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Daily Spending Allowance</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
              ${dailyRemaining}.00 Left
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${dailySpentPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>${dailyCapSpent} spent of ${dailyCapTotal} max</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{dailySpentPercent}% used</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 leading-relaxed">
            Resets automatically every 24 hours onchain. Your agent cannot spend more than this limit.
          </p>
        </div>

        {/* Metric 2: Gas Budget */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Network Gas Fuel</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
              {gasBudgetNearRemaining.toFixed(2)} NEAR
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${gasRemainingPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{gasBudgetNearRemaining.toFixed(2)} of {gasBudgetNearTotal.toFixed(2)} NEAR</span>
              <span>Gas fees only</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 leading-relaxed">
            Reserved strictly for blockchain transaction fees. The agent cannot transfer this away.
          </p>
        </div>

        {/* Metric 3: Burst Speed Limit */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Speed Throttle (Anti-Spam)</span>
            </div>
            <span
              className={`text-xs font-mono font-bold ${
                isVelocityNearCap ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
              }`}
            >
              {velocityUsed} of {velocityMax} calls
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isVelocityNearCap ? "bg-amber-500" : "bg-slate-700 dark:bg-slate-400"
                }`}
                style={{ width: `${velocityPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>10-minute window</span>
              <span>Resets {windowResetsAt}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 leading-relaxed">
            Stops runaway bot loops. 3 rejected actions in 10 minutes trips the emergency circuit breaker.
          </p>
        </div>
      </div>
    </div>
  );
};