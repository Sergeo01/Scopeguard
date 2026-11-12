"use client";

import React, { useState } from "react";
import { X, Sliders, Zap, RefreshCw, Check, Copy, Shield, AlertCircle, AlertTriangle } from "lucide-react";

export interface PolicyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editDailyCap: number;
  setEditDailyCap: (v: number) => void;
  editVelocityMax: number;
  setEditVelocityMax: (v: number) => void;
  editTargets: string;
  setEditTargets: (v: string) => void;
  editRecipients: string;
  setEditRecipients: (v: string) => void;
  editCanaryMethods: string;
  setEditCanaryMethods: (v: string) => void;
  editMaxDrawdown: number | "";
  setEditMaxDrawdown: (v: number | "") => void;
  editIntentRecipients: string;
  setEditIntentRecipients: (v: string) => void;
  editNearDailyCap: string;
  setEditNearDailyCap: (v: string) => void;
  editNearHighValueThreshold: string;
  setEditNearHighValueThreshold: (v: string) => void;
  isWalletConnected: boolean;
  connectedWalletId?: string | null;
  ownerId?: string | null;
  agentId: string;
  guardId: string;
  policy: any;
  handleSavePolicyOnchain: () => void;
  isSigningPolicy: boolean;
  policyUpdateTxHash: string | null;
  policyUpdateError: string | null;
  openAuthModal?: () => void;
}

export function PolicyEditorModal({
  isOpen,
  onClose,
  editDailyCap,
  setEditDailyCap,
  editVelocityMax,
  setEditVelocityMax,
  editTargets,
  setEditTargets,
  editRecipients,
  setEditRecipients,
  editCanaryMethods,
  setEditCanaryMethods,
  editMaxDrawdown,
  setEditMaxDrawdown,
  editIntentRecipients,
  setEditIntentRecipients,
  editNearDailyCap,
  setEditNearDailyCap,
  editNearHighValueThreshold,
  setEditNearHighValueThreshold,
  isWalletConnected,
  connectedWalletId,
  ownerId,
  agentId,
  guardId,
  policy,
  handleSavePolicyOnchain,
  isSigningPolicy,
  policyUpdateTxHash,
  policyUpdateError,
  openAuthModal,
}: PolicyEditorModalProps) {
  const [copiedPolicyCmd, setCopiedPolicyCmd] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-obsidian-900 border border-slate-200 dark:border-obsidian-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-obsidian-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-blue" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Edit Onchain Guard Policy
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Reconfigures spend caps, velocity limits, targets, and allowlists. Policy changes are staged onchain with a mandatory delay before becoming active.
        </p>

        {/* Daily Cap (mUSD Tokens) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Token Daily Spending Cap (mUSD)</span>
            <span className="text-[11px] font-mono text-mint-greenDark dark:text-mint-green font-bold">
              {editDailyCap} mUSD Max
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              value={editDailyCap}
              onChange={(e) => setEditDailyCap(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[100, 250, 500, 1000, 2500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setEditDailyCap(amt)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition cursor-pointer ${
                  editDailyCap === amt
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-slate-100 dark:bg-obsidian-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-obsidian-700 hover:border-brand-blue"
                }`}
              >
                {amt} mUSD
              </button>
            ))}
          </div>

          {/* Onchain Invariant Parameters */}
          <div className="p-3 mt-2 rounded-xl bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Onchain Settlement Rules</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue">Active Invariants</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-obsidian-800">
                <span className="text-[10px] text-slate-400 block font-sans">High-Value Threshold</span>
                <span className="font-bold text-slate-900 dark:text-white">{policy?.high_value_threshold || 250} mUSD</span>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-obsidian-900 border border-slate-200/80 dark:border-obsidian-800">
                <span className="text-[10px] text-slate-400 block font-sans">Timelock Delay</span>
                <span className="font-bold text-slate-900 dark:text-white">{policy?.high_value_delay_seconds || 60}s quarantine</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 font-sans">Allowed Methods: </span>
              <code className="text-[10px] font-mono text-brand-blue bg-brand-blue/5 px-1 py-0.5 rounded">ft_transfer</code>,{" "}
              <code className="text-[10px] font-mono text-brand-blue bg-brand-blue/5 px-1 py-0.5 rounded">swap</code>,{" "}
              <code className="text-[10px] font-mono text-brand-blue bg-brand-blue/5 px-1 py-0.5 rounded">execute_intent</code>
            </div>
          </div>
        </div>

        {/* Native NEAR Daily Budget (Separate Cap) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Native NEAR Daily Cap (yoctoNEAR integer)</span>
            <span className="text-[11px] font-mono text-brand-blue font-bold">
              {editNearDailyCap ? `${editNearDailyCap} yocto` : "Disabled (Fail Closed)"}
            </span>
          </label>
          <input
            type="text"
            placeholder="1000000000000000000000000 (1 NEAR in yoctoNEAR)"
            value={editNearDailyCap}
            onChange={(e) => setEditNearDailyCap(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: "1 NEAR", val: "1000000000000000000000000" },
              { label: "5 NEAR", val: "5000000000000000000000000" },
              { label: "10 NEAR", val: "10000000000000000000000000" },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setEditNearDailyCap(item.val)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition cursor-pointer ${
                  editNearDailyCap === item.val
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-slate-100 dark:bg-obsidian-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-obsidian-700 hover:border-brand-blue"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEditNearDailyCap("")}
              className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Native NEAR Timelock Threshold */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Native NEAR Timelock Threshold (yoctoNEAR)</span>
            <span className="text-[11px] font-mono text-slate-400">Optional Quarantine</span>
          </label>
          <input
            type="text"
            placeholder="500000000000000000000000 (0.5 NEAR)"
            value={editNearHighValueThreshold}
            onChange={(e) => setEditNearHighValueThreshold(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Velocity Throttle */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Velocity Rate Limit (Actions / 10 Minutes)</span>
            <span className="text-[11px] font-mono text-brand-blue font-bold">
              {editVelocityMax} Actions Max
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="100"
              value={editVelocityMax}
              onChange={(e) => setEditVelocityMax(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[3, 5, 10, 20, 50].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setEditVelocityMax(v)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition cursor-pointer ${
                  editVelocityMax === v
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-slate-100 dark:bg-obsidian-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-obsidian-700 hover:border-brand-blue"
                }`}
              >
                {v} actions
              </button>
            ))}
          </div>
        </div>

        {/* Allowlisted Target Contracts */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Allowlisted Target Contracts
            </label>
            {!editTargets.trim() ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Target Required
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Comma-separated</span>
            )}
          </div>
          <input
            type="text"
            placeholder="sergeo-guard-dex.testnet, wrap.testnet"
            value={editTargets}
            onChange={(e) => setEditTargets(e.target.value)}
            className={`w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border font-mono focus:outline-none transition ${
              !editTargets.trim()
                ? "border-rose-500 ring-2 ring-rose-500/30 text-rose-900 dark:text-rose-100"
                : "border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white focus:border-brand-blue"
            }`}
          />
          {!editTargets.trim() && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
              <span>Enter at least one target contract address (e.g. sergeo-guard-dex.testnet)</span>
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: "Testnet DEX", contract: "sergeo-guard-dex.testnet" },
              { label: "Wrapped NEAR", contract: "wrap.testnet" },
              { label: "NEAR Intents (Mock)", contract: "intents.near" },
            ].map((item) => (
              <button
                key={item.contract}
                type="button"
                onClick={() => {
                  const current = editTargets.split(",").map((s) => s.trim()).filter(Boolean);
                  if (!current.includes(item.contract)) {
                    setEditTargets([...current, item.contract].join(", "));
                  }
                }}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-obsidian-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-obsidian-700 hover:border-brand-blue transition cursor-pointer"
              >
                + {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Allowlisted Recipient Accounts */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Allowlisted Recipients (Direct Payouts)</span>
            <span className="text-[11px] text-slate-400">Empty blocks all transfers</span>
          </label>
          <input
            type="text"
            placeholder="bob.testnet, treasury.testnet"
            value={editRecipients}
            onChange={(e) => setEditRecipients(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Canary Decoy Honeypots */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Canary Honeypot Decoy Methods</span>
            <span className="text-[11px] text-slate-400">Trips immediate auto-pause</span>
          </label>
          <input
            type="text"
            placeholder="admin_drain, emergency_withdraw"
            value={editCanaryMethods}
            onChange={(e) => setEditCanaryMethods(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Drawdown Circuit Breaker Floor */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>Drawdown Breaker (Max Loss Floor %)</span>
            <span className="text-[11px] font-mono text-brand-blue font-bold">
              {typeof editMaxDrawdown === "number" && editMaxDrawdown > 0 ? `${editMaxDrawdown}% Floor` : "None"}
            </span>
          </label>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="20 (20% loss from high-water mark pauses agent)"
            value={editMaxDrawdown}
            onChange={(e) => setEditMaxDrawdown(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* IntentShield (targets intents.near) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>IntentShield Allowlist (targets intents.near)</span>
            <span className="text-[11px] text-slate-400">Targets mock contract, not real NEAR Intents</span>
          </label>
          <input
            type="text"
            placeholder="0x1111111111111111111111111111111111111111"
            value={editIntentRecipients}
            onChange={(e) => setEditIntentRecipients(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue"
          />
        </div>

        {/* Action Buttons & Red Blockers Signal */}
        {(() => {
          const isCapValid = typeof editDailyCap === "number" && editDailyCap > 0;
          const isTargetsValid = typeof editTargets === "string" && editTargets.trim().length > 0;
          const isEditorValid = isCapValid && isTargetsValid && !isSigningPolicy;

          const editorBlockers: { field: string; message: string; fix: string }[] = [];
          if (!isCapValid) {
            editorBlockers.push({
              field: "Daily Spending Cap",
              message: "Token daily spending cap must be greater than 0 mUSD.",
              fix: "Enter a positive mUSD amount (e.g. 100) or select one of the preset chips.",
            });
          }
          if (!isTargetsValid) {
            editorBlockers.push({
              field: "Target Platform Contracts",
              message: "At least one target platform contract is required.",
              fix: "Specify a contract account ID (e.g. sergeo-guard-dex.testnet) or click one of the quick add presets.",
            });
          }

          return (
            <div className="pt-2 space-y-2">
              {editorBlockers.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/50 space-y-1.5 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
                  <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Cannot Stage Policy: {editorBlockers.length} Requirement{editorBlockers.length > 1 ? "s" : ""} Missing</span>
                  </div>
                  <ul className="space-y-1 text-[11px]">
                    {editorBlockers.map((b, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="font-bold text-rose-500">•</span>
                        <div>
                          <span className="font-semibold text-rose-800 dark:text-rose-200">{b.field}:</span> {b.message} (Fix: {b.fix})
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {isWalletConnected ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={handleSavePolicyOnchain}
                    disabled={!isEditorValid}
                    title={
                      editorBlockers.length > 0
                        ? `Button locked: ${editorBlockers.map((b) => b.message).join(" | ")}`
                        : "Sign and stage policy update on NEAR"
                    }
                    className={`w-full py-2.5 px-3 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      isEditorValid
                        ? "bg-brand-blue hover:bg-brand-blueHover cursor-pointer shadow-xs"
                        : "bg-brand-blue/50 opacity-50 cursor-not-allowed border border-rose-500/40"
                    }`}
                  >
                    {isSigningPolicy ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting set_policy to NEAR...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>Sign &amp; Stage Policy on NEAR ({connectedWalletId})</span>
                      </>
                    )}
                  </button>
                  {editorBlockers.length > 0 && (
                    <div className="text-[10px] text-rose-500 dark:text-rose-400 font-semibold flex items-center justify-center gap-1 py-0.5">
                      <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                      <span>Resolve {editorBlockers.length} red signal{editorBlockers.length > 1 ? "s" : ""} above to enable button</span>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (openAuthModal) openAuthModal();
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Connect Owner Wallet to Sign on NEAR</span>
                </button>
              )}
            </div>
          );
        })()}

          {policyUpdateTxHash && (
            <div className="p-3 rounded-lg bg-mint-green/10 border border-mint-green/20 text-center space-y-1">
              <p className="text-xs font-semibold text-mint-greenDark dark:text-mint-green">
                Policy update staged on NEAR. Timelock delay initiated.
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Tx: {policyUpdateTxHash}
              </p>
            </div>
          )}

          {policyUpdateError && (
            <p className="text-xs font-mono text-center text-rose-500">
              {policyUpdateError}
            </p>
          )}

        {/* CLI Fallback */}
        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-obsidian-800">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Or run in terminal:</span>
            <button
              type="button"
              onClick={() => {
                const targetsList = editTargets.split(",").map((s) => s.trim()).filter(Boolean);
                const targetsObj: Record<string, string[]> = {};
                for (const t of targetsList) targetsObj[t] = ["swap", "ft_transfer_call"];
                const recList = editRecipients.split(",").map((s) => s.trim()).filter(Boolean);
                const canaryList = editCanaryMethods.split(",").map((s) => s.trim()).filter(Boolean);
                const intentList = editIntentRecipients.split(",").map((s) => s.trim()).filter(Boolean);
                const pol: any = {
                  token: policy?.token || "sergeo-guard-token.testnet",
                  targets: Object.keys(targetsObj).length > 0 ? targetsObj : { "sergeo-guard-dex.testnet": ["swap"] },
                  daily_cap: String(editDailyCap),
                  recipients: recList,
                  max_actions_per_10min: Number(editVelocityMax),
                  auto_pause_rejects: 3,
                  auto_pause_window_minutes: 10,
                  high_value_threshold: "250",
                  high_value_delay_seconds: 60,
                  policy_change_delay_seconds: 60,
                  max_drawdown_bps: typeof editMaxDrawdown === "number" && editMaxDrawdown > 0 ? Math.round(editMaxDrawdown * 100) : null,
                  canary_methods: canaryList,
                  intent_recipients: intentList,
                  near_daily_cap: editNearDailyCap.trim() ? editNearDailyCap.trim() : null,
                  near_high_value_threshold: editNearHighValueThreshold.trim() ? editNearHighValueThreshold.trim() : null,
                };
                const cmd = `near call ${guardId} set_policy '{"agent_account":"${agentId}","policy":${JSON.stringify(pol)}}' --accountId ${connectedWalletId || ownerId} --gas 100000000000000`;
                navigator.clipboard.writeText(cmd);
                setCopiedPolicyCmd(true);
                setTimeout(() => setCopiedPolicyCmd(false), 2000);
              }}
              className="inline-flex items-center gap-1 text-brand-blue font-medium cursor-pointer"
            >
              {copiedPolicyCmd ? <Check className="w-3 h-3 text-mint-green" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPolicyCmd ? "Copied" : "Copy Command"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
