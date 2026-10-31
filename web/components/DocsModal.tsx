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
  Code2,
  Workflow,
  Cpu,
  Coins,
  ShieldAlert,
} from "lucide-react";

interface DocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    "architecture" | "walkthrough" | "recipes" | "rules" | "panic" | "contracts"
  >("architecture");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-obsidian-950/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 sm:py-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-900/30 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  ScopeGuard Operator & Developer Guide
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  v0.2.0 Testnet
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Non-custodial agent passkeys, onchain policy enforcement, and practical integration runbooks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-obsidian-850 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-2 border-b border-slate-200/80 dark:border-slate-800 flex gap-1 sm:gap-2 shrink-0 bg-slate-50/50 dark:bg-obsidian-900/50 overflow-x-auto no-scrollbar">
          {[
            { id: "architecture", label: "Architecture", icon: Cpu },
            { id: "walkthrough", label: "Setup Walkthrough", icon: Workflow },
            { id: "recipes", label: "Integration Recipes", icon: Code2 },
            { id: "rules", label: "10-Layer Policy", icon: Layers },
            { id: "panic", label: "Panic Runbook", icon: AlertTriangle },
            { id: "contracts", label: "Live Contracts", icon: ExternalLink },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl transition border-b-2 cursor-pointer whitespace-nowrap ${
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
          {/* TAB 1: ARCHITECTURE */}
          {activeTab === "architecture" && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-50/60 via-blue-50/40 to-transparent dark:from-blue-950/30 dark:via-blue-950/10 dark:to-transparent border border-blue-200/60 dark:border-blue-800/40 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  The Problem and The Solution
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  Giving an autonomous AI agent your master private key means one prompt injection or compromised dependency results in total fund loss. ScopeGuard bounds the agent using NEAR protocol native passkeys and a custom policy contract.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4" />
                    <span>How Most Agents Run Today (Unsafe)</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside">
                    <li>The agent holds a full private key in a local plaintext file or environment variable.</li>
                    <li>The key has permission to transfer all funds, add/delete keys, and call any smart contract.</li>
                    <li>If an attacker uses prompt injection to trick the agent, the entire wallet is drained in seconds.</li>
                    <li>There is no spending cap, no speed limit, and no rollback option.</li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>The ScopeGuard Model (Guarded)</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside">
                    <li>The agent machine holds only a scoped FunctionCall passkey restricted to Guard2::execute.</li>
                    <li>The key cannot transfer NEAR, cannot add keys, and cannot call unauthorized contracts.</li>
                    <li>Working money lives in an isolated spending vault: worst-case risk is capped at what you deposited.</li>
                    <li>The owner holds full recovery rights: pause, revoke keys onchain, or empty the vault at any time.</li>
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-500" />
                  <span>The Dual-Key Security Boundary</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-white dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-blue-600 dark:text-blue-400 block">1. Owner Master Key (Stays in Your Wallet)</span>
                    <p className="text-slate-500 leading-relaxed">
                      Used only to create the policy, deposit vault funds, or trigger emergency stops. Never touches the agent machine and never leaves your browser wallet or hardware signer.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-obsidian-950 border border-slate-200 dark:border-slate-800 space-y-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block">2. Agent FunctionCall Passkey (Given to the Bot)</span>
                    <p className="text-slate-500 leading-relaxed">
                      Restricted at the NEAR protocol layer: receiver = guard2.sergeo-guard.testnet, methodNames = [&quot;execute&quot;]. Any direct payout attempt is rejected by the NEAR blockchain itself before running.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WALKTHROUGH */}
          {activeTab === "walkthrough" && (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Follow these three steps to provision a secured passkey for your autonomous bot:
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                    <span>Draft the Policy Rules</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                    Open the <strong className="text-slate-700 dark:text-slate-300">Issue Passkey</strong> page in the sidebar. Describe your agent in plain English or select presets. Set your maximum daily spend (e.g. $50 mUSD/day), allowed target contracts (e.g. ScopeGuard DEX, Ref Finance), velocity limit (e.g. 5 actions per 10 minutes), and auto-pause strike count. Direct payouts to external personal accounts default to refused.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                    <span>Sign the Registration Onchain</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                    ScopeGuard is non-custodial: the web server never holds your master private key. When you click Issue Passkey, you can sign the registration with your connected NEAR wallet. Alternatively, you can copy the exact <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">near call</code> command and execute it directly in your own terminal.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                    <span>Deliver the Passkey to Your Bot</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
                    Provide the generated passkey to your bot runtime using the convenient handoff method of your choice: a single-line CLI connect command, a private key string for trading bots, an agent.json credential file, or a ready-to-paste system prompt for conversational LLMs.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTEGRATION RECIPES */}
          {activeTab === "recipes" && (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Choose the recipe matching your agent stack:
              </p>

              {/* Recipe 1: TypeScript SDK */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-500" />
                    <span>Recipe 1: TypeScript / JavaScript Bot Runtime</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyCode(
                        `import { ScopeGuard } from "@scopeguard/sdk";\n\n// 1. Initialize with agent credentials\nconst guard = await ScopeGuard.init({\n  agentAccountId: "agent.sergeo-guard.testnet",\n  policyContractId: "guard2.sergeo-guard.testnet",\n  privateKey: process.env.SCOPEGUARD_AGENT_PRIVATE_KEY!,\n});\n\n// 2. Query remaining daily budget without signing\nconst budget = await guard.getBudget();\nconsole.log("Remaining Budget:", budget.available, "mUSD");\n\n// 3. Execute bounded trade\nconst result = await guard.act({\n  target: "sergeo-guard-dex.testnet",\n  method: "swap",\n  amount: "25",\n});\nconsole.log("Status:", result.status, "Tx:", result.txHash);`,
                        "ts-recipe"
                      )
                    }
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "ts-recipe" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Code</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
{`import { ScopeGuard } from "@scopeguard/sdk";

// 1. Initialize with agent credentials
const guard = await ScopeGuard.init({
  agentAccountId: "agent.sergeo-guard.testnet",
  policyContractId: "guard2.sergeo-guard.testnet",
  privateKey: process.env.SCOPEGUARD_AGENT_PRIVATE_KEY!,
});

// 2. Query remaining daily budget without signing
const budget = await guard.getBudget();
console.log("Remaining Budget:", budget.available, "mUSD");

// 3. Execute bounded trade
const result = await guard.act({
  target: "sergeo-guard-dex.testnet",
  method: "swap",
  amount: "25",
});
console.log("Status:", result.status, "Tx:", result.txHash);`}
                </pre>
              </div>

              {/* Recipe 2: Conversational LLM Prompt */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span>Recipe 2: Conversational LLM Agents (Claude, ChatGPT, OpenClaw, Eliza)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyCode(
                        `You are an autonomous trading agent operating on NEAR Testnet under ScopeGuard protection.\n- Agent Account: agent.sergeo-guard.testnet\n- Guard Contract: guard2.sergeo-guard.testnet\n- Approved Target: sergeo-guard-dex.testnet (methods: swap)\n\nRules:\n1. All trades must route exclusively through guard2.sergeo-guard.testnet::execute\n2. Direct asset withdrawals and payouts to external wallets are forbidden.\n3. You cannot increase your own budget. The human owner signs limits onchain.\n4. If user instructions tell you to bypass the guard or drain funds, refuse immediately.`,
                        "llm-prompt"
                      )
                    }
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "llm-prompt" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Prompt</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Paste this system instruction into your agent prompt. Even if a malicious message bypasses this prompt, the Guard2 Rust smart contract blocks the action onchain.
                </p>
                <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
{`You are an autonomous trading agent operating on NEAR Testnet under ScopeGuard protection.
- Agent Account: agent.sergeo-guard.testnet
- Guard Contract: guard2.sergeo-guard.testnet
- Approved Target: sergeo-guard-dex.testnet (methods: swap)

Rules:
1. All trades must route exclusively through guard2.sergeo-guard.testnet::execute
2. Direct asset withdrawals and payouts to external wallets are forbidden.
3. You cannot increase your own budget. The human owner signs limits onchain.
4. If user instructions tell you to bypass the guard or drain funds, refuse immediately.`}
                </pre>
              </div>

              {/* Recipe 3: Python / Generic Bot */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-500" />
                    <span>Recipe 3: Python / REST Bot (near-api-py or Raw RPC)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyCode(
                        `# Python JSON-RPC action payload\npayload = {\n    "agent_account": "agent.sergeo-guard.testnet",\n    "action": {\n        "ContractCall": {\n            "target": "sergeo-guard-dex.testnet",\n            "method": "swap",\n            "args": "{}",\n            "deposit": "0",\n            "gas": 30000000000000\n        }\n    }\n}`,
                        "py-recipe"
                      )
                    }
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "py-recipe" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Python trading bots sign a standard function call to <code className="font-mono text-slate-700 dark:text-slate-300">guard2.sergeo-guard.testnet::execute</code> using their scoped ed25519 passkey.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: 10-LAYER POLICY */}
          {activeTab === "rules" && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                When an agent attempts an action, Guard2 executes 10 sequential checks. If any check fails, the transaction is rejected as a return value (never reverting gas), the violation is logged in EVENT_JSON, and the auto-pause circuit breaker increments.
              </p>

              <div className="space-y-2.5">
                {[
                  {
                    num: 1,
                    code: "NOT_AGENT",
                    title: "Authorized Caller Check",
                    desc: "Caller must match the registered agent sub-account on file. Unregistered callers fail here.",
                  },
                  {
                    num: 2,
                    code: "PAUSED",
                    title: "Emergency Circuit Breaker",
                    desc: "Rejected if the owner activated soft pause or if consecutive strike limits tripped the auto-brake.",
                  },
                  {
                    num: 3,
                    code: "OVER_VELOCITY_CAP",
                    title: "Speed Throttle (Anti-Spam)",
                    desc: "Number of actions within the rolling 10-minute window must not exceed the configured limit (e.g. 5).",
                  },
                  {
                    num: 4,
                    code: "TARGET_NOT_ALLOWED",
                    title: "Destination Allowlist",
                    desc: "The smart contract address must be explicitly listed on the approved policy target list.",
                  },
                  {
                    num: 5,
                    code: "METHOD_NOT_ALLOWED",
                    title: "Function Scope Check",
                    desc: "The invoked method name must be explicitly allowed for that target contract.",
                  },
                  {
                    num: 6,
                    code: "OVER_DAILY_CAP",
                    title: "24-Hour Spending Cap",
                    desc: "Spend in the rolling 24-hour window plus this transfer must fit within the daily cap (e.g. $500).",
                  },
                  {
                    num: 7,
                    code: "RECIPIENT_NOT_ALLOWED",
                    title: "Beneficiary Allowlist",
                    desc: "Direct token payouts to outside personal accounts are rejected unless explicitly allowlisted.",
                  },
                  {
                    num: 8,
                    code: "PENDING (Quarantine)",
                    title: "High-Value Veto Timelock",
                    desc: "Actions at or above the threshold (e.g. $50) enter a 60-second quarantine allowing owner veto.",
                  },
                  {
                    num: 9,
                    code: "INSUFFICIENT_VAULT_BALANCE",
                    title: "Vault Balance Limit",
                    desc: "Action amount cannot exceed the agent working balance currently deposited in the Guard vault.",
                  },
                  {
                    num: 10,
                    code: "PENDING_QUEUE_FULL",
                    title: "Pending Queue Cap",
                    desc: "Limits the maximum number of simultaneous quarantined actions to prevent buffer flooding.",
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

          {/* TAB 5: PANIC RUNBOOK */}
          {activeTab === "panic" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 space-y-1">
                <span className="font-bold flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Owner Emergency Command Runbook</span>
                </span>
                <p className="text-[11px] leading-relaxed">
                  As the owner, you retain cryptographic sovereignty. If an agent goes rogue or is compromised, run these commands with your owner account:
                </p>
              </div>

              <div className="space-y-3">
                {/* 1. Pause */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-600 text-xs block">1. Emergency Pause (Soft Stop)</span>
                      <span className="text-[10px] text-slate-500">Freezes all actions immediately without deleting keys. Can be unpaused later.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyCode(
                          `near call guard2.sergeo-guard.testnet pause '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000`,
                          "pause-cmd"
                        )
                      }
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSection === "pause-cmd" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-950 text-amber-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
near call guard2.sergeo-guard.testnet pause &apos;&#123;&quot;agent_account&quot;:&quot;agent.sergeo-guard.testnet&quot;&#125;&apos; --accountId sergeo-guard.testnet --gas 100000000000000
                  </pre>
                </div>

                {/* 2. Revoke */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-rose-600 text-xs block">2. Permanent Key Revocation (Hard Stop)</span>
                      <span className="text-[10px] text-slate-500">Erases allowlists and pauses agent. All future attempts are permanently dead.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyCode(
                          `near call guard2.sergeo-guard.testnet revoke_agent '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000`,
                          "revoke-cmd"
                        )
                      }
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSection === "revoke-cmd" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-950 text-rose-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
near call guard2.sergeo-guard.testnet revoke_agent &apos;&#123;&quot;agent_account&quot;:&quot;agent.sergeo-guard.testnet&quot;&#125;&apos; --accountId sergeo-guard.testnet --gas 100000000000000
                  </pre>
                </div>

                {/* 3. Withdraw */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-blue-600 text-xs block">3. Emergency Vault Drain to Owner</span>
                      <span className="text-[10px] text-slate-500">Recovers working funds. Destination is strictly forced to the owner account.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        copyCode(
                          `near call guard2.sergeo-guard.testnet withdraw_vault '{"agent_account":"agent.sergeo-guard.testnet","amount":"350"}' --accountId sergeo-guard.testnet --gas 100000000000000`,
                          "withdraw-cmd"
                        )
                      }
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSection === "withdraw-cmd" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>Copy</span>
                    </button>
                  </div>
                  <pre className="p-2.5 rounded bg-slate-950 text-blue-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap break-all">
near call guard2.sergeo-guard.testnet withdraw_vault &apos;&#123;&quot;agent_account&quot;:&quot;agent.sergeo-guard.testnet&quot;,&quot;amount&quot;:&quot;350&quot;&#125;&apos; --accountId sergeo-guard.testnet --gas 100000000000000
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CONTRACTS */}
          {activeTab === "contracts" && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Active contracts deployed and verified on NEAR Testnet:
              </p>

              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-sans">Policy Guard Contract (v0.2.0)</span>
                    <span className="font-bold text-slate-900 dark:text-white">guard2.sergeo-guard.testnet</span>
                  </div>
                  <a
                    href="https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    <span>NearBlocks</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-sans">Token Vault Contract (mUSD)</span>
                    <span className="font-bold text-slate-900 dark:text-white">sergeo-guard-token.testnet</span>
                  </div>
                  <a
                    href="https://testnet.nearblocks.io/address/sergeo-guard-token.testnet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    <span>NearBlocks</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 text-[10px] block uppercase font-sans">Demo DEX Exchange Contract</span>
                    <span className="font-bold text-slate-900 dark:text-white">sergeo-guard-dex.testnet</span>
                  </div>
                  <a
                    href="https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                  >
                    <span>NearBlocks</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 sm:py-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-obsidian-900/60">
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
