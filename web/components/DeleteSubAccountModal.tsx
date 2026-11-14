"use client";

import React, { useState } from "react";
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Check,
  Copy,
  X,
  RefreshCw,
  Zap,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/context/WalletContext";
import { tryGetPolicyContractId } from "@/lib/config";

interface DeleteSubAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentAccount: string;
  ownerAccount?: string;
  vaultBalance?: string | number;
  nearVaultBalance?: string | number;
  isRevoked?: boolean;
  onDeleted?: (agentAccount: string) => void;
}

export const DeleteSubAccountModal: React.FC<DeleteSubAccountModalProps> = ({
  isOpen,
  onClose,
  agentAccount,
  ownerAccount,
  vaultBalance = "0",
  nearVaultBalance = "0",
  isRevoked = false,
  onDeleted,
}) => {
  const { accountId: connectedWalletId, isConnected: isWalletConnected, openAuthModal } = useWallet();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTx, setSuccessTx] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeTab, setActiveTab] = useState<"action" | "cli">("action");

  if (!isOpen || !agentAccount) return null;

  const effectiveOwner = connectedWalletId || ownerAccount || "your-wallet.testnet";
  const guardId = tryGetPolicyContractId() || "scopeguard.testnet";

  const revokeCliCommand = `near call ${guardId} revoke_agent '{"agent_account":"${agentAccount}"}' --accountId ${effectiveOwner} --gas 100000000000000`;
  const deleteSubAccountCliCommand = `near delete ${agentAccount} ${effectiveOwner}`;

  const markAgentAsDeletedLocally = () => {
    if (typeof window !== "undefined") {
      try {
        const key = "scopeguard_deleted_agents";
        const current: string[] = JSON.parse(localStorage.getItem(key) || "[]");
        if (!current.includes(agentAccount)) {
          current.push(agentAccount);
          localStorage.setItem(key, JSON.stringify(current));
        }
      } catch {}
    }
  };

  const handleRevokeOnchain = async () => {
    setIsDeleting(true);
    setError(null);
    setSuccessTx(null);

    try {
      const { getNearWalletSelector } = await import("@/lib/wallet-selector");
      const ws = await getNearWalletSelector();
      if (!ws) throw new Error("Wallet selector could not be initialized");

      const wallet = await ws.selector.wallet();
      const { transactions } = await import("near-api-js");

      const action = transactions.functionCall(
        "revoke_agent",
        Buffer.from(JSON.stringify({ agent_account: agentAccount })),
        BigInt("100000000000000"),
        BigInt(0)
      );

      const res = await wallet.signAndSendTransaction({
        receiverId: guardId,
        actions: [action as any],
      });

      const txHash = typeof res === "object" && res && "transaction" in res
        ? (res as any).transaction?.hash
        : null;

      if (txHash) {
        setSuccessTx(txHash);
      }

      markAgentAsDeletedLocally();
      if (onDeleted) {
        onDeleted(agentAccount);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Revoke error:", err);
      setError(err?.message || "Failed to submit revoke transaction to NEAR");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHideOnly = () => {
    markAgentAsDeletedLocally();
    if (onDeleted) {
      onDeleted(agentAccount);
    }
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const vNum = Number(vaultBalance) || 0;
  const nNum = Number(nearVaultBalance) || 0;
  const hasFundsInVault = vNum > 0 || nNum > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-obsidian-800 flex items-center justify-between bg-rose-50/40 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Agent Sub-Account
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Permanent Action
                </span>
              </div>
              <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate max-w-sm">
                {agentAccount}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-obsidian-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex items-center border-b border-slate-100 dark:border-obsidian-800 px-5 pt-2 bg-slate-50/50 dark:bg-obsidian-950/40">
          <button
            type="button"
            onClick={() => setActiveTab("action")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "action"
                ? "border-rose-600 text-rose-600 dark:text-rose-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Delete & Revoke
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cli")}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition cursor-pointer ${
              activeTab === "cli"
                ? "border-rose-600 text-rose-600 dark:text-rose-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            CLI Commands
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Transaction Failed</span>
                <p className="font-mono text-[11px] break-all">{error}</p>
              </div>
            </div>
          )}

          {successTx && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3 text-xs text-emerald-700 dark:text-emerald-300">
              <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <div>
                <span className="font-bold">Agent Sub-Account Successfully Retired</span>
                <p className="text-[11px] mt-0.5">Permissions permanently wiped on NEAR consensus.</p>
              </div>
            </div>
          )}

          {activeTab === "action" ? (
            <div className="space-y-4">
              {/* What happens explanation */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-950/60 border border-slate-200 dark:border-obsidian-800 space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span>What happens when you delete this sub-account:</span>
                </div>
                <ul className="space-y-1.5 list-disc pl-4 text-[11px]">
                  <li>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Permanent Onchain Revocation:</span> Calling <code className="font-mono bg-slate-200/60 dark:bg-obsidian-800 px-1 py-0.5 rounded">revoke_agent</code> wipes all allowlisted contracts, target methods, and recipients on <code className="font-mono bg-slate-200/60 dark:bg-obsidian-800 px-1 py-0.5 rounded">{guardId}</code>.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Execution Blocked:</span> Even if the agent tries to use its scoped passkey, every future transaction will be blocked by policy.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Removed from Fleet:</span> This agent will be removed from your dashboard fleet view.
                  </li>
                </ul>
              </div>

              {/* Vault balance warning if funds exist */}
              {hasFundsInVault && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
                  <Coins className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold">Vault Balance Detected</span>
                    <p className="text-[11px] leading-relaxed">
                      This agent currently has <span className="font-bold">{vaultBalance} mUSD</span> and <span className="font-bold">{nearVaultBalance} NEAR</span> inside the Guard vault. You can drain these funds back to your wallet from the Dashboard Emergency tab at any time.
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2 pt-1">
                {isWalletConnected ? (
                  <button
                    type="button"
                    onClick={handleRevokeOnchain}
                    disabled={isDeleting}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Submitting Revoke to NEAR...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        <span>Revoke Onchain with Wallet ({connectedWalletId})</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (openAuthModal) openAuthModal();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Connect Wallet to Revoke Onchain</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleHideOnly}
                  className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 hover:bg-slate-100 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Remove from Local Fleet View Only</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                If you prefer to execute via NEAR CLI from your terminal, run these commands:
              </p>

              {/* Command 1: Revoke Policy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span>1. Revoke Onchain Policy Permissions</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(revokeCliCommand)}
                    className="text-brand-blue hover:underline inline-flex items-center gap-1"
                  >
                    {copiedCli ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCli ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap select-all">
                  {revokeCliCommand}
                </pre>
              </div>

              {/* Command 2: Delete Subaccount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                  <span>2. Delete Subaccount on NEAR (Reclaim Gas NEAR)</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(deleteSubAccountCliCommand)}
                    className="text-brand-blue hover:underline inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap select-all">
                  {deleteSubAccountCliCommand}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-obsidian-800 bg-slate-50/50 dark:bg-obsidian-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Non-custodial owner security control</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
