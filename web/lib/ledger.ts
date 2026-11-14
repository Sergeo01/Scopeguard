// ScopeGuard Activity Ledger
//
// Records policy evaluations this server performed at runtime.
// Every entry contains a verified NEAR testnet transaction hash that can be
// inspected on NearBlocks or decoded directly from NEAR RPC.
//
// Persists newly recorded executions to disk so transactions remain durable.

import fs from "fs";
import path from "path";

export interface ActivityItem {
  id: string;
  txHash?: string;
  type: "ALLOW" | "REJECT" | "AUTO_PAUSE" | "SETTLED" | "CANCELLED" | "PAUSE" | "UNPAUSE" | "PENDING" | "RESET";
  timestamp: number;
  agent: string;
  target?: string;
  method?: string;
  amount?: string;
  reason?: string;
}

export function getLedgerFilePath(): string {
  if (process.env.LEDGER_PATH) {
    return process.env.LEDGER_PATH;
  }
  const rootDir = fs.existsSync(path.join(process.cwd(), "data"))
    ? process.cwd()
    : fs.existsSync(path.join(process.cwd(), "web", "data"))
    ? path.join(process.cwd(), "web")
    : process.cwd();
  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // Directory creation fallback
    }
  }
  return path.join(dataDir, "activity-ledger.json");
}

let activityLog: ActivityItem[] = (() => {
  try {
    const filePath = getLedgerFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // Disk read fallback
  }
  return [];
})();

function persistLedger(): void {
  try {
    const filePath = getLedgerFilePath();
    fs.writeFileSync(filePath, JSON.stringify(activityLog, null, 2), "utf-8");
  } catch {
    // Non-blocking write failure
  }
}

export function getRecentActivities(): ActivityItem[] {
  return [...activityLog];
}

export function recordActivity(item: ActivityItem): void {
  // Prepend new verified activity and cap at 100 entries
  activityLog = [item, ...activityLog].slice(0, 100);
  persistLedger();
}

export function clearActivities(): void {
  activityLog = [];
  persistLedger();
}

interface OnchainCache {
  timestamp: number;
  data: ActivityItem[];
}

const onchainCacheMap = new Map<string, OnchainCache>();
const txOutcomeCache = new Map<string, ActivityItem>();
const ONCHAIN_CACHE_TTL_MS = 8000; // 8 seconds

const TESTNET_RPCS = [
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.fastnear.com",
  "https://rpc.testnet.near.org",
];

async function fetchTxFromRpc(hash: string, agentAccount: string): Promise<any> {
  for (const rpc of TESTNET_RPCS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "tx",
          params: [hash, agentAccount],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.result) return data.result;
      }
    } catch {}
  }
  return null;
}

export async function fetchOnchainActivities(agentAccount: string): Promise<ActivityItem[]> {
  if (!agentAccount) return [];

  const cached = onchainCacheMap.get(agentAccount);
  if (cached && Date.now() - cached.timestamp < ONCHAIN_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const nbRes = await fetch(
      `https://api-testnet.nearblocks.io/v1/account/${encodeURIComponent(agentAccount)}/txns?limit=25`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!nbRes.ok) return cached ? cached.data : [];
    const nbData = await nbRes.json();
    const txns = Array.isArray(nbData.txns) ? nbData.txns : [];

    const activities: ActivityItem[] = [];
    const seenHashes = new Set<string>();

    const candidateTxns = txns.filter((t: any) => {
      const hash = t.transaction_hash;
      if (!hash || seenHashes.has(hash)) return false;
      const isExecute =
        t.actions?.some((a: any) => a.method === "execute") ||
        t.receiver_account_id?.includes("guard");
      if (!isExecute) return false;
      seenHashes.add(hash);
      return true;
    }).slice(0, 15);

    const fetchedItems = await Promise.all(
      candidateTxns.map(async (t: any) => {
        const hash = t.transaction_hash;
        if (txOutcomeCache.has(hash)) {
          return txOutcomeCache.get(hash)!;
        }

        try {
          const outcome = await fetchTxFromRpc(hash, agentAccount);
          if (!outcome) return null;

          let type: ActivityItem["type"] = "ALLOW";
          let reason: string | undefined = undefined;

          const logs = outcome.receipts_outcome?.flatMap((r: any) => r.outcome?.logs || []) || [];
          for (const log of logs) {
            if (typeof log === "string" && log.startsWith("EVENT_JSON:")) {
              try {
                const ev = JSON.parse(log.slice(11));
                if (ev.event === "REJECT") {
                  type = "REJECT";
                  reason = ev.reason;
                } else if (ev.event === "AUTO_PAUSE") {
                  type = "AUTO_PAUSE";
                }
              } catch {}
            }
          }

          if (!reason && outcome.status?.SuccessValue) {
            try {
              const val = JSON.parse(
                Buffer.from(outcome.status.SuccessValue, "base64").toString("utf8")
              );
              if (val.status === "REJECTED") {
                type = "REJECT";
                reason = val.reason;
              }
            } catch {}
          }

          let target = t.receiver_account_id;
          let method = "execute";
          let amount: string | undefined = undefined;

          try {
            const rawArgs = outcome.transaction?.actions?.[0]?.FunctionCall?.args;
            if (rawArgs) {
              const parsed = JSON.parse(Buffer.from(rawArgs, "base64").toString("utf8"));
              if (parsed.action?.ContractCall) {
                target = parsed.action.ContractCall.target;
                method = parsed.action.ContractCall.method;
              } else if (parsed.action?.Transfer) {
                target = parsed.action.Transfer.to;
                method = "ft_transfer";
                amount = parsed.action.Transfer.amount;
              } else if (parsed.action?.Swap) {
                target = parsed.action.Swap.dex;
                method = "swap";
                amount = parsed.action.Swap.amount_in;
              }
            }
          } catch {}

          const item: ActivityItem = {
            id: `onchain-${hash}`,
            txHash: hash,
            type,
            timestamp: Math.floor(Number(t.block_timestamp) / 1000000),
            agent: agentAccount,
            target,
            method,
            amount,
            reason,
          };

          txOutcomeCache.set(hash, item);
          return item;
        } catch {
          return null;
        }
      })
    );

    for (const item of fetchedItems) {
      if (item) activities.push(item);
    }

    onchainCacheMap.set(agentAccount, { timestamp: Date.now(), data: activities });
    return activities;
  } catch (err) {
    console.warn("Could not query onchain activities:", err);
    return cached ? cached.data : [];
  }
}

export async function getMergedActivities(agentAccount?: string): Promise<ActivityItem[]> {
  const local = getRecentActivities();
  if (!agentAccount) return local;

  const onchain = await fetchOnchainActivities(agentAccount);
  const seen = new Set<string>();
  const merged: ActivityItem[] = [];

  for (const item of [...onchain, ...local]) {
    const key = item.txHash || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.sort((a, b) => b.timestamp - a.timestamp);
}
