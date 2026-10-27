"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Receipt,
  Lock,
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
}

export const AttackAutopsy: React.FC<AttackAutopsyProps> = ({ data }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const isPending = data.reasonCode === "PENDING";

  const copyHash = () => {
    navigator.clipboard.writeText(data.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Human-readable decline reasons
  const humanReasonMap: Record<string, string> = {
    RECIPIENT_NOT_ALLOWED: "The recipient address is not on your approved list. Transfers to outside accounts are refused.",
    TARGET_NOT_ALLOWED: "The target contract is not on your approved list. Untrusted contracts are blocked.",
    METHOD_NOT_ALLOWED: "The requested function is not permitted for this contract.",
    OVER_DAILY_CAP: "This purchase exceeds your agent's 24-hour spending allowance.",
    OVER_VELOCITY_CAP: "Too many actions attempted too quickly. Anti-spam speed brake activated.",
    PAUSED: "The agent spending key is currently paused by the owner.",
    PENDING: "This purchase is $250 or more. It has been placed in a 60-second review quarantine for your approval.",
  };

  const humanExplanation = humanReasonMap[data.reasonCode] || "The transaction did not meet your safety guardrails.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Decline Header Banner */}
      <div
        className={`px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isPending
            ? "bg-amber-50 border-amber-200 text-amber-900"
            : "bg-rose-50 border-rose-200 text-rose-950"
        }`}
      >
        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
              <XCircle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              {isPending ? "Large Transaction Quarantined for Your Review" : "Attack Declined on Blockchain"}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {isPending
                ? "Transaction over $250 paused for 60 seconds. You have full veto power."
                : "The agent attempted to move money, but ScopeGuard refused the transaction onchain."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`https://testnet.nearblocks.io/txns/${data.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-xs text-slate-700 transition font-medium shadow-sm"
          >
            <span>Receipt on NearBlocks</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          </a>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-6">
        {/* The Two Worlds: Without vs With ScopeGuard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Without ScopeGuard (The Danger) */}
          <div className="p-5 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-rose-200">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Without ScopeGuard (Ordinary Key)</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900">
                Total Wipeout
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When an agent holds standard private keys, prompt injections give attackers full power over your wallet. The agent obeys the prompt and transfers all your funds.
            </p>
            <div className="pt-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-500 font-medium">Total Money Stolen:</span>
              <span className="text-sm font-bold font-mono text-rose-700">
                -${data.attemptedAction.amount} mUSD (100% Lost)
              </span>
            </div>
          </div>

          {/* With ScopeGuard (The Safe World) */}
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>With ScopeGuard (Smart Spending Key)</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                100% Safe
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your agent only holds a limited passkey restricted to ScopeGuard. Even if the agent is tricked, the smart contract blocks the unauthorized transfer onchain.
            </p>
            <div className="pt-1 flex items-baseline justify-between text-xs">
              <span className="text-slate-500 font-medium">Actual Money Lost:</span>
              <span className="text-sm font-bold font-mono text-emerald-700">
                $0.00 (Zero Loss)
              </span>
            </div>
          </div>
        </div>

        {/* Plain English Autopsy Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-slate-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Decline Summary
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1 p-3.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                What the Attacker Injected
              </span>
              <p className="text-slate-800 italic leading-relaxed">
                "{data.prompt}"
              </p>
            </div>

            <div className="space-y-1 p-3.5 rounded-xl bg-white border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                What the AI Agent Tried to Do
              </span>
              <p className="text-slate-800 leading-relaxed">
                The agent naively obeyed and called:{" "}
                <span className="font-mono text-slate-900 font-semibold">
                  {data.attemptedAction.target}::{data.attemptedAction.method}()
                </span>{" "}
                with amount {data.attemptedAction.amount} mUSD.
              </p>
            </div>
          </div>

          {/* Why Stopped */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Why ScopeGuard Stopped It</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {humanExplanation}
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-500">
              <span>Triggered Rule:</span>
              <span className="font-semibold text-slate-700">
                Check #{data.ruleNumber} ({data.reasonCode})
              </span>
              <span>- The transaction failed harmlessly without touching your funds.</span>
            </div>
          </div>
        </div>

        {/* Footer: Tx Hash and Technical Details Toggle */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-200">
          <div className="flex items-center gap-2 text-slate-500">
            <span>Blockchain Transaction:</span>
            <span className="font-mono text-slate-800 font-semibold">{data.txHash.slice(0, 16)}...</span>
            <button
              type="button"
              onClick={copyHash}
              className="p-1 text-slate-400 hover:text-slate-600 transition"
              title="Copy hash"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition self-start sm:self-auto"
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