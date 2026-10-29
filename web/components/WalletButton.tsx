"use client";

import React, { useState } from "react";
import {
  Wallet,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  LogOut,
  Sparkles,
  Coins,
  ChevronDown,
  X,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";

export const WalletButton: React.FC = () => {
  const {
    accountId,
    isConnected,
    nearBalance,
    isLoadingBalance,
    connectWallet,
    disconnectWallet,
    refreshBalance,
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [inputAccount, setInputAccount] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("100");
  const [fundStatus, setFundStatus] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputAccount.trim()) {
      await connectWallet(inputAccount.trim());
      setInputAccount("");
    }
  };

  const handleQuickFund = async () => {
    setIsFunding(true);
    setFundStatus(null);
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "trader.sergeo-guard.testnet",
          amount: fundAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFundStatus({
          success: true,
          message: `Funded agent vault with ${fundAmount} mUSD tokens.`,
          txHash: data.txHash,
        });
        await refreshBalance();
      } else {
        setFundStatus({
          success: false,
          message: data.error || "Failed to fund vault.",
        });
      }
    } catch (err: any) {
      setFundStatus({
        success: false,
        message: err.message || "Network error while calling token faucet.",
      });
    } finally {
      setIsFunding(false);
    }
  };

  return (
    <div className="relative">
      {/* Navbar Trigger Button */}
      {isConnected && accountId ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 font-medium transition shadow-xs cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono font-semibold max-w-[110px] sm:max-w-[150px] truncate">
            {accountId}
          </span>
          <span className="hidden sm:inline text-emerald-600 dark:text-emerald-500 text-[11px] font-mono">
            ({nearBalance} NEAR)
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-xs cursor-pointer"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Connect Testnet Wallet</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      )}

      {/* Wallet & Topup Anchored Dropdown */}
      {isOpen && (
        <>
          {/* Transparent Backdrop to dismiss on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Anchored Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-96 sm:w-[420px] z-50 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-obsidian-950/95 backdrop-blur-xl p-5 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.18),0_4px_12px_rgba(15,23,42,0.08)] space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    NEAR Testnet Wallet & Faucet
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Non-custodial account connection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Account Card */}
            {isConnected && accountId ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
                    Connected Account
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Testnet Active</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[250px]">
                    {accountId}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(accountId)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                      title="Copy account ID"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://testnet.nearblocks.io/address/${accountId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition"
                      title="View on NearBlocks"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Available Balance:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {nearBalance} NEAR
                    </span>
                    <button
                      type="button"
                      onClick={refreshBalance}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
                      title="Refresh Balance"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingBalance ? "animate-spin text-emerald-500" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Quick Faucet & Agent Funding */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <span>Top-up Agent Vault (mUSD Faucet)</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  1-Click Faucet
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Mint demo mUSD tokens and deposit them directly into your agent vault pot onchain.
              </p>

              <div className="flex items-center gap-2">
                {["50", "100", "250"].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFundAmount(amt)}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                      fundAmount === amt
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white dark:bg-obsidian-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-obsidian-800"
                    }`}
                  >
                    ${amt} mUSD
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleQuickFund}
                disabled={isFunding}
                className="w-full py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {isFunding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Minting & Depositing on NEAR...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 dark:text-white" />
                    <span>Deposit ${fundAmount} mUSD into Agent Vault</span>
                  </>
                )}
              </button>

              {fundStatus && (
                <div
                  className={`p-2.5 rounded-xl text-xs border ${
                    fundStatus.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <p className="font-semibold">{fundStatus.message}</p>
                  {fundStatus.txHash && (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${fundStatus.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline mt-1"
                    >
                      <span>View Tx: {fundStatus.txHash.slice(0, 16)}...</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Switch Account / Custom Testnet Account */}
            <form onSubmit={handleManualConnect} className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Connect or Switch Testnet Account
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. alice.testnet or youraccount.testnet"
                  value={inputAccount}
                  onChange={(e) => setInputAccount(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs font-mono rounded-xl bg-white dark:bg-obsidian-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-obsidian-800 hover:bg-slate-200 dark:hover:bg-obsidian-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition border border-slate-300 dark:border-slate-700 shadow-xs cursor-pointer"
                >
                  Connect
                </button>
              </div>

              {/* Quick Preset Accounts */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Preset:</span>
                <button
                  type="button"
                  onClick={() => connectWallet("sergeo-guard.testnet")}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-obsidian-800 hover:bg-slate-200 dark:hover:bg-obsidian-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                >
                  sergeo-guard.testnet (Demo Owner)
                </button>
              </div>
            </form>

            {/* External Web Wallet Link */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <a
                href="https://testnet.mynearwallet.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
              >
                <span>Open MyNearWallet Testnet</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {isConnected && (
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
