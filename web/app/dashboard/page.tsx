"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  const { accountId: connectedWalletId, isConnected: isWalletConnected } = useWallet();
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

  const [stagedPolicy, setStagedPolicy] = useState<StagedPolicyItem | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingActionItem[]>([]);
  const [isQueuingPending, setIsQueuingPending] = useState(false);

  // Non-custodial Owner Command Modal state
  const [activeOwnerModal, setActiveOwnerModal] = useState<{
    title: string;
    description: string;
    command: string;
    isDanger?: boolean;
  } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Activity feed
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keyboard accessibility: dismiss modal on Escape key
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
      command: `near call ${guardId} withdraw '{"agent_account":"${agentId}","amount":"${vaultBalance}"}' --accountId ${ownerId} --gas 100000000000000`,
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

  const dailyBudgetPercent = Math.min(100, Math.round((dailyCapSpent / (dailyCapTotal || 1)) * 100));
  const velocityPercent = Math.min(100, Math.round((velocityUsed / (velocityMax || 1)) * 100));

  return (
    <div className="w-full max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 sm:py-8 space-y-6">
      {/* Top Banner / Command Bar */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 shadow-sm transition-colors space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Security & Telemetry Console
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Policy Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monitoring agent passkey <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{agentId}</span> guarded by{" "}
              <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{guardId}</span>
            </p>
          </div>

          {/* Owner Emergency Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadOnchainState}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 dark:bg-obsidian-800 hover:bg-slate-200 dark:hover:bg-obsidian-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
              title="Refresh onchain state"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-500" : ""}`} />
            </button>

            {isPaused ? (
              <button
                type="button"
                onClick={handleUnpause}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <PlayCircle className="w-4 h-4" />
                <span>Unpause Key</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
              >
                <PauseCircle className="w-4 h-4" />
                <span>Pause Key</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRevokeKey}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-obsidian-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <Trash2 className="w-4 h-4" />
              <span>Revoke Policy</span>
            </button>

            <button
              type="button"
              onClick={handleWithdrawVault}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <DownloadCloud className="w-4 h-4" />
              <span>Evacuate Vault</span>
            </button>
          </div>
        </div>
      </div>

      {/* Circuit Breaker Status */}
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

      {/* Three Primary Telemetry Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Custodied Vault Pot */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 space-y-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              Agent Working Pot (Vault)
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Coins className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                ${vaultBalance}
              </span>
              <span className="text-xs font-semibold text-slate-400">mUSD tokens</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Custodied in the Guard contract. The maximum loss ceiling if the agent is fully compromised.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Token Contract:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold truncate max-w-[160px]">
              sergeo-guard-token.testnet
            </span>
          </div>
        </div>

        {/* Metric 2: 24h Daily Budget Cap */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 space-y-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              Daily Spending Budget
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                ${dailyCapSpent}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Cap: ${dailyCapTotal} mUSD / 24h
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-obsidian-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  dailyBudgetPercent > 80 ? "bg-rose-500" : "bg-emerald-500"
                }`}
                style={{ width: `${dailyBudgetPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{dailyBudgetPercent}% utilized</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                ${Math.max(0, dailyCapTotal - dailyCapSpent)} mUSD remaining
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Window Reset:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
              Rolling 24 Hours
            </span>
          </div>
        </div>

        {/* Metric 3: 10-Minute Velocity Throttle */}
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 space-y-4 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">
              Anti-Burst Speed Limit
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Gauge className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white">
                {velocityUsed}
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                Max: {velocityMax} calls / 10m
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-obsidian-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  velocityPercent >= 100 ? "bg-rose-500" : "bg-purple-500"
                }`}
                style={{ width: `${velocityPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{velocityPercent}% velocity</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {Math.max(0, velocityMax - velocityUsed)} calls remaining
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Velocity Rule:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">
              OVER_VELOCITY_CAP
            </span>
          </div>
        </div>
      </div>

      {/* Quarantined Actions in Timelock */}
      {pendingActions.length > 0 && (
        <div className="rounded-3xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/20 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
              <Clock className="w-4 h-4 animate-spin" />
              <span>Quarantined High-Value Actions ({pendingActions.length})</span>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">
              Threshold: $50 mUSD
            </span>
          </div>

          <div className="space-y-2">
            {pendingActions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800"
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
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs self-start sm:self-center"
                >
                  Veto & Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Ledger: Full Width */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 space-y-4 shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span>Permanent Activity Ledger</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete onchain execution history and policy refusal receipts.
            </p>
          </div>

          {/* Ledger Filter Tabs & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search events, hash, or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-obsidian-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setLedgerFilter("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
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
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
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
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                  ledgerFilter === "declined"
                    ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Refused
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Event List */}
        <div className="space-y-2">
          {filteredActivities.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching activity events recorded.
            </div>
          ) : (
            filteredActivities.map((act) => {
              const isAllowed = act.type === "ALLOW" || act.type === "SETTLED";
              const isPending = act.type === "PENDING";
              return (
                <div
                  key={act.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-obsidian-950/60 border border-slate-200/80 dark:border-slate-800/80 transition hover:bg-slate-100/70 dark:hover:bg-obsidian-950"
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
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                            isAllowed
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : isPending
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {act.type}
                        </span>

                        {act.target && (
                          <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-semibold">
                            {act.target}::{act.method || "call"}()
                          </span>
                        )}

                        {act.amount && (
                          <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            ${act.amount} mUSD
                          </span>
                        )}
                      </div>

                      {act.reason && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                          Refusal Reason: {act.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center text-xs text-slate-400">
                    <span className="font-mono text-[11px]">
                      {new Date(act.timestamp).toLocaleTimeString()}
                    </span>

                    {act.txHash && (
                      <a
                        href={`https://testnet.nearblocks.io/txns/${act.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-[11px]"
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

      {/* Owner CLI Command Modal */}
      {activeOwnerModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveOwnerModal(null);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeOwnerModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOwnerModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeOwnerModal.description}
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Run in your terminal with near-cli:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeOwnerModal.command);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"
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
