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
  dailyCap = 500,
  policyJson,
}) => {
  const [keyData, setKeyData] = useState<StoredSubWalletKey | null>(null);
  const [revealKey, setRevealKey] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"keys" | "commands" | "config">("keys");

  const guardId = tryGetPolicyContractId() || "scopeguard.testnet";
  const effectiveOwner =
    ownerAccount || process.env.NEXT_PUBLIC_OWNER_ACCOUNT_ID || "sergeo-guard.testnet";

  useEffect(() => {
    if (isOpen && agentAccount) {
      const stored = getSubWalletKey(agentAccount);
      setKeyData(stored);
      setRevealKey(false);
      setCopiedSection(null);
      setManualInput("");
    }
  }, [isOpen, agentAccount]);

  if (!isOpen || !agentAccount) return null;

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => {
      setCopiedSection((prev) => (prev === section ? null : prev));
    }, 2000);
  };

  const handleGenerateKey = () => {
    const generated = generateAndSaveSubWalletKey(agentAccount, effectiveOwner, dailyCap);
    setKeyData(generated);
    setRevealKey(true);
  };

  const handleSaveManualKey = () => {
    if (!manualInput.trim()) return;
    const cleanKey = manualInput.trim();
    const saved = saveSubWalletKey(agentAccount, {
      privateKey: cleanKey,
      ownerAccount: effectiveOwner,
      dailyCap,
    });
    setKeyData(saved);
    setManualInput("");
  };

  const privKey = keyData?.privateKey || "";
  const pubKey = keyData?.publicKey || "<AGENT_PUBLIC_KEY>";
  const maskedKey = privKey ? "ed25519:••••••••••••••••••••••••••••••••••••••••••••" : "";

  const cliCommands = `# 1. Register agent policy on Guard contract
near call ${guardId} register_agent '{"agent_account":"${agentAccount}","policy":${
    policyJson ? JSON.stringify(policyJson) : `{"token":"sergeo-guard-token.testnet","daily_cap":${dailyCap},"targets":{"sergeo-guard-dex.testnet":["swap"]}}`
  }}' --accountId ${effectiveOwner} --gas 100000000000000

# 2. Add scoped function-call passkey to agent account
near add-key ${agentAccount} ${pubKey} --contractId ${guardId} --methodNames execute --allowance 0.25 --accountId ${agentAccount}`;

  const envExports = `export SCOPEGUARD_AGENT_ACCOUNT="${agentAccount}"
export SCOPEGUARD_AGENT_PRIVATE_KEY="${privKey || "<AGENT_PRIVATE_KEY>"}"
export SCOPEGUARD_POLICY_CONTRACT="${guardId}"
export NEAR_NETWORK="testnet"
export NEAR_RPC_URL="https://test.rpc.fastnear.com"`;

  const agentJsonConfig = JSON.stringify(
    {
      agentAccountId: agentAccount,
      policyContractId: guardId,
      publicKey: pubKey,
      privateKey: privKey || "<AGENT_PRIVATE_KEY>",
      networkId: "testnet",
      nodeUrl: "https://test.rpc.fastnear.com",
      dailyCap: Number(dailyCap) || 500,
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

      <div className="relative w-full max-w-2xl bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sub-Wallet Passkey & Commands
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  FunctionCall Key
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
            onClick={() => setActiveTab("commands")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "commands"
                ? "border-brand-blue text-brand-blue"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CLI Setup Commands</span>
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
          {/* TAB 1: PASSKEY CREDENTIALS */}
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
              {pubKey && pubKey !== "<AGENT_PUBLIC_KEY>" && (
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

          {/* TAB 2: CLI SETUP COMMANDS */}
          {activeTab === "commands" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Run these official NEAR CLI commands from your terminal to verify or attach the key:
                </p>
                <button
                  type="button"
                  onClick={() => handleCopy(cliCommands, "commands")}
                  className="px-3 py-1 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  {copiedSection === "commands" ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Commands</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-slate-900 dark:bg-black text-slate-200 font-mono text-xs overflow-x-auto border border-slate-700/60 whitespace-pre-wrap leading-relaxed select-all">
                {cliCommands}
              </pre>
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
        <div className="p-4 bg-slate-50 dark:bg-obsidian-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Keys are stored securely in local browser storage and scoped onchain to Guard execute.
          </span>
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
