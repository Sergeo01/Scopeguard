import React from "react";
import { ExternalLink, Activity, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";

export interface ActivityItem {
  id: string;
  txHash?: string;
  type:
    | "ALLOW"
    | "REJECT"
    | "AUTO_PAUSE"
    | "SETTLED"
    | "CANCELLED"
    | "PAUSE"
    | "UNPAUSE"
    | "POLICY_CHANGE_CANCELLED";
  timestamp: number;
  agent: string;
  target?: string;
  method?: string;
  amount?: string;
  reason?: string;
}

export interface ActivityFeedProps {
  activities: ActivityItem[];
  explorerBaseUrl?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  explorerBaseUrl = "https://testnet.nearblocks.io/txns",
}) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 space-y-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-700" />
            <span>Live Activity & Security Audit Log</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every transaction, rejection, and panic action is recorded on the public blockchain
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          {activities.length} Recorded Events
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500">
          No transactions recorded yet in this session. The stream updates automatically as your agent acts.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="pb-3.5">Status</th>
                <th className="pb-3.5">Action Attempted</th>
                <th className="pb-3.5">Amount</th>
                <th className="pb-3.5">Guardrail Decision</th>
                <th className="pb-3.5">Time</th>
                <th className="pb-3.5 text-right">Blockchain Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {activities.map((item) => {
                const isAllow = item.type === "ALLOW" || item.type === "SETTLED";
                const isBreaker = item.type === "AUTO_PAUSE";
                const isVeto = item.type === "CANCELLED" || item.type === "POLICY_CHANGE_CANCELLED";
                const isPause = item.type === "PAUSE" || item.type === "UNPAUSE";

                const badgeLabel = isAllow
                  ? "Approved"
                  : isBreaker
                  ? "Brake Tripped"
                  : isVeto
                  ? "Vetoed by Owner"
                  : isPause
                  ? item.type === "PAUSE"
                    ? "Paused"
                    : "Unpaused"
                  : "Declined";

                const badgeClass = isAllow
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : isBreaker
                  ? "bg-purple-50 text-purple-800 border-purple-200"
                  : isVeto
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : isPause
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : "bg-rose-50 text-rose-800 border-rose-200";

                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full border ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-800 font-medium">
                      {item.target ? (
                        <span className="font-mono text-xs">
                          {item.target}::<span className="text-slate-500">{item.method}()</span>
                        </span>
                      ) : (
                        <span className="text-slate-700">{item.agent}</span>
                      )}
                    </td>
                    <td className="py-3.5 text-slate-700 font-mono font-medium">
                      {item.amount && item.amount !== "0" ? `$${item.amount}.00` : "-"}
                    </td>
                    <td className="py-3.5">
                      {item.reason ? (
                        <span className={item.type === "REJECT" ? "text-rose-700 font-medium" : "text-slate-600"}>
                          {item.reason}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Policy verified · Success</span>
                      )}
                    </td>
                    <td className="py-3.5 text-slate-500 font-mono text-xs">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-3.5 text-right font-mono">
                      {item.txHash ? (
                        <a
                          href={`${explorerBaseUrl}/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition font-medium"
                        >
                          <span>{item.txHash.slice(0, 8)}...</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};