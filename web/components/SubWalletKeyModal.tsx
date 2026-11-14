"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Terminal,
  FileCode,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ExternalLink,
  MessageSquareCode,
  ChevronDown,
  Download,
} from "lucide-react";
import {
  getSubWalletKey,
  saveSubWalletKey,
  generateAndSaveSubWalletKey,
  StoredSubWalletKey,
} from "@/lib/subwallet-keys";
import { tryGetPolicyContractId } from "@/lib/config";

export interface SubWalletKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentAccount: string;
  ownerAccount?: string;
  dailyCap?: number | string;
  policyJson?: any;
}

export const SubWalletKeyModal: React.FC<SubWalletKeyModalProps> = ({
  isOpen,
  onClose,
  agentAccount,
  ownerAccount,
  dailyCap,
  policyJson,
}) => {
  const [keyData, setKeyData] = useState<StoredSubWalletKey | null>(null);
  const [liveDailyCap, setLiveDailyCap] = useState<number | null>(null);
  const [revealKey, setRevealKey] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"prompt" | "keys" | "config">("prompt");
  const [showQuickCli, setShowQuickCli] = useState<boolean>(false);

  const guardId = tryGetPolicyContractId() || "scopeguard.testnet";
  const effectiveOwner =
    ownerAccount || process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet";

  // Load sub-wallet key data
  useEffect(() => {
    if (isOpen && agentAccount) {
      const stored = getSubWalletKey(agentAccount, effectiveOwner, dailyCap);
      setKeyData(stored);
      setRevealKey(false);
      setCopiedSection(null);
      setManualInput("");
    }
  }, [isOpen, agentAccount, effectiveOwner, dailyCap]);

  // Fetch live onchain budget directly from NEAR Testnet RPC
  useEffect(() => {
    if (!isOpen || !agentAccount) return;
    let isMounted = true;

    async function fetchLiveBudget() {
      try {
        const res = await fetch("https://test.rpc.fastnear.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "1",
            method: "query",
            params: {
              request_type: "call_function",
              finality: "final",
              account_id: guardId,
              method_name: "get_budget",
              args_base64: btoa(JSON.stringify({ agent_account: agentAccount })),
            },
          }),
        });
        const data = await res.json();
        if (data.result?.result) {
          const raw = JSON.parse(
            new TextDecoder().decode(new Uint8Array(data.result.result))
          );
          if (isMounted && raw.cap !== undefined && raw.cap !== null) {
            setLiveDailyCap(Number(raw.cap));
          }
        }
      } catch (err) {
        console.warn("Could not query live onchain budget for agent:", err);
      }
    }

    fetchLiveBudget();
    return () => {
      isMounted = false;
    };
  }, [isOpen, agentAccount, guardId]);

  if (!isOpen || !agentAccount) return null;

  const effectiveDailyCap =
    liveDailyCap !== null
      ? liveDailyCap
      : keyData?.dailyCap
      ? Number(keyData.dailyCap)
      : dailyCap
      ? Number(dailyCap)
      : 25;

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => {
      setCopiedSection((prev) => (prev === section ? null : prev));
    }, 2000);
  };

  const handleGenerateKey = () => {
    const generated = generateAndSaveSubWalletKey(agentAccount, effectiveOwner, effectiveDailyCap);
    setKeyData(generated);
    setRevealKey(true);
  };

  const handleSaveManualKey = () => {
    if (!manualInput.trim()) return;
    const cleanKey = manualInput.trim();
    const saved = saveSubWalletKey(agentAccount, {
      privateKey: cleanKey,
      ownerAccount: effectiveOwner,
      dailyCap: effectiveDailyCap,
    });
    setKeyData(saved);
    setManualInput("");
  };

  const privKey =
    keyData?.privateKey ||
    "ed25519:4cYFpiPQreZa5GtLybDSiYH8n9pjEBhdT47CQ1Gybr5fZwzDonZNQaoFykpED4jrMsesccmsPTuP33depZ3md2Cg";
  const pubKey =
    keyData?.publicKey ||
    "ed25519:24M44drzfm6qdexJqtxLU6MuhV5ymtwfeeipGcMp36dE";
  const maskedKey = privKey ? "ed25519:••••••••••••••••••••••••••••••••••••••••••••" : "";

  let queryBase64 = "eyJhZ2VudF9hY2NvdW50IjoiYWdlbnQuYmxja2ZtZS50ZXN0bmV0In0=";
  try {
    if (typeof window !== "undefined") {
      queryBase64 = btoa(JSON.stringify({ agent_account: agentAccount }));
    }
  } catch {}

  const cliCommands = `# 1. Register agent policy on Guard contract
near call ${guardId} register_agent '{"agent_account":"${agentAccount}","policy":${
    policyJson
      ? JSON.stringify(policyJson)
      : `{"token":"sergeo-guard-token.testnet","daily_cap":${effectiveDailyCap},"targets":{"sergeo-guard-dex.testnet":["swap"]}}`
  }}' --accountId ${effectiveOwner} --gas 100000000000000

# 2. Add scoped function-call passkey to agent account
near add-key ${agentAccount} ${pubKey} --contractId ${guardId} --methodNames execute --allowance 0.25 --accountId ${agentAccount}`;

  const agentSetupPrompt = `INSTRUCTION FOR AI AGENT (Claude Code, OpenCode, Cursor, AutoGPT):
Execute the setup steps below immediately. Do not ask questions, do not prompt the user for choices, and do not wait for confirmation.
Once setup is complete, respond ONLY with: "set and ready".

=== SCOPEGUARD AGENT CREDENTIALS & ONCHAIN TARGETS ===
- Agent Account: ${agentAccount}
- Owner Account: ${effectiveOwner}
- Network: NEAR Testnet (Fast RPC: https://test.rpc.fastnear.com)
- Policy Guard Contract: ${guardId}
- Custody Token (mUSD): sergeo-guard-token.testnet
- DEX Swap Target: sergeo-guard-dex.testnet
- Daily Spend Limit: ${effectiveDailyCap} mUSD
- Scoped Public Key: ${pubKey}
- Scoped Private Key: ${privKey}

=== SETUP STEP 1: WRITE CONFIGURATION FILES ===
Write the following configuration to file \`./agent.json\`:
{
  "agentAccountId": "${agentAccount}",
  "policyContractId": "${guardId}",
  "publicKey": "${pubKey}",
  "privateKey": "${privKey}",
  "networkId": "testnet",
  "nodeUrl": "https://test.rpc.fastnear.com",
  "dailyCap": ${effectiveDailyCap},
  "token": "sergeo-guard-token.testnet",
  "dex": "sergeo-guard-dex.testnet"
}

Write or append the following environment variables to file \`./.env\`:
SCOPEGUARD_AGENT_ACCOUNT="${agentAccount}"
SCOPEGUARD_AGENT_PRIVATE_KEY="${privKey}"
SCOPEGUARD_POLICY_CONTRACT="${guardId}"
NEAR_NETWORK="testnet"
NEAR_RPC_URL="https://test.rpc.fastnear.com"

=== SETUP STEP 2: VERIFY CONNECTION ===
Verify live budget and policy connectivity via RPC:
curl -s -X POST https://test.rpc.fastnear.com -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":"1","method":"query","params":{"request_type":"call_function","finality":"final","account_id":"${guardId}","method_name":"get_budget","args_base64":"${queryBase64}"}}'

=== HOW TO EXECUTE OPERATIONS ===
You hold a scoped function-call key. All onchain actions MUST be dispatched through ${guardId}::execute.

1. TRADING / SWAPPING (DEX):
near call ${guardId} execute '{"action":{"ContractCall":{"target":"sergeo-guard-dex.testnet","method":"swap","args":"eyJhZ2VudF9zd2FwIjogdHJ1ZX0=","deposit":"0","gas":"30000000000000"}}}' --accountId ${agentAccount} --gas 100000000000000

2. SENDING / PAYMENTS (Token Transfer):
near call ${guardId} execute '{"action":{"Transfer":{"token":"sergeo-guard-token.testnet","to":"<RECIPIENT>","amount":"<AMOUNT_WHOLE_MUSD>","memo":"Payment"}}}' --accountId ${agentAccount} --gas 100000000000000

3. CHECK REMAINING DAILY BUDGET:
near view ${guardId} get_budget '{"agent_account":"${agentAccount}"}'

=== COMPLETION ===
Perform Step 1 and Step 2 right now, then reply ONLY with: "set and ready".`;

  const handleDownloadPrompt = () => {
    const blob = new Blob([agentSetupPrompt], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-setup-${agentAccount}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const envExports = `export SCOPEGUARD_AGENT_ACCOUNT="${agentAccount}"
export SCOPEGUARD_AGENT_PRIVATE_KEY="${privKey}"
export SCOPEGUARD_POLICY_CONTRACT="${guardId}"
export NEAR_NETWORK="testnet"
export NEAR_RPC_URL="https://test.rpc.fastnear.com"`;

  const agentJsonConfig = JSON.stringify(
    {
      agentAccountId: agentAccount,
      policyContractId: guardId,
      publicKey: pubKey,
      privateKey: privKey,
      networkId: "testnet",
      nodeUrl: "https://test.rpc.fastnear.com",
      dailyCap: effectiveDailyCap,
      token: "sergeo-guard-token.testnet",
      dex: "sergeo-guard-dex.testnet",
      query_live_rules_url: `https://scopeguard.blockframe.cloud/api/agents?agent=${agentAccount}`,
    },
    null,
    2
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-3xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Agent Passkey & Setup Prompt
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Daily Cap: {effectiveDailyCap} mUSD
                </span>
              </div>
              <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-md">
                {agentAccount}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-obsidian-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-5 pt-2 bg-slate-50/50 dark:bg-obsidian-950/40">
          <button
            type="button"
            onClick={() => setActiveTab("prompt")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "prompt"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <MessageSquareCode className="w-3.5 h-3.5" />
            <span>Agent Setup Prompt</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "keys"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Passkey Credentials</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "config"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Agent JSON & Env</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* TAB 1: AGENT SETUP PROMPT */}
          {activeTab === "prompt" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Instant Agent Handoff Prompt</span>
                  </h4>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Paste into Claude Code, OpenCode, Cursor, or any agent. It writes configs, connects, and replies &quot;set and ready&quot;.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadPrompt}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-obsidian-900 hover:bg-slate-50 dark:hover:bg-obsidian-850 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    title="Download prompt as markdown file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(agentSetupPrompt, "prompt")}
                    className="px-3.5 py-1.5 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    {copiedSection === "prompt" ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-mint-green" />
                        <span>Copied Prompt!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Agent Setup Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 dark:bg-black text-slate-200 font-mono text-xs overflow-x-auto border border-slate-700/60 whitespace-pre-wrap leading-relaxed select-all max-h-[440px] overflow-y-auto">
                  {agentSetupPrompt}
                </pre>
              </div>

              {/* Collapsible Quick CLI Commands */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowQuickCli(!showQuickCli)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-obsidian-950 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-obsidian-900 transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Quick Terminal Commands (NEAR CLI)</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                      showQuickCli ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showQuickCli && (
                  <div className="p-3.5 bg-white dark:bg-obsidian-900 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">Run directly from your terminal:</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(cliCommands, "commands")}
                        className="text-xs font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedSection === "commands" ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Commands</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="p-2.5 rounded-lg bg-slate-900 dark:bg-black text-slate-200 font-mono text-[11px] overflow-x-auto border border-slate-700/60 whitespace-pre-wrap select-all">
                      {cliCommands}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PASSKEY CREDENTIALS */}
          {activeTab === "keys" && (
            <div className="space-y-4">
              {/* Private Key Box */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Scoped Agent Private Key (Passkey)
                    </span>
                    <span className="text-[10px] text-slate-500">ed25519</span>
                  </div>
                  {privKey && (
                    <button
                      type="button"
                      onClick={() => setRevealKey(!revealKey)}
                      className="text-xs font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {revealKey ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Reveal</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {privKey ? (
                  <>
                    <div className="p-2.5 rounded-lg bg-slate-900 dark:bg-black text-slate-200 font-mono text-xs break-all select-all border border-slate-700/60">
                      {revealKey ? privKey : maskedKey}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[11px] text-slate-500">
                        Give this key to your autonomous agent runtime. It is scoped strictly to Guard execute.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(privKey, "privkey")}
                        className="px-3 py-1 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        {copiedSection === "privkey" ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Private Key</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      No private passkey is saved locally in this browser for {agentAccount}.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleGenerateKey}
                        className="px-3.5 py-2 rounded-xl bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate & Save Fresh Passkey</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                      <span className="text-[11px] text-slate-500">Or paste an existing private key to save it:</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualInput}
                          onChange={(e) => setManualInput(e.target.value)}
                          placeholder="ed25519:..."
                          className="flex-1 px-3 py-1.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={handleSaveManualKey}
                          disabled={!manualInput.trim()}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Public Key Box */}
              {pubKey && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-obsidian-950 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Passkey Public Key
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(pubKey, "pubkey")}
                      className="text-xs font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedSection === "pubkey" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 dark:bg-black text-slate-200 font-mono text-xs break-all select-all border border-slate-700/60">
                    {pubKey}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AGENT CONFIG & ENV */}
          {activeTab === "config" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Environment Variables (.env)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(envExports, "env")}
                    className="text-xs font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "env" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Env</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 dark:bg-black text-slate-200 font-mono text-xs overflow-x-auto border border-slate-700/60 whitespace-pre-wrap select-all">
                  {envExports}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Agent Credentials JSON (./agent.json)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(agentJsonConfig, "json")}
                    className="text-xs font-semibold text-brand-blue hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSection === "json" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 dark:bg-black text-slate-200 font-mono text-xs overflow-x-auto border border-slate-700/60 whitespace-pre-wrap select-all">
                  {agentJsonConfig}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-obsidian-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Scoped for autonomous execution without full custody risk</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-800 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
