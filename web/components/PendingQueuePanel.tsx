"use client";

import React, { useState, useEffect } from "react";
import { Clock, XCircle, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";

export interface PendingActionItem {
  id: number;
  target: string;
  method: string;
  args: string;
  amount: string;
  recipient?: string | null;
  created_at: number;
  executable_at: number;
}

interface PendingQueuePanelProps {
  pendingActions: PendingActionItem[];
  onCancelPending: (id: number) => Promise<void>;
  onSettlePending?: (id: number) => Promise<void>;
  isOwner: boolean;
}

export const PendingQueuePanel: React.FC<PendingQueuePanelProps> = ({
  pendingActions,
  onCancelPending,
  onSettlePending,
  isOwner,
}) => {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [settlingId, setSettlingId] = useState<number | null>(null);
  const [nowSec, setNowSec] = useState<number>(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (id: number) => {
    setCancellingId(id);
    try {
      await onCancelPending(id);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSettle = async (id: number) => {
    if (!onSettlePending) return;
    setSettlingId(id);
    try {
      await onSettlePending(id);
    } finally {
      setSettlingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 sm:p-7 space-y-5 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span>High-Value Purchase Approvals ({pendingActions.length} Pending)</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Any transaction of $250 or more waits here for 60 seconds so you have time to cancel it
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          Owner 60s Veto Window
        </span>
      </div>

      {pendingActions.length === 0 ? (
        <div className="p-8 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Pending Transactions</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            All recent actions were under the $250 threshold and executed immediately.
            If your agent ever attempts a large transfer ($250+), it will pause here with a live countdown so you can veto it.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pendingActions.map((action) => {
            const remainingSec = Math.max(0, action.executable_at - nowSec);
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;
            const isReady = remainingSec === 0;

            return (
              <div
                key={action.id}
                className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col md:flex-row md:items-center justify-between gap-5 transition shadow-xs"
              >
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[11px]">
                      Order #{action.id}
                    </span>
                    <span className="text-slate-900 dark:text-white font-bold text-sm">
                      {action.target}::{action.method}()
                    </span>
                    <span className="text-amber-800 dark:text-amber-400 font-mono font-bold text-sm">
                      ${action.amount}.00 mUSD
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-2">
                    <span>
                      Destination: <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{action.recipient || "Internal Contract"}</span>
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">·</span>
                    <span className={isReady ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-amber-800 dark:text-amber-300 font-semibold"}>
                      {isReady ? "Review window expired (ready to settle)" : `You have ${mins}m ${secs}s to veto`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isReady && onSettlePending && (
                    <button
                      type="button"
                      onClick={() => handleSettle(action.id)}
                      disabled={settlingId === action.id}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-[0.99]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{settlingId === action.id ? "Settling..." : "Settle & Execute"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCancel(action.id)}
                    disabled={cancellingId === action.id}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60 shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-[0.99]"
                  >
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{cancellingId === action.id ? "Vetoing Onchain..." : "Veto & Cancel Purchase"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};