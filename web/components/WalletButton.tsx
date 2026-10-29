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
          message: `Funded agent vault with ${fundAmount} mUSD tokens!`,
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
    <>
      {/* Navbar Trigger Button */}
      {isConnected && accountId ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50/80 hover:bg-emerald-100/70 border border-emerald-200 text-xs text-emerald-950 font-medium transition shadow-xs"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span className="font-mono font-semibold max-w-[120px] sm:max-w-[150px] truncate">
            {accountId}
          </span>
          <span className="hidden sm:inline text-emerald-700 text-[11px] font-mono">
            ({nearBalance} NEAR)
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Connect Testnet Wallet</span>
        </button>
      )}

      {/* Wallet Management Drawer / Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    NEAR Testnet Wallet
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Non-custodial account connection
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Account Card */}
            {isConnected && accountId ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400">
                    Connected Account
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Testnet Active</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {accountId}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(accountId)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                      title="Copy account ID"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://testnet.nearblocks.io/address/${accountId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                      title="View on NearBlocks"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Available Balance:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">
                      {nearBalance} NEAR
                    </span>
                    <button
                      type="button"
                      onClick={refreshBalance}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
                      title="Refresh Balance"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isLoadingBalance ? "animate-spin text-emerald-600" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Quick Faucet & Agent Funding */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/70 via-slate-50 to-blue-50/40 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>Fund Agent Vault (mUSD Faucet)</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  1-Click Faucet
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mint demo mUSD tokens and deposit them directly into your agent vault pot so your agent can trade.
              </p>

              <div className="flex items-center gap-2">
                {["50", "100", "250"].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFundAmount(amt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition border ${
                      fundAmount === amt
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
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
                className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-60"
              >
                {isFunding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Minting & Depositing on NEAR...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Deposit ${fundAmount} mUSD into Agent Vault</span>
                  </>
                )}
              </button>

              {fundStatus && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    fundStatus.success
                      ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                      : "bg-rose-50 border-rose-200 text-rose-950"
                  }`}
                >
                  <p className="font-semibold">{fundStatus.message}</p>
                  {fundStatus.txHash && (
                    <a
                      href={`https://testnet.nearblocks.io/txns/${fundStatus.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 hover:underline mt-1"
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
              <label className="block text-xs font-bold text-slate-700">
                Connect or Switch Testnet Account
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. alice.testnet or youraccount.testnet"
                  value={inputAccount}
                  onChange={(e) => setInputAccount(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition border border-slate-300 shadow-xs"
                >
                  Connect
                </button>
              </div>

              {/* Quick Preset Accounts */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => connectWallet("sergeo-guard.testnet")}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                >
                  sergeo-guard.testnet (Demo Owner)
                </button>
              </div>
            </form>

            {/* External Web Wallet Link */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <a
                href="https://testnet.mynearwallet.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold"
              >
                <span>Open MyNearWallet Testnet</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              {isConnected && (
                <button
                  type="button"
                  onClick={disconnectWallet}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
