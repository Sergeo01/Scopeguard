"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Gauge,
  Clock,
  ShieldCheck,
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  DownloadCloud,
  KeyRound,
  ExternalLink,
  Activity,
  RefreshCw,
  XCircle,
  Search,
  Check,
  AlertTriangle,
  Zap,
  CheckCircle2,
  X,
  Copy,
  Coins,
  Lock,
  Layers,
  ChevronRight,
  Shield,
  Trash2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { CircuitBreakerBanner, RejectionEvent } from "@/components/CircuitBreakerBanner";
import { StagedPolicyBanner, StagedPolicyItem } from "@/components/StagedPolicyBanner";
import { useWallet } from "@/context/WalletContext";

interface ActivityItem {
  id: string;
  txHash?: string;
  type: "ALLOW" | "REJECT" | "AUTO_PAUSE" | "SETTLED" | "CANCELLED" | "PAUSE" | "UNPAUSE" | "PENDING";
  timestamp: number;
  agent: string;
  target?: string;
  method?: string;
  amount?: string;
  reason?: string;
}

interface PendingActionItem {
  id: number;
  target: string;
  method: string;
  amount: string;
  recipient?: string | null;
  executable_at: number;
  secondsRemaining?: number;
}

export default function DashboardPage() {
  const { accountId: connectedWalletId, isConnected: isWalletConnected, refreshBalance } = useWallet();
  const [isMounted, setIsMounted] = useState(false);
  const [agentId, setAgentId] = useState("trader.sergeo-guard.testnet");
  const [guardId, setGuardId] = useState("guard2.sergeo-guard.testnet");
  const [ownerId, setOwnerId] = useState("sergeo-guard.testnet");

  useEffect(() => {
    if (isWalletConnected && connectedWalletId) {
      setOwnerId(connectedWalletId);
    }
  }, [isWalletConnected, connectedWalletId]);

  const [agentPublicKey, setAgentPublicKey] = useState("ed25519:13Xi8UoLpX7hgPd6u8W4JRMsxtzHHkMd8RZpdhqppSvm");
  const [policy, setPolicy] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rejectCount, setRejectCount] = useState(0);
  const [vaultBalance, setVaultBalance] = useState("100");
  const [dailyCapTotal, setDailyCapTotal] = useState(500);
  const [dailyCapSpent, setDailyCapSpent] = useState(25);
  const [velocityUsed, setVelocityUsed] = useState(2);
  const [velocityMax, setVelocityMax] = useState(5);
  const [loading, setLoading] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "approved" | "declined">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const [stagedPolicy, setStagedPolicy] = useState<StagedPolicyItem | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);

  // Non-custodial Owner Command Modal state
  const [activeOwnerModal, setActiveOwnerModal] = useState<{
    title: string;
    description: string;
    command: string;
    isDanger?: boolean;
  } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveOwnerModal(null);
        setCopiedCmd(false);
      }
    };
    if (activeOwnerModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeOwnerModal]);

  const loadOnchainState = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/state");
      const data = await resp.json();
      if (data.success) {
        if (data.agentId) setAgentId(data.agentId);
        if (data.guardId) setGuardId(data.guardId);
        if (data.ownerId) setOwnerId(data.ownerId);
        if (data.agentPublicKey) setAgentPublicKey(data.agentPublicKey);
        if (data.policy) {
          setPolicy(data.policy);
          if (data.policy.max_actions_per_10min) {
            setVelocityMax(Number(data.policy.max_actions_per_10min));
          }
        }
        if (data.budget) {
          setIsPaused(Boolean(data.budget.paused));
          setDailyCapTotal(Number(data.budget.cap) || 500);
          setDailyCapSpent(Number(data.budget.spent) || 0);
          setVaultBalance(data.budget.vault_balance || "100");
          setVelocityUsed(data.budget.actions_in_window || 0);
        }
        setPendingActions(Array.isArray(data.pendingActions) ? data.pendingActions : []);
        if (data.stagedPolicy !== undefined) setStagedPolicy(data.stagedPolicy);
        if (data.activities && Array.isArray(data.activities)) setActivities(data.activities);
      }
    } catch (e) {
      console.warn("Could not fetch /api/state", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOnchainState();
    const interval = setInterval(loadOnchainState, 15000);
    return () => clearInterval(interval);
  }, []);

  // Timelock countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setPendingActions((prev) =>
        prev.map((item) => {
          const nowSeconds = Math.floor(Date.now() / 1000);
          const rem = Math.max(0, item.executable_at - nowSeconds);
          return { ...item, secondsRemaining: rem };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePause = async () => {
    setActiveOwnerModal({
      title: "Emergency Pause Key",
      description: "Freezes all agent transactions on NEAR Testnet immediately. The Guard contract will refuse all calls until unpaused by the owner.",
      command: `near call ${guardId} pause '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: false,
    });
  };

  const handleUnpause = async () => {
    setActiveOwnerModal({
      title: "Unpause Agent Key",
      description: "Resumes normal agent execution and clears consecutive reject counters.",
      command: `near call ${guardId} unpause '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: false,
    });
  };

  const handleRevokeKey = async () => {
    setActiveOwnerModal({
      title: "Permanently Revoke Agent Policy",
      description: "Permanently strips all execution targets and recipients from the agent onchain. The agent passkey becomes completely dead and all future calls will be declined.",
      command: `near call ${guardId} revoke_agent '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
    });
  };

  const handleWithdrawVault = async () => {
    setActiveOwnerModal({
      title: "Emergency Vault Evacuation",
      description: `Transfers all custodied ${vaultBalance} mUSD tokens from the Guard vault directly back to the owner account.`,
      command: `near call ${guardId} withdraw '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
    });
  };

  const handleCancelPending = async (id: number) => {
    setActiveOwnerModal({
      title: `Veto Pending Intent #${id}`,
      description: "Cancels quarantined high-value action before the timelock delay expires.",
      command: `near call ${guardId} cancel_pending '{"agent_account":"${agentId}","id":${id}}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
    });
  };

  const handleCancelPolicyChange = async () => {
    setActiveOwnerModal({
      title: "Cancel Staged Policy Change",
      description: "Discards the staged policy update onchain before the timelock window activates it.",
      command: `near call ${guardId} cancel_policy_change '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
    });
  };

  const handleQuickFund = async () => {
    setIsFunding(true);
    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          amount: "100",
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadOnchainState();
        await refreshBalance();
      }
    } finally {
      setIsFunding(false);
    }
  };

  const copyAgentId = () => {
    navigator.clipboard.writeText(agentId);
    setCopiedAgent(true);
    setTimeout(() => setCopiedAgent(false), 2000);
  };

  const filteredActivities = activities.filter((item) => {
    if (ledgerFilter === "approved" && item.type !== "ALLOW" && item.type !== "SETTLED") return false;
    if (ledgerFilter === "declined" && item.type !== "REJECT" && item.type !== "AUTO_PAUSE") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCall = item.target ? item.target.toLowerCase().includes(q) : false;
      const matchMethod = item.method ? item.method.toLowerCase().includes(q) : false;
      const matchReason = item.reason ? item.reason.toLowerCase().includes(q) : false;
      const matchTx = item.txHash ? item.txHash.toLowerCase().includes(q) : false;
      return matchCall || matchMethod || matchReason || matchTx;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Circuit Breaker Status Banner */}
      <CircuitBreakerBanner
        isPaused={isPaused}
        rejectCount={rejectCount}
        maxRejects={Number(policy?.auto_pause_rejects || 3)}
        windowMinutes={Number(policy?.auto_pause_window_minutes || 10)}
        recentRejections={[]}
        onUnpause={handleUnpause}
        isOwner={true}
      />

      {/* Staged Policy Timelock Banner */}
      <StagedPolicyBanner
        stagedPolicy={stagedPolicy}
        onCancelPolicyChange={handleCancelPolicyChange}
        isOwner={true}
      />

      {/* Hero Financial Card (Dark Glassmorphism Specification) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B0F19] via-[#111827] to-[#1E1B4B] p-6 sm:p-8 text-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] border border-slate-800">
        {/* Internal Radial Glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

        {/* Top Row: Lifetime Vault Pot + 4 Glass Sub-Cards */}
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              PROTECTED VAULT POT
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white tabular-nums">
                ${vaultBalance}.00
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                mUSD Tokens
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
              Custodied in the Guard contract. The absolute maximum loss ceiling if the agent is fully compromised.
            </p>
          </div>

          {/* 4-Column Grid of Translucent Glass Sub-Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Sub-Card 1: 24H Daily Cap */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  DAILY CAP
                </span>
                <span className="w-5 h-5 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">
                  <CreditCard className="w-3 h-3" />
                </span>
              </div>
              <span className="font-mono text-base font-bold text-white block">
                ${dailyCapTotal}
              </span>
              <span className="text-[10px] text-slate-400 block">24h Budget</span>
            </div>

            {/* Sub-Card 2: Spent Today */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  SPENT
                </span>
                <span className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px]">
                  <Activity className="w-3 h-3" />
                </span>
              </div>
              <span className="font-mono text-base font-bold text-white block">
                ${dailyCapSpent}
              </span>
              <span className="text-[10px] text-slate-400 block">Rolling spend</span>
            </div>

            {/* Sub-Card 3: Remaining */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  REMAINING
                </span>
                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">
                  <Check className="w-3 h-3" />
                </span>
              </div>
              <span className="font-mono text-base font-bold text-emerald-400 block">
                ${Math.max(0, dailyCapTotal - dailyCapSpent)}
              </span>
              <span className="text-[10px] text-slate-400 block">Safe to spend</span>
            </div>

            {/* Sub-Card 4: Speed Throttle */}
            <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  VELOCITY
                </span>
                <span className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 flex items-center justify-center text-[10px]">
                  <Gauge className="w-3 h-3" />
                </span>
              </div>
              <span className="font-mono text-base font-bold text-white block">
                {velocityUsed}/{velocityMax}
              </span>
              <span className="text-[10px] text-slate-400 block">Calls / 10m</span>
            </div>
          </div>
        </div>

        {/* Bottom Row: Monospace Address + Translucent Pill CTA */}
        <div className="relative z-10 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Assigned Agent Passkey:</span>
            <span className="font-mono text-xs font-semibold text-slate-200 bg-white/10 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
              <span>{agentId}</span>
              <button
                type="button"
                onClick={copyAgentId}
                className="hover:text-emerald-400 transition"
                title="Copy agent account ID"
              >
                {copiedAgent ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              </button>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickFund}
              disabled={isFunding}
              className="bg-white/20 hover:bg-white/30 text-white rounded-full px-5 py-2 text-xs font-semibold backdrop-blur-sm transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isFunding ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Minting Faucet...</span>
                </>
              ) : (
                <>
                  <Coins className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deposit $100 mUSD into Vault →</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Activation Callout Strip (Soft Mint with Pitch-Black Pill CTA) */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-ambient">
        <div className="flex items-start gap-3.5">
          <div className="bg-emerald-500 text-white p-3 rounded-xl shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
              ONCHAIN ENFORCEMENT ACTIVE
            </span>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Agent Key Locked to Guard Contract at Protocol Level
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              The agent machine only holds a NEAR FunctionCall passkey. Direct token drains and unapproved smart contracts are cryptographically refused by blockchain validators.
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="bg-slate-950 hover:bg-slate-800 text-white rounded-full px-5 py-2.5 text-xs font-bold shrink-0 transition shadow-xs flex items-center gap-1.5"
        >
          <span>Simulate Attack on Testnet →</span>
        </Link>
      </div>

      {/* Quarantined Actions in Timelock */}
      {pendingActions.length > 0 && (
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Quarantined High-Value Actions ({pendingActions.length})</span>
            </div>
            <span className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
              Threshold: $50 mUSD
            </span>
          </div>

          <div className="space-y-2">
            {pendingActions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      Action #{item.id}: {item.method}() on {item.target}
                    </span>
                    <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      ${item.amount} mUSD
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {item.secondsRemaining && item.secondsRemaining > 0
                      ? `Owner review delay: ${item.secondsRemaining}s remaining`
                      : "Quarantine window ended. Ready for settlement."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCancelPending(item.id)}
                  className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs self-start sm:self-center"
                >
                  Veto & Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asymmetric Bottom Bento Grid (lg:col-span-7 and lg:col-span-5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Col 7): Crisp Pure White Container for Activity Ledger */}
        <div className="lg:col-span-7 bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-ambient space-y-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                ONCHAIN AUDIT LEDGER
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Activity Receipts & Enforcements
              </h3>
            </div>

            {/* Smart Filter Pills */}
            <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-100 dark:bg-obsidian-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setLedgerFilter("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  ledgerFilter === "all"
                    ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("approved")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  ledgerFilter === "approved"
                    ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Allowed
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("declined")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                  ledgerFilter === "declined"
                    ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Refused
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter transactions by contract, hash, or refusal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Event Items */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {filteredActivities.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No activity receipts matching filter.
              </div>
            ) : (
              filteredActivities.map((act) => {
                const isAllowed = act.type === "ALLOW" || act.type === "SETTLED";
                const isPending = act.type === "PENDING";
                return (
                  <div
                    key={act.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50/70 dark:bg-obsidian-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100/70 dark:hover:bg-obsidian-950 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isAllowed ? "bg-emerald-500" : isPending ? "bg-blue-500" : "bg-rose-500"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              isAllowed
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                : isPending
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                            }`}
                          >
                            {act.type}
                          </span>

                          {act.target && (
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[170px] sm:max-w-xs">
                              {act.target}::{act.method || "call"}()
                            </span>
                          )}

                          {act.amount && (
                            <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                              ${act.amount}
                            </span>
                          )}
                        </div>

                        {act.reason && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                            Refused: {act.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center text-xs text-slate-400">
                      <span className="font-mono text-[10px]">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </span>
                      {act.txHash && (
                        <a
                          href={`https://testnet.nearblocks.io/txns/${act.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-mono text-[10px]"
                        >
                          <span>Tx</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (Col 5): Deep Charcoal Card (#121316) Specification */}
        <div className="lg:col-span-5 bg-[#121316] text-white rounded-2xl p-6 shadow-ambient space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              YOUR POLICY STATUS
            </span>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Active Protection</span>
              </h3>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Verified</span>
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every attempted transaction is intercepted by ScopeGuard. Even if the agent is prompt-injected or stolen, loss is bounded to approved limits.
            </p>
          </div>

          {/* 4-Column Metric Row from Template Specification */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 bg-white/[0.04] rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                BRAKE
              </span>
              <span className="font-mono text-sm font-bold text-white">3 strikes</span>
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                WINDOW
              </span>
              <span className="font-mono text-sm font-bold text-white">10 min</span>
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                TARGETS
              </span>
              <span className="font-mono text-sm font-bold text-emerald-400">1 DEX</span>
            </div>

            <div className="p-3 bg-white/[0.04] rounded-xl border border-white/5 space-y-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                EXTERNAL
              </span>
              <span className="font-mono text-sm font-bold text-rose-400">Blocked</span>
            </div>
          </div>

          {/* Owner Emergency Controls */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              OWNER PANIC CONTROLS
            </span>
            <div className="grid grid-cols-2 gap-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleUnpause}
                  className="py-2.5 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Unpause Key</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="py-2.5 px-3 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pause Key</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleWithdrawVault}
                className="py-2.5 px-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Evacuate Vault</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Command Modal */}
      {activeOwnerModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveOwnerModal(null);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeOwnerModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOwnerModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeOwnerModal.description}
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Run with near-cli:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeOwnerModal.command);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-emerald-600 font-semibold"
                >
                  {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd ? "Copied" : "Copy Command"}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto border border-slate-800">
                {activeOwnerModal.command}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
