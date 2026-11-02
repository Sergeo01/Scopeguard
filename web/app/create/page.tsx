"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Lock,
  Building2,
  RefreshCw,
  Code2,
  Check,
  Plus,
  Trash2,
  Send,
  Bell,
  ExternalLink,
  Layers,
  Wand2,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { KeyPair } from "near-api-js";
import { AgentHandoffCard } from "../../components/AgentHandoffCard";
import { PlatformPresets, PresetPlatform } from "../../components/PlatformPresets";
import { CustomPlatformManager, ConfiguredPlatform } from "../../components/CustomPlatformManager";
import { useWallet } from "@/context/WalletContext";
import { validatePolicyShape, lintPolicy } from "@/lib/drafter";

interface TargetPlatform extends ConfiguredPlatform {}

export default function CreateAgentPage() {
  const { accountId: connectedWalletId, isConnected: isWalletConnected } = useWallet();
  const [agentName, setAgentName] = useState("agent.sergeo-guard.testnet");
  const [dailyCap, setDailyCap] = useState<number>(500);
  const [dailyCapInput, setDailyCapInput] = useState<string>("500");

  const [platforms, setPlatforms] = useState<TargetPlatform[]>([
    {
      id: "p1",
      contract: "sergeo-guard-dex.testnet",
      methods: "swap",
      label: "ScopeGuard Testnet DEX",
      isPreset: true,
    },
  ]);

  const [allowExternalTransfers, setAllowExternalTransfers] = useState(false);
  const [externalRecipient, setExternalRecipient] = useState("");
  const [speedLimit, setSpeedLimit] = useState<number>(5);
  const [autoPauseAfter, setAutoPauseAfter] = useState<number>(3);
  const [autoPauseWindowMinutes, setAutoPauseWindowMinutes] = useState<number>(10);
  const [timelockThreshold, setTimelockThreshold] = useState<number>(250);
  const [telegramChatId, setTelegramChatId] = useState<string>("@sergeo");

  const [activeView, setActiveView] = useState<"visual" | "json">("visual");
  const [isDeploying, setIsDeploying] = useState(false);
  const [issuedSuccess, setIssuedSuccess] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [generatedPasskey, setGeneratedPasskey] = useState<string>("");
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [explorerUrl, setExplorerUrl] = useState<string>("");
  const [registrationStatus, setRegistrationStatus] = useState<"idle" | "broadcasting" | "registered" | "manual">("idle");
  const [registrationCommand, setRegistrationCommand] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("issued") === "true") {
        setIssuedSuccess(true);
      }
    }
  }, []);

  const handleDailyCapChange = (val: string) => {
    setDailyCapInput(val);
    const parsed = Number(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setDailyCap(parsed);
      setTimelockThreshold(Math.max(1, Math.floor(parsed / 2)));
    }
  };

  const setPresetChip = (amount: number) => {
    setDailyCap(amount);
    setDailyCapInput(amount.toString());
    setTimelockThreshold(Math.max(1, Math.floor(amount / 2)));
  };

  const addCustomPlatform = (newPlatform: { contract: string; methods: string; label?: string }) => {
    setPlatforms((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        contract: newPlatform.contract,
        methods: newPlatform.methods,
        label: newPlatform.label,
        isPreset: false,
      },
    ]);
  };

  const removePlatform = (id: string) => {
    if (platforms.length <= 1) return;
    setPlatforms((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePlatformMethods = (id: string, methods: string) => {
    setPlatforms((prev) =>
      prev.map((p) => (p.id === id ? { ...p, methods } : p))
    );
  };

  const togglePresetPlatform = (preset: PresetPlatform) => {
    const exists = platforms.some((p) => p.contract === preset.contract);
    if (exists) {
      if (platforms.length > 1) {
        setPlatforms((prev) => prev.filter((p) => p.contract !== preset.contract));
      }
    } else {
      setPlatforms((prev) => [
        ...prev,
        {
          id: `preset-${Date.now()}`,
          contract: preset.contract,
          methods: preset.methods,
          label: preset.name,
          isPreset: true,
        },
      ]);
    }
  };

  const compiledTargets: Record<string, string[]> = {};
  platforms.forEach((p) => {
    if (p.contract.trim()) {
      const methods = p.methods
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);
      compiledTargets[p.contract.trim()] = methods.length > 0 ? methods : ["swap"];
    }
  });

  const compiledRecipients = allowExternalTransfers && externalRecipient.trim()
    ? [externalRecipient.trim()]
    : [];

  const compiledPolicyJson = {
    token: "sergeo-guard-token.testnet",
    targets: compiledTargets,
    daily_cap: Number(dailyCap),
    recipients: compiledRecipients,
    max_actions_per_10min: speedLimit,
    auto_pause_rejects: autoPauseAfter,
    auto_pause_window_minutes: autoPauseWindowMinutes,
    high_value_threshold: Number(timelockThreshold),
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 60,
  };

  const policyValidationErrors = validatePolicyShape(compiledPolicyJson);
  const policyLintWarnings = lintPolicy(compiledPolicyJson as any);
  const hasDangerPolicyLint = policyLintWarnings.some((w) => w.severity === "danger");
  const isPolicyValid = policyValidationErrors.length === 0 && !hasDangerPolicyLint;

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;
    setIsDrafting(true);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (data.success && data.draft?.policy) {
        const p = data.draft.policy;
        setDailyCap(Number(p.daily_cap) || 100);
        setDailyCapInput(p.daily_cap || "100");
        setSpeedLimit(p.max_actions_per_10min || 5);
        setAutoPauseAfter(p.auto_pause_rejects || 3);
        setAutoPauseWindowMinutes(p.auto_pause_window_minutes || 10);
        setTimelockThreshold(Number(p.high_value_threshold) || 50);

        if (p.targets && Object.keys(p.targets).length > 0) {
          const newPlatforms = Object.entries(p.targets).map(([contract, methods], idx) => ({
            id: `p-${Date.now()}-${idx}`,
            contract,
            methods: Array.isArray(methods) ? (methods as string[]).join(", ") : "swap",
            label: contract.includes("dex") ? "ScopeGuard Testnet DEX" : contract,
          }));
          setPlatforms(newPlatforms);
        }

        if (p.recipients && p.recipients.length > 0) {
          setAllowExternalTransfers(true);
          setExternalRecipient(p.recipients[0]);
        } else {
          setAllowExternalTransfers(false);
          setExternalRecipient("");
        }

        setDraftResult(data.draft);
      }
    } catch (err: any) {
      console.error("AI Drafter error:", err);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleIssueCard = async () => {
    setIsDeploying(true);
    setRegistrationStatus("broadcasting");
    try {
      const keyPair = KeyPair.fromRandom("ed25519");
      const pubKey = keyPair.getPublicKey().toString();
      const privKey = keyPair.toString();
      setGeneratedPasskey(privKey);
      setGeneratedPublicKey(pubKey);

      try {
        const regRes = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentAccountId: agentName,
            policy: compiledPolicyJson,
            publicKey: pubKey,
          }),
        });
        const regData = await regRes.json();
        if (regData.success && regData.txHash) {
          setTxHash(regData.txHash);
          setExplorerUrl(regData.explorerUrl);
          setRegistrationStatus("registered");
        } else if (regData.command) {
          setRegistrationCommand(regData.command);
          setRegistrationStatus("manual");
        }
      } catch (err: any) {
        console.warn("Auto registration broadcast failed:", err);
        setRegistrationStatus("manual");
      }

      setIsDeploying(false);
      setIssuedSuccess(true);
    } catch (e: any) {
      setIsDeploying(false);
      alert("Failed to generate passkey: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Passkey Studio Card (Clean Single-Layer Container) */}
      <div className="bg-white dark:bg-obsidian-900 rounded-2xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/80">
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
              POLICY & PASSKEY STUDIO
            </span>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Issue Agent Passkey
              </h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                FunctionCall Scope
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
              Create a restricted NEAR FunctionCall access key scoped strictly to Guard2. The agent machine never holds a master key, bounding its spend to rules you sign.
            </p>
          </div>

          {/* Clean Metric Widget */}
          <div className="bg-slate-50 dark:bg-obsidian-950/70 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 w-full sm:w-auto sm:min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                PROTOCOL INTEGRITY
              </span>
              <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
                Scoped Key
              </span>
              <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Validated
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block">
              Exclusive Guard receiver
            </span>
          </div>
        </div>

        {/* Clean Neutral 4-Column Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile A: Target Receiver */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                EXCLUSIVE TARGET
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono truncate" title="guard2.sergeo-guard.testnet">
                guard2...
              </span>
              <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Fixed
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Protocol locked receiver
            </span>
          </div>

          {/* Tile B: Single Entrypoint */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Code2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                ALLOWED METHOD
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                execute
              </span>
              <span className="bg-emerald-100/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                Single
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Only callable function
            </span>
          </div>

          {/* Tile C: Daily Cap */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                DAILY SPEND CAP
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                ${dailyCap} mUSD
              </span>
              <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />
                Custom
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Manual $1 to any budget
            </span>
          </div>

          {/* Tile D: 1-Tap Revoke */}
          <div className="rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950/60 flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-2">
              <div className="w-6 h-6 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                REVOCATION
              </span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                1-Tap
              </span>
              <span className="bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Instant
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Protocol level key deletion
            </span>
          </div>
        </div>

          {/* AI Scope Drafter Section */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  AI Scope Drafter (Optional)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                Type plain English: minimal policy generated with schema validation
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAiDraft();
                  }
                }}
                placeholder="e.g. Trade up to 250 mUSD per day on Ref Finance and Burrow, max 10 actions per 10 minutes"
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAiDraft}
                disabled={isDrafting || !aiPrompt.trim()}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
              >
                {isDrafting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Drafting Policy...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Draft with AI</span>
                  </>
                )}
              </button>
            </div>

            {draftResult?.plainEnglish && (
              <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider block">
                  AI Proposed Rule Card:
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
                  {draftResult.plainEnglish}
                </p>
              </div>
            )}
          </div>
        </div>

      {issuedSuccess ? (
        <AgentHandoffCard
          agentName={agentName}
          dailyCap={dailyCap}
          platformsCount={platforms.length}
          autoPauseAfter={autoPauseAfter}
          autoPauseWindowMinutes={autoPauseWindowMinutes}
          telegramChatId={telegramChatId}
          ownerAccount={connectedWalletId || process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet"}
          passkey={generatedPasskey}
          publicKey={generatedPublicKey}
          policyJson={compiledPolicyJson}
          onReset={() => setIssuedSuccess(false)}
          txHash={txHash}
          explorerUrl={explorerUrl}
          registrationStatus={registrationStatus}
          registrationCommand={registrationCommand}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Side (Col 7: Clean Single-Layer Card) */}
          <div className="lg:col-span-7 bg-white dark:bg-obsidian-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
              {/* Agent Sub-Account */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Agent Sub-Account
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. agent.sergeo-guard.testnet"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {isWalletConnected && connectedWalletId && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">Connected account prefix:</span>
                    <button
                      type="button"
                      onClick={() => setAgentName(`trader.${connectedWalletId}`)}
                      className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Use trader.{connectedWalletId}
                    </button>
                  </div>
                )}
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  The NEAR account holding the scoped passkey. Isolated from your master wallet.
                </span>
              </div>

            {/* Daily Spending Cap: Free-form manual input */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Daily Spending Cap (mUSD / day)
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Type any figure manually. Can be $1 or any custom budget.
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-obsidian-800 px-2.5 py-1 rounded-lg">
                  ${dailyCap} mUSD
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={dailyCapInput}
                    onChange={(e) => handleDailyCapChange(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="100"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {[25, 100, 250, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPresetChip(preset)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium border transition ${
                        dailyCap === preset
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-slate-50 dark:bg-obsidian-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-obsidian-800"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick-Add Pre-Vetted Platforms */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <PlatformPresets
                activeContracts={platforms.map((p) => p.contract)}
                onTogglePreset={togglePresetPlatform}
              />
            </div>

            {/* Custom Multi-Platform Manager */}
            <CustomPlatformManager
              platforms={platforms}
              onAddCustomPlatform={addCustomPlatform}
              onRemovePlatform={removePlatform}
              onUpdatePlatformMethods={updatePlatformMethods}
            />

            {/* Custom Circuit Breaker & Velocity Safeguards */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <label className="font-semibold text-slate-900 dark:text-white block">Custom Circuit Breaker & Rate Limits</label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Configure how many failed calls freeze the key, and how fast the agent can act.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Auto-Brake Strikes</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={autoPauseAfter}
                    onChange={(e) => setAutoPauseAfter(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-rose-600 dark:text-rose-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block">Rejections to freeze</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Check Window (Min)</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={autoPauseWindowMinutes}
                    onChange={(e) => setAutoPauseWindowMinutes(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block">Rolling minutes</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Speed Throttle</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={speedLimit}
                    onChange={(e) => setSpeedLimit(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono font-bold text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400 block">Max calls / window</span>
                </div>
              </div>
            </div>

            {/* Direct External Cash Transfers Toggle */}
            <div className="p-4 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Allow Direct Transfers to Outside Wallets?
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Default is OFF. Blocks sending funds to third-party personal accounts.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowExternalTransfers(!allowExternalTransfers)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    allowExternalTransfers ? "bg-emerald-600" : "bg-slate-300 dark:bg-obsidian-800"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      allowExternalTransfers ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {allowExternalTransfers && (
                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <label className="text-slate-700 dark:text-slate-300">Designated Allowed Recipient</label>
                  <input
                    type="text"
                    value={externalRecipient}
                    onChange={(e) => setExternalRecipient(e.target.value)}
                    placeholder="e.g. sergeo-guard.testnet"
                    className="w-full px-3 py-2 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Validation & Security Feedback */}
            {policyValidationErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <div className="font-bold">Policy Schema Validation Error:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {policyValidationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            {hasDangerPolicyLint && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                <div className="font-bold">Security Lint Warning:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {policyLintWarnings
                    .filter((w) => w.severity === "danger")
                    .map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                </ul>
              </div>
            )}

            {/* Register Action Button */}
            <button
              type="button"
              disabled={isDeploying || !isPolicyValid}
              onClick={handleIssueCard}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Policy Specification...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Preview Scope & Generate Handoff</span>
                </>
              )}
            </button>
          </div>

        {/* Blueprint & Physical Card (Col 5: Clean Single-Layer Card) */}
        <div className="lg:col-span-5 bg-white dark:bg-obsidian-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Digital Key Specification</h2>
              <div className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-obsidian-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setActiveView("visual")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    activeView === "visual"
                      ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Card
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView("json")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                    activeView === "json"
                      ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

              {activeView === "visual" ? (
                <div className="space-y-4">
                  {/* Physical Passkey Widget */}
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-obsidian-900 to-obsidian-950 text-white space-y-4 shadow-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold tracking-wider text-slate-200 text-[11px]">
                          SCOPEGUARD PASSKEY
                        </span>
                      </div>
                      <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                        NEAR TESTNET
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                        Assigned Agent
                      </span>
                      <span className="font-mono text-sm text-slate-100 font-semibold block truncate">
                        {agentName}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Daily Limit</span>
                        <span className="font-mono font-bold text-emerald-400">
                          ${dailyCap} mUSD
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Platforms</span>
                        <span className="font-mono font-semibold text-slate-200">
                          {platforms.length} Approved
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Policy Guarantees */}
                  <div className="p-4 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white block mb-1">
                      Enforceable Guarantees
                    </span>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>
                        Calls restricted to {platforms.length} allowlisted contract(s)
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>
                        Daily spending strictly bounded to ${dailyCap} mUSD
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>
                        Auto-freeze after {autoPauseAfter} rejects in {autoPauseWindowMinutes}m
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>
                        {allowExternalTransfers
                          ? `Transfers allowed only to ${externalRecipient || "designated wallet"}`
                          : "Transfers to personal accounts are refused"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  <pre>{JSON.stringify(compiledPolicyJson, null, 2)}</pre>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
