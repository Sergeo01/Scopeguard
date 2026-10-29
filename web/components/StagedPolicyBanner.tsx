"use client";

import React, { useState, useEffect } from "react";
import { Clock, Ban } from "lucide-react";

export interface StagedPolicyItem {
  policy: {
    daily_cap: number;
    high_value_threshold: number;
    max_actions_per_10min: number;
  };
  effective_at: number;
}

interface StagedPolicyBannerProps {
  stagedPolicy: StagedPolicyItem | null;
  onCancelPolicyChange: () => Promise<void>;
  isOwner: boolean;
}

export const StagedPolicyBanner: React.FC<StagedPolicyBannerProps> = ({
  stagedPolicy,
  onCancelPolicyChange,
  isOwner,
}) => {
  const [cancelling, setCancelling] = useState(false);
  const [nowSec, setNowSec] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!stagedPolicy) return null;

  const remainingSec = Math.max(0, stagedPolicy.effective_at - nowSec);
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancelPolicyChange();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-obsidian-900 p-5 text-slate-800 dark:text-slate-200 shadow-sm transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Staged Policy Modification in Timelock
            </h4>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            A policy update has been proposed. New daily cap:{" "}
            <span className="text-slate-900 dark:text-white font-mono font-bold">{stagedPolicy.policy.daily_cap} mUSD</span>.
            The update is held in timelock to give the owner veto power before activation.
          </p>
          <div className="text-xs font-mono text-slate-700 dark:text-slate-300 font-semibold pt-1">
            {remainingSec > 0 ? `Effective in ${mins}m ${secs}s` : "Timelock expired (activates on next transaction)"}
          </div>
        </div>

        {isOwner && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="inline-flex shrink-0 items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition disabled:opacity-50 shadow-sm"
          >
            <Ban className="w-4 h-4" />
            <span>{cancelling ? "Vetoing Update..." : "Veto Policy Update"}</span>
          </button>
        )}
      </div>
    </div>
  );
};
