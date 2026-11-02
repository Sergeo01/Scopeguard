"use client";

import React, { useState } from "react";
import {
  XCircle,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Receipt,
} from "lucide-react";

export interface AutopsyData {
  prompt: string;
  agentResponse: string;
  attemptedAction: {
    target: string;
    method: string;
    amount: string;
    recipient?: string;
  };
  reasonCode: string;
  ruleName: string;
  ruleNumber: number;
  txHash: string;
  timestamp: string;
  fundsSaved: string;
}

interface AttackAutopsyProps {
  data: AutopsyData | null;
  onInspect?: (hash: string) => void;
}

export const AttackAutopsy: React.FC<AttackAutopsyProps> = ({ data, onInspect }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const isPending = data.reasonCode === "PENDING";

  const copyHash = () => {
    if (!data.txHash) return;
    navigator.clipboard.writeText(data.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Human-readable decline reasons for all 10 guard checks
  const humanReasonMap: Record<string, string> = {
    NOT_AGENT: "The calling account is not the registered agent sub-account authorized for this policy.",
    PAUSED: "The agent spending key is currently paused by the owner or emergency circuit breaker.",
    OVER_VELOCITY_CAP: "Too many actions attempted too quickly. Anti-spam speed brake activated.",
    TARGET_NOT_ALLOWED: "The target contract is not on your approved list. Untrusted contracts are blocked.",
    METHOD_NOT_ALLOWED: "The requested function is not permitted for this contract.",
    OVER_DAILY_CAP: "This purchase exceeds your agent's 24-hour spending allowance.",
    RECIPIENT_NOT_ALLOWED: "The recipient address is not on your approved list. Transfers to outside accounts are refused.",
    PENDING: "This purchase is $250 or more. It has been placed in a 60-second review quarantine for your approval.",
    INSUFFICIENT_VAULT_BALANCE: "The requested transfer exceeds your agent's current vault balance pot.",
    PENDING_QUEUE_FULL: "The timelock review queue is full. Wait for existing quarantined items to clear.",
  };

  const humanExplanation = humanReasonMap[data.reasonCode] || "The transaction did not meet your safety guardrails.";
  const displayHash = data.txHash && data.txHash.length > 16 ? `${data.txHash.slice(0, 16)}...` : (data.txHash || "N/A");

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 overflow-hidden shadow-xs">
      {/* Decline Header Banner */}
      <div
        className={`px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isPending
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
            : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200"
        }`}
      >
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700 flex items-center justify-center text-rose-700 dark:text-rose-300">
              <XCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              {isPending ? "Large Transaction Quarantined for Your Review" : "Attack Declined on Blockchain"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {isPending
                ? "Transaction over $250 paused for 60 seconds. You have full veto power."
                : "The agent attempted to move money, but ScopeGuard refused the transaction onchain."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onInspect && data.txHash && (
            <button
              type="button"
              onClick={() => onInspect(data.txHash)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-obsidian-800 hover:bg-slate-50 dark:hover:bg-obsidian-700 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 transition font-medium shadow-xs cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5 text-blue-500" />
              <span>Inspect Receipt</span>
            </button>
          )}
          {data.txHash && (
            <a
              href={`https://testnet.nearblocks.io/txns/${data.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-obsidian-800 hover:bg-slate-50 dark:hover:bg-obsidian-700 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 transition font-medium shadow-xs"
            >
              <span>NearBlocks</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            </a>
          )}
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* The Two Worlds: Without vs With ScopeGuard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* World A: SIMULATED Unprotected Agent Wallet Drain */}
          <div className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-rose-200 dark:border-rose-800/50">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900 dark:text-rose-300">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>World A: SIMULATED Unprotected Agent Wallet Drain</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200">
                Total Wipeout
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When an agent holds standard private keys, prompt injections give attackers full power over your wallet. The agent obeys the prompt and transfers all your funds.
            </p>
            <div className="pt-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Total Money Stolen:</span>
              <span className="text-sm font-bold font-mono text-rose-700 dark:text-rose-400">
                {data.attemptedAction.amount && data.attemptedAction.amount !== "0"
                  ? `-${data.attemptedAction.amount} mUSD (100% Lost)`
                  : "Full Fee Revenue Siphoned (100% Lost)"}
              </span>
            </div>
          </div>

          {/* World B: ScopeGuard Live Onchain Defense */}
          <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200 dark:border-emerald-800/50">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>World B: ScopeGuard Live Onchain Defense</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                {isPending ? "Quarantined" : "100% Safe"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isPending
                ? "Your agent holds only a limited passkey restricted to ScopeGuard. High-value transactions are held in timelock quarantine until explicitly confirmed by the owner."
                : "Your agent only holds a limited passkey restricted to ScopeGuard. Even if the agent is tricked, the smart contract blocks the unauthorized transfer onchain."}
            </p>
            <div className="pt-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Actual Money Lost:</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  $0.00 (Zero Loss)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-semibold">
                  Rule #{data.ruleNumber}: {data.reasonCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Plain English Autopsy Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Decline Summary
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 p-3.5 rounded-xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                What the Attacker Injected
              </span>
              <p className="text-slate-800 dark:text-slate-200 italic leading-relaxed">
                "{data.prompt}"
              </p>
            </div>

            <div className="space-y-1 p-3.5 rounded-xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                What the AI Agent Tried to Do
              </span>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                The agent naively obeyed and called:{" "}
                <span className="font-mono text-slate-900 dark:text-white font-semibold">
                  {data.attemptedAction.target}::{data.attemptedAction.method}()
                </span>{" "}
                with amount {data.attemptedAction.amount} mUSD
                {data.attemptedAction.recipient ? ` to ${data.attemptedAction.recipient}` : ""}.
              </p>
            </div>
          </div>

          {/* Why Stopped */}
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Why ScopeGuard Stopped It</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {humanExplanation}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Triggered Rule:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                Check #{data.ruleNumber} ({data.reasonCode})
              </span>
              <span>
                {isPending
                  ? ": Quarantined in 60-second review timelock awaiting owner settlement."
                  : ": The transaction failed harmlessly without touching your funds."}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Tx Hash and Technical Details Toggle */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span>Blockchain Transaction:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{displayHash}</span>
            {data.txHash && (
              <button
                type="button"
                onClick={copyHash}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                title="Copy hash"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition self-start sm:self-auto cursor-pointer"
          >
            <span>{showTechnicalDetails ? "Hide Technical Data" : "Inspect Raw Blockchain Payload"}</span>
            {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Technical Details */}
        {showTechnicalDetails && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 space-y-3 overflow-x-auto">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span>Onchain Outcome Payload (FastNEAR Testnet)</span>
              <span className="text-emerald-400">Deterministic Guard Verdict</span>
            </div>
            <pre className="text-emerald-300/90 leading-relaxed text-[11px]">
{JSON.stringify(
  {
    tx_hash: data.txHash,
    status: data.reasonCode === "PENDING" ? "PENDING" : "REJECTED",
    reason_code: data.reasonCode,
    rule_number: data.ruleNumber,
    rule_name: data.ruleName,
    attempted_target: data.attemptedAction.target,
    attempted_method: data.attemptedAction.method,
    attempted_amount: data.attemptedAction.amount,
    attempted_recipient: data.attemptedAction.recipient || "none",
    funds_preserved_musd: data.fundsSaved,
  },
  null,
  2
)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};