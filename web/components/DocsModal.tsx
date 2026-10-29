"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  X,
  ShieldCheck,
  Terminal,
  Key,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Lock,
} from "lucide-react";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"quickstart" | "rules" | "integration" | "panic">("quickstart");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-obsidian-950/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-900/30 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ScopeGuard Documentation & Integration Guide
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  v1.0 Testnet
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Complete developer specifications, onchain rule hierarchy, and agent runtime setups.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-obsidian-850 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200/80 dark:border-slate-800 flex gap-2 shrink-0 bg-slate-50/50 dark:bg-obsidian-900/50">
          {[
            { id: "quickstart", label: "Quick Start", icon: Sparkles },
            { id: "rules", label: "7-Layer Rules", icon: Layers },
            { id: "integration", label: "Agent Handoff", icon: Terminal },
            { id: "panic", label: "Panic & Security", icon: AlertTriangle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-obsidian-950 shadow-xs"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700 dark:text-slate-300">
          {activeTab === "quickstart" && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-50/50 via-blue-50/80 to-blue-100/60 dark:from-blue-950/20 dark:via-blue-950/30 dark:to-blue-900/40 border border-blue-200/50 dark:border-blue-800/40 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  Mission Statement
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  Give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  The Three Core Steps
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white block">Draft Policy</span>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Describe what the agent does. Set your daily spending budget, allowed target contracts, and velocity cap.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                      2
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white block">Sign Onchain</span>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Your master wallet registers the agent rule card on Guard2. The agent machine receives only a FunctionCall passkey.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <span className="w-6 h-6 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                      3
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white block">Connect Agent</span>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Feed the passkey to your agent via CLI command, raw key string, or chat prompt. Testnet execution is bounded.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-100/70 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Active Testnet Contracts
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-white dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block text-[9px] uppercase">Guard Contract</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">guard2.sergeo-guard.testnet</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block text-[9px] uppercase">Token (mUSD)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">sergeo-guard-token.testnet</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block text-[9px] uppercase">Demo DEX</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">sergeo-guard-dex.testnet</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "rules" && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                When an agent attempts any action, Guard2 executes the following 7 checks in fixed sequential order.
                If any check fails, the transaction is rejected without gas loss, the violation is logged onchain, and the auto-pause circuit breaker evaluates the strike count.
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    num: 1,
                    code: "NOT_AGENT",
                    title: "Authorized Caller Check",
                    desc: "Caller must match the registered agent sub-account on file.",
                  },
                  {
                    num: 2,
                    code: "PAUSED",
                    title: "Emergency Circuit Breaker",
                    desc: "Transaction rejected if the owner paused the agent or auto-pause tripped.",
                  },
                  {
                    num: 3,
                    code: "OVER_VELOCITY_CAP",
                    title: "Frequency Velocity Throttle",
                    desc: "Actions within the active 10-minute rolling window must not exceed the limit.",
                  },
                  {
                    num: 4,
                    code: "TARGET_NOT_ALLOWED",
                    title: "Destination Allowlist",
                    desc: "Destination contract address must exist on the approved policy list.",
                  },
                  {
                    num: 5,
                    code: "METHOD_NOT_ALLOWED",
                    title: "Function Scope",
                    desc: "Invoked method name must be explicitly allowed for that specific destination.",
                  },
                  {
                    num: 6,
                    code: "OVER_DAILY_CAP",
                    title: "24-Hour Spending Cap",
                    desc: "Spend in the current 24-hour window plus this transfer must fit under the cap.",
                  },
                  {
                    num: 7,
                    code: "RECIPIENT_NOT_ALLOWED",
                    title: "Beneficiary Allowlist",
                    desc: "Funds sent to personal accounts must be pre-authorized. Default is blocked.",
                  },
                ].map((rule) => (
                  <div
                    key={rule.num}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {rule.num}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                          {rule.code}
                        </span>
                        <span className="text-slate-400 text-[10px]">|</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {rule.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {rule.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "integration" && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect your autonomous agent runtime through any of the three standard handoff methods:
              </p>

              {/* Method 1: CLI */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-500" />
                    <span>Method 1: Interactive CLI Setup & Act</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyCode("node sdk/bin/cli.js setup", "cli-setup")}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "cli-setup" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Setup</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto">
{`# 1. Run interactive onboarding with mandatory Admin Approval Gate:
node sdk/bin/cli.js setup

# 2. Check remaining daily budget:
node sdk/bin/cli.js budget --account trader.sergeo-guard.testnet

# 3. Execute bounded swap action:
node sdk/bin/cli.js act --target sergeo-guard-dex.testnet --method swap --amount 25`}
                </pre>
              </div>

              {/* Method 2: AI Agent Prompt */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span>Method 2: Conversational Agent Prompt (Claude, ChatGPT, OpenClaw)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyCode(
                        "You are connected to NEAR Testnet via ScopeGuard. All financial transactions must route strictly through guard2.sergeo-guard.testnet::execute. Never attempt direct token transfers to unlisted recipients. Limit modifications require explicit human admin approval.",
                        "prompt-copy"
                      )
                    }
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "prompt-copy" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Prompt</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Paste this system instruction into your agent runtime. The agent cannot escalate limits because the contract enforces admin signatures.
                </p>
              </div>
            </div>
          )}

          {activeTab === "panic" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 space-y-1">
                <span className="font-bold flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Immediate Panic Controls: 3 Taps</span>
                </span>
                <p className="text-[11px] leading-relaxed">
                  The human owner retains cryptographic sovereignty at all times through their master wallet.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-amber-600 block text-xs">1. Soft Pause</span>
                  <p className="text-[11px] text-slate-500">
                    Immediately halts all execute calls. Can be unpaused at any time with a single tap.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-rose-600 block text-xs">2. Hard Revoke</span>
                  <p className="text-[11px] text-slate-500">
                    Deletes the agent FunctionCall key from NEAR protocol. The agent credential file is permanently neutralized.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-blue-600 block text-xs">3. Vault Withdraw</span>
                  <p className="text-[11px] text-slate-500">
                    Drains the working pot directly back into your owner wallet. Destination is locked to the owner account.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-obsidian-900/60">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span>NEAR Protocol Verified Onchain Enforcement</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
