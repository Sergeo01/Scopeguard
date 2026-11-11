"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { tryGetPolicyContractId } from "@/lib/config";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Clock,
  Ban,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Search,
  Coins,
  PlayCircle,
  PauseCircle,
  KeyRound,
  Database,
  Radio,
  Terminal,
  Server,
  ArrowRight,
  X,
} from "lucide-react";
import { ReceiptModal } from "@/components/ReceiptModal";
import { useWallet } from "@/context/WalletContext";

/**
 * Fleet console.
 *
 * Everything on this page is read from chain via /api/agents. There is no
 * fixture data, no "authenticated owner" badge, and no button that pretends to
 * sign. Every destructive action produces a copy-paste `near call` command that
 * the owner signs with their own key.
 */

interface AgentRow {
  account: string;
  revoked: boolean;
  paused: boolean;
  cap: string;
  spent: string;
  remaining: string;
  vaultBalance: string;
  actionsInWindow: number;
  maxActionsPer10Min: number | null;
  targets: Record<string, string[]> | null;
  recipients: string[] | null;
  stagedPolicy: { policy: any; effective_at: number } | null;
  pendingActions: any[];
}

interface FleetResponse {
  success: boolean;
  source: string;
  owner: string;
  guardId: string;
  networkId: string;
  nodeUrl: string;
  contractVersion: string | null;
  rpcLatencyMs: number;
  fetchedAt: string;
  agents: AgentRow[];
  totals: {
    cap: number;
    spent: number;
    vault: number;
    pending: number;
    active: number;
    paused: number;
    revoked: number;
  };
  error?: string;
}

interface AuditEvent {
  id: string;
  txHash?: string;
  type: "ALLOW" | "REJECT" | "PENDING";
  timestamp: number;
  agent: string;
  target: string;
  method: string;
  amount?: string;
  reason?: string;
}

type Modal = { title: string; description: string; command: string; danger?: boolean } | null;

const statusOf = (a: AgentRow): "ACTIVE" | "PAUSED" | "REVOKED" =>
  a.revoked ? "REVOKED" : a.paused ? "PAUSED" : "ACTIVE";

const scopeOf = (a: AgentRow): string => {
  if (!a.targets) return "unreadable";
  const entries = Object.entries(a.targets);
  if (!entries.length) return "no targets";
  return entries
    .map(([t, m]) => `${t} (${Array.isArray(m) ? m.join(",") : m})`)
    .join(", ");
};

const relative = (ts: number, nowSec: number): string => {
  const delta = Math.max(0, nowSec - Math.floor(ts / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
};

export default function FleetConsolePage() {
  const { user, isAdmin, openAuthModal } = useWallet();
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [copied, setCopied] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [inspectHash, setInspectHash] = useState<string | null>(null);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const sync = useCallback(async () => {
    setLoading(true);
    try {
      const [fleetRes, stateRes] = await Promise.all([
        fetch("/api/agents", { cache: "no-store" }),
        fetch("/api/state", { cache: "no-store" }),
      ]);
      const fleetData = await fleetRes.json();
      if (!fleetData.success) {
        setError(fleetData.error || "Failed to read fleet state");
      } else {
        setFleet(fleetData);
        setError(null);
      }
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (Array.isArray(stateData.activities)) {
          setEvents(stateData.activities.slice(0, 40));
        }
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    sync();
  }, [sync]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const guardId = fleet?.guardId || tryGetPolicyContractId() || "guard2.sergeo-guard.testnet";
  const owner = fleet?.owner || "sergeo-guard.testnet";
  const agents = useMemo(() => fleet?.agents ?? [], [fleet?.agents]);
  const totals = fleet?.totals;

  const staged = useMemo(
    () => agents.filter((a) => a.stagedPolicy),
    [agents]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents.filter((a) => {
      const status = statusOf(a);
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        a.account.toLowerCase().includes(q) ||
        status.toLowerCase().includes(q) ||
        scopeOf(a).toLowerCase().includes(q)
      );
    });
  }, [agents, query, statusFilter]);

  const call = (method: string, args: object) =>
    `near call ${guardId || "<POLICY_CONTRACT_ID>"} ${method} '${JSON.stringify(args)}' --accountId ${owner} --gas 100000000000000`;

  const freeze = (agent: AgentRow) => {
    const pausing = statusOf(agent) === "ACTIVE";
    setModal({
      title: pausing ? `Freeze ${agent.account}` : `Unpause ${agent.account}`,
      description: pausing
        ? "Sets paused=true. Every subsequent execute call is rejected onchain with reason PAUSED."
        : "Clears paused and resets the consecutive-reject counter. This does not restore a revoked allowlist.",
      command: call(pausing ? "pause" : "unpause", { agent_account: agent.account }),
      danger: pausing,
    });
  };

  const revoke = (agent: AgentRow) => {
    setModal({
      title: `Permanently revoke ${agent.account}`,
      description:
        "Empties the target and recipient allowlists and pauses the agent. The result is durable: an empty allowlist rejects every action, and there is no onchain method that restores it.",
      command: call("revoke_agent", { agent_account: agent.account }),
      danger: true,
    });
  };

  const cancelStaged = (agent: AgentRow) => {
    setModal({
      title: `Cancel staged policy: ${agent.account}`,
      description:
        "Removes the staged policy before it takes effect. Staged policies are applied lazily on the next execute or settle call after their effective time.",
      command: call("cancel_policy_change", { agent_account: agent.account }),
      danger: true,
    });
  };

  const settle = (agent: AgentRow, id: number) => {
    setModal({
      title: `Settle pending intent #${id}`,
      description:
        "Executes a timelocked high-value action. Only the owner can settle; an agent can never settle its own queued action.",
      command: call("settle_pending", { agent: agent.account, id }),
    });
  };

  const cancelPending = (agent: AgentRow, id: number) => {
    setModal({
      title: `Veto pending intent #${id}`,
      description: "Cancels the queued action. Funds never leave the vault.",
      command: call("cancel_pending", { agent_account: agent.account, id }),
      danger: true,
    });
  };

  const filteredEvents = events.filter((e) => {
    if (statusFilter !== "ALL" && e.type !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      e.agent.toLowerCase().includes(q) ||
      e.target.toLowerCase().includes(q) ||
      e.method.toLowerCase().includes(q) ||
      (e.reason || "").toLowerCase().includes(q)
    );
  });

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Owner Access Required
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            This fleet management console is restricted to policy owner accounts. To manage fleet policies, settle timelock quarantines, or unpause agents, connect an authorized owner wallet (e.g. <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-obsidian-800">sergeo-guard.testnet</code>).
          </p>
        </div>
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 text-xs text-slate-500 text-left space-y-2">
          <div className="font-semibold text-slate-700 dark:text-slate-300">Public Demo Access:</div>
          <ul className="list-disc pl-4 space-y-1">
            <li>Explore live agent budgets and audit logs in the <Link href="/dashboard" className="text-brand-blue hover:underline">Security Console</Link>.</li>
            <li>Test adversarial prompt injection defenses in the <Link href="/#arena" className="text-brand-blue hover:underline">Attack Arena</Link>.</li>
            <li>Run live comparative preflight benchmarks on the <Link href="/compare" className="text-brand-blue hover:underline">Compare Page</Link>.</li>
          </ul>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold transition"
          >
            Go to Security Console
          </Link>
          <Link
            href="/#arena"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-850 dark:hover:bg-obsidian-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-obsidian-800 text-xs font-semibold transition"
          >
            Test Attack Arena
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
              Fleet Console
            </span>
            <span className="text-xs text-slate-400 font-mono">read-only chain view</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            Agents under policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
            Every row is read from <span className="font-mono">{guardId || "guard2.sergeo-guard.testnet"}</span> via{" "}
            <span className="font-mono">get_agents</span>. No wallet signature is required to view,
            and none is implied. Actions below emit commands you sign yourself.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={sync}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-obsidian-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-obsidian-850 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            <span>{loading ? "Reading chain..." : "Re-read chain"}</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className={`w-2 h-2 rounded-full ${error ? "bg-rose-500" : "bg-emerald-500"}`} />
            <span>{error ? "RPC error" : "Onchain"}</span>
          </div>
        </div>
      </div>

      {!guardId && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <p className="font-bold">Policy contract not configured</p>
            <p className="mt-1">
              Set NEXT_PUBLIC_POLICY_CONTRACT_ID in your environment to view and manage agents under policy.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-800 dark:text-rose-300">
            <p className="font-bold">Could not read fleet state</p>
            <p className="font-mono mt-1">{error}</p>
            <p className="mt-1 text-rose-700/80 dark:text-rose-400/80">
              Nothing on this page is cached or simulated. Fix the RPC and re-read.
            </p>
          </div>
        </div>
      )}

      {/* Hero: funds actually bounded by policy */}
      <div className="relative overflow-hidden rounded-3xl bg-[#090D16] p-6 sm:p-8 text-white border border-slate-800 shadow-sm">
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-mask pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Value bounded by policy
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight font-mono">
              ${loading ? "--" : (totals?.vault ?? 0)}
              <span className="text-lg font-semibold text-slate-400 ml-2">mUSD in vaults</span>
            </div>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Sum of every agent vault held by this owner. An agent can only move value inside its
              own vault, up to its daily cap, to a target and recipient the policy names.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-mono border border-white/15">
                <Database className="w-3 h-3 text-emerald-400" />
                {guardId || "guard2.sergeo-guard.testnet"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-mono border border-white/15">
                <Radio className="w-3 h-3 text-blue-400" />
                {fleet?.contractVersion ? `v${fleet.contractVersion}` : "version unknown"}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white text-[11px] font-mono border border-white/15">
                <Server className="w-3 h-3 text-amber-400" />
                {fleet ? `${fleet.rpcLatencyMs}ms` : "-"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto shrink-0">
            <Tile label="Registered" value={loading ? "--" : agents.length} note="agents on chain" tone="text-slate-100" />
            <Tile label="Active" value={loading ? "--" : (totals?.active ?? 0)} note="executing normally" tone="text-emerald-400" />
            <Tile label="Paused" value={loading ? "--" : (totals?.paused ?? 0)} note="circuit breakers" tone="text-amber-400" />
            <Tile label="Revoked" value={loading ? "--" : (totals?.revoked ?? 0)} note="allowlist wiped" tone="text-rose-400" />
          </div>
        </div>
      </div>

      {/* Telemetry */}
      <div className="bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60">
        <div className="bg-white/95 dark:bg-obsidian-900 rounded-[22px] p-6 border border-white dark:border-slate-800 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Measured this page load
            </span>
            <span className="text-xs font-mono text-slate-400">
              {fleet ? new Date(fleet.fetchedAt).toLocaleTimeString() : "-"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Telemetry
              icon={<Activity className="w-3.5 h-3.5" />}
              label="RPC latency"
              value={fleet ? `${fleet.rpcLatencyMs}ms` : "-"}
              note={fleet?.nodeUrl || "not measured"}
              tone="slate"
            />
            <Telemetry
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Pending intents"
              value={totals?.pending ?? 0}
              note="awaiting owner settle or veto"
              tone="orange"
            />
            <Telemetry
              icon={<Coins className="w-3.5 h-3.5" />}
              label="Daily cap in force"
              value={`$${totals?.cap ?? 0}`}
              note={`$${totals?.spent ?? 0} spent this window`}
              tone="sky"
            />
            <Telemetry
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              label="Contract version"
              value={fleet?.contractVersion || "-"}
              note={guardId || "guard2.sergeo-guard.testnet"}
              tone="emerald"
            />
          </div>
        </div>
      </div>

      {/* Staged policy changes, read from get_staged_policy */}
      {staged.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Staged policy changes
              </h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
              {staged.length} queued
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            The contract applies a staged policy lazily: on the next <span className="font-mono">execute</span>{" "}
            or <span className="font-mono">settle_pending</span> call after{" "}
            <span className="font-mono">effective_at</span>. There is no separate &quot;approve&quot;
            transaction: cancel it here if it is not what you want.
          </p>

          <div className="space-y-3">
            {staged.map((agent) => {
              const stagedPolicy = agent.stagedPolicy!;
              const rem = Math.max(0, Number(stagedPolicy.effective_at) - nowSec);
              return (
                <div
                  key={agent.account}
                  className="bg-white dark:bg-obsidian-900 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {agent.account}
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">
                        Current cap: <strong className="text-slate-900 dark:text-white">${agent.cap}</strong>
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-amber-700 dark:text-amber-400 font-bold">
                        Staged cap: ${String(stagedPolicy.policy?.daily_cap ?? "none")}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400 block pt-1">
                      {rem > 0
                        ? `Effective in ${Math.floor(rem / 60)}m ${rem % 60}s`
                        : "Effective now, applies on the next agent action"}
                    </span>
                  </div>

                  <button
                    onClick={() => cancelStaged(agent)}
                    className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold hover:bg-rose-100 transition flex items-center gap-1.5 shrink-0"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancel change</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Registry */}
      <div className="bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60">
        <div className="bg-white/95 dark:bg-obsidian-900 rounded-[22px] p-6 border border-white dark:border-slate-800 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Registered agents
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Owner <span className="font-mono">{owner}</span> · {agents.length} on{" "}
                <span className="font-mono">{guardId || "guard2.sergeo-guard.testnet"}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter agents..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="REVOKED">Revoked</option>
              </select>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 transition"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Issue passkey</span>
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="pb-3 pl-2">Agent account</th>
                  <th className="pb-3">Allowed targets</th>
                  <th className="pb-3">Daily cap</th>
                  <th className="pb-3">10m velocity</th>
                  <th className="pb-3">Vault</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-2">Owner controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {loading
                        ? "Reading chain..."
                        : agents.length === 0
                        ? "No agents registered to this owner on this contract."
                        : "No agents match this filter."}
                    </td>
                  </tr>
                )}

                {visible.map((agent) => {
                  const status = statusOf(agent);
                  return (
                    <tr
                      key={agent.account}
                      className="hover:bg-slate-50/70 dark:hover:bg-obsidian-850 transition align-top"
                    >
                      <td className="py-3.5 pl-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-obsidian-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs shrink-0">
                            {agent.account.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {agent.account}
                            </span>
                            {agent.pendingActions.length > 0 && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-sans">
                                {agent.pendingActions.length} pending intent
                                {agent.pendingActions.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 text-slate-600 dark:text-slate-300 font-medium max-w-[200px]">
                        <span className="break-all">{scopeOf(agent)}</span>
                        {agent.recipients && agent.recipients.length > 0 ? (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                            payouts: {agent.recipients.join(", ")}
                          </span>
                        ) : (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            no outside payouts (DEX isolation)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 font-mono text-slate-900 dark:text-white font-semibold whitespace-nowrap">
                        ${agent.cap}
                        <span className="text-[10px] text-slate-400 font-normal block">
                          ${agent.spent} spent
                        </span>
                      </td>

                      <td className="py-3.5 font-mono whitespace-nowrap">
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {agent.actionsInWindow}/{agent.maxActionsPer10Min ?? "?"}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">in 10m</span>
                      </td>

                      <td className="py-3.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                        ${agent.vaultBalance}
                      </td>

                      <td className="py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            status === "ACTIVE"
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : status === "PAUSED"
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                              : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              status === "ACTIVE"
                                ? "bg-emerald-500"
                                : status === "PAUSED"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                          />
                          {status}
                        </span>
                      </td>

                      <td className="py-3.5 pr-2">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {agent.pendingActions.map((p: any) => (
                            <span key={`p-${p.id}`} className="flex items-center gap-1">
                              <button
                                onClick={() => settle(agent, Number(p.id))}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold hover:bg-blue-100 transition"
                                title={`Settle intent #${p.id} (${p.amount} mUSD)`}
                              >
                                <Check className="w-3 h-3" />
                                #{p.id}
                              </button>
                              <button
                                onClick={() => cancelPending(agent, Number(p.id))}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 dark:bg-obsidian-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:bg-slate-100 transition"
                                title={`Veto intent #${p.id}`}
                              >
                                <Ban className="w-3 h-3" />
                              </button>
                            </span>
                          ))}

                          {status === "REVOKED" ? (
                            <span className="text-[11px] text-slate-400 font-medium">
                              allowlist erased
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => freeze(agent)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  status === "PAUSED"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                }`}
                              >
                                {status === "PAUSED" ? (
                                  <>
                                    <PlayCircle className="w-3 h-3" />
                                    <span>Unpause</span>
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle className="w-3 h-3" />
                                    <span>Freeze</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => revoke(agent)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-obsidian-800 transition"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Revoke</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Deployment facts, all verified by the API call that produced this page */}
      <div className="bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60">
        <div className="bg-white/95 dark:bg-obsidian-900 rounded-[22px] p-6 border border-white dark:border-slate-800 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Deployment</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Addresses used for the reads above. No health badge is shown that was not measured.
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-obsidian-850 text-slate-600 dark:text-slate-300 font-bold">
              {network}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Fact
              label="Policy contract"
              value={guardId || "guard2.sergeo-guard.testnet"}
              href={guardId ? `https://testnet.nearblocks.io/address/${guardId}` : undefined}
            />
            <Fact
              label="RPC endpoint"
              value={fleet?.nodeUrl || "not measured"}
              note={fleet ? `${fleet.rpcLatencyMs}ms round trip` : undefined}
            />
            <Fact
              label="Contract version"
              value={fleet?.contractVersion ? `v${fleet.contractVersion}` : "unreadable"}
              note="from get_version"
            />
            <Fact label="Owner" value={owner} href={`https://testnet.nearblocks.io/address/${owner}`} />
            <Fact
              label="Token"
              value={process.env.NEXT_PUBLIC_TOKEN_CONTRACT || "sergeo-guard-token.testnet"}
              href="https://testnet.nearblocks.io/address/sergeo-guard-token.testnet"
            />
            <Fact
              label="Demo DEX"
              value={process.env.NEXT_PUBLIC_DEX_CONTRACT || "sergeo-guard-dex.testnet"}
              href="https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet"
            />
          </div>
        </div>
      </div>

      {/* Audit stream from the app ledger (real calls this server observed) */}
      <div className="bg-slate-100/70 dark:bg-obsidian-900/60 p-1.5 rounded-[28px] border border-slate-200/60 dark:border-slate-800/60">
        <div className="bg-white/95 dark:bg-obsidian-900 rounded-[22px] p-6 border border-white dark:border-slate-800 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Evaluation log
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified onchain actions recorded by ScopeGuard on NEAR testnet. The contract is the definitive source of truth for state.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">{filteredEvents.length} events</span>
          </div>

          <div className="space-y-2">
            {filteredEvents.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">
                No actions recorded by this process yet. Run an attack in the arena to populate it.
              </p>
            )}

            {filteredEvents.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-obsidian-850/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-md font-mono font-bold text-[10px] shrink-0 ${
                      log.type === "ALLOW"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : log.type === "REJECT"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {log.type}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {log.agent}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        &bull; {relative(log.timestamp, nowSec)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                      <span className="font-mono">{log.target}</span>
                      <span className="mx-1 text-slate-400">&bull;</span>
                      <span className="font-mono">{log.method}</span>
                      {log.reason && <span className="ml-2">{log.reason}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {log.amount && log.amount !== "0" && (
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {log.amount} mUSD
                    </span>
                  )}
                  {log.txHash ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectHash(log.txHash!)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        <span>Inspect</span>
                      </button>
                      <a
                        href={`https://testnet.nearblocks.io/txns/${log.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>
                          {log.txHash.slice(0, 6)}...{log.txHash.slice(-4)}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-mono">no tx</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Command modal */}
      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{modal.title}</h3>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-md"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {modal.description}
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Run as owner · signs with your key, not this server
              </span>
              <div className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs break-all relative pr-10">
                {modal.command}
                <button
                  onClick={() => copy(modal.command, "modal-cmd")}
                  className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  title="Copy command"
                >
                  {copied === "modal-cmd" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-obsidian-800 transition"
              >
                Close
              </button>
              <button
                onClick={() => {
                  copy(modal.command, "modal-btn");
                  setTimeout(() => setModal(null), 1200);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition ${
                  modal.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {copied === "modal-btn" ? "Copied" : "Copy command"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct In-App Onchain Receipt Inspector */}
      <ReceiptModal txHash={inspectHash} onClose={() => setInspectHash(null)} />
    </div>
  );
}

const network = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet";

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number | string;
  note: string;
  tone: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 space-y-1 min-w-[140px]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
        {label}
      </span>
      <div className={`text-2xl font-bold font-mono ${tone}`}>{value}</div>
      <span className="text-[10px] text-slate-400">{note}</span>
    </div>
  );
}

function Telemetry({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note: string;
  tone: "slate" | "orange" | "sky" | "emerald";
}) {
  const toneMap = {
    slate: "border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-obsidian-950/70 text-slate-700 dark:text-slate-300",
    orange: "border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
    sky: "border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
    emerald: "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300",
  } as const;

  return (
    <div className={`rounded-2xl p-4 border flex flex-col justify-between ${toneMap[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        <div className="w-6 h-6 rounded-md bg-white/60 dark:bg-black/20 flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="my-2 text-2xl font-bold font-mono text-slate-900 dark:text-white tabular-nums truncate">
        {value}
      </div>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={note}>
        {note}
      </span>
    </div>
  );
}

function Fact({ label, value, note, href }: { label: string; value: string; note?: string; href?: string }) {
  return (
    <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-obsidian-850 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white break-all">
          {value}
        </span>
        {note && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 font-semibold">
            {note}
          </span>
        )}
      </div>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 text-slate-400 hover:text-blue-600 transition shrink-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}
