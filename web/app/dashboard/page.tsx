"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Fuel,
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
} from "lucide-react";
import { CircuitBreakerBanner, RejectionEvent } from "@/components/CircuitBreakerBanner";
import { StagedPolicyBanner, StagedPolicyItem } from "@/components/StagedPolicyBanner";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";

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
  const [isMounted, setIsMounted] = useState(false);
  const [agentId, setAgentId] = useState("trader.sergeo-guard.testnet");
  const [guardId, setGuardId] = useState("guard2.sergeo-guard.testnet");
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

  // Initialized empty to eliminate server vs client hydration mismatches
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

  const [ownerTxStatus, setOwnerTxStatus] = useState<{
    message: string;
    txHash?: string;
    explorerUrl?: string;
  } | null>(null);

  const handlePause = async () => {
    setActiveOwnerModal({
      title: "Emergency Pause Key",
      description: "Freezes all agent transactions on NEAR Testnet immediately. The Guard contract will refuse all calls until unpaused by the owner.",
      command: `near call ${guardId} pause '{"agent_account":"${agentId}"}' --accountId sergeo-guard.testnet`,
      isDanger: false,
    });
  };

  const handleUnpause = async () => {
    setActiveOwnerModal({
      title: "Unpause Agent Key",
      description: "Resumes normal agent execution and clears consecutive reject counters.",
      command: `near call ${guardId} unpause '{"agent_account":"${agentId}"}' --accountId sergeo-guard.testnet`,
      isDanger: false,
    });
  };

  const handleRevokeKey = async () => {
    setActiveOwnerModal({
      title: "Permanently Revoke Passkey",
      description: "Deletes the restricted function-call passkey directly on NEAR consensus. The credential on the agent machine becomes completely dead.",
      command: `near delete-key ${agentId} <AGENT_PUBLIC_KEY> --accountId ${agentId}`,
      isDanger: true,
    });
  };

  const handleWithdrawVault = async () => {
    setActiveOwnerModal({
      title: "Emergency Vault Evacuation",
      description: `Transfers all custodied ${vaultBalance} mUSD tokens from the Guard vault directly back to the owner account.`,
      command: `near call ${guardId} withdraw '{"agent_account":"${agentId}","amount":"${vaultBalance}"}' --accountId sergeo-guard.testnet`,
      isDanger: true,
    });
  };

  const handleCancelPending = async (id: number) => {
    setActiveOwnerModal({
      title: `Veto Pending Intent #${id}`,
      description: "Cancels quarantined high-value action before the timelock delay expires.",
      command: `near call ${guardId} cancel_pending '{"agent_account":"${agentId}","id":${id}}' --accountId sergeo-guard.testnet`,
      isDanger: true,
    });
  };

  const handleTriggerRealTimelock = async () => {
    try {
      setIsQueuingPending(true);
      const res = await fetch("/api/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "sergeo-guard-dex.testnet",
          method: "swap",
          amount: "300",
          args: { amount: "300" },
        }),
      });
      const data = await res.json();
      if (!data.success) {
        console.warn("Notice triggering timelock action:", data.error);
      }
      await loadOnchainState();
    } catch (err) {
      console.error("Failed to trigger real timelock action:", err);
    } finally {
      setIsQueuingPending(false);
    }
  };

  const handleCancelPolicyChange = async () => {
    setActiveOwnerModal({
      title: "Cancel Staged Policy Change",
      description: "Discards the staged policy update onchain before the timelock window activates it. Only the owner account can sign this cancellation.",
      command: `near contract call-function as-transaction ${guardId} cancel_policy_change json-args '{"agent_account":"${agentId}"}' prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as <your-owner-account.testnet> network-config testnet`,
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
      const matchType = item.type.toLowerCase().includes(q);
      return matchCall || matchMethod || matchReason || matchType;
    }
    return true;
  });

  const remainingDaily = Math.max(0, dailyCapTotal - dailyCapSpent);
  const spentPercent = dailyCapTotal > 0 ? Math.min(100, Math.round((dailyCapSpent / dailyCapTotal) * 100)) : 0;

  // Format time deterministically after client mount
  const formatTime = (ts: number) => {
    if (!isMounted) return "--:--";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "--:--";
    }
  };

  // Rule taxonomy token helper
  const getRuleToken = (reason?: string) => {
    if (!reason) return null;
    if (reason.includes("NOT_AGENT")) return { code: "Rule 1", name: "NOT_AGENT", tone: "bg-red-50 text-red-800 border-red-200" };
    if (reason.includes("PAUSED")) return { code: "Rule 2", name: "PAUSED", tone: "bg-zinc-100 text-zinc-800 border-zinc-200" };
    if (reason.includes("OVER_VELOCITY_CAP")) return { code: "Rule 3", name: "OVER_VELOCITY_CAP", tone: "bg-orange-50 text-orange-800 border-orange-200" };
    if (reason.includes("TARGET_NOT_ALLOWED")) return { code: "Rule 4", name: "TARGET_NOT_ALLOWED", tone: "bg-rose-50 text-rose-800 border-rose-200" };
    if (reason.includes("METHOD_NOT_ALLOWED")) return { code: "Rule 5", name: "METHOD_NOT_ALLOWED", tone: "bg-amber-50 text-amber-800 border-amber-200" };
    if (reason.includes("OVER_DAILY_CAP")) return { code: "Rule 6", name: "OVER_DAILY_CAP", tone: "bg-red-50 text-red-800 border-red-200" };
    if (reason.includes("RECIPIENT_NOT_ALLOWED")) return { code: "Rule 7", name: "RECIPIENT_NOT_ALLOWED", tone: "bg-purple-50 text-purple-800 border-purple-200" };
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ========================================================================= */}
      {/* ZONE 1: READING (Agent State, Identity, and Live Spending Budgets)         */}
      {/* ========================================================================= */}
      <section aria-labelledby="section-reading-title" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 id="section-reading-title" className="text-xl font-bold text-slate-900 tracking-tight">
                Agent Security Console
              </h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  isPaused
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                {isPaused ? "Paused" : "Active & Guarded"}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Consensus Policy Enforced</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Agent: <span className="font-mono text-slate-800 font-medium">{agentId}</span> · Guard:{" "}
              <span className="font-mono text-slate-800 font-medium">{guardId}</span> · Receipts:{" "}
              <span className="text-slate-700 font-medium">Public NEAR RPC</span>
            </p>
          </div>

          <button
            type="button"
            onClick={loadOnchainState}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-xs self-start sm:self-auto focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-slate-900" : "text-slate-500"}`} />
            <span>Sync Onchain State</span>
          </button>
        </div>

        {ownerTxStatus && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">{ownerTxStatus.message}</span>
                {ownerTxStatus.txHash && (
                  <span className="font-mono text-[11px] text-emerald-700">
                    Onchain Tx: {ownerTxStatus.txHash}
                  </span>
                )}
              </div>
            </div>
            {ownerTxStatus.explorerUrl && (
              <a
                href={ownerTxStatus.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition"
              >
                <span>View Receipt</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Staged Policy & Circuit Breaker Banners */}
        <StagedPolicyBanner
          stagedPolicy={stagedPolicy}
          onCancelPolicyChange={handleCancelPolicyChange}
          isOwner={true}
        />

        <CircuitBreakerBanner
          isPaused={isPaused}
          rejectCount={rejectCount}
          maxRejects={3}
          windowMinutes={10}
          recentRejections={[]}
          onUnpause={handleUnpause}
          isOwner={true}
        />

        {/* Integrated KPI Strip: 4 distinct metrics, mobile-responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: Daily Spend Cap */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Daily Spend Allowance</span>
              <span className="font-mono font-bold text-slate-900">{remainingDaily} mUSD Left</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: `${spentPercent}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>{dailyCapSpent} of {dailyCapTotal} mUSD limit</span>
              <span>{spentPercent}%</span>
            </div>
          </div>

          {/* KPI 2: Gas Fuel Allowance */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Protocol Gas Budget</span>
              <span className="font-mono font-bold text-slate-900">0.25 NEAR</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: "100%" }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Function-call passkey cap</span>
              <span>NEAR Gas</span>
            </div>
          </div>

          {/* KPI 3: Speed Throttle */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Anti-Spam Velocity</span>
              <span className="font-mono font-bold text-slate-900">{velocityUsed} of {velocityMax} calls</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, (velocityUsed / velocityMax) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>10m rolling window</span>
              <span>Auto-brake: 3 strikes</span>
            </div>
          </div>

          {/* KPI 4: Real Custody Vault Balance */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Custody Vault Pot</span>
              <span className="font-mono font-bold text-emerald-700">{vaultBalance} mUSD</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: "100%" }} />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Locked in Guard contract</span>
              <span>NEP-141</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ZONE 2: ACTING (Emergency Owner Switches and Breaker Powers)               */}
      {/* Warm alert perimeter treatment to visually isolate critical controls     */}
      {/* ========================================================================= */}
      <section
        aria-labelledby="section-acting-title"
        className="rounded-2xl border border-rose-200/80 bg-gradient-to-b from-rose-50/30 to-white p-5 space-y-4 shadow-xs"
      >
        <div className="flex items-center justify-between pb-3 border-b border-rose-100">
          <div>
            <h2 id="section-acting-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Emergency Owner Switches</span>
            </h2>
            <p className="text-xs text-slate-500">
              Non-custodial onchain controls that can never be blocked or redirected by the agent
            </p>
          </div>
          <span className="text-[11px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-200 font-mono">
            Master Authority
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Switch 1: Soft Freeze */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 block">
                {isPaused ? "Resume Passkey" : "Freeze Passkey"}
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isPaused
                  ? "Key is currently frozen onchain. Unpause to resume authorized operations."
                  : "Soft stop: refuses all agent calls immediately without deleting the key."}
              </p>
            </div>
            <button
              type="button"
              onClick={isPaused ? handleUnpause : handlePause}
              className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                isPaused
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300 font-bold"
              }`}
            >
              {isPaused ? "Unpause Passkey" : "Pause Passkey"}
            </button>
          </div>

          {/* Switch 2: Evacuate Vault */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 block">Evacuate Vault</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Sweeps all custodied {vaultBalance} mUSD directly back to the owner personal account.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWithdrawVault}
              className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              Evacuate Full Vault
            </button>
          </div>

          {/* Switch 3: Permanent Revocation */}
          <div className="p-4 bg-white border border-rose-200 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
            <div className="space-y-1">
              <span className="font-bold text-xs text-rose-950 block">Permanently Revoke Key</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Deletes the agent passkey on NEAR consensus. The credential on disk opens nothing.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRevokeKey}
              className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              Revoke Access Key
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ZONE 3: VERIFYING (Timelock Queue & Onchain Transaction Ledger)            */}
      {/* Monospace chain data, cryptographic receipts, and rule evaluations         */}
      {/* ========================================================================= */}
      <section aria-labelledby="section-verifying-title" className="space-y-6">
        {/* High-Value Timelock Approval Queue */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div>
              <h2 id="section-verifying-title" className="text-sm font-bold text-slate-900">
                High-Value Approval Queue
              </h2>
              <p className="text-xs text-slate-500">
                Purchases of $250 or more enter a 60-second review quarantine for owner veto
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono font-medium">{pendingActions.length} Pending</span>
              {pendingActions.length === 0 && (
                <button
                  type="button"
                  onClick={handleTriggerRealTimelock}
                  disabled={isQueuingPending}
                  className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:opacity-50"
                >
                  {isQueuingPending ? "Queuing onchain..." : "+ Test Timelock Action ($300)"}
                </button>
              )}
            </div>
          </div>

          {pendingActions.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No transactions currently in timelock. Purchases under $250 settle immediately against verified rules.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingActions.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-amber-50/70 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 font-mono">
                        {item.target}::{item.method}()
                      </span>
                      <span className="font-mono font-bold text-amber-900">${item.amount} mUSD</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-950 font-mono">
                        {item.secondsRemaining !== undefined ? `${item.secondsRemaining}s veto window` : "60s timelock"}
                      </span>
                    </div>
                    <span className="text-slate-600 block text-[11px]">
                      Destination: <span className="font-mono text-slate-800">{item.recipient || "Internal Contract"}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCancelPending(item.id)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition shadow-xs focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none self-start sm:self-auto"
                  >
                    Veto Intent #{item.id}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Master Transaction Ledger */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Master Transaction Ledger</h2>
              <p className="text-xs text-slate-500">Permanent onchain execution and rejection log</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search ledger..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-800 placeholder-slate-400 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                />
              </div>

              <div className="flex items-center p-0.5 bg-slate-100 rounded-md text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setLedgerFilter("all")}
                  className={`px-2.5 py-1 rounded transition ${ledgerFilter === "all" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600"}`}
                >
                  All ({activities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerFilter("approved")}
                  className={`px-2.5 py-1 rounded transition ${ledgerFilter === "approved" ? "bg-white text-emerald-800 shadow-xs font-bold" : "text-slate-600"}`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerFilter("declined")}
                  className={`px-2.5 py-1 rounded transition ${ledgerFilter === "declined" ? "bg-white text-rose-800 shadow-xs font-bold" : "text-slate-600"}`}
                >
                  Declined
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-2 px-3">Status</th>
                  <th className="pb-2 px-3">Call</th>
                  <th className="pb-2 px-3">Amount</th>
                  <th className="pb-2 px-3">Rule Evaluation</th>
                  <th className="pb-2 px-3">Time</th>
                  <th className="pb-2 px-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No matching transactions recorded.
                    </td>
                  </tr>
                ) : (
                  filteredActivities.map((item) => {
                    const isApproved = item.type === "ALLOW" || item.type === "SETTLED";
                    const isDeclined = item.type === "REJECT" || item.type === "AUTO_PAUSE";
                    const ruleToken = getRuleToken(item.reason);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-sans">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isApproved
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : isDeclined
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {isApproved ? "Approved" : isDeclined ? "Declined" : item.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-medium">
                          {item.target ? `${item.target}::${item.method}()` : item.agent}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {item.amount && item.amount !== "0" ? `$${item.amount} mUSD` : "-"}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {ruleToken ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${ruleToken.tone}`}>
                              {ruleToken.code}: {ruleToken.name}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">
                              {item.reason || "Policy verified onchain"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {formatTime(item.timestamp)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {item.txHash ? (
                            <a
                              href={`https://testnet.nearblocks.io/txns/${item.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium hover:underline"
                            >
                              <span>{item.txHash.slice(0, 8)}...</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (Visible only below md:) */}
          <div className="block md:hidden space-y-2.5">
            {filteredActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No matching transactions recorded.
              </div>
            ) : (
              filteredActivities.map((item) => {
                const isApproved = item.type === "ALLOW" || item.type === "SETTLED";
                const isDeclined = item.type === "REJECT" || item.type === "AUTO_PAUSE";
                const ruleToken = getRuleToken(item.reason);

                return (
                  <div key={item.id} className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isApproved
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : isDeclined
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {isApproved ? "Approved" : isDeclined ? "Declined" : item.type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-slate-900 break-all">
                        {item.target ? `${item.target}::${item.method}()` : item.agent}
                      </span>
                      {item.amount && item.amount !== "0" && (
                        <span className="font-bold text-slate-900 shrink-0 ml-2">${item.amount} mUSD</span>
                      )}
                    </div>

                    {ruleToken ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${ruleToken.tone}`}>
                        {ruleToken.code}: {ruleToken.name}
                      </span>
                    ) : (
                      <p className="text-[11px] text-slate-600">{item.reason || "Policy verified onchain"}</p>
                    )}

                    {item.txHash && (
                      <div className="pt-1 border-t border-slate-200/60 flex justify-end">
                        <a
                          href={`https://testnet.nearblocks.io/txns/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 hover:text-slate-900 font-medium"
                        >
                          <span>Tx: {item.txHash.slice(0, 12)}...</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* COHESIVE NON-CUSTODIAL OWNER MODAL (Fully Accessible & Light-Themed)     */}
      {/* ========================================================================= */}
      {activeOwnerModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveOwnerModal(null);
              setCopiedCmd(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 id="modal-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
                {activeOwnerModal.isDanger ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                )}
                <span>{activeOwnerModal.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setActiveOwnerModal(null);
                  setCopiedCmd(false);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {activeOwnerModal.description}
            </p>

            {/* Terminal Command Box */}
            <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[11px] text-slate-400">NEAR CLI Terminal Command</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeOwnerModal.command);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold transition"
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>
              <code className="text-xs font-mono text-emerald-400 break-all select-all block bg-black/40 p-3 rounded-lg border border-slate-800">
                {activeOwnerModal.command}
              </code>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800">Non-Custodial Architecture:</span> ScopeGuard servers never store your master private keys. To execute this owner power, copy the command above and run it in your terminal, or sign directly through your connected wallet.
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveOwnerModal(null);
                  setCopiedCmd(false);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  loadOnchainState();
                  setActiveOwnerModal(null);
                  setCopiedCmd(false);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
              >
                Sync Onchain State
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
