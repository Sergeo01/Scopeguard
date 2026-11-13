"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Copy,
  Check,
  Key,
  MessageSquareCode,
  ExternalLink,
  Shield,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  Lock,
  AlertTriangle,
  Code2,
  ShieldCheck,
} from "lucide-react";
import { tryGetPolicyContractId } from "@/lib/config";

interface AgentHandoffCardProps {
  agentName: string;
  dailyCap: number;
  platformsCount: number;
  autoPauseAfter: number;
  autoPauseWindowMinutes: number;
  telegramChatId?: string;
  ownerAccount?: string;
  passkey?: string;
  publicKey?: string;
  policyJson?: any;
  onReset: () => void;
  txHash?: string;
  explorerUrl?: string;
  registrationStatus?: "idle" | "broadcasting" | "registered" | "manual";
  registrationCommand?: string;
}

export const AgentHandoffCard: React.FC<AgentHandoffCardProps> = ({
  agentName,
  dailyCap,
  platformsCount,
  autoPauseAfter,
  autoPauseWindowMinutes,
  telegramChatId,
  ownerAccount,
  passkey,
  publicKey,
  policyJson,
  onReset,
  txHash,
  explorerUrl,
  registrationStatus = "idle",
  registrationCommand,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);

  const actualPasskey = passkey || "";
  const actualPublicKey = publicKey || "";
  const maskedPasskey = actualPasskey ? "ed25519:••••••••••••••••••••••••••••••••••••••••••••" : "";
  const rawGuard = tryGetPolicyContractId();
  const guardContract = rawGuard || "scopeguard.testnet";
  const guardContractDisplay = guardContract;
  const cliGuardArg = guardContract;
  const ownerName = ownerAccount || process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet";

  // Retain nearSetupCommands for compatibility and CLI reference
  const nearSetupCommands = `# 1. Register agent policy on Guard contract
near call ${cliGuardArg} register_agent '{"agent_account":"${agentName}","policy":${policyJson ? JSON.stringify(policyJson) : "<POLICY_JSON>"}}' --accountId ${ownerName} --gas 100000000000000

# 2. Add scoped function-call passkey to agent account (restricted to Guard execute only, with 0.25 NEAR allowance for gas fees)
# Note: On NEAR Protocol, the agent sub-account authorizes adding its own access key.
near add-key ${agentName} ${actualPublicKey || "<AGENT_PUBLIC_KEY>"} --contractId ${cliGuardArg} --methodNames execute --allowance 0.25 --accountId ${agentName}`;

  const agentPromptText = `You are my autonomous agent on NEAR Testnet protected by ScopeGuard.

INTEGRATION INSTRUCTIONS FOR AI AGENTS:
- Do not search your local filesystem for any SDK or CLI tools. All necessary credentials, endpoints, and constraints are provided directly in this prompt.
- If you need a local credential file, save this configuration to ./agent.json:
{
  "agentAccountId": "${agentName}",
  "policyContractId": "${guardContractDisplay}",
  "publicKey": "${actualPublicKey}",
  "privateKey": "${actualPasskey}",
  "networkId": "testnet",
  "nodeUrl": "https://test.rpc.fastnear.com",
  "dailyCap": ${dailyCap},
  "query_live_rules_url": "https://scopeguard.blockframe.cloud/api/agents?agent=${agentName}"
}

ALLOWED CAPABILITIES & WORKFLOWS:
You can execute two primary categories of guarded operations:
1. Swaps: Execute trades on approved decentralized exchanges (such as sergeo-guard-dex.testnet).
2. Payments & Transfers: Transfer approved tokens (such as sergeo-guard-token.testnet) to allowlisted destination accounts.

TRANSACTION EXECUTION PATHS:
- All actions must be submitted through the Guard contract (${guardContractDisplay}) calling the execute method.
- Direct token transfers or calls bypassing ScopeGuard will be rejected and trip your circuit breaker.

1. Direct Payments (Transfers):
- Guard Action Shape: typed Transfer action { "token": "sergeo-guard-token.testnet", "to": "<RECIPIENT_ACCOUNT>", "amount": "<AMOUNT_IN_ATOMIC_UNITS>", "memo": "<OPTIONAL_MEMO>" }
- CLI Command: node sdk/bin/cli.js act --recipient <RECIPIENT_ACCOUNT> --amount <AMOUNT>
- MCP Tool: scopeguard_act with method "ft_transfer", recipient "<RECIPIENT_ACCOUNT>", amount <AMOUNT>
- Destination Rule: Transfers only succeed to destinations explicitly allowlisted in your policy recipients list. Transferring to any unlisted destination triggers an onchain policy rejection (REASON_RECIPIENT) and records a strike toward your auto-pause circuit breaker.

2. Contract Calls (Swaps):
- Guard Action Shape: typed ContractCall action { "target": "sergeo-guard-dex.testnet", "method": "swap", "args": "<BASE64_OR_JSON_ARGS>", "deposit": "0", "gas": 30000000000000 }
- CLI Command: node sdk/bin/cli.js act --target sergeo-guard-dex.testnet --method swap --amount <AMOUNT>
- MCP Tool: scopeguard_act with target "sergeo-guard-dex.testnet", method "swap", amount <AMOUNT>

PREFLIGHT-FIRST OPERATING PROTOCOL:
Always verify your remaining daily spending allowance and active policy before dispatching transactions:
- Via MCP: call scopeguard_budget tool
- Via CLI: node sdk/bin/cli.js budget --account ${agentName}
- Via RPC: near view ${guardContractDisplay} get_budget '{"agent_account":"${agentName}"}'
- Via RPC: near view ${guardContractDisplay} get_policy '{"agent_account":"${agentName}"}'
High-value transfers at or above your high-value threshold enter a timelock quarantine pending human owner confirmation.

WORKED EXAMPLES:
1. Swap Example:
   CLI: node sdk/bin/cli.js act --target sergeo-guard-dex.testnet --method swap --amount 25
   MCP: { "tool": "scopeguard_act", "arguments": { "target": "sergeo-guard-dex.testnet", "method": "swap", "amount": 25 } }

2. Transfer / Payment Example:
   CLI: node sdk/bin/cli.js act --recipient ${ownerName} --amount 10
   MCP: { "tool": "scopeguard_act", "arguments": { "recipient": "${ownerName}", "amount": 10 } }

ACTIVE CONSTRAINTS & LIMITS:
- Daily Spending Limit: ${dailyCap} mUSD
- Enforced Rules:
  1. All calls and transfers must be dispatched through ${guardContractDisplay}::execute
  2. Direct asset withdrawals and unapproved contract calls are rejected and tripped onchain
  3. You cannot increase your own budget or approve new platform contracts. Only the human admin account (${ownerName}) can sign policy changes.
  4. When asked "What can you do with this key?", query your rules and explain your allowed platforms, permitted recipients, and spending caps to the user.`;

  const displayAgentPromptText = actualPasskey && !revealKey
    ? agentPromptText.split(actualPasskey).join(maskedPasskey)
    : agentPromptText;

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Success Confirmation Banner */}
      <div className="bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-sm transition-colors">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500 shadow-xs">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-block mb-1">
            {txHash ? "Registered Onchain (NEAR Testnet)" : "Passkey Generated Locally (Ready for Handoff)"}
          </span>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Passkey Ready for Agent Handoff
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
            A cryptographic ED25519 passkey has been generated for{" "}
            <span className="font-mono font-semibold text-slate-900 dark:text-white">{agentName}</span>.
          </p>
        </div>

        {/* Policy Contract Not Configured Banner */}
        {!guardContract && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center gap-3 text-left">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                Policy contract not configured
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 block">
                Set NEXT_PUBLIC_POLICY_CONTRACT_ID in your environment to complete onchain deployment.
              </span>
            </div>
          </div>
        )}

        {/* Verified Onchain Transaction Banner */}
        {txHash && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  ONCHAIN POLICY REGISTRATION VERIFIED
                </span>
                <span className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate block">
                  Tx: {txHash}
                </span>
              </div>
            </div>
            <a
              href={explorerUrl || `https://testnet.nearblocks.io/txns/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition shadow-xs shrink-0 cursor-pointer"
            >
              <span>NearBlocks</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {registrationStatus === "broadcasting" && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Broadcasting registration transaction to NEAR Testnet...</span>
          </div>
        )}

        {/* Manual registration fallback */}
        {registrationStatus === "manual" && !txHash && (
          <div className="p-4 bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 rounded-xl text-left space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
              Not registered yet: one command to finish
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This server does not hold an owner key, so it did not sign anything. Run this
              with the owner account to register the policy onchain:
            </p>
            {registrationCommand ? (
              <div className="relative">
                <pre className="p-3 pr-10 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap break-all border border-slate-800">
                  {registrationCommand}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(registrationCommand, "manual-cmd")}
                  className="absolute right-2 top-2 p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  title="Copy command"
                >
                  {copiedKey === "manual-cmd" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-rose-600 dark:text-rose-400">
                No command was returned. Check the browser console and the server logs.
              </p>
            )}
          </div>
        )}

        {/* Policy Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-left">
          <div className="p-3 bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
              Daily Limit
            </span>
            <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {dailyCap} mUSD
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
              Platforms
            </span>
            <span className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
              {platformsCount} Approved
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
              Auto-Brake
            </span>
            <span className="text-sm font-mono font-semibold text-rose-600 dark:text-rose-400">
              {autoPauseAfter} rejects / {autoPauseWindowMinutes}m
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-obsidian-850 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wider">
              Telegram
            </span>
            <span className="text-sm font-mono font-semibold text-blue-600 dark:text-blue-400 truncate block">
              {telegramChatId || "Disabled"}
            </span>
          </div>
        </div>
      </div>

      {/* Strict Trading Bot Handoff Console: Dedicated Passkey and Bot Prompt Only */}
      <div className="bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-colors space-y-6 p-6 sm:p-7">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-5 space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Strict Trading Bot Handoff
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Import the scoped private key directly into your trading bot (e.g. Telegram bots, automated scripts).
                </p>
              </div>
            </div>
            <span className="self-start sm:self-center font-mono text-[11px] bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              Allowance: 0.25 NEAR gas
            </span>
          </div>
        </div>

        {/* Section 1: Prominent Scoped Passkey Box (Strict Trading Bot & Telegram Bots) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-950 text-white border border-slate-800 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-xs tracking-wider uppercase text-slate-200">
                Scoped Protocol Passkey (For Telegram &amp; Strict Bots)
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                receiver: {guardContractDisplay}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                method: execute
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-slate-300 leading-relaxed">
              Strict trading bots (such as Telegram trading bots, DEX snipers, and automated scripts) only need this private key. Copy the key below and paste it directly into your bot:
            </p>
          </div>

          {/* Large 1-Click Copy Key Button for Telegram & Trading Bots */}
          {actualPasskey && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handleCopy(actualPasskey, "telegram-bot-key")}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
              >
                {copiedKey === "telegram-bot-key" ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Private Key Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Copy Private Key for Trading Bot (Telegram)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Account and Protocol Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Agent Sub-Account
              </span>
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs font-semibold text-slate-100 truncate">
                  {agentName}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(agentName, "agent-acct")}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  title="Copy Agent Account"
                >
                  {copiedKey === "agent-acct" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Locked Receiver
              </span>
              <span className="font-mono text-xs font-semibold text-emerald-400 block truncate">
                {guardContractDisplay}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Execution Method
              </span>
              <span className="font-mono text-xs font-semibold text-slate-200 block">
                execute (single entrypoint)
              </span>
            </div>
          </div>

          {/* Scoped Private Key Row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Scoped Private Key (Passkey)</span>
              </span>
              {actualPasskey && (
                <button
                  type="button"
                  onClick={() => setRevealKey(!revealKey)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  {revealKey ? <EyeOff className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{revealKey ? "Mask Passkey" : "Reveal Passkey"}</span>
                </button>
              )}
            </div>

            <div className="relative group">
              <pre className="p-3.5 pr-28 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                {actualPasskey
                  ? (revealKey ? actualPasskey : maskedPasskey)
                  : "[No passkey in memory. Provide SCOPEGUARD_AGENT_PRIVATE_KEY]"}
              </pre>
              {actualPasskey && (
                <button
                  type="button"
                  onClick={() => handleCopy(actualPasskey, "passkey-btn")}
                  className="absolute top-2.5 right-2.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  {copiedKey === "passkey-btn" ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Key</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Scoped Public Key Row */}
          {actualPublicKey && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 block">
                Public Key (Attached to {agentName})
              </span>
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300">
                <span className="truncate">{actualPublicKey}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(actualPublicKey, "pubkey-btn")}
                  className="p-1 hover:text-white text-slate-400 shrink-0 cursor-pointer"
                  title="Copy Public Key"
                >
                  {copiedKey === "pubkey-btn" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Safe for Telegram bots: This is a restricted FunctionCall key. It can ONLY call {guardContractDisplay}::execute. Even if the bot is compromised, it cannot transfer native NEAR, drain your wallet, or alter keys.
            </span>
          </div>
        </div>

        {/* Section 2: AI Agent System Prompt (For Conversational LLMs: Claude, Cursor, ElizaOS) */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <MessageSquareCode className="w-4 h-4 text-brand-blue dark:text-sky-400" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  AI Agent System Prompt (Claude, Cursor, ElizaOS)
                </h4>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                If using an autonomous LLM agent instead of a Telegram bot, paste this system prompt into your AI runtime:
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              {actualPasskey && (
                <button
                  type="button"
                  onClick={() => setRevealKey(!revealKey)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-obsidian-800 hover:bg-slate-200 dark:hover:bg-obsidian-750 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  {revealKey ? <EyeOff className="w-3.5 h-3.5 text-brand-blue" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{revealKey ? "Mask in Prompt" : "Reveal in Prompt"}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCopy(agentPromptText, "prompt-btn")}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                {copiedKey === "prompt-btn" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied Prompt</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Bot Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="relative group">
            <pre className="p-4 sm:p-5 rounded-2xl bg-slate-950 text-slate-100 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800 max-h-[320px] overflow-y-auto">
              {displayAgentPromptText}
            </pre>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Configure Another Key</span>
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/#arena"
              className="px-4 py-2 rounded-xl bg-white dark:bg-obsidian-850 hover:bg-slate-100 dark:hover:bg-obsidian-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition shadow-xs"
            >
              Live Attack Arena
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <span>Open Security Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
