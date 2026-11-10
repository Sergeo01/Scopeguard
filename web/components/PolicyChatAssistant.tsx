"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Wand2,
  Sparkles,
  Check,
  Copy,
  AlertCircle,
  AlertTriangle,
  Terminal,
  Code2,
  Shield,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Cpu,
  Layers,
} from "lucide-react";
import { DrafterPolicy, draftPolicyFromText } from "@/lib/drafter";

export interface PolicyChatAssistantProps {
  onApplyPolicy: (policy: DrafterPolicy) => void;
  currentDailyCap: number;
  currentAgentName: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: number;
  policy?: DrafterPolicy;
  plainEnglish?: string;
  warnings?: { field: string; message: string; severity: "warning" | "danger" }[];
  applied?: boolean;
}

const PRESET_PROMPTS = [
  {
    label: "DEX Trader ($250/day)",
    prompt: "Create an autonomous DeFi trading policy for sergeo-guard-dex.testnet allowing swap with a $250 daily cap, max 5 trades per 10 minutes, and auto-pause after 3 failed strikes.",
  },
  {
    label: "Ref Finance & Burrow Bot",
    prompt: "Allow my agent to trade on ref-finance-101.testnet (swap) and contract.burrow.testnet (deposit, borrow) with $500 daily cap and 10 actions per 10 minutes.",
  },
  {
    label: "Micro-Payments ($50/day)",
    prompt: "Strict micro-payment agent with $50 daily spending limit, max 3 actions per 10 minutes, and auto-pause after 2 rejections.",
  },
  {
    label: "Conservative Timelock Guard",
    prompt: "Conservative treasury bot with $100 daily cap, $50 quarantine timelock threshold, and 20% drawdown limit on sergeo-guard-dex.testnet.",
  },
];

export function PolicyChatAssistant({
  onApplyPolicy,
  currentDailyCap,
  currentAgentName,
}: PolicyChatAssistantProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "agent-guide">("chat");
  const [promptInput, setPromptInput] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [promptValidationError, setPromptValidationError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-greeting",
      sender: "assistant",
      text: "Hello! I am your ScopeGuard policy assistant. Tell me in plain English what your autonomous agent is allowed to do, and I will generate the formal onchain guardrails for you. You can also connect external LLM agents directly using the Agent Integration guide.",
      timestamp: Date.now(),
    },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleSendPrompt = async (textToSend?: string) => {
    const text = (textToSend ?? promptInput).trim();
    if (!text) {
      setPromptValidationError("Prompt text is required. Describe the agent permissions or budget to draft a policy.");
      return;
    }
    setPromptValidationError(null);
    setDraftError(null);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setPromptInput("");
    setIsDrafting(true);

    try {
      let draftData: any = null;

      // First attempt server route /api/draft
      try {
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.draft) {
            draftData = json.draft;
          }
        }
      } catch {
        // Fall back to client deterministic drafter
      }

      // Client-side fallback if server route is unavailable or offline
      if (!draftData) {
        draftData = await draftPolicyFromText(text);
      }

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: "assistant",
        text: `I have drafted a guardrail policy matching your instructions. Daily cap is set to $${draftData.policy.daily_cap} mUSD across ${Object.keys(draftData.policy.targets).length} target platform(s).`,
        timestamp: Date.now(),
        policy: draftData.policy,
        plainEnglish: draftData.plainEnglish,
        warnings: draftData.warnings,
        applied: false,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      setDraftError(e.message || "Failed to generate policy from text");
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "I encountered an error analyzing your request. Please try refining your phrasing or pick one of the preset templates below.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsDrafting(false);
    }
  };

  const handleApply = (msgId: string, policy: DrafterPolicy) => {
    onApplyPolicy(policy);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
    );
  };

  const mcpConfigJson = JSON.stringify(
    {
      mcpServers: {
        scopeguard: {
          command: "node",
          args: [
            "d:/Hackathon/NEAR/packages/ironclaw-mcp/dist/index.js",
            "--credential",
            "./credentials/agent.json",
          ],
        },
      },
    },
    null,
    2
  );

  const elizaConfigSnippet = `// ElizaOS Agent Character File Integration
import { scopeGuardPlugin } from "@scopeguard/plugin-eliza";

export const defaultCharacter: Character = {
  name: "${currentAgentName || "agent.sergeo-guard.testnet"}",
  plugins: [scopeGuardPlugin],
  settings: {
    secrets: {
      SCOPEGUARD_CREDENTIAL_PATH: "./credentials/agent.json"
    }
  }
};`;

  const curlDraftSnippet = `curl -X POST https://scopeguard.app/api/draft \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Allow DEX swap with 100 mUSD daily cap and 5 actions per 10min"}'`;

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 shadow-xs overflow-hidden">
      {/* Header & Tabs */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/60 dark:bg-obsidian-950/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Conversational Policy Assistant &amp; Agent Hub
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                AI Powered
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Draft guardrail rules through chat or connect autonomous agents (Claude, Cursor, ElizaOS, or MCP) directly.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-obsidian-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "chat"
                ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
            <span>Chat Assistant</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("agent-guide")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "agent-guide"
                ? "bg-white dark:bg-obsidian-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>Agent Connect (MCP &amp; ElizaOS)</span>
          </button>
        </div>
      </div>

      {activeTab === "chat" ? (
        <div className="p-5 space-y-4">
          {/* Quick Preset Prompt Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              Suggested policy templates (1-click draft):
            </span>
            <div className="flex flex-wrap gap-2">
              {PRESET_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPromptInput(p.prompt);
                    handleSendPrompt(p.prompt);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-obsidian-950 hover:bg-slate-100 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Wand2 className="w-3 h-3 text-brand-blue" />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Thread */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-obsidian-950/70 border border-slate-200/80 dark:border-slate-800 max-h-96 overflow-y-auto space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 text-xs ${
                  m.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.sender === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2.5 shadow-2xs ${
                    m.sender === "user"
                      ? "bg-brand-blue text-white rounded-tr-none"
                      : "bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                  {/* Render Policy Specification Card if Assistant Drafted One */}
                  {m.policy && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 space-y-2 mt-2">
                      <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-1.5">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-emerald-500" />
                          Generated Guardrail Policy
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold">
                          Validated
                        </span>
                      </div>

                      {m.plainEnglish && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 italic leading-relaxed">
                          "{m.plainEnglish}"
                        </p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                        <div className="p-2 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Daily Cap</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ${m.policy.daily_cap} mUSD
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Speed Limit</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {m.policy.max_actions_per_10min} / 10m
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Auto-Brake</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                            {m.policy.auto_pause_rejects} strikes
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Quarantine</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                            ${m.policy.high_value_threshold}
                          </span>
                        </div>
                      </div>

                      {/* Allowed Targets */}
                      <div className="text-[11px] pt-1">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Permitted Contracts:
                        </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {Object.entries(m.policy.targets).map(([contract, methods]) => (
                            <span
                              key={contract}
                              className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-200/70 dark:bg-obsidian-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                            >
                              {contract}: [{methods.join(", ")}]
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Apply Button */}
                      <div className="pt-2 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          Click to push these settings into the form below:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApply(m.id, m.policy!)}
                          disabled={m.applied}
                          className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                            m.applied
                              ? "bg-emerald-600 text-white cursor-default"
                              : "bg-brand-blue hover:bg-brand-blueHover text-white shadow-xs"
                          }`}
                        >
                          {m.applied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Applied to Policy Form</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-3.5 h-3.5" />
                              <span>Apply to Policy Form</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Validation Error Red Signal for Empty/Invalid Prompt */}
          {promptValidationError && (
            <div
              id="chat-prompt-error-signal"
              className="p-3 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 animate-in fade-in"
            >
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <div>
                <span className="font-bold">Prompt Description Missing:</span>{" "}
                <span>{promptValidationError}</span>
              </div>
            </div>
          )}

          {draftError && (
            <div className="p-3 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{draftError}</span>
            </div>
          )}

          {/* Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="space-y-2"
          >
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Agent Intent or Permission Prompt</span>
                </label>
                {!promptInput.trim() && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Draft Description Required
                  </span>
                )}
              </div>
              <div className="relative">
                <textarea
                  value={promptInput}
                  onChange={(e) => {
                    setPromptInput(e.target.value);
                    if (promptValidationError && e.target.value.trim().length > 0) {
                      setPromptValidationError(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPrompt();
                    }
                  }}
                  placeholder="Describe your agent requirements (e.g. 'Allow DEX swap with 150 mUSD cap, max 5 trades per 10min, pause on 3 rejections')..."
                  rows={2}
                  maxLength={2000}
                  className={`w-full p-3 rounded-xl bg-slate-50 dark:bg-obsidian-950 border text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition resize-none ${
                    promptValidationError || (!promptInput.trim() && promptInput.length > 0)
                      ? "border-rose-500 ring-2 ring-rose-500/30"
                      : "border-slate-200 dark:border-slate-800 focus:border-brand-blue"
                  }`}
                />
                <span className="absolute right-3 bottom-2.5 text-[10px] text-slate-400 font-mono">
                  {promptInput.length}/2000
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex-1">
                {!promptInput.trim() ? (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Button unclickable: Enter a prompt description above or click a preset template to draft.</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    Press Enter to draft, or click the button. You can apply the drafted policy directly into your scoped key.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isDrafting || !promptInput.trim()}
                title={
                  isDrafting
                    ? "Drafting policy in progress..."
                    : !promptInput.trim()
                    ? "Button locked: Enter natural language instructions in the box above to enable AI drafting"
                    : "Generate policy specification with AI"
                }
                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition shrink-0 ${
                  isDrafting || !promptInput.trim()
                    ? "bg-brand-blue/50 opacity-50 cursor-not-allowed border border-rose-500/40"
                    : "bg-brand-blue hover:bg-brand-blueHover cursor-pointer"
                }`}
              >
                {isDrafting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Request...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Draft Policy with AI</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Agent Direct Connect Guide Tab */
        <div className="p-5 space-y-6 text-xs text-slate-700 dark:text-slate-300">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Direct Autonomous Agent Integration
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
              External agents (Claude Desktop, Cursor, ElizaOS, or custom Python/TypeScript scripts) can configure policies and execute guarded actions over standard interfaces.
            </p>
          </div>

          {/* Option 1: IronClaw MCP Server */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-obsidian-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-brand-blue" />
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  1. IronClaw Model Context Protocol (MCP) Server
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(mcpConfigJson, "mcp")}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-obsidian-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-brand-blue transition cursor-pointer flex items-center gap-1.5"
              >
                {copiedKey === "mcp" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Claude Config</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Add ScopeGuard to Claude Desktop or Cursor by placing this snippet in your claude_desktop_config.json:
            </p>
            <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
              {mcpConfigJson}
            </pre>
            <div className="text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
              <span className="font-semibold block text-slate-700 dark:text-slate-300">
                Tools exposed to LLM agents:
              </span>
              <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px]">
                <li>scopeguard_budget: View current spend and available 24h budget</li>
                <li>scopeguard_get_rules: Inspect active target allowlist and caps</li>
                <li>scopeguard_preflight: Simulate whether an action would be allowed or rejected</li>
                <li>scopeguard_act: Safely execute an onchain action with scoped access key</li>
                <li>scopeguard_get_last_decline: Retrieve reason and remediation for rejected calls</li>
              </ul>
            </div>
          </div>

          {/* Option 2: ElizaOS Autonomous Agent Plugin */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-obsidian-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-500" />
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  2. ElizaOS Autonomous Agent Plugin (@scopeguard/plugin-eliza)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(elizaConfigSnippet, "eliza")}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-obsidian-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-emerald-500 transition cursor-pointer flex items-center gap-1.5"
              >
                {copiedKey === "eliza" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Eliza Snippet</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Equip ElizaOS autonomous agents with policy guardrails by including the plugin in the character file:
            </p>
            <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
              {elizaConfigSnippet}
            </pre>
          </div>

          {/* Option 3: Natural Language REST API Endpoint */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-obsidian-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  3. Direct Chat Drafting API (/api/draft)
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(curlDraftSnippet, "curl")}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-obsidian-900 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-amber-500 transition cursor-pointer flex items-center gap-1.5"
              >
                {copiedKey === "curl" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy cURL</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Any agent or webhook service can POST natural language prompts to convert instructions into verified Policy JSON objects:
            </p>
            <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-800">
              {curlDraftSnippet}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
