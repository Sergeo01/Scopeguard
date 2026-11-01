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
import { ReceiptModal } from "@/components/ReceiptModal";

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
  const [agentId, setAgentId] = useState("agent.sergeo-guard.testnet");
  const [guardId, setGuardId] = useState("guard2.sergeo-guard.testnet");
  const [ownerId, setOwnerId] = useState("sergeo-guard.testnet");

  useEffect(() => {
    if (isWalletConnected && connectedWalletId) {
      setOwnerId(connectedWalletId);
    }
  }, [isWalletConnected, connectedWalletId]);

  const [agentPublicKey, setAgentPublicKey] = useState<string>("");
  const [policy, setPolicy] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rejectCount, setRejectCount] = useState(0);
  const [vaultBalance, setVaultBalance] = useState("350");
  const [dailyCapTotal, setDailyCapTotal] = useState(500);
  const [dailyCapSpent, setDailyCapSpent] = useState(0);
  const [velocityUsed, setVelocityUsed] = useState(0);
  const [velocityMax, setVelocityMax] = useState(5);
  const [ruleToggles, setRuleToggles] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
    7: true,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [inspectHash, setInspectHash] = useState<string | null>(null);
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
          const paused = Boolean(data.budget.paused);
          setIsPaused(paused);
          setRuleToggles((prev) => ({ ...prev, 2: !paused }));
          setDailyCapTotal(data.budget.cap !== undefined ? Number(data.budget.cap) : 500);
          setDailyCapSpent(data.budget.spent !== undefined ? Number(data.budget.spent) : 0);
          setVaultBalance(data.budget.vault_balance !== undefined ? String(data.budget.vault_balance) : "350");
          setVelocityUsed(data.budget.actions_in_window !== undefined ? Number(data.budget.actions_in_window) : 0);
        }
        setPendingActions(Array.isArray(data.pendingActions) ? data.pendingActions : []);
        if (data.stagedPolicy !== undefined) setStagedPolicy(data.stagedPolicy);
        if (data.activities && Array.isArray(data.activities)) setActivities(data.activities);
      }
    } catch (e) {
      console.warn("Could not fetch /api/state", e);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
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

  const toggleRule = (ruleNum: number) => {
    if (ruleNum === 1) return;
    if (ruleNum === 2) {
      if (isPaused) {
        handleUnpause();
      } else {
        handlePause();
      }
      return;
    }
    setRuleToggles((prev) => ({ ...prev, [ruleNum]: !prev[ruleNum] }));
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

  const handleSettlePending = async (id: number) => {
    setActiveOwnerModal({
      title: `Settle Pending Intent #${id}`,
      description: "Executes a timelocked high-value action after the veto delay has expired. Only the owner can settle.",
      command: `near call ${guardId} settle_pending '{"agent":"${agentId}","id":${id}}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: false,
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
      {/* Mobile Greeting & Status Header */}
      <div className="lg:hidden flex items-center justify-between bg-slate-100/70 dark:bg-obsidian-900/60 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
            Security Console
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
            Welcome, <span className="text-blue-600 dark:text-blue-400 capitalize">{ownerId.split('.')[0]}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>7 Rules Active</span>
          </span>
        </div>
      </div>

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

      {/* Hero Financial Vault Card (Clean Single-Layer Container) */}
      <div className="bg-white dark:bg-obsidian-900 rounded-2xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          {/* Top Header Row with Floating Score Box */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  PROTECTED AGENT VAULT
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Onchain Custody
                </span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {isInitialLoading ? "--" : `$${vaultBalance}.00`}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  mUSD Working Pot
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                Money custodied exclusively in the Guard contract. The absolute maximum loss boundary if the agent is fully compromised.
              </p>
            </div>

            {/* Clean Security Score Widget */}
            <div className="bg-slate-50 dark:bg-obsidian-950/70 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 w-full sm:w-auto sm:min-w-[200px] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  SECURITY SCORE
                </span>
                <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  100%
                </span>
                <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↗ Grade A
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                7 onchain bounds active
              </span>
            </div>
          </div>

          {/* Clean Neutral 4-Column Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile A: Daily Budget Cap */}
            <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  DAILY BUDGET CAP
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {isInitialLoading ? (
                  <span className="inline-block h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    ${dailyCapTotal}
                  </span>
                )}
                <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↗ Manual
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configured 24h ceiling
              </span>
            </div>

            {/* Tile B: Spent Today */}
            <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  SPENT TODAY
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {isInitialLoading ? (
                  <span className="inline-block h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    ${dailyCapSpent}
                  </span>
                )}
                <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  {dailyCapTotal > 0 ? Math.round((dailyCapSpent / dailyCapTotal) * 100) : 0}% of Cap
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {dailyCapSpent > 0 ? `$${dailyCapSpent} recorded in 24h window` : "Zero spend in current 24h window"}
              </span>
            </div>

            {/* Tile C: Remaining Safe Allowance */}
            <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  REMAINING ALLOWANCE
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {isInitialLoading ? (
                  <span className="inline-block h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    ${Math.max(0, dailyCapTotal - dailyCapSpent)}
                  </span>
                )}
                <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↗ Safe
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Unblocked spendable budget
              </span>
            </div>

            {/* Tile D: Speed Throttle */}
            <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <Gauge className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  SPEED THROTTLE
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                {isInitialLoading ? (
                  <span className="inline-block h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {velocityUsed}/{velocityMax}
                  </span>
                )}
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5 ${
                  velocityUsed >= velocityMax
                    ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300"
                    : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                }`}>
                  {velocityUsed >= velocityMax ? "Breaker Tripped" : "Normal"}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Calls in current 10m window
              </span>
            </div>
          </div>

          {/* Bottom Action Strip */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Assigned Agent Passkey:</span>
              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-obsidian-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 flex items-center gap-2 max-w-full">
                <span className="truncate">{agentId}</span>
                <button
                  type="button"
                  onClick={copyAgentId}
                  className="hover:text-emerald-500 transition cursor-pointer"
                  title="Copy agent account ID"
                >
                  {copiedAgent ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </span>
            </div>

            <button
              type="button"
              onClick={handleQuickFund}
              disabled={isFunding}
              className="bg-slate-950 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 rounded-full px-5 py-2 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
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
          className="bg-slate-950 hover:bg-slate-800 text-white rounded-full px-5 py-2.5 text-xs font-bold shrink-0 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <span>Simulate Attack on Testnet →</span>
        </Link>
      </div>

      {/* 7 Enforced Policy Rules and Controls */}
      <div className="bg-white dark:bg-obsidian-900 rounded-2xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ACTIVE ONCHAIN POLICY
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                7 Deterministic Layers
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              7 Enforced Policy Rules and Per-Rule Controls
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Deterministic sequence executed on NEAR Testnet before any token movement. If any check fails, call is rejected with exact reason code.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-obsidian-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              Contract: {guardId}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[
            {
              num: 1,
              name: "Registered Agent Account",
              code: "NOT_AGENT",
              desc: "Caller must match registered agent sub-account. Impostors and third-party callers are refused before state access.",
              config: agentId,
              badge: "Bound",
              isLocked: true,
            },
            {
              num: 2,
              name: "Execution State & Circuit Breaker",
              code: "PAUSED",
              desc: "Refuses execution when paused by owner or tripped by 3 consecutive rejects in 10 minutes.",
              config: isInitialLoading ? "Syncing Onchain State..." : isPaused ? "Paused by Owner" : "Active (Unpaused)",
              badge: isInitialLoading ? "Syncing" : isPaused ? "Paused" : "Active",
              isLocked: false,
            },
            {
              num: 3,
              name: "Velocity Anti-Spam Limit",
              code: "OVER_VELOCITY_CAP",
              desc: `Maximum ${velocityMax} transactions per 10-minute sliding window. Blocks runaway loops and automated burst draining.`,
              config: `${velocityUsed} / ${velocityMax} calls recorded`,
              badge: `${velocityUsed}/${velocityMax} Used`,
              isLocked: false,
            },
            {
              num: 4,
              name: "Target Contract Allowlist",
              code: "TARGET_NOT_ALLOWED",
              desc: "Agent calls are restricted exclusively to allowlisted contracts. Calls to unlisted contracts are blocked onchain.",
              config: isInitialLoading
                ? "Syncing onchain policy..."
                : policy?.targets && Object.keys(policy.targets).length > 0
                ? Object.keys(policy.targets).join(", ")
                : "No targets allowlisted",
              badge: isInitialLoading
                ? "Syncing"
                : `${policy?.targets ? Object.keys(policy.targets).length : 0} Target(s)`,
              isLocked: false,
            },
            {
              num: 5,
              name: "Method Call Allowlist",
              code: "METHOD_NOT_ALLOWED",
              desc: "Only approved contract methods can be invoked. Key-management, admin, and upgrade functions are refused.",
              config: isInitialLoading
                ? "Syncing onchain policy..."
                : policy?.targets && Object.keys(policy.targets).length > 0
                ? Object.entries(policy.targets)
                    .map(([t, m]: any) => `${t}: ${Array.isArray(m) ? m.join(", ") : m}`)
                    .join(" | ")
                : "No methods allowlisted",
              badge: "Strict Methods",
              isLocked: false,
            },
            {
              num: 6,
              name: "Daily Spending Cap (24h Window)",
              code: "OVER_DAILY_CAP",
              desc: `Cumulative value spent across rolling 24 hours cannot exceed $${dailyCapTotal} mUSD ($${dailyCapSpent} spent, $${Math.max(0, dailyCapTotal - dailyCapSpent)} remaining).`,
              config: isInitialLoading ? "Syncing..." : `$${dailyCapSpent} / $${dailyCapTotal} mUSD`,
              badge: isInitialLoading ? "Syncing" : `$${Math.max(0, dailyCapTotal - dailyCapSpent)} Left`,
              isLocked: false,
            },
            {
              num: 7,
              name: "Recipient Transfer Allowlist",
              code: "RECIPIENT_NOT_ALLOWED",
              desc: "Direct token payouts to personal wallets are refused unless explicitly allowlisted. Empty list = strict DEX isolation.",
              config: isInitialLoading
                ? "Syncing onchain policy..."
                : policy?.recipients && policy.recipients.length > 0
                ? policy.recipients.join(", ")
                : "Strict Isolation (Transfers Refused)",
              badge: isInitialLoading
                ? "Syncing"
                : policy?.recipients && policy.recipients.length > 0
                ? `${policy.recipients.length} Recipient(s)`
                : "Isolated",
              isLocked: false,
            },
          ].map((rule) => {
            const isEnabled = ruleToggles[rule.num] !== false;
            return (
              <div
                key={rule.num}
                className={`p-4 rounded-xl border transition ${
                  isEnabled
                    ? "bg-slate-50/70 dark:bg-obsidian-950/60 border-slate-200/80 dark:border-slate-800"
                    : "bg-slate-100/50 dark:bg-obsidian-950/20 border-slate-200/40 dark:border-slate-800/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-200/80 dark:bg-slate-800 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      {rule.num}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rule.name}
                      </h4>
                      <span className="font-mono text-[10px] text-slate-400">
                        Code: {rule.code}
                      </span>
                    </div>
                  </div>

                  {/* Per-Rule Toggle Switch */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isEnabled
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {rule.badge}
                    </span>

                    <button
                      type="button"
                      disabled={rule.isLocked}
                      onClick={() => toggleRule(rule.num)}
                      title={rule.isLocked ? "Protocol invariant: cannot disable" : "Toggle rule enforcement"}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.isLocked
                          ? "opacity-60 cursor-not-allowed bg-emerald-500"
                          : isEnabled
                          ? "cursor-pointer bg-emerald-500"
                          : "cursor-pointer bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed">
                  {rule.desc}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 text-[10px]">Onchain Config:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[200px]">
                    {rule.config}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
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
              Threshold: ${policy?.high_value_threshold || 250} mUSD
            </span>
          </div>

          <div className="space-y-2">
            {pendingActions.map((item) => {
              const isReady = !item.secondsRemaining || item.secondsRemaining <= 0;
              return (
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
                      {isReady
                        ? "Quarantine window ended. Ready for owner settlement."
                        : `Owner review delay: ${item.secondsRemaining}s remaining`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {isReady && (
                      <button
                        type="button"
                        onClick={() => handleSettlePending(item.id)}
                        className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        Settle & Execute
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCancelPending(item.id)}
                      className="px-3.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Veto & Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asymmetric Bottom Grid (lg:col-span-7 and lg:col-span-5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Col 7): Activity Ledger Card */}
        <div className="lg:col-span-7 bg-white dark:bg-obsidian-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
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
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
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
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
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
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
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
              {isInitialLoading ? (
                <div className="space-y-2.5 py-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-obsidian-950/60 border border-slate-200/80 dark:border-slate-800/80 animate-pulse flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                          <div className="h-2.5 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
                        </div>
                      </div>
                      <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
                    </div>
                  ))}
                </div>
              ) : filteredActivities.length === 0 ? (
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
                            <p
                              className={`text-[11px] font-mono mt-0.5 ${
                                isAllowed
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : isPending
                                  ? "text-blue-600 dark:text-blue-400"
                                  : act.type === "CANCELLED" || act.type === "PAUSE" || act.type === "UNPAUSE"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {isAllowed
                                ? `Verified: ${act.reason}`
                                : isPending
                                ? `Quarantine: ${act.reason}`
                                : act.type === "CANCELLED"
                                ? `Vetoed: ${act.reason}`
                                : act.type === "PAUSE" || act.type === "UNPAUSE"
                                ? `Admin: ${act.reason}`
                                : `Refused: ${act.reason}`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center text-xs text-slate-400">
                        <span className="font-mono text-[10px]">
                          {new Date(act.timestamp).toLocaleTimeString()}
                        </span>
                        {act.txHash && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInspectHash(act.txHash!)}
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-mono text-[10px] cursor-pointer"
                            >
                              <span>Inspect</span>
                            </button>
                            <a
                              href={`https://testnet.nearblocks.io/txns/${act.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-mono text-[10px]"
                            >
                              <span>NearBlocks</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        {/* Right Column (Col 5): Policy Status & Panic Controls */}
        <div className="lg:col-span-5 bg-[#121316] text-white rounded-2xl p-6 border border-slate-800 shadow-xs space-y-6">
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

            {/* 4-Column Metric Row with Pastel Tint Accents */}
            <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300 block">
                  BRAKE
                </span>
                <span className="font-mono text-sm font-bold text-white">3 strikes</span>
              </div>

              <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300 block">
                  WINDOW
                </span>
                <span className="font-mono text-sm font-bold text-white">10 min</span>
              </div>

              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 block">
                  TARGETS
                </span>
                <span className="font-mono text-sm font-bold text-emerald-400">1 DEX</span>
              </div>

              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 space-y-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300 block">
                  EXTERNAL
                </span>
                <span className="font-mono text-sm font-bold text-amber-400">Blocked</span>
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
                    className="py-2.5 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Unpause Key</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    className="py-2.5 px-3 rounded-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                    <span>Pause Key</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleWithdrawVault}
                  className="py-2.5 px-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
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

      {/* Direct In-App Onchain Receipt Inspector */}
      <ReceiptModal txHash={inspectHash} onClose={() => setInspectHash(null)} />
    </div>
  );
}
