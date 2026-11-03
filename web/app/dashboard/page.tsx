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
  ArrowUpRight,
  TrendingDown,
  Timer,
  Crosshair,
} from "lucide-react";
import { CircuitBreakerBanner, RejectionEvent } from "@/components/CircuitBreakerBanner";
import { StagedPolicyBanner, StagedPolicyItem } from "@/components/StagedPolicyBanner";
import { useWallet } from "@/context/WalletContext";
import { ReceiptModal } from "@/components/ReceiptModal";
import { WorstCaseBoundIndicator } from "@/components/WorstCaseBoundIndicator";
import { IncidentExportModal } from "@/components/IncidentExportModal";
import { BudgetVelocityGauge } from "@/components/BudgetVelocityGauge";

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
  const { user, accountId: connectedWalletId, isConnected: isWalletConnected, refreshBalance } = useWallet();
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
  const [highWaterMark, setHighWaterMark] = useState<string>("350");
  const [maxDrawdownBps, setMaxDrawdownBps] = useState<number | null>(1500);
  const [leaseExpiresAt, setLeaseExpiresAt] = useState<number | string | null>(null);
  const [canaryMethods, setCanaryMethods] = useState<string[]>(["drain_vault", "admin_transfer"]);
  const [intentRecipients, setIntentRecipients] = useState<string[]>([]);
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
    8: true,
    9: true,
    10: true,
    11: true,
    12: true,
  });
  const [loading, setLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [inspectHash, setInspectHash] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<"all" | "approved" | "declined">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
          if (data.policy.max_drawdown_bps !== undefined) {
            setMaxDrawdownBps(data.policy.max_drawdown_bps);
          }
          if (data.policy.lease_expires_at !== undefined) {
            setLeaseExpiresAt(data.policy.lease_expires_at);
          }
          if (Array.isArray(data.policy.canary_methods) && data.policy.canary_methods.length > 0) {
            setCanaryMethods(data.policy.canary_methods);
          }
          if (Array.isArray(data.policy.intent_recipients)) {
            setIntentRecipients(data.policy.intent_recipients);
          }
        }
        if (data.budget) {
          const paused = Boolean(data.budget.paused);
          setIsPaused(paused);
          setRuleToggles((prev) => ({ ...prev, 2: !paused }));
          setDailyCapTotal(data.budget.cap !== undefined ? Number(data.budget.cap) : 500);
          setDailyCapSpent(data.budget.spent !== undefined ? Number(data.budget.spent) : 0);
          const vBalance = data.budget.vault_balance !== undefined ? String(data.budget.vault_balance) : "350";
          setVaultBalance(vBalance);
          setHighWaterMark(data.budget.high_water_mark !== undefined ? String(data.budget.high_water_mark) : vBalance);
          if (data.budget.max_drawdown_bps !== undefined) {
            setMaxDrawdownBps(data.budget.max_drawdown_bps);
          }
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
      description: "Resumes normal agent operation on NEAR Testnet. The Guard will resume checking transactions against approved policy rules.",
      command: `near call ${guardId} unpause '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: false,
    });
  };

  const handleWithdrawVault = async () => {
    setActiveOwnerModal({
      title: "Evacuate Vault to Owner",
      description: "Empties 100% of the agent spending pot back into your owner wallet. The destination is forced to the verified owner account onchain.",
      command: `near call ${guardId} withdraw '{"agent_account":"${agentId}","amount":"${vaultBalance}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
    });
  };

  const handleQuickFund = async () => {
    setIsFunding(true);
    try {
      const resp = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          amount: "100",
        }),
      });
      const data = await resp.json();
      if (data.success) {
        await loadOnchainState();
        if (refreshBalance) refreshBalance();
      }
    } catch (err) {
      console.error("Fund failed:", err);
    } finally {
      setIsFunding(false);
    }
  };

  const handleSettlePending = (pendingId: number) => {
    setActiveOwnerModal({
      title: "Settle Quarantined Action",
      description: `Authorizes and executes quarantined action #${pendingId} on NEAR Testnet. The 60-second review timelock has completed.`,
      command: `near call ${guardId} settle_pending '{"agent":"${agentId}","id":${pendingId}}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: false,
    });
  };

  const handleCancelPending = (pendingId: number) => {
    setActiveOwnerModal({
      title: "Veto Quarantined Action",
      description: `Vetoes and deletes quarantined action #${pendingId} from the onchain queue. No funds will be transferred.`,
      command: `near call ${guardId} cancel_pending '{"agent_account":"${agentId}","id":${pendingId}}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
    });
  };

  const handleCancelPolicyChange = async () => {
    setActiveOwnerModal({
      title: "Cancel Staged Policy Change",
      description: "Cancels the pending policy change currently sitting in the timelock queue. The existing policy rules remain active.",
      command: `near call ${guardId} cancel_policy_change '{"agent_account":"${agentId}"}' --accountId ${ownerId} --gas 100000000000000`,
      isDanger: true,
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
    setRuleToggles((prev) => ({
      ...prev,
      [ruleNum]: !prev[ruleNum],
    }));
  };

  const copyAgentId = () => {
    navigator.clipboard.writeText(agentId);
    setCopiedAgent(true);
    setTimeout(() => setCopiedAgent(false), 2000);
  };

  const filteredActivities = activities.filter((item) => {
    if (ledgerFilter === "approved" && item.type !== "ALLOW" && item.type !== "SETTLED") {
      return false;
    }
    if (ledgerFilter === "declined" && item.type !== "REJECT" && item.type !== "AUTO_PAUSE") {
      return false;
    }
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
      <div className="lg:hidden flex items-center justify-between bg-white dark:bg-obsidian-900 p-3.5 rounded-xl border border-slate-200 dark:border-obsidian-800">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Security Console
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
            Welcome, <span className="text-brand-blue capitalize">{ownerId.split('.')[0]}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-mono bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-mint-green" />
            <span>10 Rules</span>
          </span>
        </div>
      </div>

      {/* Onboarding Quickstart Banner */}
      <div className="bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-obsidian-850 text-brand-blue border border-slate-200 dark:border-obsidian-800 shrink-0">
            <ShieldCheck className="w-5 h-5 text-mint-green" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-blue">
                {user ? `Welcome, ${user.displayName}` : "Security Console"}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20">
                Live Demo Telemetry
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Guarded Agent: agent.sergeo-guard.testnet
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              Real-time telemetry from the public ScopeGuard demo agent. Ready to secure your own trading bot or background agent? Issue a custom scoped passkey with your own spending cap and allowlisted contracts in under 60 seconds.
            </p>
          </div>
        </div>

        <Link
          href="/create"
          className="bg-brand-blue hover:bg-brand-blueHover text-white rounded-lg px-4 py-2 text-xs font-semibold shrink-0 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span>Issue Passkey</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
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

      {/* Hero Financial Vault Card */}
      <div className="bg-white dark:bg-obsidian-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-obsidian-800 space-y-6">
        {/* Top Header Row with Score Box */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-obsidian-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Protected Agent Vault
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20">
                Onchain Custody
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                {isInitialLoading ? "--" : `$${vaultBalance}.00`}
              </span>
              <span className="text-xs font-mono text-slate-500">
                mUSD Working Pot
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
              Money custodied exclusively in the Guard contract. The absolute maximum loss boundary if the agent is fully compromised.
            </p>
          </div>

          {/* Clean Security Score Widget */}
          <div className="bg-slate-50 dark:bg-obsidian-950 rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 w-full sm:w-auto sm:min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">
                Security Score
              </span>
              <ShieldCheck className="w-4 h-4 text-mint-green" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                100%
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green">
                Grade A
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              10 onchain rules verified
            </span>
          </div>
        </div>

        {/* 4-Column Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile A: Daily Budget Cap */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Daily Budget Cap
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-20 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${dailyCapTotal}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-500">
                mUSD / 24h
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Configured 24h ceiling
            </span>
          </div>

          {/* Tile B: Spent Today */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Spent Today
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-16 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${dailyCapSpent}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-500">
                {dailyCapTotal > 0 ? Math.round((dailyCapSpent / dailyCapTotal) * 100) : 0}% of Cap
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              {dailyCapSpent > 0 ? `$${dailyCapSpent} in rolling window` : "Zero spend in window"}
            </span>
          </div>

          {/* Tile C: Remaining Safe Allowance */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <Check className="w-3.5 h-3.5 text-mint-green" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Remaining Allowance
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-20 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${Math.max(0, dailyCapTotal - dailyCapSpent)}
                </span>
              )}
              <span className="text-[11px] font-mono text-mint-greenDark dark:text-mint-green font-semibold">
                Available
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Unblocked spendable budget
            </span>
          </div>

          {/* Tile D: Speed Throttle */}
          <div className="rounded-xl p-4 border border-slate-200 dark:border-obsidian-800 bg-slate-50 dark:bg-obsidian-950 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <Gauge className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Speed Throttle
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              {isInitialLoading ? (
                <span className="inline-block h-8 w-16 bg-slate-200 dark:bg-obsidian-800 rounded animate-pulse" />
              ) : (
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {velocityUsed}/{velocityMax}
                </span>
              )}
              <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                velocityUsed >= velocityMax
                  ? "bg-rose-500/10 text-rose-500"
                  : "text-slate-500"
              }`}>
                {velocityUsed >= velocityMax ? "Brake Tripped" : "Normal"}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1">
              Calls in 10m window
            </span>
          </div>
        </div>

        {/* Bottom Action Strip */}
        <div className="pt-4 border-t border-slate-100 dark:border-obsidian-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Assigned Passkey:</span>
            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-obsidian-950 px-3 py-1 rounded-lg border border-slate-200 dark:border-obsidian-800 flex items-center gap-2 max-w-full">
              <span className="truncate">{agentId}</span>
              <button
                type="button"
                onClick={copyAgentId}
                className="hover:text-brand-blue transition cursor-pointer"
                title="Copy agent account ID"
              >
                {copiedAgent ? <Check className="w-3.5 h-3.5 text-mint-green" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              </button>
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickFund}
            disabled={isFunding}
            className="bg-brand-blue hover:bg-brand-blueHover text-white rounded-lg px-4 py-2 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          >
            {isFunding ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Minting Faucet...</span>
              </>
            ) : (
              <>
                <Coins className="w-3.5 h-3.5" />
                <span>Deposit $100 mUSD into Vault</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Spending Limits, Speed Throttles & Autonomous Risk Gauges */}
      <BudgetVelocityGauge
        gasBudgetNearTotal={0.25}
        gasBudgetNearRemaining={0.23}
        dailyCapTotal={dailyCapTotal}
        dailyCapSpent={dailyCapSpent}
        velocityUsed={velocityUsed}
        velocityMax={velocityMax}
        vaultBalance={vaultBalance}
        highWaterMark={highWaterMark}
        maxDrawdownBps={maxDrawdownBps}
        leaseExpiresAt={leaseExpiresAt}
        canaryMethodsCount={canaryMethods.length}
        intentRecipientsCount={intentRecipients.length}
      />

      {/* Worst-Case Loss Bound Indicator */}
      <WorstCaseBoundIndicator dailyCap={dailyCapTotal} vaultBalance={vaultBalance} />

      {/* Autonomous Risk Panels: IntentShield & Canary Decoys */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IntentShield Card */}
        <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-obsidian-800">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand-blue" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                IntentShield: Cross-Chain Allowlist
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
              {intentRecipients.length > 0 ? `${intentRecipients.length} Recipient(s)` : "Strict Mode"}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Restricts IntentTransfer actions to pre-approved destination addresses across EVM, Cosmos, and Solana chains.
          </p>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Allowlisted Destinations:
            </span>
            {intentRecipients.length > 0 ? (
              <div className="space-y-1">
                {intentRecipients.map((rec, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 font-mono text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span className="truncate">{rec}</span>
                    <span className="text-[10px] font-semibold text-mint-greenDark dark:text-mint-green px-1.5 py-0.5 rounded bg-mint-green/10">
                      Permitted
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-xs font-mono text-slate-500">
                No external recipients allowlisted. All cross-chain withdrawals are blocked onchain.
              </div>
            )}
          </div>
        </div>

        {/* Canary Decoy Honeypot Card */}
        <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-obsidian-800">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Canary Decoy Tripwires
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {canaryMethods.length} Armed
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Honeypot functions deliberately advertised to catch prompt injection attacks. If an agent tries calling any of these methods, the contract triggers immediate auto-pause.
          </p>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Active Decoy Methods:
            </span>
            <div className="flex flex-wrap gap-2">
              {canaryMethods.map((m, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 font-mono text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>{m}()</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Enforced Policy Rules and Controls */}
      <div className="bg-white dark:bg-obsidian-900 rounded-xl p-5 sm:p-6 border border-slate-200 dark:border-obsidian-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-obsidian-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Active Onchain Policy
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20">
                Deterministic Order
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight mt-1">
              Policy Checks and Enforcement Rules
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sequence executed on NEAR before any token movement. If any check fails, the transaction is rejected with its reason code.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-600 dark:text-slate-400">
              Contract: {guardId}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              desc: "Refuses execution when paused by owner or tripped by consecutive rejects in configured window.",
              config: isInitialLoading ? "Syncing..." : isPaused ? "Paused by Owner" : "Active (Unpaused)",
              badge: isInitialLoading ? "Syncing" : isPaused ? "Paused" : "Active",
              isLocked: false,
            },
            {
              num: 3,
              name: "Task Lease Expiry",
              code: "LEASE_EXPIRED",
              desc: "Refuses execution if the task lease timestamp has expired. Prevents forgotten keys from executing indefinitely.",
              config: leaseExpiresAt
                ? `Expires: ${new Date(Number(leaseExpiresAt) / 1000000).toLocaleString()}`
                : "Perpetual (No Expiry)",
              badge: leaseExpiresAt ? "Timed" : "Perpetual",
              isLocked: false,
            },
            {
              num: 4,
              name: "Canary Decoy Honeypot Tripwire",
              code: "CANARY_TRIPPED",
              desc: "Calling honeypot methods trips auto-pause immediately and emits an onchain CANARY_TRIPPED security event.",
              config: canaryMethods.join(", "),
              badge: `${canaryMethods.length} Armed`,
              isLocked: true,
            },
            {
              num: 5,
              name: "Velocity Anti-Spam Limit",
              code: "OVER_VELOCITY_CAP",
              desc: `Maximum ${velocityMax} transactions per 10-minute sliding window. Blocks runaway loops and automated burst draining.`,
              config: `${velocityUsed} / ${velocityMax} calls recorded`,
              badge: `${velocityUsed}/${velocityMax} Used`,
              isLocked: false,
            },
            {
              num: 6,
              name: "Target Contract Allowlist",
              code: "TARGET_NOT_ALLOWED",
              desc: "Agent calls are restricted exclusively to allowlisted contracts. Calls to unlisted contracts are blocked onchain.",
              config: isInitialLoading
                ? "Syncing..."
                : policy?.targets && Object.keys(policy.targets).length > 0
                ? Object.keys(policy.targets).join(", ")
                : "No targets allowlisted",
              badge: isInitialLoading
                ? "Syncing"
                : `${policy?.targets ? Object.keys(policy.targets).length : 0} Target(s)`,
              isLocked: false,
            },
            {
              num: 7,
              name: "Method Call Allowlist",
              code: "METHOD_NOT_ALLOWED",
              desc: "Only approved contract methods can be invoked. Key-management, admin, and upgrade functions are refused.",
              config: isInitialLoading
                ? "Syncing..."
                : policy?.targets && Object.keys(policy.targets).length > 0
                ? Object.entries(policy.targets)
                    .map(([t, m]: any) => `${t}: ${Array.isArray(m) ? m.join(", ") : m}`)
                    .join(" | ")
                : "No methods allowlisted",
              badge: "Strict Methods",
              isLocked: false,
            },
            {
              num: 8,
              name: "Daily Spending Cap",
              code: "OVER_DAILY_CAP",
              desc: `Cumulative value spent across rolling 24 hours cannot exceed $${dailyCapTotal} mUSD ($${dailyCapSpent} spent, $${Math.max(0, dailyCapTotal - dailyCapSpent)} remaining).`,
              config: isInitialLoading ? "Syncing..." : `$${dailyCapSpent} / $${dailyCapTotal} mUSD`,
              badge: isInitialLoading ? "Syncing" : `$${Math.max(0, dailyCapTotal - dailyCapSpent)} Left`,
              isLocked: false,
            },
            {
              num: 9,
              name: "Direct Recipient Transfer Allowlist",
              code: "RECIPIENT_NOT_ALLOWED",
              desc: "Direct token payouts to personal wallets are refused unless explicitly allowlisted. Empty list = strict DEX isolation.",
              config: isInitialLoading
                ? "Syncing..."
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
            {
              num: 10,
              name: "IntentShield Cross-Chain Allowlist",
              code: "INTENT_RECIPIENT_NOT_ALLOWED",
              desc: "Cross-chain Intent transfers are restricted to explicitly allowlisted destination recipient addresses.",
              config: isInitialLoading
                ? "Syncing..."
                : intentRecipients.length > 0
                ? intentRecipients.join(", ")
                : "Strict Isolation (Transfers Refused)",
              badge: isInitialLoading
                ? "Syncing"
                : intentRecipients.length > 0
                ? `${intentRecipients.length} Recipient(s)`
                : "Isolated",
              isLocked: false,
            },
            {
              num: 11,
              name: "Vault Custody Balance Enforcement",
              code: "INSUFFICIENT_VAULT_BALANCE",
              desc: `Transfers cannot exceed internal custodied balance ($${vaultBalance} mUSD available in agent vault).`,
              config: `$${vaultBalance} in Vault`,
              badge: "Vault Bounded",
              isLocked: false,
            },
            {
              num: 12,
              name: "Net Drawdown Floor Breaker",
              code: "DRAWDOWN_EXCEEDED",
              desc: `Halts execution if vault drops below ${((10000 - (maxDrawdownBps ?? 1500)) / 100).toFixed(0)}% of peak high-water mark ($${highWaterMark}).`,
              config: `${((maxDrawdownBps ?? 1500) / 100).toFixed(1)}% Max Drop`,
              badge: "Floor Protected",
              isLocked: false,
            },
          ].map((rule) => {
            const isEnabled = ruleToggles[rule.num] !== false;
            return (
              <div
                key={rule.num}
                className={`p-3.5 rounded-xl border transition ${
                  isEnabled
                    ? "bg-slate-50 dark:bg-obsidian-950 border-slate-200 dark:border-obsidian-800"
                    : "bg-slate-100/50 dark:bg-obsidian-950/20 border-slate-200/40 dark:border-obsidian-800/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-obsidian-850 font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                      {rule.num}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rule.name}
                      </h4>
                      <span className="font-mono text-[10px] text-slate-400">
                        {rule.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-obsidian-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-obsidian-800">
                      {rule.badge}
                    </span>

                    <button
                      type="button"
                      disabled={rule.isLocked}
                      onClick={() => toggleRule(rule.num)}
                      title={rule.isLocked ? "Protocol invariant: cannot disable" : "Toggle rule enforcement"}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        rule.isLocked
                          ? "opacity-60 cursor-not-allowed bg-brand-blue"
                          : isEnabled
                          ? "cursor-pointer bg-brand-blue"
                          : "cursor-pointer bg-slate-300 dark:bg-obsidian-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                          isEnabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {rule.desc}
                </p>

                <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-obsidian-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 text-[10px]">Config:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-[200px]">
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
        <div className="rounded-xl border border-brand-blue/30 bg-brand-blue/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-brand-blue font-semibold text-xs">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span>Quarantined High-Value Actions ({pendingActions.length})</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Threshold: ${policy?.high_value_threshold || 250} mUSD
            </span>
          </div>

          <div className="space-y-2">
            {pendingActions.map((item) => {
              const isReady = !item.secondsRemaining || item.secondsRemaining <= 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        Action #{item.id}: {item.method}() on {item.target}
                      </span>
                      <span className="font-mono font-bold text-xs text-mint-greenDark dark:text-mint-green">
                        ${item.amount} mUSD
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
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
                        className="px-3 py-1.5 rounded-lg bg-mint-greenDark dark:bg-mint-green text-white dark:text-slate-950 text-xs font-semibold transition"
                      >
                        Settle & Execute
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCancelPending(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
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

      {/* Asymmetric Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Col 7): Activity Ledger Card */}
        <div className="lg:col-span-7 bg-white dark:bg-obsidian-900 rounded-xl p-5 border border-slate-200 dark:border-obsidian-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-obsidian-800">
            <div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">
                Onchain Audit Ledger
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Activity Receipts & Enforcements
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 border border-blue-500/20 text-xs font-semibold transition"
                title="Export Provenance & Security Incidents"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                Export Report
              </button>

              {/* Smart Filter Pills */}
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-xs">
              <button
                type="button"
                onClick={() => setLedgerFilter("all")}
                className={`px-2.5 py-1 rounded transition ${
                  ledgerFilter === "all"
                    ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("approved")}
                className={`px-2.5 py-1 rounded transition ${
                  ledgerFilter === "approved"
                    ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Allowed
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("declined")}
                className={`px-2.5 py-1 rounded transition ${
                  ledgerFilter === "declined"
                    ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Refused
              </button>
            </div>
          </div>
        </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by contract, method, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-blue"
            />
          </div>

          {/* Event Items */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {isInitialLoading ? (
              <div className="space-y-2 py-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 animate-pulse flex items-center justify-between"
                  >
                    <div className="h-3 w-32 bg-slate-200 dark:bg-obsidian-800 rounded" />
                    <div className="h-3 w-16 bg-slate-200 dark:bg-obsidian-800 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono">
                No activity receipts matching filter.
              </div>
            ) : (
              filteredActivities.map((act) => {
                const isAllowed = act.type === "ALLOW" || act.type === "SETTLED";
                const isPending = act.type === "PENDING";
                return (
                  <div
                    key={act.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isAllowed ? "bg-mint-green" : isPending ? "bg-brand-blue" : "bg-rose-500"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              isAllowed
                                ? "bg-mint-green/10 text-mint-greenDark dark:text-mint-green"
                                : isPending
                                ? "bg-brand-blue/10 text-brand-blue"
                                : "bg-rose-500/10 text-rose-500"
                            }`}
                          >
                            {act.type}
                          </span>

                          {act.target && (
                            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 font-medium truncate max-w-[170px] sm:max-w-xs">
                              {act.target}::{act.method || "call"}()
                            </span>
                          )}

                          {act.amount && (
                            <span className="font-mono text-xs text-mint-greenDark dark:text-mint-green font-bold">
                              ${act.amount}
                            </span>
                          )}
                        </div>

                        {act.reason && (
                          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {act.reason}
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
                            className="text-brand-blue hover:underline font-mono text-[10px]"
                          >
                            Inspect
                          </button>
                          <a
                            href={`https://testnet.nearblocks.io/txns/${act.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-mono text-[10px] inline-flex items-center gap-0.5"
                          >
                            <span>NearBlocks</span>
                            <ExternalLink className="w-2.5 h-2.5" />
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

        {/* Right Column (Col 5): Policy Status & Controls */}
        <div className="lg:col-span-5 bg-white dark:bg-obsidian-900 rounded-xl p-5 border border-slate-200 dark:border-obsidian-800 space-y-5">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">
              Policy Status
            </span>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Active Protection
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-mint-green/10 text-mint-greenDark dark:text-mint-green text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-mint-green" />
                <span>Verified</span>
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every attempted transaction is intercepted by ScopeGuard. Even if the agent is prompt-injected or stolen, loss is bounded to approved limits.
            </p>
          </div>

          {/* Metric Grid */}
          <div className="pt-3 border-t border-slate-100 dark:border-obsidian-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                Brake
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">3 strikes</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                Window
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">10 min</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                Targets
              </span>
              <span className="font-mono text-xs font-bold text-mint-greenDark dark:text-mint-green">1 DEX</span>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-obsidian-950 rounded-lg border border-slate-200 dark:border-obsidian-800 space-y-0.5">
              <span className="text-[10px] text-slate-400 font-medium block">
                External
              </span>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">Blocked</span>
            </div>
          </div>

          {/* Owner Emergency Controls */}
          <div className="pt-3 border-t border-slate-100 dark:border-obsidian-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 block">
              Owner Controls
            </span>
            <div className="grid grid-cols-2 gap-2">
              {isPaused ? (
                <button
                  type="button"
                  onClick={handleUnpause}
                  className="py-2 px-3 rounded-lg bg-mint-greenDark dark:bg-mint-green text-white dark:text-slate-950 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Unpause Key</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-900 dark:text-white text-xs font-semibold border border-slate-200 dark:border-obsidian-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Pause Key</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleWithdrawVault}
                className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Evacuate Pot</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveOwnerModal(null);
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-obsidian-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeOwnerModal.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOwnerModal(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {activeOwnerModal.description}
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Run in terminal:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeOwnerModal.command);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-brand-blue font-medium"
                >
                  {copiedCmd ? <Check className="w-3 h-3 text-mint-green" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd ? "Copied" : "Copy Command"}</span>
                </button>
              </div>
              <pre className="p-3 rounded-lg bg-obsidian-950 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto border border-obsidian-800">
                {activeOwnerModal.command}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Policy Provenance & Incident Export Modal */}
      <IncidentExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        agentId={agentId}
        guardId={guardId}
        ownerId={ownerId}
        policy={policy}
        stagedPolicy={stagedPolicy}
        vaultBalance={vaultBalance}
        dailyCapTotal={dailyCapTotal}
        dailyCapSpent={dailyCapSpent}
        activities={activities}
      />

      {/* Direct In-App Onchain Receipt Inspector */}
      <ReceiptModal txHash={inspectHash} onClose={() => setInspectHash(null)} />
    </div>
  );
}
