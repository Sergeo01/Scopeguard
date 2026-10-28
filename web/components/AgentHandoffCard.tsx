"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  Key,
  MessageSquareCode,
  Download,
  ExternalLink,
  Shield,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface AgentHandoffCardProps {
  agentName: string;
  dailyCap: number;
  platformsCount: number;
  autoPauseAfter: number;
  autoPauseWindowMinutes: number;
  telegramChatId?: string;
  passkey?: string;
  publicKey?: string;
  policyJson?: any;
  onReset: () => void;
}

export const AgentHandoffCard: React.FC<AgentHandoffCardProps> = ({
  agentName,
  dailyCap,
  platformsCount,
  autoPauseAfter,
  autoPauseWindowMinutes,
  telegramChatId,
  passkey,
  publicKey,
  policyJson,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<"cli" | "key" | "prompt" | "json" | "near">("cli");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const actualPasskey = passkey || "ed25519:xqNiY8bEVWbtYvTewgedBmfa54fLpqDLdZfSi66s9xLfiJJ1K9eL39mCWbfZLVXpeREPQz6YXzVAoBkmg2PJKA1";
  const actualPublicKey = publicKey || "ed25519:13Xi8UoLpX7hgPd6u8W4JRMsxtzHHkMd8RZpdhqppSvm";
  const guardContract = "guard2.sergeo-guard.testnet";

  const cliCommand = `node sdk/bin/cli.js connect --account ${agentName} --key ${actualPasskey} --guard ${guardContract}`;

  const nearSetupCommands = `# 1. Register agent policy on Guard contract
near contract call-function as-transaction ${guardContract} register_agent json-args '{"agent_account":"${agentName}","policy":${JSON.stringify(policyJson || { token: "sergeo-guard-token.testnet", targets: { "sergeo-guard-dex.testnet": ["swap"] }, daily_cap: String(dailyCap), recipients: [], max_actions_per_10min: 5, auto_pause_rejects: autoPauseAfter, auto_pause_window_minutes: autoPauseWindowMinutes, high_value_threshold: String(Math.floor(dailyCap / 2)), high_value_delay_seconds: 60, policy_change_delay_seconds: 600 })}}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as <your-owner-account.testnet> network-config testnet

# 2. Add scoped function-call passkey to agent account (restricted to Guard execute only)
near account add-key ${agentName} ${actualPublicKey} grant-function-call-access --receiver-account-id ${guardContract} --allowance '1 NEAR' --method-names '["execute"]' sign-as <your-owner-account.testnet> network-config testnet`;

  const agentPromptText = `You are my autonomous trading agent on NEAR Testnet.
- Account: ${agentName}
- Scoped Passkey: Load from environment variable (SCOPEGUARD_AGENT_PRIVATE_KEY) or credentials/agent.json
- Policy Guard Contract: ${guardContract}
- Daily Spending Limit: $${dailyCap} mUSD
- Enforced Rules:
  1. All trades must be routed through ${guardContract}::execute
  2. Direct asset withdrawals and unapproved contract calls are forbidden onchain
  3. Comply strictly with the ${dailyCap} mUSD daily budget and speed limits`;

  const credentialJson = {
    agentAccountId: agentName,
    policyContractId: guardContract,
    publicKey: actualPublicKey,
    privateKey: actualPasskey,
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    created_at: new Date().toISOString(),
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadJson = () => {
    // ponytail: Zero-dependency client-side file download via browser Blob
    const blob = new Blob([JSON.stringify(credentialJson, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scopeguard-${agentName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Confirmation Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-block mb-1">
            Passkey Generated Locally (Pending Onchain Registration)
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Passkey Ready for Onchain Activation
          </h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            A cryptographic ED25519 passkey has been generated for <span className="font-mono font-semibold text-slate-900">{agentName}</span>. Next step: connect it to your agent and register the policy onchain.
          </p>
        </div>

        {/* Policy Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-left">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Daily Limit
            </span>
            <span className="text-sm font-mono font-bold text-emerald-700">
              ${dailyCap} mUSD
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Platforms
            </span>
            <span className="text-sm font-mono font-semibold text-slate-800">
              {platformsCount} Approved
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Auto-Brake
            </span>
            <span className="text-sm font-mono font-semibold text-rose-700">
              {autoPauseAfter} rejects / {autoPauseWindowMinutes}m
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Telegram
            </span>
            <span className="text-sm font-mono font-semibold text-blue-700 truncate block">
              {telegramChatId || "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Instant Agent Handoff Console */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-6 border-b border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Connect Key to Your Agent
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Pick the format your agent supports
            </span>
          </div>
          <p className="text-xs text-slate-600">
            No technical files required unless you want them. Use a one-line command, copy the private key string, or paste the natural language prompt.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("cli")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === "cli"
                ? "border-emerald-600 text-slate-900 bg-white"
                : "border-transparent hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <Terminal className="w-4 h-4 text-emerald-600" />
            <span>One-Line Command</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-medium">
              Easiest
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("key")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === "key"
                ? "border-emerald-600 text-slate-900 bg-white"
                : "border-transparent hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <Key className="w-4 h-4 text-slate-500" />
            <span>Private Key String</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("prompt")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === "prompt"
                ? "border-emerald-600 text-slate-900 bg-white"
                : "border-transparent hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <MessageSquareCode className="w-4 h-4 text-purple-600" />
            <span>AI Chat Prompt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("json")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === "json"
                ? "border-emerald-600 text-slate-900 bg-white"
                : "border-transparent hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Download agent.json</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("near")}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 transition whitespace-nowrap ${
              activeTab === "near"
                ? "border-emerald-600 text-slate-900 bg-white"
                : "border-transparent hover:text-slate-900 hover:bg-slate-100/60"
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>NEAR CLI Commands</span>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">
              Non-Custodial
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {activeTab === "cli" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">
                  Run in Agent Terminal or Dockerfile
                </h4>
                <p className="text-xs text-slate-600">
                  Your agent will connect to NEAR Testnet and automatically configure the passkey with zero manual typing.
                </p>
              </div>

              <div className="relative group">
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {cliCommand}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(cliCommand, "cli")}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 shadow-sm transition"
                >
                  {copiedKey === "cli" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-start gap-2">
                <Shield className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Safe & Scoped:</strong> This command only gives the agent a restricted passkey. Even if the agent machine is compromised, the attacker cannot withdraw funds or exceed your daily cap.
                </span>
              </div>
            </div>
          )}

          {activeTab === "key" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">
                  Direct Private Key for Bots & Marketplaces
                </h4>
                <p className="text-xs text-slate-600">
                  Paste this string into trading bot marketplaces, Telegram bot prompts, or Virtuals Protocol agents that require a private key.
                </p>
              </div>

              <div className="relative group">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {actualPasskey}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(actualPasskey, "key")}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 shadow-sm transition"
                >
                  {copiedKey === "key" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Key</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Account ID: <strong className="text-slate-900">{agentName}</strong> · Contract: <strong className="text-slate-900">{guardContract}</strong>
              </div>
            </div>
          )}

          {activeTab === "prompt" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">
                  Ready-to-Paste Conversational Agent Instructions
                </h4>
                <p className="text-xs text-slate-600">
                  Copy and paste this instruction directly into your LLM agent chat (Antigravity, Claude, ChatGPT, or OpenClaw).
                </p>
              </div>

              <div className="relative group">
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800">
                  {agentPromptText}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(agentPromptText, "prompt")}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 shadow-sm transition"
                >
                  {copiedKey === "prompt" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied Prompt!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "json" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">
                  Traditional JSON File for Developer Workflows
                </h4>
                <p className="text-xs text-slate-600">
                  Save as <code className="font-mono text-slate-800 bg-slate-100 px-1 py-0.5 rounded">agent.json</code> in your local project directory.
                </p>
              </div>

              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                {JSON.stringify(credentialJson, null, 2)}
              </pre>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download agent.json</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(JSON.stringify(credentialJson, null, 2), "json")}
                  className="px-4 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
                >
                  {copiedKey === "json" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "near" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900">
                  Exact Signed-Ready NEAR CLI Commands
                </h4>
                <p className="text-xs text-slate-600">
                  Run these two commands from your owner terminal to register the policy and grant the scoped function-call access key directly on NEAR.
                </p>
              </div>

              <div className="relative group">
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 whitespace-pre-wrap">
                  {nearSetupCommands}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(nearSetupCommands, "near")}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700 shadow-sm transition"
                >
                  {copiedKey === "near" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied Commands!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Commands</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2 font-mono">
                <span>
                  Key Public Key: <strong className="text-slate-900">{actualPublicKey}</strong>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Configure Another Key</span>
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition shadow-xs"
            >
              Test Attack Simulator
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
            >
              <span>Open Agent Treasury</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
