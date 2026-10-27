"use client";

import React, { useState, useEffect } from "react";
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
  Send,
  CheckCircle2,
} from "lucide-react";
import { CircuitBreakerBanner, RejectionEvent } from "@/components/CircuitBreakerBanner";
import { StagedPolicyBanner, StagedPolicyItem } from "@/components/StagedPolicyBanner";

interface ActivityItem {
  id: string;
  txHash?: string;
  type: "ALLOW" | "REJECT" | "AUTO_PAUSE" | "SETTLED" | "CANCELLED" | "PAUSE" | "UNPAUSE";
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

  // Non-custodial Owner Command Modal state
  const [activeOwnerModal, setActiveOwnerModal] = useState<{
    title: string;
    description: string;
    command: string;
  } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: "act-unpause",
      txHash: "HdzkcCXpH8DGDnhawAz6rz1V3wKA9EfjxLeHFiRh7G3t",
      type: "UNPAUSE",
      timestamp: Date.now() - 1000 * 60 * 2,
      agent: "trader.sergeo-guard.testnet",
      reason: "Agent resumed by owner from Panic Panel",
    },
    {
      id: "act-breaker",
      txHash: "EBhNhhTT7qZhfmRWdfNJmmgt6fVdgDr2b17Bdcf6s7mi",
      type: "AUTO_PAUSE",
      timestamp: Date.now() - 1000 * 60 * 4,
      agent: "trader.sergeo-guard.testnet",
      reason: "Emergency Brake: 3 consecutive declines in 10 minutes",
    },
    {
      id: "act-target-rej",
      txHash: "EBhNhhTT7qZhfmRWdfNJmmgt6fVdgDr2b17Bdcf6s7mi",
      type: "REJECT",
      timestamp: Date.now() - 1000 * 60 * 4,
      agent: "trader.sergeo-guard.testnet",
      target: "exploit_vault.testnet",
      method: "drain_funds",
      reason: "Contract exploit_vault.testnet is not on allowlist",
    },
    {
      id: "act-settle",
      txHash: "66SgUA2YdxPSV2NcHa36rijSAERP1MW8FxLvfQEKbB6c",
      type: "SETTLED",
      timestamp: Date.now() - 1000 * 60 * 8,
      agent: "trader.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "300",
    },
    {
      id: "act-cancel",
      txHash: "GMbGFNaDUcGHPV22o2zrEFWhxvAHEFKzPffSWTJn1HAX",
      type: "CANCELLED",
      timestamp: Date.now() - 1000 * 60 * 12,
      agent: "trader.sergeo-guard.testnet",
      reason: "Large purchase #2 vetoed and cancelled by owner",
    },
    {
      id: "act-allow-swap",
      txHash: "4nzowHFaXCqwPfBwh7yyaHdtVTsM8Ng4j4WbfTmL5CGf",
      type: "ALLOW",
      timestamp: Date.now() - 1000 * 60 * 15,
      agent: "trader.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "50",
    },
  ]);

  const loadOnchainState = async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/state");
      const data = await resp.json();
      if (data.success) {
        if (data.agentId) setAgentId(data.agentId);
        if (data.guardId) setGuardId(data.guardId);
        if (data.budget) {
          setIsPaused(data.budget.paused);
          setDailyCapTotal(Number(data.budget.cap) || 500);
          setDailyCapSpent(Number(data.budget.spent) || 0);
          setVaultBalance(data.budget.vault_balance || "100");
          setVelocityUsed(data.budget.actions_in_window || 0);
        }
        if (data.pendingActions && data.pendingActions.length > 0) {
          setPendingActions(data.pendingActions);
        }
        if (data.stagedPolicy) setStagedPolicy(data.stagedPolicy);
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
      title: "Emergency Pause",
      description: "Freezes all agent transactions on NEAR Testnet immediately. The Guard contract will refuse all calls until unpaused.",
      command: `near call ${guardId} pause '{"agent_account":"${agentId}"}' --accountId sergeo-guard.testnet`,
    });
  };

  const handleUnpause = async () => {
    setActiveOwnerModal({
      title: "Unpause Agent",
      description: "Resumes normal agent execution and clears consecutive reject counters.",
      command: `near call ${guardId} unpause '{"agent_account":"${agentId}"}' --accountId sergeo-guard.testnet`,
    });
  };

  const handleRevokeKey = async () => {
    setActiveOwnerModal({
      title: "Permanently Revoke Passkey",
      description: "Deletes the restricted function-call passkey directly on NEAR consensus. The credential on the agent machine becomes completely dead.",
      command: `near delete-key ${agentId} <AGENT_PUBLIC_KEY> --accountId ${agentId}`,
    });
  };

  const handleWithdrawVault = async () => {
    setActiveOwnerModal({
      title: "Emergency Vault Withdrawal",
      description: "Transfers all custodied NEP-141 tokens from the Guard vault back to the owner wallet.",
      command: `near call ${guardId} withdraw '{"agent_account":"${agentId}","amount":"${vaultBalance}"}' --accountId sergeo-guard.testnet`,
    });
  };

  const handleCancelPending = async (id: number) => {
    setActiveOwnerModal({
      title: `Veto Pending Intent #${id}`,
      description: "Cancels quarantined high-value action before the timelock delay expires.",
      command: `near call ${guardId} cancel_pending '{"agent_account":"${agentId}","id":${id}}' --accountId sergeo-guard.testnet`,
    });
  };

  const handleSimulatePending = () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const newPending: PendingActionItem = {
      id: Math.floor(Math.random() * 900) + 100,
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "300",
      recipient: "sergeo-guard.testnet",
      executable_at: nowSec + 60,
      secondsRemaining: 60,
    };
    setPendingActions((prev) => [newPending, ...prev]);
  };

  const handleCancelPolicyChange = async () => {
    setStagedPolicy(null);
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
  const spentPercent = Math.min(100, Math.round((dailyCapSpent / (dailyCapTotal || 1)) * 100));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Trader Agent Treasury Console
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
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
              <Send className="w-3 h-3 text-blue-600" />
              <span>Telegram: @sergeo</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Account: <span className="font-mono text-slate-800 font-medium">{agentId}</span> · Enforcer:{" "}
            <span className="font-mono text-slate-800 font-medium">{guardId}</span> · Verifiable Receipts:{" "}
            <span className="text-emerald-700 font-medium">100% Free RPC Verification</span>
          </p>
        </div>

        <button
          type="button"
          onClick={loadOnchainState}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition shadow-sm self-start sm:self-auto focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
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

      {/* Staged Policy & Circuit Breaker Notifications */}
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

      {/* Integrated Spending & Fuel Metric Strip */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-3 shadow-sm">
        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Daily Spend Allowance</span>
            <span className="font-mono font-bold text-slate-900">${remainingDaily}.00 Left</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: `${spentPercent}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>${dailyCapSpent} spent of ${dailyCapTotal} cap</span>
            <span>{spentPercent}%</span>
          </div>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Network Gas Fuel</span>
            <span className="font-mono font-bold text-slate-900">0.22 NEAR</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: "88%" }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>0.22 of 0.25 NEAR allowance</span>
            <span>Protocol Gas Only</span>
          </div>
        </div>

        <div className="p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Speed Throttle</span>
            <span className="font-mono font-bold text-slate-900">{velocityUsed} / {velocityMax} calls</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 rounded-full transition-all duration-300" style={{ width: "20%" }} />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 font-mono">
            <span>Anti-spam 10m window</span>
            <span>Auto-brake on 3 rejects</span>
          </div>
        </div>
      </div>

      {/* High-Value Work Queue (Ramp-style) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">High-Value Approval Queue</h2>
            <p className="text-xs text-slate-500">Transactions of $250 or more wait 60 seconds for owner veto</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono font-medium">{pendingActions.length} Pending</span>
            {pendingActions.length === 0 && (
              <button
                type="button"
                onClick={handleSimulatePending}
                className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
              >
                + Test Timelock Action ($300)
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">
                      {item.target}::{item.method}()
                    </span>
                    <span className="font-mono font-bold text-amber-900">${item.amount}.00 mUSD</span>
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
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition shadow-sm focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none self-start sm:self-auto"
                >
                  Veto & Cancel Onchain
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Owner Kill Switches */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Emergency Owner Switches</h2>
            <p className="text-xs text-slate-500">Onchain controls that can never be blocked or overridden by the agent</p>
          </div>
          <span className="text-xs font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            Master Authority
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 block">
                {isPaused ? "Resume Key" : "Pause Key"}
              </span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isPaused
                  ? "Key is currently frozen. Unpause to resume purchases."
                  : "Soft freeze: stops all transactions without deleting the key."}
              </p>
            </div>
            <button
              type="button"
              onClick={isPaused ? handleUnpause : handlePause}
              className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none ${
                isPaused
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-amber-100 text-amber-950 hover:bg-amber-200 border border-amber-300"
              }`}
            >
              {isPaused ? "Unpause Key" : "Pause Key"}
            </button>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 block">Evacuate Vault</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Sweeps all remaining ${vaultBalance}.00 mUSD directly to the owner wallet.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWithdrawVault}
              className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
            >
              Sweep Remaining Funds
            </button>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <span className="font-bold text-xs text-slate-900 block">Permanently Revoke Key</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Deletes the agent key from NEAR consensus. The credential becomes dead.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRevokeKey}
              className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-sm focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:outline-none"
            >
              Revoke Access Key
            </button>
          </div>
        </div>
      </div>

      {/* Master Transaction Ledger */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
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

            <div className="flex items-center gap-1 text-xs bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setLedgerFilter("all")}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  ledgerFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                All ({activities.length})
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("approved")}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  ledgerFilter === "approved" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                Approved
              </button>
              <button
                type="button"
                onClick={() => setLedgerFilter("declined")}
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                  ledgerFilter === "declined" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                }`}
              >
                Declined
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Call</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Policy Note</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
              {filteredActivities.map((item) => {
                const isApproved = item.type === "ALLOW" || item.type === "SETTLED";
                const isDeclined = item.type === "REJECT" || item.type === "AUTO_PAUSE";

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
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
                    <td className="py-3 px-3 font-mono text-slate-900">
                      {item.target ? `${item.target}::${item.method}()` : item.agent}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-900">
                      {item.amount && item.amount !== "0" ? `$${item.amount}.00` : "-"}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {item.reason || "Policy verified onchain"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      {item.txHash ? (
                        <a
                          href={`https://testnet.nearblocks.io/txns/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeOwnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                {activeOwnerModal.title}
              </h3>
              <button
                onClick={() => { setActiveOwnerModal(null); setCopiedCmd(false); }}
                className="text-zinc-400 hover:text-zinc-200 text-sm"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {activeOwnerModal.description}
            </p>
            <div className="rounded-lg bg-zinc-950 p-3 border border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                <span>NEAR CLI Command (Non-Custodial)</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeOwnerModal.command);
                    setCopiedCmd(true);
                    setTimeout(() => setCopiedCmd(false), 2000);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  {copiedCmd ? "Copied!" : "Copy Command"}
                </button>
              </div>
              <code className="text-xs font-mono text-zinc-300 break-all select-all block bg-black/40 p-2 rounded border border-zinc-800/80">
                {activeOwnerModal.command}
              </code>
            </div>
            <div className="text-[11px] text-zinc-500 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/50">
              <strong>Non-Custodial Security:</strong> ScopeGuard servers never custody your master private keys. To execute this owner power, sign via NEAR CLI or your connected hardware wallet.
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  loadOnchainState();
                  setActiveOwnerModal(null);
                  setCopiedCmd(false);
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
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
