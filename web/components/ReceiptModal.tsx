"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Shield,
  Terminal,
  Activity,
  Layers,
  Code2,
  RefreshCw,
} from "lucide-react";

interface ReceiptModalProps {
  txHash: string | null;
  onClose: () => void;
  accountId?: string;
  ownerId?: string;
}

interface TxData {
  success: boolean;
  found: boolean;
  hash: string;
  blockHash?: string;
  signerId?: string;
  receiverId?: string;
  status?: string;
  gasBurnt?: string;
  tokensBurnt?: string;
  logs?: string[];
  event?: any;
  raw?: any;
  note?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  txHash,
  onClose,
  accountId = "agent.sergeo-guard.testnet",
  ownerId = "sergeo-guard.testnet",
}) => {
  const [loading, setLoading] = useState(true);
  const [txData, setTxData] = useState<TxData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    if (!txHash) return;
    setLoading(true);
    fetch(`/api/tx?hash=${encodeURIComponent(txHash)}&account=${encodeURIComponent(accountId)}&owner=${encodeURIComponent(ownerId)}`)
      .then((res) => res.json())
      .then((data) => {
        setTxData(data);
      })
      .catch(() => {
        // Never fabricate data on a failed fetch: say we could not look it up.
        setTxData({
          success: false,
          found: false,
          hash: txHash,
          status: "UNVERIFIED",
          logs: [],
          note: "Lookup failed. Open NearBlocks or retry once the RPC has indexed the transaction.",
        });
      })
      .finally(() => setLoading(false));
  }, [txHash, accountId, ownerId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!txHash) return null;

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const cliCommand = `near tx-status ${txHash} --accountId ${accountId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  txData?.found
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                }`}
              >
                {txData?.found === undefined
                  ? "Looking up receipt..."
                  : txData.found
                  ? "Testnet Receipt Found"
                  : "Awaiting index"}
              </span>
              <span className="text-xs font-mono text-slate-400">Read-only lookup</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>{txData?.found ? "Onchain Execution Receipt" : "Transaction Not Yet Verified"}</span>
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-obsidian-850 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Hash */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Cryptographic Transaction Hash
          </span>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs sm:text-sm text-slate-900 dark:text-white font-semibold break-all">
              {txHash}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(txHash, "hash")}
              className="p-2 rounded-xl bg-white dark:bg-obsidian-850 hover:bg-slate-100 dark:hover:bg-obsidian-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition shrink-0"
              title="Copy transaction hash"
            >
              {copiedKey === "hash" ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Verification Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Signer</span>
            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate block">
              {txData?.signerId || (txData?.found === false ? "--" : accountId)}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Guard</span>
            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate block">
              {txData?.receiverId || (txData?.found === false ? "--" : "guard2.sergeo-guard.testnet")}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
            <span className="text-xs font-mono font-bold flex items-center gap-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  txData?.status === "SUCCESS"
                    ? "bg-emerald-500"
                    : txData?.status === "FAILED" || txData?.status === "UNVERIFIED"
                    ? "bg-amber-500"
                    : "bg-slate-400"
                }`}
              />
              <span
                className={
                  txData?.status === "SUCCESS"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                }
              >
                {txData?.status || "UNVERIFIED"}
              </span>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Gas Burnt</span>
            <span className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
              {txData?.gasBurnt || "--"}
            </span>
          </div>
        </div>

        {/* Contract Event Logs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Contract Event Logs (EVENT_JSON)
            </span>
            {loading && (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 space-y-1 overflow-x-auto max-h-40">
            {txData?.logs && txData.logs.length > 0 ? (
              txData.logs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap break-all">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-amber-300">
                {txData?.found
                  ? "Receipt found, but it contained no EVENT_JSON log."
                  : "No receipt logs returned. Wait a few blocks and re-open, or use NearBlocks."}
              </div>
            )}
          </div>
        </div>

        {/* CLI Terminal Verification Command */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Independent NEAR CLI Verification
          </span>
          <div className="relative group">
            <pre className="p-3 pr-24 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
              {cliCommand}
            </pre>
            <button
              type="button"
              onClick={() => handleCopy(cliCommand, "cli")}
              className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 transition"
            >
              {copiedKey === "cli" ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Explorer Fallbacks & Raw Toggle */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <a
              href={`https://testnet.nearblocks.io/txns/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-850 dark:hover:bg-obsidian-800 text-slate-800 dark:text-slate-200 font-mono text-xs font-semibold transition"
            >
              <span>NearBlocks</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={`https://testnet.pikespeak.ai/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-850 dark:hover:bg-obsidian-800 text-slate-800 dark:text-slate-200 font-mono text-xs font-semibold transition"
            >
              <span>Pikespeak</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            {txData?.raw && (
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <Code2 className="w-3 h-3" />
                <span>{showRaw ? "Hide Raw RPC" : "View Raw RPC"}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-bold transition hover:opacity-90 cursor-pointer"
          >
            Done
          </button>
        </div>

        {/* Optional Raw RPC Data */}
        {showRaw && txData?.raw && (
          <div className="pt-2">
            <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] leading-relaxed overflow-x-auto max-h-48 border border-slate-800">
              {JSON.stringify(txData.raw, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
