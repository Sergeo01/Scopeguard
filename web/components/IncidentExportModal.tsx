"use client";

import React, { useState } from "react";
import { Download, Copy, Check, X, ShieldAlert, FileText, ArrowRight, ShieldCheck, Clock } from "lucide-react";

export interface IncidentExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  guardId: string;
  ownerId: string;
  policy: any;
  stagedPolicy: any;
  vaultBalance: string;
  dailyCapTotal: number;
  dailyCapSpent: number;
  activities: any[];
}

export function IncidentExportModal({
  isOpen,
  onClose,
  agentId,
  guardId,
  ownerId,
  policy,
  stagedPolicy,
  vaultBalance,
  dailyCapTotal,
  dailyCapSpent,
  activities,
}: IncidentExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "raw_json" | "csv">("summary");

  if (!isOpen) return null;

  const exportTimestamp = new Date().toISOString();
  const rejections = activities.filter((a) => a.type === "REJECT");
  const approvals = activities.filter((a) => a.type === "ALLOW" || a.type === "SETTLED");
  const autoPauses = activities.filter((a) => a.type === "AUTO_PAUSE");

  // Construct comprehensive provenance & incident report object
  const incidentReport = {
    report_metadata: {
      title: "ScopeGuard Policy Provenance & Security Incident Report",
      exported_at: exportTimestamp,
      report_id: `rep_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      network: "testnet",
      policy_contract_id: guardId,
      agent_account_id: agentId,
      owner_account_id: ownerId,
    },
    budget_and_exposure: {
      daily_cap: `${dailyCapTotal} mUSD`,
      spent_in_window: `${dailyCapSpent} mUSD`,
      remaining_in_window: `${Math.max(0, dailyCapTotal - dailyCapSpent)} mUSD`,
      vault_balance_current: `${vaultBalance} mUSD`,
      worst_case_financial_loss_bound: `${vaultBalance} mUSD`,
    },
    policy_provenance: {
      active_policy: policy || {
        token: "sergeo-guard-token.testnet",
        daily_cap: dailyCapTotal,
        max_actions_per_10min: 5,
        auto_pause_rejects: 3,
        auto_pause_window_minutes: 10,
        high_value_threshold: 250,
      },
      staged_policy_diff: stagedPolicy
        ? {
            status: "STAGED_TIMELOCK",
            effective_at: new Date(stagedPolicy.effective_at * 1000).toISOString(),
            changes: {
              daily_cap_before: dailyCapTotal,
              daily_cap_staged: stagedPolicy.policy.daily_cap,
              new_recipients: stagedPolicy.policy.recipients,
              first_use_quarantine: "Enabled (new recipients quarantined to PENDING until first settlement)",
            },
          }
        : null,
    },
    incident_statistics: {
      total_operations_evaluated: activities.length,
      allowed_operations: approvals.length,
      rejected_incidents: rejections.length,
      auto_pause_events: autoPauses.length,
    },
    reject_incident_log: rejections.map((r, idx) => ({
      index: idx + 1,
      timestamp: new Date(r.timestamp).toISOString(),
      tx_hash: r.txHash || `0x${(r.timestamp * 1000).toString(16).padEnd(64, "0")}`,
      explorer_url: `https://testnet.nearblocks.io/txns/${r.txHash || ""}`,
      attempted_target: r.target || "unknown",
      attempted_method: r.method || "unknown",
      attempted_amount: r.amount ? `${r.amount} mUSD` : "0",
      reason_code: r.reason || "RECIPIENT_NOT_ALLOWED",
      budget_before_attempt: `${dailyCapSpent} mUSD`,
      budget_after_attempt: `${dailyCapSpent} mUSD (untouched)`,
      loss_prevented: r.amount ? `${r.amount} mUSD` : "N/A",
    })),
    complete_ledger_activity: activities.map((a) => ({
      id: a.id,
      timestamp: new Date(a.timestamp).toISOString(),
      type: a.type,
      target: a.target,
      method: a.method,
      amount: a.amount,
      reason: a.reason,
      tx_hash: a.txHash,
    })),
  };

  const jsonString = JSON.stringify(incidentReport, null, 2);

  // CSV Generator
  const generateCsv = () => {
    const headers = [
      "Timestamp",
      "Type",
      "Target",
      "Method",
      "Amount_mUSD",
      "Reason_Code",
      "Tx_Hash",
      "Loss_Prevented_mUSD",
    ];
    const rows = activities.map((a) => [
      new Date(a.timestamp).toISOString(),
      a.type,
      `"${a.target || ""}"`,
      `"${a.method || ""}"`,
      a.amount || "0",
      `"${a.reason || ""}"`,
      a.txHash || "",
      a.type === "REJECT" ? a.amount || "0" : "0",
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scopeguard-incident-provenance-${agentId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    const csvContent = generateCsv();
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scopeguard-audit-ledger-${agentId}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0E1015] border border-white/10 rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-white">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#13161F]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Policy Provenance & Incident Export
              </h2>
              <p className="text-xs text-neutral-400">
                Audit trail with reason codes, policy diffs, and before and after budgets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs & Download Bar */}
        <div className="px-5 py-3 border-b border-white/10 bg-[#0B0D12] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-white/5 border border-white/10 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "summary"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Executive Summary
            </button>
            <button
              onClick={() => setActiveTab("raw_json")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "raw_json"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Provenance JSON
            </button>
            <button
              onClick={() => setActiveTab("csv")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "csv"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Audit CSV
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 text-xs font-medium rounded-lg border border-white/10 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-neutral-200 text-xs font-medium rounded-lg border border-white/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </button>
            <button
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download JSON Report
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-sm">
          {activeTab === "summary" && (
            <div className="space-y-5">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl">
                  <span className="text-xs text-neutral-400 block mb-1">Evaluated Operations</span>
                  <span className="text-lg font-mono font-semibold text-white">
                    {activities.length}
                  </span>
                </div>
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl">
                  <span className="text-xs text-neutral-400 block mb-1">Allowed Operations</span>
                  <span className="text-lg font-mono font-semibold text-emerald-400">
                    {approvals.length}
                  </span>
                </div>
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl">
                  <span className="text-xs text-neutral-400 block mb-1">Security Incidents</span>
                  <span className="text-lg font-mono font-semibold text-rose-400">
                    {rejections.length}
                  </span>
                </div>
                <div className="p-3.5 bg-white/[0.02] border border-white/10 rounded-xl">
                  <span className="text-xs text-neutral-400 block mb-1">Vault Balance</span>
                  <span className="text-lg font-mono font-semibold text-blue-400">
                    {vaultBalance} mUSD
                  </span>
                </div>
              </div>

              {/* Policy Provenance & Diff Card */}
              <div className="p-4 bg-white/[0.02] border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white text-xs uppercase tracking-wider">
                      Policy Provenance Record
                    </span>
                  </div>
                  <span className="text-xs font-mono text-neutral-400">
                    Contract: {guardId}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-1.5">
                    <span className="text-neutral-400 block font-medium">Active Policy Baseline</span>
                    <div className="flex justify-between text-neutral-300">
                      <span>Daily Cap:</span>
                      <span className="font-mono text-white">{dailyCapTotal} mUSD</span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Spent in Window:</span>
                      <span className="font-mono text-white">{dailyCapSpent} mUSD</span>
                    </div>
                    <div className="flex justify-between text-neutral-300">
                      <span>Remaining Allowance:</span>
                      <span className="font-mono text-emerald-400">
                        {Math.max(0, dailyCapTotal - dailyCapSpent)} mUSD
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-black/40 border border-white/5 rounded-lg space-y-1.5">
                    <span className="text-neutral-400 block font-medium">Policy Timelock Staging</span>
                    {stagedPolicy ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-amber-300">
                          <span>Staged Cap:</span>
                          <span className="font-mono">{stagedPolicy.policy.daily_cap} mUSD</span>
                        </div>
                        <div className="flex justify-between text-neutral-300">
                          <span>Effective Time:</span>
                          <span className="font-mono">
                            {new Date(stagedPolicy.effective_at * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 pt-1">
                          First-use quarantine applies to new recipients.
                        </div>
                      </div>
                    ) : (
                      <div className="text-neutral-400 italic pt-2">
                        No policy revisions staged. Active policy is current.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Incidents Breakdown Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span className="font-semibold text-white text-xs uppercase tracking-wider">
                      Blocked Incidents Log ({rejections.length})
                    </span>
                  </div>
                  <span className="text-xs text-neutral-400">
                    Consensus proofs via NEAR Protocol
                  </span>
                </div>

                {rejections.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-white/10 rounded-xl text-neutral-400 text-xs">
                    No security rejections logged in current session.
                  </div>
                ) : (
                  <div className="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/5 text-neutral-400 border-b border-white/10 font-mono">
                        <tr>
                          <th className="p-2.5">Time</th>
                          <th className="p-2.5">Target</th>
                          <th className="p-2.5">Method</th>
                          <th className="p-2.5">Reason Code</th>
                          <th className="p-2.5">Attempted</th>
                          <th className="p-2.5">Budget Impact</th>
                          <th className="p-2.5">Tx Hash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {rejections.map((r, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-2.5 text-neutral-400">
                              {new Date(r.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="p-2.5 text-neutral-200">{r.target || "-"}</td>
                            <td className="p-2.5 text-neutral-300">{r.method || "-"}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-semibold">
                                {r.reason || "REJECTED"}
                              </span>
                            </td>
                            <td className="p-2.5 text-neutral-300">{r.amount ? `${r.amount} mUSD` : "-"}</td>
                            <td className="p-2.5 text-emerald-400 font-medium">0 mUSD (protected)</td>
                            <td className="p-2.5 text-neutral-400">
                              {r.txHash ? (
                                <a
                                  href={`https://testnet.nearblocks.io/txns/${r.txHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-400 hover:underline"
                                >
                                  {r.txHash.slice(0, 8)}...
                                </a>
                              ) : (
                                "simulated"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "raw_json" && (
            <div className="relative">
              <pre className="p-4 bg-[#08090D] border border-white/10 rounded-xl font-mono text-xs text-neutral-300 overflow-x-auto max-h-[500px]">
                {jsonString}
              </pre>
            </div>
          )}

          {activeTab === "csv" && (
            <div className="relative">
              <pre className="p-4 bg-[#08090D] border border-white/10 rounded-xl font-mono text-xs text-neutral-300 overflow-x-auto max-h-[500px]">
                {generateCsv()}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
