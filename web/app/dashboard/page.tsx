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

      {/* Hero Bento Well Container (Double-Bezel Framing Specification) */}
      <div className="bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="bg-white/95 dark:bg-obsidian-950/90 backdrop-blur-sm rounded-[22px] p-6 sm:p-7 border border-white dark:border-slate-800/80 space-y-6">
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
                  ${vaultBalance}.00
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  mUSD Working Pot
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                Money custodied exclusively in the Guard contract. The absolute maximum loss boundary if the agent is fully compromised.
              </p>
            </div>

            {/* Pattern 4: Floating "Score" Card (Elevated Inset Widget) */}
            <div className="bg-white dark:bg-obsidian-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.04)] shrink-0 min-w-[220px] space-y-2">
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

          {/* Pattern 2: Pastel-Tinted Inner Metric Tiles (2x2 / 4-column Bento Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile A: Violet/Lavender (Daily Budget Cap) */}
            <div className="rounded-2xl p-4 border transition-all flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-purple-50/50 via-purple-50/80 to-purple-100/60 dark:from-purple-950/20 dark:via-purple-950/30 dark:to-purple-900/40 border-purple-200/50 dark:border-purple-800/40">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-purple-100/80 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  DAILY BUDGET CAP
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${dailyCapTotal}
                </span>
                <span className="bg-purple-100/80 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↗ Manual
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configured 24h ceiling
              </span>
            </div>

            {/* Tile B: Mint/Sage (Spent Today) */}
            <div className="rounded-2xl p-4 border transition-all flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-emerald-50/40 via-emerald-50/70 to-emerald-100/50 dark:from-emerald-950/20 dark:via-emerald-950/30 dark:to-emerald-900/40 border-emerald-200/50 dark:border-emerald-800/40">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  SPENT TODAY
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${dailyCapSpent}
                </span>
                <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↘ 5% of Cap
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                1 active testnet trade
              </span>
            </div>

            {/* Tile C: Sky/Ice Blue (Remaining Safe Allowance) */}
            <div className="rounded-2xl p-4 border transition-all flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-sky-50/40 via-sky-50/70 to-sky-100/50 dark:from-sky-950/20 dark:via-sky-950/30 dark:to-sky-900/40 border-sky-200/50 dark:border-sky-800/40">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-sky-100/80 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  REMAINING ALLOWANCE
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  ${Math.max(0, dailyCapTotal - dailyCapSpent)}
                </span>
                <span className="bg-sky-100/80 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↗ Safe
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Unblocked spendable budget
              </span>
            </div>

            {/* Tile D: Warm Peach/Amber (Velocity Throttle) */}
            <div className="rounded-2xl p-4 border transition-all flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-orange-50/40 via-orange-50/70 to-orange-100/50 dark:from-orange-950/20 dark:via-orange-950/30 dark:to-orange-900/40 border-orange-200/50 dark:border-orange-800/40">
              <div className="flex items-center gap-2 pb-2">
                <div className="w-6 h-6 rounded-md bg-orange-100/80 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 flex items-center justify-center">
                  <Gauge className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  SPEED THROTTLE
                </span>
              </div>
              <div className="flex items-baseline gap-2 pt-1">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {velocityUsed}/{velocityMax}
                </span>
                <span className="bg-orange-100/80 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-0.5">
                  ↘ Normal
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Calls in current 10m window
              </span>
            </div>
          </div>

          {/* Bottom Action Strip */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Assigned Agent Passkey:</span>
              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-obsidian-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <span>{agentId}</span>
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
              className="bg-slate-950 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-full px-5 py-2 text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer self-start sm:self-auto"
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
          className="bg-slate-950 hover:bg-slate-800 text-white rounded-full px-5 py-2.5 text-xs font-bold shrink-0 transition shadow-xs flex items-center gap-1.5 cursor-pointer"
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
        {/* Left Column (Col 7): Bento Well Container for Activity Ledger */}
        <div className="lg:col-span-7 bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="bg-white/95 dark:bg-obsidian-950/90 backdrop-blur-sm rounded-[22px] p-6 space-y-4">
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
        </div>

        {/* Right Column (Col 5): Bento Well for Policy Status & Panic Controls */}
        <div className="lg:col-span-5 bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="bg-[#121316] text-white rounded-[22px] p-6 space-y-6">
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
