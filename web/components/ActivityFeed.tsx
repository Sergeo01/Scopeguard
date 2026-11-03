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
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-obsidian-900 p-6 sm:p-7 space-y-5 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <span>Live Activity & Security Audit Log</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Every transaction, rejection, and panic action is recorded on the public blockchain
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {activities.length} Recorded Events
        </span>
      </div>

      {activities.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
          No transactions recorded yet in this session. The stream updates automatically as your agent acts.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="pb-3.5">Status</th>
                <th className="pb-3.5">Action Attempted</th>
                <th className="pb-3.5">Amount</th>
                <th className="pb-3.5">Guardrail Decision</th>
                <th className="pb-3.5">Time</th>
                <th className="pb-3.5 text-right">Blockchain Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-sans">
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
                  ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                  : isBreaker
                  ? "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/60"
                  : isVeto
                  ? "bg-slate-100 dark:bg-obsidian-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-obsidian-800"
                  : isPause
                  ? "bg-slate-100 dark:bg-obsidian-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                  : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/60";

                return (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-obsidian-850/60 transition">
                    <td className="py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full border ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-800 dark:text-slate-200 font-medium">
                      {item.target ? (
                        <span className="font-mono text-xs">
                          {item.target}::<span className="text-slate-500 dark:text-slate-400">{item.method}()</span>
                        </span>
                      ) : (
                        <span className="text-slate-700 dark:text-slate-300">{item.agent}</span>
                      )}
                    </td>
                    <td className="py-3.5 text-slate-700 dark:text-slate-300 font-mono font-medium">
                      {item.amount && item.amount !== "0" ? `$${item.amount}.00` : "-"}
                    </td>
                    <td className="py-3.5">
                      {item.reason ? (
                        <span className={item.type === "REJECT" ? "text-rose-700 dark:text-rose-400 font-medium" : "text-slate-600 dark:text-slate-400"}>
                          {item.reason}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">Policy verified · Success</span>
                      )}
                    </td>
                    <td className="py-3.5 text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="py-3.5 text-right font-mono">
                      {item.txHash ? (
                        <a
                          href={`${explorerBaseUrl}/${item.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition font-medium"
                        >
                          <span>{item.txHash.slice(0, 8)}...</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">-</span>
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