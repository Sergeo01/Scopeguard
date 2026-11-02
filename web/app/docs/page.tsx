"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Shield,
  Terminal,
  Code2,
  Lock,
  Layers,
  ArrowRight,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Gauge,
  Wallet,
  Zap,
  Copy,
  Check,
  Search,
  Menu,
  X,
  FileCode,
  AlertCircle,
  HelpCircle,
  Cpu,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { ScopeGuardLogo } from "@/components/ScopeGuardLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useWallet } from "@/context/WalletContext";

interface DocSection {
  id: string;
  category: string;
  title: string;
  badge?: string;
}

export default function DocsPage() {
  const { openAuthModal } = useWallet();
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const sections: DocSection[] = [
    { id: "overview", category: "Getting Started", title: "Introduction & Threat Model" },
    { id: "quickstart", category: "Getting Started", title: "60-Second Quickstart" },
    { id: "architecture", category: "Core Architecture", title: "The 5 System Pillars" },
    { id: "passkeys", category: "Core Architecture", title: "NEAR FunctionCall Passkeys" },
    { id: "ten-rules", category: "Policy Engine", title: "The 10 Sequential Rules", badge: "Core" },
    { id: "vault-custody", category: "Policy Engine", title: "Vault Custody & Async Rollback" },
    { id: "circuit-breaker", category: "Safety Controls", title: "Circuit Breakers & Emergency Brake" },
    { id: "timelock", category: "Safety Controls", title: "Timelock Quarantine Queue" },
    { id: "owner-powers", category: "Safety Controls", title: "Owner Panic Powers" },
    { id: "cli-reference", category: "Developer Reference", title: "CLI Command Reference" },
    { id: "sdk-reference", category: "Developer Reference", title: "TypeScript SDK Guide" },
    { id: "agent-prompt", category: "Developer Reference", title: "AI Agent System Prompt Handoff" },
    { id: "auth-wallets", category: "Identity & Wallets", title: "Auth & Multi-Account Architecture" },
    { id: "implemented-features", category: "Project Status", title: "Verified Implemented Features", badge: "100% Live" },
    { id: "roadmap", category: "Project Status", title: "Product Roadmap" },
    { id: "unimplemented-features", category: "Project Status", title: "Disclosure: Unimplemented Capabilities", badge: "Honest Audit" },
  ];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredSections = searchQuery.trim()
    ? sections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : sections;

  const categories = Array.from(new Set(sections.map((s) => s.category)));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Docs Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#080B11]/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/80 transition-colors">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <ScopeGuardLogo className="w-8 h-8 transition-transform group-hover:scale-105" size={32} />
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Scope<span className="text-blue-500">Guard</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Docs v0.2.0
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Search Filter Input */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation, rules, CLI, or SDK..."
                className="w-full h-9 pl-9 pr-4 rounded-xl bg-slate-100 dark:bg-[#0D111A] border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            >
              Marketing Home
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition"
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>Security Console</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="md:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main GitBook Layout */}
      <div className="flex-1 max-w-[1520px] w-full mx-auto flex">
        {/* Left Sticky Navigation Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 bg-white dark:bg-[#090C13] border-r border-slate-200 dark:border-slate-800/80 pt-20 pb-10 px-4 overflow-y-auto transform transition-transform duration-200 md:translate-x-0 md:static md:z-0 md:pt-6 ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="space-y-6">
            <div className="md:hidden pb-3 border-b border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search docs..."
                className="w-full h-8 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {categories.map((cat) => {
              const catSections = filteredSections.filter((s) => s.category === cat);
              if (catSections.length === 0) return null;

              return (
                <div key={cat} className="space-y-1.5">
                  <h4 className="px-2.5 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {cat}
                  </h4>
                  <div className="space-y-0.5">
                    {catSections.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(sec.id);
                          setMobileNavOpen(false);
                          const el = document.getElementById(sec.id);
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between transition cursor-pointer ${
                          activeSection === sec.id
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold border-l-2 border-blue-600 dark:border-blue-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <span className="truncate">{sec.title}</span>
                        {sec.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-mono shrink-0 ml-1.5 ${
                              sec.badge.includes("100%")
                                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                : sec.badge.includes("Honest")
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                            }`}
                          >
                            {sec.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center Main Content Area */}
        <main className="flex-1 min-w-0 px-6 sm:px-12 py-8 space-y-16 max-w-4xl">
          {/* SECTION 1: OVERVIEW */}
          <section id="overview" className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-500 uppercase tracking-wider">
                Getting Started
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Introduction &amp; Threat Model
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
              Autonomous AI agents that execute market operations, manage liquidity, and pay for APIs require capital. Today, most agent setups grant the agent a master private key stored in plaintext on disk. If that key is compromised via prompt injection, rogue third-party skills, or server exfiltration, every dollar in the account is drained immediately with no recourse.
            </p>
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>The Plain Key Equation: One Trick Equals Total Loss</span>
              </div>
              <p className="leading-relaxed">
                Crypto transfers cannot be charged back or undone. In 2026 audits, 341 out of 2,857 audited agent skills contained malicious payloads. ScopeGuard solves this at the protocol level: the agent never holds a master key. It holds a restricted NEAR FunctionCall passkey bounded by an onchain policy guard.
              </p>
            </div>
          </section>

          {/* SECTION 2: 60-SECOND QUICKSTART */}
          <section id="quickstart" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider">
                Quickstart
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              60-Second Quickstart
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Bind any agent to onchain ScopeGuard enforcement in two commands:
            </p>

            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-2 relative">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                  <span>Step 1: Install and bind via CLI</span>
                  <button
                    type="button"
                    onClick={() => handleCopy("npx @scopeguard/cli protect --agent trader.sergeo-guard.testnet", "q1")}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {copiedCode === "q1" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === "q1" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <code>npx @scopeguard/cli protect --agent trader.sergeo-guard.testnet</code>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 p-4 font-mono text-xs space-y-2 relative">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                  <span>Step 2: Execute trade bounded by onchain policy</span>
                  <button
                    type="button"
                    onClick={() => handleCopy("node -e \"const { loadCredential, act } = require('@scopeguard/sdk'); ...\"", "q2")}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {copiedCode === "q2" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode === "q2" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="text-slate-300 overflow-x-auto">
{`const { loadCredential, act } = require("@scopeguard/sdk");
const cred = loadCredential("agent.json");
const receipt = await act(cred, {
  target: "mock-dex.sergeo-guard.testnet",
  method: "swap",
  amount: "50",
  args: { token_in: "mUSD", amount_in: "50" }
});`}
                </pre>
              </div>
            </div>
          </section>

          {/* SECTION 3: THE 5 SYSTEM PILLARS */}
          <section id="architecture" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-500 uppercase tracking-wider">
                Core Architecture
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              The 5 System Pillars
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-mono font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Isolated Agent Sub-Account</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  The agent operates under a dedicated sub-account (e.g. trader.sergeo-guard.testnet). Its money lives separately from the owner main funds.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-mono font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">The Spending Vault</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  The owner funds a small working balance pot. That pot is the only capital the agent can touch. Maximum potential loss is strictly bounded.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                  3
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">The Scoped Passkey</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  A protocol-level NEAR FunctionCall access key restricted to receiver = guard contract and method = execute. It cannot sign arbitrary transfers.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-mono font-bold text-xs">
                  4
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">The Policy Guard Contract</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  A high-assurance Rust contract (near-sdk 5.29) that validates all 10 checks onchain before performing the action via cross-contract promise.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2 sm:col-span-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                  5
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">The Owner Signed Rule Card</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  The verified JSON policy containing allowlisted targets, methods, velocity rate bounds, daily spending caps, and automatic circuit breaker thresholds.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 4: NEAR FUNCTIONCALL PASSKEYS */}
          <section id="passkeys" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Protocol Advantage
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              NEAR FunctionCall Passkeys
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              On Ethereum-style EVM networks, keys are all-powerful by default: a leaked private key can sign any transaction. Restricting an EVM agent requires complex smart contract wallets (ERC-4337) and account abstraction bundlers.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              NEAR Protocol was built with multiple key types from genesis. ScopeGuard provisions a native <strong>FunctionCall access key</strong> with three immutable protocol constraints:
            </p>
            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <li>1. receiver_id = "guard2.sergeo-guard.testnet" (can NEVER call any other contract directly)</li>
              <li>2. method_names = ["execute"] (can NEVER invoke admin methods, add keys, or delete account)</li>
              <li>3. allowance = 250 mNEAR (gas-only budget; cannot transfer native NEAR by itself)</li>
            </ul>
          </section>

          {/* SECTION 5: THE 10 SEQUENTIAL RULES */}
          <section id="ten-rules" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-wider">
                Execution Pipeline
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              The 10 Sequential Rules
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Every invocation of execute evaluates the policy in this exact, immutable order. The order is mathematically determined to prevent state poisoning and bypass attempts:
            </p>

            <div className="space-y-3">
              {[
                { num: "01", name: "Caller Identity", code: "NOT_AGENT", desc: "Caller must match the registered agent account ID. Only unregistered callers panic, before state is touched." },
                { num: "02", name: "Circuit Breaker", code: "PAUSED", desc: "Agent must not be paused by owner or by automatic circuit breaker trip." },
                { num: "03", name: "Velocity Anti-Spam", code: "OVER_VELOCITY_CAP", desc: "Actions executed in the rolling 10-minute window must not exceed velocity_limit." },
                { num: "04", name: "Target Allowlist", code: "TARGET_NOT_ALLOWED", desc: "Target contract must be explicitly listed. Generic calls may never target the custody token." },
                { num: "05", name: "Method Allowlist", code: "METHOD_NOT_ALLOWED", desc: "Target method must be explicitly permitted. Direct transfers must use typed Transfer actions." },
                { num: "06", name: "Daily Spending Cap", code: "OVER_DAILY_CAP", desc: "Total spend in the rolling 24-hour window plus requested amount must not exceed daily_spend_cap." },
                { num: "07", name: "Recipient Allowlist", code: "RECIPIENT_NOT_ALLOWED", desc: "If funds transfer to an account, recipient must be on the allowlist. Empty list forbids transfers." },
                { num: "08", name: "Timelock Quarantine", code: "PENDING", desc: "Transfers at or above high_value_threshold wait in timelock queue for owner settlement. Not a rejection." },
                { num: "09", name: "Vault Balance Solvency", code: "INSUFFICIENT_VAULT_BALANCE", desc: "Transfer amount cannot exceed the agent active working vault balance." },
                { num: "10", name: "Queue Boundary", code: "PENDING_QUEUE_FULL", desc: "Timelock queue is bounded at MAX_PENDING_ACTIONS (16). Prevents unapproved action buildup." },
              ].map((r) => (
                <div
                  key={r.num}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0E15] flex items-start gap-3.5"
                >
                  <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    {r.num}
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{r.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-bold">
                        {r.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                      {r.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <span className="font-bold">Non-Negotiable Architecture Invariant:</span>
              <p className="leading-relaxed">
                execute must NEVER panic on a policy rejection. Panics revert all state writes, which would erase the reject audit log and cancel the auto-pause circuit breaker counter. Rejections return structured values with the exact reason code.
              </p>
            </div>
          </section>

          {/* SECTION 6: VAULT CUSTODY & ASYNC ROLLBACK */}
          <section id="vault-custody" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider">
                Financial Solvency
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Vault Custody &amp; Async Rollback
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Working funds (e.g. NEP-141 mUSD mock tokens) are deposited by the owner directly into the guard custody vault. When an agent executes a valid Transfer action, the guard debits the agent vault pot before dispatching the asynchronous ft_transfer promise.
            </p>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 font-mono text-xs space-y-2">
              <div className="text-slate-400 pb-2 border-b border-slate-800">
                Callback Settlement Flow (contracts/policy/src/lib.rs:770)
              </div>
              <pre className="overflow-x-auto text-emerald-400">
{`// 1. Debit agent vault balance upfront
vault.balance = vault.balance - amount;

// 2. Dispatch ft_transfer promise to token contract
ext_ft::ext(token).ft_transfer(recipient, amount)
  .then(ext_self::ext(current_account).on_transfer_complete(agent, amount));

// 3. Callback executes:
// If cross-contract call succeeded: finalize spend
// If cross-contract call failed/reverted: refund vault balance immediately
if !is_promise_success() {
    vault.balance = vault.balance + amount;
}`}
              </pre>
            </div>
          </section>

          {/* SECTION 7: CIRCUIT BREAKER & AUTO-PAUSE */}
          <section id="circuit-breaker" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wider">
                Emergency Defense
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Circuit Breakers &amp; Auto-Pause
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              When an attacker injects a malicious prompt ordering an agent to sweep funds, the agent may attempt rapid iterative attacks. ScopeGuard features an automated onchain emergency circuit breaker:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0E15] text-center space-y-1">
                <span className="text-2xl font-extrabold text-amber-500 font-mono">3 Strikes</span>
                <p className="text-[11px] text-slate-500">Trip Threshold</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0E15] text-center space-y-1">
                <span className="text-2xl font-extrabold text-blue-500 font-mono">5 Minutes</span>
                <p className="text-[11px] text-slate-500">Rolling Strike Window</p>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0E15] text-center space-y-1">
                <span className="text-2xl font-extrabold text-red-500 font-mono">Instant</span>
                <p className="text-[11px] text-slate-500">Auto-Pause Lockout</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              On the third consecutive rejection inside 5 minutes, the guard contract sets paused = true in the exact same transaction, halts all subsequent calls immediately, and emits a public onchain AUTO_PAUSE event.
            </p>
          </section>

          {/* SECTION 8: TIMELOCK QUARANTINE */}
          <section id="timelock" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wider">
                Quarantine Queue
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Timelock Quarantine Queue
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              For legitimate but unusually high-value transfers, the owner configures a high_value_threshold (e.g. 200 mUSD). Any request at or above this threshold is quarantined in the timelock queue:
            </p>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside bg-slate-100 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <li>Status code returns PENDING (this is an outcome, not a rejection; does not count against strikes).</li>
              <li>A mandatory quarantine window (e.g. 60 seconds) must elapse before settlement is allowed.</li>
              <li>The owner can review the pending intent in the dashboard and either click Settle or Cancel.</li>
              <li>The queue is strictly bounded at 16 slots; if full, requests are refused with PENDING_QUEUE_FULL.</li>
            </ul>
          </section>

          {/* SECTION 9: OWNER PANIC POWERS */}
          <section id="owner-powers" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-wider">
                Emergency Sovereignty
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Owner Panic Powers
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The human owner retains absolute unilateral sovereignty over agent credentials and capital via three distinct panic buttons:
            </p>
            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] flex items-start gap-3">
                <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 font-mono font-bold text-xs">Pause</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Soft Stop</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Temporarily halts all agent actions on the guard contract. Can be unpaused by the owner at any time.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] flex items-start gap-3">
                <span className="px-2 py-1 rounded bg-red-500/10 text-red-500 font-mono font-bold text-xs">Revoke</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Hard Stop (Protocol Level)</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Deletes the agent FunctionCall key directly on the NEAR protocol. The credential file on the agent machine becomes invalid everywhere permanently.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] flex items-start gap-3">
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 font-mono font-bold text-xs">Withdraw</span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Instant Pot Drainage</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Transfers the entire vault balance directly back to the owner verified account. Destination is hard-coded to owner; agent cannot intercept or redirect.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 10: CLI REFERENCE */}
          <section id="cli-reference" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-500 uppercase tracking-wider">
                Developer Tooling
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              CLI Command Reference
            </h2>
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 space-y-1">
                <div className="text-slate-400"># Connect agent with scoped credentials</div>
                <div className="text-emerald-400 font-bold">npx @scopeguard/cli connect --account &lt;agent_id&gt; --key &lt;private_key&gt; --guard guard2.sergeo-guard.testnet</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 space-y-1">
                <div className="text-slate-400"># Inspect active onchain budget and velocity</div>
                <div className="text-blue-400 font-bold">npx @scopeguard/cli status --agent trader.sergeo-guard.testnet</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 space-y-1">
                <div className="text-slate-400"># Trigger emergency owner pause</div>
                <div className="text-amber-400 font-bold">npx @scopeguard/cli panic pause --guard guard2.sergeo-guard.testnet</div>
              </div>
            </div>
          </section>

          {/* SECTION 11: SDK REFERENCE */}
          <section id="sdk-reference" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider">
                TypeScript SDK
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              TypeScript SDK Guide
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              The @scopeguard/sdk package exports three zero-dependency functions:
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-1.5">
                <span className="font-mono font-bold text-blue-500">loadCredential(pathOrString)</span>
                <p className="text-slate-600 dark:text-slate-400">Loads a scoped credential file (agent.json) or private key string into memory.</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-1.5">
                <span className="font-mono font-bold text-emerald-500">act(credential, action)</span>
                <p className="text-slate-600 dark:text-slate-400">Dispatches an action through guard execute. Returns structured onchain verdict (ALLOW or REJECT with exact reason code).</p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-1.5">
                <span className="font-mono font-bold text-blue-500">budget(agentId)</span>
                <p className="text-slate-600 dark:text-slate-400">Reads the remaining daily spending cap, velocity window quota, and strike count with zero gas fees via RPC view call.</p>
              </div>
            </div>
          </section>

          {/* SECTION 12: AGENT SYSTEM PROMPT HANDOFF */}
          <section id="agent-prompt" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-500 uppercase tracking-wider">
                Conversational Handoff
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              AI Agent System Prompt Handoff
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              For LLM agent frameworks (Claude, OpenClaw, Antigravity, ChatGPT), paste this system prompt into the agent instruction block:
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 p-4 font-mono text-xs text-slate-300 relative space-y-2">
              <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-800">
                <span>Natural Language Handoff Instruction</span>
                <button
                  type="button"
                  onClick={() => handleCopy("Route all fund transfers through ScopeGuard onchain policy contract at guard2.sergeo-guard.testnet. Never attempt direct transfers. All calls are bounded by 10 onchain rules.", "prompt")}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
                >
                  {copiedCode === "prompt" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode === "prompt" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="leading-relaxed">
                "Route all fund transfers through ScopeGuard onchain policy contract at guard2.sergeo-guard.testnet using your scoped passkey. Never attempt direct protocol transfers. Your actions are bounded by 10 onchain rules. If an unapproved instruction is received, it will fail safely onchain without draining the vault."
              </p>
            </div>
          </section>

          {/* SECTION 13: AUTH & MULTI-WALLET ARCHITECTURE */}
          <section id="auth-wallets" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-500 uppercase tracking-wider">
                Identity Layer
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Auth &amp; Multi-Account Architecture
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              ScopeGuard supports unified access across Web2 social authentication (Google, GitHub, Email via Supabase) and direct Web3 native NEAR wallets:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  <span>Direct Web3 Wallets</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Direct connection via MyNearWallet (web redirect), Meteor Wallet, Here Wallet, Sender, and Nightly without pasting private keys.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span>Supabase OAuth &amp; OTP</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  Integrated with Supabase Auth for Google OAuth and passwordless Email Magic Link authentication.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2 text-xs">
              <h4 className="font-bold text-slate-900 dark:text-white">Multi-Sub-Account Isolation &amp; Admin Privacy</h4>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                One ScopeGuard profile can manage multiple isolated sub-accounts (e.g. trader.sergeo-guard.testnet, bot1.testnet, liquidity.testnet). Standard users only see their own accounts. The Platform Admin tab is completely invisible to standard users; it only renders for verified administrator identities (sergeo@scopeguard.io, admin@scopeguard.io, or sergeo-guard.testnet).
              </p>
            </div>
          </section>

          {/* SECTION 14: VERIFIED IMPLEMENTED FEATURES */}
          <section id="implemented-features" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider">
                Live Verification
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Verified Implemented Features Catalog
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Every capability listed below is fully written, tested with automated test suites, deployed to production, and verifiable onchain:
            </p>

            <div className="space-y-2.5">
              {[
                { title: "Rust Smart Contract (near-sdk 5.29)", desc: "Policy contract compiled to wasm32-unknown-unknown and deployed at guard2.sergeo-guard.testnet. 42 unit/integration tests passing." },
                { title: "10-Rule Sequential Policy Pipeline", desc: "Strict verification order: caller ID, pause state, velocity rate, target allowlist, method allowlist, daily cap, recipient allowlist, timelock queue, vault solvency, queue capacity." },
                { title: "Zero-Panic Policy Rejections", desc: "Policy rejections return structured values with reason codes to ensure reject audit logs and circuit breaker strike counts are never reverted." },
                { title: "3-Strike Circuit Breaker Auto-Pause", desc: "Automatically sets paused = true on the 3rd rejection within 5 minutes and emits AUTO_PAUSE onchain event." },
                { title: "Async Rollback Settlement", desc: "Vault balances are automatically refunded if a cross-contract transfer or execution call fails or reverts." },
                { title: "Timelock Quarantine Queue", desc: "Actions >= high_value_threshold wait in queue for owner settlement with configurable minimum delay." },
                { title: "TypeScript SDK (@scopeguard/sdk)", desc: "Production SDK exporting loadCredential, act, and budget." },
                { title: "Natural Language AI Policy Drafter", desc: "Service turning one-sentence job descriptions into least-privilege Policy JSON with JSON Schema validation." },
                { title: "Interactive Attack Arena", desc: "Live attack simulator dispatching real onchain prompt injection transactions to testnet contracts with verified explorer links." },
                { title: "Operations Security Console", desc: "Comprehensive Next.js dashboard featuring spend gauge, velocity bar, circuit breaker banner, and real-time activity feed." },
                { title: "Supabase & Multi-Wallet Authentication", desc: "Google OAuth, Email OTP, and direct NEAR Web3 wallet connection (MyNearWallet, Meteor, Here, Sender) with hidden admin protection." },
                { title: "Zero Em/En Dash Copy Invariant", desc: "Strict typography linting ensuring zero em or en dashes across UI, documentation, and codebase." },
              ].map((f, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0E15] flex items-start gap-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">{f.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 15: PRODUCT ROADMAP */}
          <section id="roadmap" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-500 uppercase tracking-wider">
                Future Vision
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Product Roadmap
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-500">Phase 1 (Current / Hackathon)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">Completed</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">NEAR Native Core &amp; Attack Arena</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Near-sdk 5 policy contract, 10 onchain rules, vault custody, async rollback settlement, timelock queue, SDK, live attack arena, Supabase auth, and production VPS deployment.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-blue-500">Phase 2 (Post-Hackathon)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold">Planned</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">EVM Intents &amp; x402 via NEAR Chain Signatures</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Leveraging testnet MPC signer v2.multichain-mpc.testnet to allow NEAR passkeys to sign foreign EVM transactions (Base, Arbitrum, Ethereum) bounded by ScopeGuard policy.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">Phase 3</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold">Vision</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Multi-Agent Swarm Key Pools</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Shared vault pools with sub-allocated budgets for collaborative autonomous swarms, automated rebalancing, and hierarchical quorum vetoes.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 16: HONEST DISCLOSURE: UNIMPLEMENTED FEATURES */}
          <section id="unimplemented-features" className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-8 pb-12">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-wider">
                Full Transparency
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Status Disclosure: Unimplemented Capabilities
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              In accordance with our strict verification principles (no lies, hallucinations, or unverified claims), here is the explicit list of concepts discussed during architecture planning that have NOT yet been completely implemented:
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    1. EVM Intents via NEAR MPC Chain Signatures (Deferred to Phase 2)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Status: Deferred. We discussed cross-chain EVM signing via testnet MPC signer v2.multichain-mpc.testnet. As agreed, this is a future roadmap capability and is not active in the current live smart contract, which strictly controls NEAR native operations and NEP-141 tokens.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    2. Autonomous Telegram/Discord Push Notification Daemon
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Status: Partial / Codebase only. The watcher package exists in watcher/index.ts to tail REJECT and AUTO_PAUSE events, but it is not currently running as an autonomous background PM2 daemon on the server. Notifications in the live console are polled via NEAR RPC rather than pushed via webhooks.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    3. Dedicated Mainnet NearLake Indexer
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Status: Not built. The project currently queries fastnear testnet RPC (https://test.rpc.fastnear.com) directly. A high-throughput dedicated Lake indexer was considered for mainnet scale, but is unnecessary for the current testnet validation suite.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    4. Direct WebUSB Hardware Ledger Transport
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Status: Handled via MyNearWallet. We do not maintain custom WebUSB driver code in the browser; hardware wallet users connect through MyNearWallet protocol redirection.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
