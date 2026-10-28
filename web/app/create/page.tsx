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
  Sparkles,
} from "lucide-react";
import { KeyPair } from "near-api-js";
import { AgentHandoffCard } from "../../components/AgentHandoffCard";
import { PlatformPresets, PresetPlatform } from "../../components/PlatformPresets";

interface TargetPlatform {
  id: string;
  contract: string;
  methods: string;
  label?: string;
}

export default function CreateAgentPage() {
  const [agentName, setAgentName] = useState("trader.sergeo-guard.testnet");
  const [dailyCap, setDailyCap] = useState<number>(100);
  const [dailyCapInput, setDailyCapInput] = useState<string>("100");

  const [platforms, setPlatforms] = useState<TargetPlatform[]>([
    {
      id: "p1",
      contract: "sergeo-guard-dex.testnet",
      methods: "swap",
      label: "ScopeGuard Testnet DEX",
    },
  ]);

  const [allowExternalTransfers, setAllowExternalTransfers] = useState(false);
  const [externalRecipient, setExternalRecipient] = useState("");
  const [speedLimit, setSpeedLimit] = useState<number>(5);
  const [autoPauseAfter, setAutoPauseAfter] = useState<number>(3);
  const [autoPauseWindowMinutes, setAutoPauseWindowMinutes] = useState<number>(10);
  const [timelockThreshold, setTimelockThreshold] = useState<number>(50);
  const [telegramChatId, setTelegramChatId] = useState<string>("@sergeo");

  const [activeView, setActiveView] = useState<"visual" | "json">("visual");
  const [isDeploying, setIsDeploying] = useState(false);
  const [issuedSuccess, setIssuedSuccess] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<any>(null);
  const [generatedPasskey, setGeneratedPasskey] = useState<string>("");
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string>("");

  useEffect(() => {
    // ponytail: Inspect URL query param to allow direct inspection/testing of the handoff state
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

  const addPlatform = () => {
    const newId = `p${Date.now()}`;
    setPlatforms([
      ...platforms,
      {
        id: newId,
        contract: "ref-finance.near",
        methods: "swap",
        label: "Secondary DEX / DeFi",
      },
    ]);
  };

  const removePlatform = (id: string) => {
    if (platforms.length <= 1) return;
    setPlatforms(platforms.filter((p) => p.id !== id));
  };

  const updatePlatform = (id: string, field: "contract" | "methods" | "label", val: string) => {
    setPlatforms(
      platforms.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const togglePresetPlatform = (preset: PresetPlatform) => {
    const exists = platforms.some((p) => p.contract === preset.contract);
    if (exists) {
      if (platforms.length > 1) {
        setPlatforms(platforms.filter((p) => p.contract !== preset.contract));
      }
    } else {
      setPlatforms([
        ...platforms,
        {
          id: `preset-${Date.now()}`,
          contract: preset.contract,
          methods: preset.methods,
          label: preset.name,
        },
      ]);
    }
  };

  const compiledTargets: Record<string, string[]> = {};
  platforms.forEach((p) => {
    if (p.contract.trim()) {
      const methodsArr = p.methods
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      // ponytail: Strict compliance with spec section 4 (no wildcards permitted)
      const sanitizedMethods = methodsArr.filter((m) => m !== "*");
      compiledTargets[p.contract.trim()] = sanitizedMethods.length ? sanitizedMethods : ["swap"];
    }
  });

  const compiledPolicyJson = {
    token: "sergeo-guard-token.testnet",
    targets: compiledTargets,
    daily_cap: String(dailyCap),
    recipients: allowExternalTransfers && externalRecipient ? [externalRecipient] : [],
    max_actions_per_10min: speedLimit,
    auto_pause_rejects: autoPauseAfter,
    auto_pause_window_minutes: autoPauseWindowMinutes,
    high_value_threshold: String(timelockThreshold),
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 3600,
  };

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

  const handleIssueCard = () => {
    setIsDeploying(true);
    try {
      const keyPair = KeyPair.fromRandom("ed25519");
      const pubKey = keyPair.getPublicKey().toString();
      const privKey = keyPair.toString();
      setGeneratedPasskey(privKey);
      setGeneratedPublicKey(pubKey);
      setIsDeploying(false);
      setIssuedSuccess(true);
    } catch (e: any) {
      setIsDeploying(false);
      alert("Failed to generate keypair: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Editorial Headline */}
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
            Fully Customizable Policy
          </span>
          <span className="text-xs text-slate-500 font-mono">No hardcoded limits · 100% Manual Controls</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Issue an Agent Spending Key
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
          Create a restricted function-call access key scoped to the Guard contract. Every setting is customizable: set your own dollar caps, allow multiple platforms, and configure instant Telegram alerts.
        </p>
      </div>

      {/* AI Scope Drafter Hero Card */}
      <div className="bg-gradient-to-r from-emerald-50/70 via-slate-50 to-purple-50/40 border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-emerald-100" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                AI Scope Drafter
              </h2>
              <p className="text-xs text-slate-500">
                Describe the agent's job in plain English. The AI service drafts the minimal required rule card.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-800 border border-emerald-200 hidden sm:inline-block">
            Strict Schema Validated
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
            className="flex-1 px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleAiDraft}
            disabled={isDrafting || !aiPrompt.trim()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-sm shrink-0"
          >
            {isDrafting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Drafting Policy...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Draft Policy with AI</span>
              </>
            )}
          </button>
        </div>

        {draftResult?.plainEnglish && (
          <div className="p-3.5 bg-white border border-emerald-200 rounded-xl space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
              AI Proposed Rule Card (Signed Review)
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              {draftResult.plainEnglish}
            </p>
          </div>
        )}
      </div>

      {issuedSuccess ? (
        <AgentHandoffCard
          agentName={agentName}
          dailyCap={dailyCap}
          platformsCount={platforms.length}
          autoPauseAfter={autoPauseAfter}
          autoPauseWindowMinutes={autoPauseWindowMinutes}
          telegramChatId={telegramChatId}
          passkey={generatedPasskey}
          publicKey={generatedPublicKey}
          policyJson={compiledPolicyJson}
          onReset={() => setIssuedSuccess(false)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Side (Col 7) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-sm">
            {/* Agent Sub-Account */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 block">Agent Sub-Account</label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="e.g. trader.sergeo-guard.testnet"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none focus:bg-white"
              />
              <span className="text-[11px] text-slate-500 block">
                The NEAR account holding the scoped passkey. Isolated from your master wallet.
              </span>
            </div>

            {/* Daily Spending Cap: Free-form manual input */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-900 block">
                    Daily Spending Cap (mUSD / day)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Type any figure manually. Can be $1 or any custom budget.
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
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
                    className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                    placeholder="100"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 25, 100, 250, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPresetChip(preset)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] font-mono font-medium border transition ${
                        dailyCap === preset
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      ${preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick-Add Pre-Vetted Platforms */}
            <div className="pt-3 border-t border-slate-100">
              <PlatformPresets
                activeContracts={platforms.map((p) => p.contract)}
                onTogglePreset={togglePresetPlatform}
              />
            </div>

            {/* Custom Multi-Platform Allowed Targets */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-900 block">
                    Active Allowed Platforms ({platforms.length})
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Add or modify any contract and authorized method names.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addPlatform}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Platform</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {platforms.map((p, idx) => (
                  <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 text-[11px]">
                        Platform #{idx + 1}: {p.label || p.contract}
                      </span>
                      {platforms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePlatform(p.id)}
                          className="text-rose-600 hover:text-rose-800 text-[11px] font-medium inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Target Contract ID</label>
                        <input
                          type="text"
                          value={p.contract}
                          onChange={(e) => updatePlatform(p.id, "contract", e.target.value)}
                          placeholder="e.g. ref-finance.near"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Allowed Methods (comma-separated)</label>
                        <input
                          type="text"
                          value={p.methods}
                          onChange={(e) => updatePlatform(p.id, "methods", e.target.value)}
                          placeholder="e.g. swap, deposit"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Circuit Breaker & Velocity Safeguards */}
            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <label className="font-semibold text-slate-900 block">Custom Circuit Breaker & Rate Limits</label>
                <span className="text-[11px] text-slate-500">
                  Configure how many failed calls freeze the key, and how fast the agent can act.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-600 block">Auto-Brake Rejects</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={autoPauseAfter}
                    onChange={(e) => setAutoPauseAfter(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-rose-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block">Strikes before freeze</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-600 block">Check Window (Min)</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={autoPauseWindowMinutes}
                    onChange={(e) => setAutoPauseWindowMinutes(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block">Rolling time window</span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <span className="text-[11px] text-slate-600 block">Speed Throttle</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={speedLimit}
                    onChange={(e) => setSpeedLimit(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block">Max calls / window</span>
                </div>
              </div>
            </div>

            {/* Telegram Real-Time Notification Integration */}
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3 pt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-slate-900">Telegram Instant Alerts</span>
                </div>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  100% Free · Zero Fees
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Receive instant phone notifications whenever your agent makes a trade, triggers a policy rejection, or trips the emergency brake.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="e.g. @my_telegram_handle or Chat ID"
                  className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg font-mono text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
                />
              </div>
            </div>

            {/* Direct External Cash Transfers Toggle */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900 block">
                    Allow Direct Transfers to Outside Wallets?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Default is OFF. Blocks sending funds to third-party personal accounts.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAllowExternalTransfers(!allowExternalTransfers)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    allowExternalTransfers ? "bg-slate-900" : "bg-slate-300"
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
                <div className="space-y-1 pt-2 border-t border-slate-200 text-xs">
                  <label className="text-slate-700">Designated Allowed Recipient</label>
                  <input
                    type="text"
                    value={externalRecipient}
                    onChange={(e) => setExternalRecipient(e.target.value)}
                    placeholder="e.g. sergeo-guard.testnet"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Register Action Button */}
            <button
              type="button"
              disabled={isDeploying}
              onClick={handleIssueCard}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none disabled:opacity-50"
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
            <p className="text-[11px] text-slate-500 text-center">
              Preview mode: generates ready-to-sign policy JSON and agent passkey format for NEAR consensus.
            </p>
          </div>

          {/* Blueprint & Physical Card (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900">Digital Key Specification</h2>
                <div className="flex items-center gap-1 text-xs bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveView("visual")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                      activeView === "visual" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("json")}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                      activeView === "json" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {activeView === "visual" ? (
                <div className="space-y-4">
                  {/* Physical Card Widget */}
                  <div className="p-5 rounded-xl bg-slate-900 text-white space-y-4 shadow-md border border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold tracking-wider text-slate-200 text-[11px]">
                          SCOPEGUARD PASSKEY
                        </span>
                      </div>
                      <span className="font-mono text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
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
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-1">
                      Enforceable Guarantees
                    </span>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Calls restricted to {platforms.length} allowlisted contract(s)
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Daily spending strictly bounded to ${dailyCap} mUSD
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        Auto-freeze after {autoPauseAfter} rejects in {autoPauseWindowMinutes}m
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        {allowExternalTransfers
                          ? `Transfers allowed only to ${externalRecipient || "designated wallet"}`
                          : "Transfers to personal accounts are refused"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  <pre>{JSON.stringify(compiledPolicyJson, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
