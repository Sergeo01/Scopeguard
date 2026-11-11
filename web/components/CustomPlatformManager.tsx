"use client";

import React, { useState } from "react";
import { Plus, Trash2, Shield, Check, X, Code2, Globe, AlertCircle } from "lucide-react";

export interface ConfiguredPlatform {
  id: string;
  contract: string;
  methods: string;
  label?: string;
  isPreset?: boolean;
}

const COMMON_NEAR_METHODS = [
  "swap",
  "deposit",
  "stake",
  "storage_deposit",
  "near_deposit",
  "execute",
];

interface CustomPlatformManagerProps {
  platforms: ConfiguredPlatform[];
  onAddCustomPlatform: (platform: { contract: string; methods: string; label?: string }) => void;
  onRemovePlatform: (id: string) => void;
  onUpdatePlatformMethods: (id: string, methods: string) => void;
}

export const CustomPlatformManager: React.FC<CustomPlatformManagerProps> = ({
  platforms,
  onAddCustomPlatform,
  onRemovePlatform,
  onUpdatePlatformMethods,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [customContract, setCustomContract] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [selectedMethods, setSelectedMethods] = useState<string[]>(["swap"]);
  const [customMethodInput, setCustomMethodInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const toggleMethod = (method: string) => {
    if (selectedMethods.includes(method)) {
      if (selectedMethods.length > 1) {
        setSelectedMethods(selectedMethods.filter((m) => m !== method));
      }
    } else {
      setSelectedMethods([...selectedMethods, method]);
    }
  };

  const handleAddCustomMethod = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = customMethodInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!selectedMethods.includes(trimmed)) {
      setSelectedMethods([...selectedMethods, trimmed]);
    }
    setCustomMethodInput("");
  };

  const validateContract = (address: string): boolean => {
    const clean = address.trim();
    if (!clean) return false;
    // NEAR account IDs: alphanumeric with . or _ or -, 2 to 64 chars
    const isValid = /^(([a-z\d]+[\-_])*[a-z\d]+\.)*([a-z\d]+[\-_])*[a-z\d]+$/.test(clean);
    return isValid && clean.length >= 2 && clean.length <= 64;
  };

  const handleSavePlatform = () => {
    setErrorMsg("");
    const contractClean = customContract.trim().toLowerCase();

    if (!contractClean) {
      setErrorMsg("Please enter a target contract ID.");
      return;
    }

    if (!validateContract(contractClean)) {
      setErrorMsg("Contract ID must be a valid NEAR account (e.g. app.testnet or contract.near).");
      return;
    }

    if (platforms.some((p) => p.contract.toLowerCase() === contractClean)) {
      setErrorMsg("This contract address is already allowlisted in your policy.");
      return;
    }

    if (selectedMethods.length === 0) {
      setErrorMsg("At least one allowed method must be selected.");
      return;
    }

    onAddCustomPlatform({
      contract: contractClean,
      methods: selectedMethods.join(", "),
      label: customLabel.trim() || undefined,
    });

    // Reset form
    setCustomContract("");
    setCustomLabel("");
    setSelectedMethods(["swap"]);
    setCustomMethodInput("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
      {/* Section Header with Direct Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
              Active Allowed Platforms ({platforms.length})
            </label>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Only smart contracts and methods allowlisted here can be called by this agent passkey.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-xl border border-blue-200/60 dark:border-blue-800/40 transition shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Protocol</span>
          </button>
        )}
      </div>

      {/* Interactive Custom Protocol Builder Drawer */}
      {isAdding && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-blue-200 dark:border-blue-900/50 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Add Custom Protocol Allowance
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contract Address Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
                Target Contract ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={customContract}
                onChange={(e) => {
                  setCustomContract(e.target.value);
                  if (errorMsg) setErrorMsg("");
                }}
                placeholder="e.g. app.my-defi.testnet or dex.near"
                className="w-full px-3 py-2 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">
                {customContract && validateContract(customContract) ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check className="w-3 h-3" /> Valid NEAR address format
                  </span>
                ) : (
                  "Standard NEAR account name (e.g. protocol.near)"
                )}
              </span>
            </div>

            {/* Protocol Nickname / Label */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
                Protocol Nickname (Optional)
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Arbitrage Vault, Lending Pool"
                className="w-full px-3 py-2 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                A human-friendly name for this target
              </span>
            </div>
          </div>

          {/* Methods Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 block">
              Authorized Method Names <span className="text-rose-500">*</span>
            </label>

            {/* Quick Pick Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                Quick-Select Common Methods:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_NEAR_METHODS.map((method) => {
                  const isChecked = selectedMethods.includes(method);
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => toggleMethod(method)}
                      className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 border ${
                        isChecked
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-white dark:bg-obsidian-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-obsidian-800"
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3" />}
                      <span>{method}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Method Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customMethodInput}
                onChange={(e) => setCustomMethodInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomMethod();
                  }
                }}
                placeholder="Type other method (e.g. rebalance_pool) and press Enter"
                className="flex-1 px-3 py-1.5 bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleAddCustomMethod()}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-obsidian-800 hover:bg-slate-300 dark:hover:bg-obsidian-700 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                + Add
              </button>
            </div>

            {/* Selected Active Methods Chips */}
            <div className="pt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                Methods Included ({selectedMethods.length}):
              </span>
              {selectedMethods.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 font-mono text-[11px] font-semibold"
                >
                  <span>{m}</span>
                  {selectedMethods.length > 1 && (
                    <button
                      type="button"
                      onClick={() => toggleMethod(m)}
                      className="hover:text-rose-600 transition cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              {errorMsg}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePlatform}
                disabled={!customContract.trim()}
                title={!customContract.trim() ? "Enter a target contract ID to enable allowlist button" : "Allowlist this protocol"}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 ${
                  !customContract.trim()
                    ? "bg-blue-600/50 opacity-50 cursor-not-allowed border border-rose-500/40"
                    : "bg-blue-600 hover:bg-blue-500 cursor-pointer"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Allowlist This Protocol</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
            {!customContract.trim() && (
              <span className="text-[11px] text-rose-500 dark:text-rose-400 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Target contract ID is required</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Active Platforms List Cards */}
      <div className="space-y-2">
        {platforms.map((p, idx) => {
          const methodList = p.methods
            .split(",")
            .map((m) => m.trim())
            .filter((m) => m.length > 0);

          return (
            <div
              key={p.id}
              className="p-3.5 bg-slate-50 dark:bg-obsidian-950 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2 text-xs transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-slate-200/70 dark:bg-obsidian-850 text-slate-700 dark:text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">
                        {p.label || p.contract}
                      </span>
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-obsidian-800 text-slate-600 dark:text-slate-400">
                        {p.isPreset ? "Preset" : "Custom Protocol"}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block font-medium">
                      {p.contract}
                    </span>
                  </div>
                </div>

                {platforms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemovePlatform(p.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                    title="Remove protocol from allowlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Methods Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  <span>Methods:</span>
                </span>
                {methodList.map((m) => (
                  <span
                    key={m}
                    className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-white dark:bg-obsidian-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-2xs"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
