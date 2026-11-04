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
  const isAllowed = data.reasonCode === "POLICY_PASSED" || data.reasonCode === "ALLOWED" || (data as any).status === "ALLOWED";

  const copyHash = () => {
    if (!data.txHash) return;
    navigator.clipboard.writeText(data.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const humanReasonMap: Record<string, string> = {
    POLICY_PASSED: "Authorized Action Executed within Policy Limits",
    ALLOWED: "Authorized Action Executed within Policy Limits",
    NOT_AGENT: "The calling account is not the registered agent sub-account authorized for this policy.",
    PAUSED: "The agent spending key is currently paused by the owner or emergency circuit breaker.",
    OVER_VELOCITY_CAP: "Too many actions attempted too quickly. Anti-spam speed brake activated.",
    TARGET_NOT_ALLOWED: "The target contract is not on your approved list. Untrusted contracts are blocked.",
    METHOD_NOT_ALLOWED: "The requested function is not permitted for this contract.",
    OVER_DAILY_CAP: "This purchase exceeds your agent 24-hour spending allowance.",
    RECIPIENT_NOT_ALLOWED: "The recipient address is not on your approved list. Transfers to outside accounts are refused.",
    INTENT_RECIPIENT_NOT_ALLOWED: "The cross-chain intent destination address is not on your approved cross-chain allowlist.",
    LEASE_EXPIRED: "The temporary task lease for this session has reached its expiry timestamp. Session is automatically inactive.",
    CANARY_TRIPPED: "A honeypot decoy method was invoked. The emergency circuit breaker paused the agent immediately.",
    DRAWDOWN_EXCEEDED: "The projected vault balance breaches your maximum allowed drawdown threshold from the high-water mark.",
    PENDING: "This purchase is $250 or more. It has been placed in a 60-second review quarantine for your approval.",
    INSUFFICIENT_VAULT_BALANCE: "The requested transfer exceeds your agent current vault balance pot.",
    PENDING_QUEUE_FULL: "The timelock review queue is full. Wait for existing quarantined items to clear.",
  };

  const humanExplanation = humanReasonMap[data.reasonCode] || (isAllowed ? "Authorized Action Executed within Policy Limits" : "The transaction did not meet your safety guardrails.");
  const displayHash = data.txHash && data.txHash.length > 16 ? `${data.txHash.slice(0, 16)}...` : (data.txHash || "N/A");

  return (
    <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 overflow-hidden transition-colors">
      {/* Decline / Status Header Banner */}
      <div
        className={`px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isPending
            ? "bg-brand-blue/10 border-brand-blue/20 text-brand-blue"
            : isAllowed
            ? "bg-mint-green/10 border-mint-green/20 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300"
        }`}
      >
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          ) : isAllowed ? (
            <div className="w-8 h-8 rounded-lg bg-mint-green/10 text-mint-green flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
              {isPending
                ? "Large Transaction Quarantined for Owner Review"
                : isAllowed
                ? "Authorized Action Executed within Policy Limits"
                : "Attack Declined on Blockchain"}
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              {isPending
                ? "Transaction over $250 paused for 60 seconds. You have full veto power."
                : isAllowed
                ? "The agent action was verified onchain and executed successfully."
                : "The agent attempted to move money, but ScopeGuard refused the transaction onchain."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onInspect && data.txHash && (
            <button
              type="button"
              onClick={() => onInspect(data.txHash)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-obsidian-800 hover:bg-slate-50 dark:hover:bg-obsidian-750 border border-slate-200 dark:border-obsidian-700 text-xs text-slate-700 dark:text-slate-200 transition font-medium"
            >
              <Receipt className="w-3.5 h-3.5 text-brand-blue" />
              <span>Inspect Receipt</span>
            </button>
          )}
          {data.txHash && (
            <a
              href={`https://testnet.nearblocks.io/txns/${data.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-obsidian-800 hover:bg-slate-50 dark:hover:bg-obsidian-750 border border-slate-200 dark:border-obsidian-700 text-xs text-slate-700 dark:text-slate-200 transition font-medium"
            >
              <span>NearBlocks</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* The Two Worlds: Without vs With ScopeGuard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* World A */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-obsidian-800">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Without ScopeGuard (Master Key)</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                Total Wipeout
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When an agent holds standard private keys, prompt injections give attackers full power over your wallet. The agent obeys the prompt and transfers all your funds.
            </p>
            <div className="pt-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-500 font-medium">Money Stolen:</span>
              <span className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                {data.attemptedAction.amount && data.attemptedAction.amount !== "0"
                  ? `-${data.attemptedAction.amount} mUSD (100% Lost)`
                  : "Full Fee Revenue Siphoned (100% Lost)"}
              </span>
            </div>
          </div>

          {/* World B */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-obsidian-800">
              <span className="text-xs font-semibold text-mint-greenDark dark:text-mint-green flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-mint-green" />
                <span>With ScopeGuard (Passkey)</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green font-bold">
                {isPending ? "Quarantined" : isAllowed ? "Authorized" : "100% Safe"}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {isPending
                ? "Your agent holds only a limited passkey restricted to ScopeGuard. High-value transactions are held in timelock quarantine until explicitly confirmed by the owner."
                : isAllowed
                ? "Your agent holds a limited passkey restricted to ScopeGuard. The action satisfied all policy limits and was executed within safe parameters."
                : "Your agent only holds a limited passkey restricted to ScopeGuard. Even if the agent is tricked, the smart contract blocks the unauthorized transfer onchain."}
            </p>
            <div className="pt-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-500 font-medium">{isAllowed ? "Spend Authorized:" : "Actual Money Lost:"}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-mono text-mint-greenDark dark:text-mint-green">
                  {isAllowed ? `${data.attemptedAction.amount || "0"} mUSD (Within Budget)` : "$0.00 (Zero Loss)"}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Rule #{data.ruleNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Decline Summary */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 p-3 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Injected Prompt
              </span>
              <p className="text-slate-800 dark:text-slate-200 font-mono text-[11px] italic leading-relaxed">
                "{data.prompt}"
              </p>
            </div>

            <div className="space-y-1 p-3 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Attempted Action
              </span>
              <p className="text-slate-800 dark:text-slate-200 font-mono text-[11px] leading-relaxed">
                {data.attemptedAction.target}::{data.attemptedAction.method}() with {data.attemptedAction.amount} mUSD
                {data.attemptedAction.recipient ? ` to ${data.attemptedAction.recipient}` : ""}.
              </p>
            </div>
          </div>

          {/* Why Stopped */}
          <div className="p-3.5 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-mint-green" />
              <span>Why ScopeGuard Stopped It</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
              {humanExplanation}
            </p>
          </div>
        </div>

        {/* Footer: Tx Hash and Technical Details Toggle */}
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-200 dark:border-obsidian-800">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
            <span>Tx:</span>
            <span className="text-slate-800 dark:text-slate-200 font-medium">{displayHash}</span>
            {data.txHash && (
              <button
                type="button"
                onClick={copyHash}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Copy transaction hash"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-mint-green" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
          >
            <span>{showTechnicalDetails ? "Hide Payload" : "Inspect Raw Payload"}</span>
            {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Technical Details */}
        {showTechnicalDetails && (
          <div className="p-3 rounded-lg bg-obsidian-950 border border-obsidian-800 text-xs font-mono text-slate-300 space-y-2 overflow-x-auto">
            <div className="flex items-center justify-between text-slate-500 border-b border-obsidian-800 pb-1 text-[11px]">
              <span>Onchain Outcome Payload (NEAR Testnet)</span>
              <span className="text-mint-green">Verified</span>
            </div>
            <pre className="text-slate-300 leading-relaxed text-[11px]">
{JSON.stringify(
  {
    tx_hash: data.txHash,
    status: data.reasonCode === "PENDING" ? "PENDING" : isAllowed ? "ALLOWED" : "REJECTED",
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
