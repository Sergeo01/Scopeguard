"use client";

import React, { useState } from "react";
import { PauseCircle, PlayCircle, KeyRound, DownloadCloud, ShieldAlert, AlertOctagon } from "lucide-react";

export interface PanicPanelProps {
  agentId: string;
  isPaused: boolean;
  vaultBalance: string;
  onPause: () => Promise<void>;
  onUnpause: () => Promise<void>;
  onRevokeKey: () => Promise<void>;
  onWithdrawVault: () => Promise<void>;
}

export const PanicPanel: React.FC<PanicPanelProps> = ({
  agentId,
  isPaused,
  vaultBalance,
  onPause,
  onUnpause,
  onRevokeKey,
  onWithdrawVault,
}) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = async (actionName: string, fn: () => Promise<void>) => {
    setLoadingAction(actionName);
    try {
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 sm:p-7 space-y-6 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span>Emergency Owner Controls</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Instant onchain safety switches that can never be delayed or blocked by the agent
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          Owner Exclusive
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Action 1: Soft Stop */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                {isPaused ? "Resume Operations" : "Pause Agent Purchases"}
              </h4>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  isPaused
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60"
                }`}
              >
                {isPaused ? "CURRENTLY PAUSED" : "ACTIVE"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isPaused
                ? "The agent is currently frozen. Resume policy checks to allow verified purchases."
                : "Freezes all contract executions immediately without deleting keys. Can be unpaused anytime."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleAction(isPaused ? "unpause" : "pause", isPaused ? onUnpause : onPause)}
            disabled={loadingAction !== null}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99] ${
              isPaused
                ? "bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950"
                : "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60"
            }`}
          >
            {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            <span>
              {loadingAction === "pause" || loadingAction === "unpause"
                ? "Updating onchain..."
                : isPaused
                ? "Unpause Agent Now"
                : "Pause Agent Now"}
            </span>
          </button>
        </div>

        {/* Action 2: Vault Sweep */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Evacuate Vault to Owner</h4>
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">${vaultBalance}.00 Available</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Sweeps all remaining money in the spending pot directly back to your personal master wallet. Destination is locked onchain.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleAction("withdraw", onWithdrawVault)}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-obsidian-850 dark:hover:bg-obsidian-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <DownloadCloud className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>{loadingAction === "withdraw" ? "Evacuating Funds..." : "Sweep Funds to Owner"}</span>
          </button>
        </div>

        {/* Action 3: Hard Revoke */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Permanently Revoke Key</h4>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60">
                HARD STOP
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Permanently deletes the agent's function-call key on the NEAR blockchain. The credential file on the agent's machine becomes completely dead.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleAction("revoke", onRevokeKey)}
            disabled={loadingAction !== null}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loadingAction === "revoke" ? "Deleting Key Onchain..." : "Revoke Access Key"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};