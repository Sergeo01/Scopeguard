"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldAlert,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  ArrowRight,
  Terminal,
} from "lucide-react";
import { MarketingNavbar } from "@/components/MarketingNavbar";
import { tryGetPolicyContractId } from "@/lib/config";
import {
  ATTACKER_ADDRESS,
  POISONED_MESSAGE,
  ComparisonStepResult,
  BudgetInfo,
  computeComparisonSummary,
} from "@/lib/compare-scenario";

export default function ComparePage() {
  const [contractId, setContractId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ComparisonStepResult[]>([]);
  const [budget, setBudget] = useState<BudgetInfo | null>(null);

  // Stepper state: activeStepIndex is how many steps have executed (0 to 6)
  const [executedCount, setExecutedCount] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load contract ID and fetch scenario from /api/compare
  const loadScenario = useCallback(async () => {
    const id = tryGetPolicyContractId();
    setContractId(id);
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compare");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      setSteps(data.steps || []);
      setBudget(data.budget || null);
    } catch (err: any) {
      setError(err.message || "Failed to load comparison data from NEAR RPC");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenario();
  }, [loadScenario]);

  // Cleanup auto-play timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle Play all / Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setIsPlaying(false);
      return;
    }

    // If already at end, restart
    let current = executedCount >= steps.length ? 0 : executedCount;
    if (executedCount >= steps.length) {
      setExecutedCount(0);
    }

    setIsPlaying(true);

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intervalMs = prefersReduced ? 50 : 700;

    timerRef.current = setInterval(() => {
      current++;
      setExecutedCount(current);

      if (current >= steps.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setIsPlaying(false);
      }
    }, intervalMs);
  };

  const handleRunStep = (targetStepNumber: number) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsPlaying(false);
    }
    setExecutedCount(targetStepNumber);
  };

  const handleReset = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setIsPlaying(false);
    }
    setExecutedCount(0);
    setLiveAnnouncement("Scenario reset. Zero steps executed.");
  };

  // Announce state updates to screen readers
  useEffect(() => {
    if (executedCount === 0 || steps.length === 0) return;
    const currentStep = steps[executedCount - 1];
    if (currentStep) {
      setLiveAnnouncement(
        `Step ${currentStep.id}: ${currentStep.label}. ` +
          `Unprotected agent executed. ScopeGuard verdict: ${currentStep.verdict} ` +
          `${currentStep.reason ? `(${currentStep.reason})` : ""}.`
      );
    }
  }, [executedCount, steps]);

  // Derived starting values
  const startingTokens = budget?.vault_balance !== undefined ? Number(budget.vault_balance) : 100;
  const startingNear = budget?.near_vault_balance
    ? Math.round((Number(BigInt(budget.near_vault_balance) / BigInt(10 ** 22)) / 100) * 10) / 10
    : 2;

  // Running balance calculations for unprotected agent
  let currentUnprotectedTokens = startingTokens;
  let currentUnprotectedNear = startingNear;

  for (let i = 0; i < executedCount && i < steps.length; i++) {
    const s = steps[i];
    if (s.asset === "NEAR") {
      currentUnprotectedNear = Math.max(0, currentUnprotectedNear - s.amount);
    } else {
      currentUnprotectedTokens = Math.max(0, currentUnprotectedTokens - s.amount);
    }
  }

  // Running "moved" total for ScopeGuard agent (counts only ALLOWED steps)
  let currentScopeGuardMovedTokens = 0;
  let currentScopeGuardMovedNear = 0;

  for (let i = 0; i < executedCount && i < steps.length; i++) {
    const s = steps[i];
    if (s.verdict === "ALLOWED") {
      if (s.asset === "NEAR") {
        currentScopeGuardMovedNear += s.amount;
      } else {
        currentScopeGuardMovedTokens += s.amount;
      }
    }
  }

  const summary = computeComparisonSummary(steps, budget);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-obsidian-950 text-slate-900 dark:text-slate-100 transition-colors">
      <MarketingNavbar />

      {/* Screen Reader ARIA Live Region */}
      <div aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </div>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Header Breadcrumbs & Title */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition">
              Home
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-slate-200">Attack Comparison</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                Live Attack Comparison: Unprotected vs ScopeGuard
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
                Observe the exact same injected attack run against two agents side by side.
                The left column simulates an agent holding a standard full-access wallet key.
                The right column queries real verdicts live from the deployed NEAR policy contract
                using the read-only preflight view.
              </p>
            </div>

            {contractId && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 text-xs font-mono shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400">Policy:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{contractId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Unconfigured State Banner */}
        {!contractId && !loading && (
          <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-3">
            <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-400 font-semibold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Policy contract not configured</span>
            </div>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300/90 leading-relaxed">
              To query live verdicts from NEAR Protocol, configure `NEXT_PUBLIC_POLICY_CONTRACT_ID`
              in `web/.env.local` or deploy a guard instance from the deployment guide.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <Link
                href="/docs"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition"
              >
                <span>Deployment Guide</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* RPC Error Banner */}
        {error && (
          <div className="p-6 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 space-y-3">
            <div className="flex items-center gap-2.5 text-red-800 dark:text-red-400 font-semibold">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>NEAR RPC Connection Error</span>
            </div>
            <p className="text-xs sm:text-sm text-red-700 dark:text-red-300/90 font-mono">
              {error}
            </p>
            <button
              type="button"
              onClick={loadScenario}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry RPC Connection</span>
            </button>
          </div>
        )}

        {/* Poisoned Message Context Box */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 space-y-3 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              <Terminal className="w-4 h-4" />
              <span>Injected Attack Vector (Prompt Injection)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Attacker Target: {ATTACKER_ADDRESS}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-850 font-mono text-xs text-slate-800 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-all">
            {POISONED_MESSAGE}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            The agent is scripted (not an LLM) and follows every instruction in the prompt.
            The difference in security comes strictly from the key scope and onchain policy guardrails.
          </p>
        </div>

        {/* Playback Controls & Progress Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={loading || steps.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>{executedCount >= steps.length ? "Replay All" : "Play All"}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={loading || executedCount === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-800 dark:hover:bg-obsidian-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Steps Executed: <strong className="text-slate-900 dark:text-white">{executedCount}</strong> / {steps.length}
            </span>
            <div className="w-32 sm:w-48 h-2 rounded-full bg-slate-100 dark:bg-obsidian-950 overflow-hidden border border-slate-200 dark:border-obsidian-800">
              <div
                className="h-full bg-brand-blue transition-all duration-300"
                style={{
                  width: steps.length > 0 ? `${(executedCount / steps.length) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary Banner after Step 6 */}
        {executedCount >= 6 && (
          <div
            role="status"
            className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-blue/10 to-purple-500/10 border border-emerald-500/30 text-slate-900 dark:text-white space-y-2"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Shield className="w-4 h-4" />
              <span>Scenario Complete</span>
            </div>
            <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {summary.bannerText}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              All numbers are derived dynamically from live budget checks and scenario results.
            </p>
          </div>
        )}

        {/* Two-Column Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" aria-live="polite">
          {/* ========================================================= */}
          {/* LEFT COLUMN: UNPROTECTED AGENT (SIMULATED) */}
          {/* ========================================================= */}
          <section className="rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 p-5 sm:p-6 space-y-5">
            <header className="space-y-2 pb-4 border-b border-slate-200 dark:border-obsidian-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  Standard Full-Access Key
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                  Simulated Exposure
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                Unprotected agent (simulated: a standard wallet key has no spending limits)
              </h2>
              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Running Wallet Balance:</span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                  {currentUnprotectedTokens} mUSD · {currentUnprotectedNear} NEAR
                </span>
              </div>
            </header>

            {/* Steps List */}
            <div className="space-y-3">
              {steps.map((step, idx) => {
                const isExecuted = idx < executedCount;
                return (
                  <div
                    key={`unprotected-${step.id}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isExecuted
                        ? step.isAttack
                          ? "bg-rose-50/50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/40"
                          : "bg-slate-50 dark:bg-obsidian-950 border-slate-200 dark:border-obsidian-800"
                        : "bg-slate-50/40 dark:bg-obsidian-950/40 border-slate-200/50 dark:border-obsidian-850/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                            Step {step.id}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {step.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          {isExecuted
                            ? step.unprotectedDescription
                            : `Awaiting execution: ${step.amount} ${step.asset}`}
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isExecuted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-600 text-white">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>EXECUTED</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRunStep(step.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-200 hover:bg-slate-300 dark:bg-obsidian-800 dark:hover:bg-obsidian-700 text-slate-700 dark:text-slate-300 transition"
                          >
                            Run
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ========================================================= */}
          {/* RIGHT COLUMN: SCOPEGUARD AGENT (LIVE PREFLIGHT) */}
          {/* ========================================================= */}
          <section className="rounded-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 p-5 sm:p-6 space-y-5">
            <header className="space-y-2 pb-4 border-b border-slate-200 dark:border-obsidian-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  FunctionCall Access Key
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                  Live Preflight Verdicts
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-950 dark:text-white">
                ScopeGuard agent (live verdicts from {contractId || "guard contract"} via the read-only preflight view)
              </h2>
              <div className="flex items-center justify-between pt-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Running Allowed Movement:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {currentScopeGuardMovedTokens} mUSD · {currentScopeGuardMovedNear} NEAR (rolling cap: {summary.rollingCapText})
                </span>
              </div>
            </header>

            {/* Steps List */}
            <div className="space-y-3">
              {steps.map((step, idx) => {
                const isExecuted = idx < executedCount;
                const isAllowed = step.verdict === "ALLOWED";

                return (
                  <div
                    key={`scopeguard-${step.id}`}
                    className={`p-4 rounded-xl border transition-all ${
                      isExecuted
                        ? isAllowed
                          ? "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/40"
                          : "bg-slate-50 dark:bg-obsidian-950 border-slate-200 dark:border-obsidian-800"
                        : "bg-slate-50/40 dark:bg-obsidian-950/40 border-slate-200/50 dark:border-obsidian-850/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                            Step {step.id}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {step.label}
                          </span>
                        </div>

                        {isExecuted ? (
                          <div className="space-y-1 pt-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {step.reason && (
                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 font-semibold">
                                  {step.reason}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {step.explanation}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            Pending verification: {step.amount} {step.asset}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isExecuted ? (
                          isAllowed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-600 text-white">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ALLOWED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-800 text-slate-100 dark:bg-obsidian-800 dark:text-slate-200 border border-slate-700 dark:border-obsidian-700">
                              <Shield className="w-3.5 h-3.5 text-rose-500" />
                              <span>REJECTED</span>
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRunStep(step.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-200 hover:bg-slate-300 dark:bg-obsidian-800 dark:hover:bg-obsidian-700 text-slate-700 dark:text-slate-300 transition"
                          >
                            Run
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
