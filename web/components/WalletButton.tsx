"use client";

import React, { useState } from "react";
import {
  Wallet,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  LogOut,
  Coins,
  ChevronDown,
  X,
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  User,
  Radio,
  AlertCircle,
  Key,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { SubWalletKeyModal } from "./SubWalletKeyModal";

export const WalletButton: React.FC = () => {
  const {
    user,
    accountId,
    isConnected,
    nearBalance,
    isLoadingBalance,
    refreshBalance,
    connectedWallets,
    linkSubAccount,
    unlinkSubAccount,
    setActiveWallet,
    isAdmin,
    openAuthModal,
    openNearWalletModal,
    signOut,
  } = useWallet();

  const [isOpen, setIsOpen] = useState(false);
  const [keyModalAccount, setKeyModalAccount] = useState<string | null>(null);
  const [newSubAccountInput, setNewSubAccountInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("100");
  const [fundStatus, setFundStatus] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
    requiresOwnerSignature?: boolean;
    command?: string;
    copiedCommand?: boolean;
  } | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddSubAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubAccountInput.trim()) {
      await linkSubAccount(newSubAccountInput.trim());
      setNewSubAccountInput("");
    }
  };

  const handleQuickFund = async () => {
    setIsFunding(true);
    setFundStatus(null);

    // 1. If signed in with a NEAR browser wallet, attempt direct onchain signing
    try {
      const { getNearWalletSelector } = await import("@/lib/wallet-selector");
      const ws = await getNearWalletSelector();
      if (ws && ws.selector.isSignedIn()) {
        const wallet = await ws.selector.wallet();
        const selectedAccounts = await wallet.getAccounts();
        const signerAccountId = selectedAccounts[0]?.accountId || accountId || "";
        const { transactions } = await import("near-api-js");
        const targetGuard = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID || "scopeguard.testnet";
        const targetToken = process.env.NEXT_PUBLIC_TOKEN_CONTRACT || "sergeo-guard-token.testnet";

        // Dynamically resolve target agent for this signer
        let targetAgent = "agent2.sergeo-guard.testnet";
        if (signerAccountId) {
          try {
            const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
            const urlAgent = urlParams?.get("agent");
            if (urlAgent && (urlAgent.endsWith(`.${signerAccountId}`) || urlAgent.includes(signerAccountId))) {
              targetAgent = urlAgent;
            } else {
              const res = await fetch(`/api/agents?owner=${encodeURIComponent(signerAccountId)}`);
              const data = await res.json();
              if (data.success && Array.isArray(data.agents) && data.agents.length > 0) {
                targetAgent = data.agents[0].account;
              } else {
                targetAgent = signerAccountId.startsWith("agent.") ? signerAccountId : `agent.${signerAccountId}`;
              }
            }
          } catch {
            targetAgent = signerAccountId.startsWith("agent.") ? signerAccountId : `agent.${signerAccountId}`;
          }
        }

        // Action 0: Storage deposit for signer so token contract allows minting (refunded if already paid)
        const storageAction = transactions.functionCall(
          "storage_deposit",
          Buffer.from(
            JSON.stringify({
              account_id: signerAccountId,
              registration_only: true,
            })
          ),
          BigInt("30000000000000"),
          BigInt("1250000000000000000000") // 0.00125 NEAR
        );

        const mintAction = transactions.functionCall(
          "mint_faucet",
          Buffer.from(JSON.stringify({ amount: fundAmount })),
          BigInt("30000000000000"),
          BigInt(0)
        );
        const transferAction = transactions.functionCall(
          "ft_transfer_call",
          Buffer.from(
            JSON.stringify({
              receiver_id: targetGuard,
              amount: fundAmount,
              msg: targetAgent,
            })
          ),
          BigInt("60000000000000"),
          BigInt(1)
        );

        const res = await wallet.signAndSendTransaction({
          receiverId: targetToken,
          actions: [storageAction as any, mintAction as any, transferAction as any],
        });

        const hash =
          res && typeof res === "object" && "transaction" in res
            ? (res as any).transaction.hash
            : "Confirmed onchain";

        setFundStatus({
          success: true,
          message: `Funded agent vault (${targetAgent}) with ${fundAmount} mUSD tokens via connected wallet!`,
          txHash: typeof hash === "string" && hash !== "Confirmed onchain" ? hash : undefined,
        });
        await refreshBalance();
        setIsFunding(false);
        return;
      }
    } catch (walletErr: any) {
      if (
        walletErr?.message?.includes("User rejected") ||
        walletErr?.message?.includes("cancelled")
      ) {
        setFundStatus({
          success: false,
          message: "Wallet transaction cancelled by user.",
        });
        setIsFunding(false);
        return;
      }
      setFundStatus({
        success: false,
        message: walletErr?.message || "Wallet transaction failed. Check connected account balances.",
      });
      setIsFunding(false);
      return;
    }

    // 2. Fall back to /api/fund route
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent2.sergeo-guard.testnet",
          amount: fundAmount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFundStatus({
          success: true,
          message: data.message || `Funded agent vault with ${fundAmount} mUSD tokens.`,
          txHash: data.txHash,
        });
        await refreshBalance();
      } else if (data.requiresOwnerSignature && data.command) {
        try {
          await navigator.clipboard.writeText(data.command);
        } catch {}
        setFundStatus({
          success: false,
          requiresOwnerSignature: true,
          command: data.command,
          message: "Owner signature required onchain. Terminal command copied to clipboard!",
        });
      } else {
        setFundStatus({
          success: false,
          message: data.error || data.message || "Failed to fund vault.",
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
      {user ? (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 dark:bg-obsidian-900 dark:hover:bg-obsidian-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium transition shadow-xs cursor-pointer"
        >
          <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 text-[10px] font-bold shrink-0">
            {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
          </div>
          <span className="font-semibold max-w-[85px] sm:max-w-[120px] truncate">
            {user.displayName}
          </span>
          {accountId && (
            <span className="hidden sm:inline text-slate-500 dark:text-slate-400 text-[11px] font-mono">
              ({nearBalance} NEAR)
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={openAuthModal}
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 text-xs font-semibold transition shadow-xs cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Sign In to ScopeGuard</span>
          <span className="sm:hidden">Sign In</span>
        </button>
      )}

      {/* Wallet & Topup Anchored Dropdown */}
      {isOpen && user && (
        <>
          {/* Transparent Backdrop to dismiss on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Anchored Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-32px)] max-w-sm sm:w-[440px] z-50 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-obsidian-950/95 backdrop-blur-xl p-5 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.18),0_4px_12px_rgba(15,23,42,0.08)] space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header: ScopeGuard Profile */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 text-base font-bold shadow-xs shrink-0">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {user.displayName}
                    </h3>
                    {isAdmin ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Platform Admin
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        Verified Profile
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">
                    {user.email || `Signed in via ${user.provider}`}
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

            {/* Connected NEAR Sub-accounts & Wallets */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Linked Sub-Accounts & Wallets
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Switch active wallet or link additional NEAR accounts
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-obsidian-700 text-slate-700 dark:text-slate-300">
                  {connectedWallets.length} linked
                </span>
              </div>

              {/* Sub-accounts List */}
              <div className="space-y-1.5">
                {connectedWallets.map((wallet) => {
                  const isActive = wallet === accountId;
                  return (
                    <div
                      key={wallet}
                      onClick={() => setActiveWallet(wallet)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                        isActive
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200"
                          : "bg-white dark:bg-obsidian-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                          }`}
                        />
                        <span className="font-mono text-xs font-bold truncate">
                          {wallet}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive && (
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {nearBalance} NEAR
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setKeyModalAccount(wallet);
                          }}
                          className="p-1 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400"
                          title="View Passkey & Setup Commands"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(wallet);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Copy account address"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {connectedWallets.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              unlinkSubAccount(wallet);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            title="Unlink sub-account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Sub-Account Form */}
              <form onSubmit={handleAddSubAccount} className="pt-1 space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubAccountInput}
                    onChange={(e) => setNewSubAccountInput(e.target.value)}
                    placeholder="Link another sub-account (e.g. agent.testnet)"
                    className="flex-1 px-3 py-1.5 text-xs font-mono rounded-xl bg-white dark:bg-obsidian-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!newSubAccountInput.trim()}
                    title={!newSubAccountInput.trim() ? "Enter a sub-account ID to link" : "Link sub-account"}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Link</span>
                  </button>
                </div>
                {!newSubAccountInput.trim() && (
                  <span className="text-[10px] text-rose-500 dark:text-rose-400 flex items-center gap-1 px-1">
                    <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                    Sub-account ID is required to enable Link
                  </span>
                )}
              </form>
            </div>

            {/* Quick Faucet & Agent Funding Pot */}
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
                    <span>Minting and Depositing on NEAR...</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5 text-emerald-400 dark:text-white" />
                    <span>Deposit ${fundAmount} mUSD into Agent Vault</span>
                  </>
                )}
              </button>

              {fundStatus && (
                <div
                  className={`p-3 rounded-xl text-xs border space-y-2 ${
                    fundStatus.success
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : fundStatus.requiresOwnerSignature
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold leading-relaxed">{fundStatus.message}</p>
                    {fundStatus.requiresOwnerSignature && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                        Owner Key
                      </span>
                    )}
                  </div>

                  {fundStatus.command && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        Run this command from your terminal to mint and deposit:
                      </p>
                      <div className="p-2 rounded-lg bg-slate-900 dark:bg-black text-slate-200 font-mono text-[10px] break-all border border-slate-700/60 select-all">
                        {fundStatus.command}
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (fundStatus.command) {
                              handleCopy(fundStatus.command);
                              setFundStatus((prev) =>
                                prev ? { ...prev, copiedCommand: true } : null
                              );
                              setTimeout(() => {
                                setFundStatus((prev) =>
                                  prev ? { ...prev, copiedCommand: false } : null
                                );
                              }, 2000);
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          {fundStatus.copiedCommand ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy CLI Command</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            openNearWalletModal();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-800 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <Wallet className="w-3 h-3" />
                          <span>Sign in Browser Wallet</span>
                        </button>
                      </div>
                    </div>
                  )}

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

            {/* Bottom Controls: Switch ScopeGuard Account / Sign Out */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openAuthModal();
                }}
                className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Switch ScopeGuard Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  signOut();
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sub-Wallet Key & Commands Modal */}
      {keyModalAccount && (
        <SubWalletKeyModal
          isOpen={!!keyModalAccount}
          onClose={() => setKeyModalAccount(null)}
          agentAccount={keyModalAccount}
          ownerAccount={user?.activeAccountId || accountId || undefined}
        />
      )}
    </div>
  );
};
