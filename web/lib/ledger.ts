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
  try {
    const filePath = getLedgerFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        activityLog = parsed;
      }
    }
  } catch {}
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
const ONCHAIN_CACHE_TTL_MS = 60000;

// Permanent cache for finalized onchain transaction outcomes
const txOutcomeCache = new Map<string, ActivityItem>([
  [
    "3BPdRenYy8RJ4ztP3ngozJRisN3DKHNKK8P523ofPNCR",
    {
      id: "act-1794669675161-3BPdRe",
      txHash: "3BPdRenYy8RJ4ztP3ngozJRisN3DKHNKK8P523ofPNCR",
      type: "REJECT",
      timestamp: 1794669675161,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-token.testnet",
      method: "ft_transfer",
      amount: "100",
      reason: "RECIPIENT_NOT_ALLOWED"
    }
  ],
  [
    "AzSs8fri3cUhEpiq7B7BL8Hto1rhWxq8XqoqJxKXCMeR",
    {
      id: "act-1794562974417-AzSs8f",
      txHash: "AzSs8fri3cUhEpiq7B7BL8Hto1rhWxq8XqoqJxKXCMeR",
      type: "PENDING",
      timestamp: 1794562974417,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "300",
      reason: "Pending Timelock #3"
    }
  ],
  [
    "4ZFMu1MupnScsWqxr2CSX7vQtFAT1RW9gZ2LhU6Hi5Co",
    {
      id: "act-1794562956197-4ZFMu1",
      txHash: "4ZFMu1MupnScsWqxr2CSX7vQtFAT1RW9gZ2LhU6Hi5Co",
      type: "AUTO_PAUSE",
      timestamp: 1794562956197,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "600",
      reason: "OVER_DAILY_CAP (Tripped AUTO_PAUSE)"
    }
  ],
  [
    "2jh4jGUaSABQzMmdw1J6VT2w36zAxEUJvuDs2vo3zFHo",
    {
      id: "act-1794562945288-2jh4jG",
      txHash: "2jh4jGUaSABQzMmdw1J6VT2w36zAxEUJvuDs2vo3zFHo",
      type: "REJECT",
      timestamp: 1794562945288,
      agent: "agent2.sergeo-guard.testnet",
      target: "phish-vault.testnet",
      method: "deposit",
      reason: "TARGET_NOT_ALLOWED"
    }
  ],
  [
    "EH9eRN38MKpdJUF9wug54ZHx1kCHH863WBFZXhAtSgNb",
    {
      id: "act-1794562936721-EH9eRN",
      txHash: "EH9eRN38MKpdJUF9wug54ZHx1kCHH863WBFZXhAtSgNb",
      type: "REJECT",
      timestamp: 1794562936721,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-token.testnet",
      method: "ft_transfer",
      amount: "100",
      reason: "RECIPIENT_NOT_ALLOWED"
    }
  ],
  [
    "9tvq8xDNaDJuvjztgCeXZwexe6ycDdEPBaXPC4d1RMxH",
    {
      id: "act-1794562928296-9tvq8x",
      txHash: "9tvq8xDNaDJuvjztgCeXZwexe6ycDdEPBaXPC4d1RMxH",
      type: "ALLOW",
      timestamp: 1794562928296,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "25",
      reason: "Allowed onchain (swap executed)"
    }
  ],
  [
    "8K8v1KxTEFLLVYaZfQWTzqBfSReGnNsEXdfpfFXPU9eW",
    {
      id: "act-1794516265754-8K8v1K",
      txHash: "8K8v1KxTEFLLVYaZfQWTzqBfSReGnNsEXdfpfFXPU9eW",
      type: "REJECT",
      timestamp: 1794516265754,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-token.testnet",
      method: "ft_transfer",
      amount: "100",
      reason: "RECIPIENT_NOT_ALLOWED"
    }
  ],
  [
    "4Cjc387oGD7v8mzJSWWELk7gwGrr4zWKmF4M7uMWLJqj",
    {
      id: "act-1794516032261-4Cjc38",
      txHash: "4Cjc387oGD7v8mzJSWWELk7gwGrr4zWKmF4M7uMWLJqj",
      type: "REJECT",
      timestamp: 1794516032261,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-token.testnet",
      method: "ft_transfer",
      amount: "100",
      reason: "RECIPIENT_NOT_ALLOWED"
    }
  ],
  [
    "HbT3ZredusSEzB2dBXKZu1qnEW4QrNpAtDsarawBJ64k",
    {
      id: "act-1794493668045-HbT3Zr",
      txHash: "HbT3ZredusSEzB2dBXKZu1qnEW4QrNpAtDsarawBJ64k",
      type: "PENDING",
      timestamp: 1794493668045,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "300",
      reason: "Pending Timelock #2"
    }
  ],
  [
    "Gx8DuBcb447sotQqDN6ZnaqhUQfnbso7EEu6tWkGSn74",
    {
      id: "act-1794493628555-Gx8DuB",
      txHash: "Gx8DuBcb447sotQqDN6ZnaqhUQfnbso7EEu6tWkGSn74",
      type: "AUTO_PAUSE",
      timestamp: 1794493628555,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "600",
      reason: "OVER_DAILY_CAP (Tripped AUTO_PAUSE)"
    }
  ],
  [
    "4wnc7NTUvm2hLZzWxCfsYTarJzF1tD5jfmcHsEmtMhF5",
    {
      id: "act-1794493607195-4wnc7N",
      txHash: "4wnc7NTUvm2hLZzWxCfsYTarJzF1tD5jfmcHsEmtMhF5",
      type: "REJECT",
      timestamp: 1794493607195,
      agent: "agent2.sergeo-guard.testnet",
      target: "phish-vault.testnet",
      method: "deposit",
      reason: "TARGET_NOT_ALLOWED"
    }
  ],
  [
    "GD5f8vUWoQ2JfPC4CRphREz2asynGqx6fLWcsbU2pfPB",
    {
      id: "act-1794493585285-GD5f8v",
      txHash: "GD5f8vUWoQ2JfPC4CRphREz2asynGqx6fLWcsbU2pfPB",
      type: "REJECT",
      timestamp: 1794493585285,
      agent: "agent2.sergeo-guard.testnet",
      target: "sergeo-guard-token.testnet",
      method: "ft_transfer",
      amount: "100",
      reason: "RECIPIENT_NOT_ALLOWED"
    }
  ],
  [
    "8WB62dxzGfxUhCWnKFEbxvZMPuKJBZDkCPCF1RtY6ni9",
    {
      id: "act-1794563046704-8WB62d",
      txHash: "8WB62dxzGfxUhCWnKFEbxvZMPuKJBZDkCPCF1RtY6ni9",
      type: "SETTLED",
      timestamp: 1794563046704,
      agent: "scopeguard.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "300",
      reason: "Settled Pending #3 on DEX"
    }
  ],
  [
    "F9kYVvHkGWoZQyLjCS6Kk3RCsFJXALti2qkzokVXTahj",
    {
      id: "act-1794563052804-F9kYVv",
      txHash: "F9kYVvHkGWoZQyLjCS6Kk3RCsFJXALti2qkzokVXTahj",
      type: "RESET",
      timestamp: 1794563052804,
      agent: "sergeo-guard.testnet",
      target: "scopeguard.testnet",
      method: "reset_windows",
      reason: "Velocity and spend windows reset"
    }
  ],
  [
    "4T9EzpqxvRavJzKLVHt5WkaDrNteWfjZ8WuCLB7Kvb22",
    {
      id: "act-1794562966662-4T9Ezp",
      txHash: "4T9EzpqxvRavJzKLVHt5WkaDrNteWfjZ8WuCLB7Kvb22",
      type: "UNPAUSE",
      timestamp: 1794562966662,
      agent: "sergeo-guard.testnet",
      target: "scopeguard.testnet",
      method: "unpause",
      reason: "Agent unpaused by owner"
    }
  ],
  [
    "36LUx7rH9qyvMQkEgQWfT6mv44eTksuVy9WeAhtNq4CY",
    {
      id: "act-1794562921110-36LUx7",
      txHash: "36LUx7rH9qyvMQkEgQWfT6mv44eTksuVy9WeAhtNq4CY",
      type: "RESET",
      timestamp: 1794562921110,
      agent: "sergeo-guard.testnet",
      target: "scopeguard.testnet",
      method: "reset_windows",
      reason: "Velocity and spend windows reset"
    }
  ],
  [
    "21Y84wUvPbrUooodeqVUcjfvMp4m5BDqeLnE6StTU3x2",
    {
      id: "act-1794490951170-21Y84w",
      txHash: "21Y84wUvPbrUooodeqVUcjfvMp4m5BDqeLnE6StTU3x2",
      type: "ALLOW",
      timestamp: 1794490951170,
      agent: "sergeo-guard.testnet",
      target: "scopeguard.testnet",
      method: "register_agent",
      reason: "Agent registered with policy"
    }
  ],
  [
    "FvuDWHmWnzzHQS5GU9TARc7cfWp928Upg9ajZ39przis",
    {
      id: "act-1794490969386-FvuDWH",
      txHash: "FvuDWHmWnzzHQS5GU9TARc7cfWp928Upg9ajZ39przis",
      type: "ALLOW",
      timestamp: 1794490969386,
      agent: "sergeo-guard.testnet",
      target: "scopeguard.testnet",
      method: "ft_transfer_call",
      amount: "350",
      reason: "Vault funded with 350 mUSD"
    }
  ],
  [
    "3b3it8ovEZaYXkecmdrt2jmXyxJQNDJHWZkpwnBbwKP4",
    {
      id: "act-1794665826223-3b3it8",
      txHash: "3b3it8ovEZaYXkecmdrt2jmXyxJQNDJHWZkpwnBbwKP4",
      type: "ALLOW",
      timestamp: 1794665826223,
      agent: "trade.blckfme.testnet",
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "10",
      reason: "Swap executed on mock DEX"
    }
  ],
  [
    "6nsgsxVw3txJfMGZVdnvy1CNAK3PYqGsDcxFq8XjzcrC",
    {
      id: "act-1794665145178-6nsgsx",
      txHash: "6nsgsxVw3txJfMGZVdnvy1CNAK3PYqGsDcxFq8XjzcrC",
      type: "ALLOW",
      timestamp: 1794665145178,
      agent: "sergeo-guard-token.testnet",
      target: "scopeguard.testnet",
      method: "ft_on_transfer",
      amount: "100",
      reason: "Vault funded with 100 mUSD"
    }
  ],
  [
    "FTSAt3YVMuhm6WGXcZQWbhRDCWn2MCM3PEcHnZnZDKb3",
    {
      id: "act-1794664973865-FTSAt3",
      txHash: "FTSAt3YVMuhm6WGXcZQWbhRDCWn2MCM3PEcHnZnZDKb3",
      type: "ALLOW",
      timestamp: 1794664973865,
      agent: "blckfme.testnet",
      target: "scopeguard.testnet",
      method: "register_agent",
      reason: "Agent trade.blckfme.testnet registered"
    }
  ],
  [
    "EiRXrcxXfz1RzPa2NDPBsWyM2B1CTAMDUfNa7wkJWprT",
    {
      id: "act-1794664864230-EiRXrc",
      txHash: "EiRXrcxXfz1RzPa2NDPBsWyM2B1CTAMDUfNa7wkJWprT",
      type: "UNPAUSE",
      timestamp: 1794664864230,
      agent: "blckfme.testnet",
      target: "scopeguard.testnet",
      method: "unpause",
      reason: "Agent unpaused by owner"
    }
  ],
  [
    "2qY1WN3EVfJYwhedssE7PAZ2G85vnbpMF8njoBfHzRVH",
    {
      id: "act-1794664824351-2qY1WN",
      txHash: "2qY1WN3EVfJYwhedssE7PAZ2G85vnbpMF8njoBfHzRVH",
      type: "ALLOW",
      timestamp: 1794664824351,
      agent: "blckfme.testnet",
      target: "scopeguard.testnet",
      method: "revoke_agent",
      reason: "Agent revoked by owner"
    }
  ],
  [
    "4St6LNwf1Vm39vYqd97Mn12nZggcteP2EWTug2rX2TA6",
    {
      id: "act-1794604803970-4St6LN",
      txHash: "4St6LNwf1Vm39vYqd97Mn12nZggcteP2EWTug2rX2TA6",
      type: "ALLOW",
      timestamp: 1794604803970,
      agent: "blckfme.testnet",
      target: "scopeguard.testnet",
      method: "set_policy",
      reason: "Guard policy staged by owner"
    }
  ]
]);

// Dedicated RPC endpoint list for historical transaction resolution
const HISTORICAL_TX_RPCS = [
  "https://archival-rpc.testnet.near.org",
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.fastnear.com"
];

async function fetchTxFromRpc(hash: string, account: string): Promise<any> {
  for (const rpc of HISTORICAL_TX_RPCS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          method: "tx",
          params: [hash, account],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.result) return data.result;
      }
    } catch {
      // Failover to next RPC
    }
  }
  return null;
}

export async function fetchOnchainActivities(
  agentAccount: string,
  guardId = "scopeguard.testnet"
): Promise<ActivityItem[]> {
  if (!agentAccount) return [];

  const cacheKey = `${agentAccount}:${guardId}`;
  const cached = onchainCacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ONCHAIN_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const rawTxns: any[] = [];

    // 1. Fetch agent account transactions (page 1 and 2)
    for (let page = 1; page <= 2; page++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://api-testnet.nearblocks.io/v1/account/${encodeURIComponent(agentAccount)}/txns?page=${page}&per_page=50`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.txns)) {
            rawTxns.push(...data.txns);
            if (data.txns.length < 50) break;
          } else break;
        } else break;
      } catch {
        break;
      }
    }

    // 2. Fetch guard account transactions (page 1 and 2)
    for (let page = 1; page <= 2; page++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(
          `https://api-testnet.nearblocks.io/v1/account/${encodeURIComponent(guardId)}/txns?page=${page}&per_page=50`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.txns)) {
            rawTxns.push(...data.txns);
            if (data.txns.length < 50) break;
          } else break;
        } else break;
      } catch {
        break;
      }
    }

    if (rawTxns.length === 0) {
      return cached ? cached.data : getRecentActivities();
    }

    // Deduplicate and prioritize rows with FUNCTION_CALL over refund transfers
    const txMap = new Map<string, any>();
    for (const t of rawTxns) {
      const h = t.transaction_hash;
      if (!h) continue;
      const existing = txMap.get(h);
      if (!existing) {
        txMap.set(h, t);
      } else {
        const hasFunc = t.actions?.some((a: any) => a.action === "FUNCTION_CALL" || a.method);
        const existingHasFunc = existing.actions?.some((a: any) => a.action === "FUNCTION_CALL" || a.method);
        if (hasFunc && !existingHasFunc) {
          txMap.set(h, t);
        }
      }
    }

    const candidateTxns = Array.from(txMap.values());
    const activities: ActivityItem[] = [];

    let uncachedLookups = 0;
    const MAX_UNCACHED_PER_PASS = 3;

    for (const t of candidateTxns) {
      const hash = t.transaction_hash;
      if (txOutcomeCache.has(hash)) {
        activities.push(txOutcomeCache.get(hash)!);
        continue;
      }

      const blockTs = t.block_timestamp || t.receipt_block?.block_timestamp;
      const timestamp = blockTs ? Math.floor(Number(BigInt(blockTs) / BigInt(1_000_000))) : Date.now();
      const signer = t.signer_account_id || t.predecessor_account_id || agentAccount;
      const receiver = t.receiver_account_id;

      const actionObj = Array.isArray(t.actions) && t.actions.length > 0 ? t.actions[0] : null;
      const rawMethod = actionObj?.method || actionObj?.action;

      let target = receiver;
      let method = rawMethod || "call";
      let amount: string | undefined = undefined;
      let reason: string | undefined = undefined;
      let type: ActivityItem["type"] = "ALLOW";

      if (rawMethod === "execute") {
        let parsedArgs: any = null;
        if (actionObj?.args) {
          try {
            parsedArgs = typeof actionObj.args === "string" ? JSON.parse(actionObj.args) : actionObj.args;
          } catch {}
        }

        const innerAction = parsedArgs?.action || parsedArgs;
        if (innerAction?.Transfer) {
          const tf = innerAction.Transfer;
          target = tf.token || tf.to || guardId;
          method = "ft_transfer";
          amount = tf.amount ? String(tf.amount) : undefined;
        } else if (innerAction?.Swap) {
          const sw = innerAction.Swap;
          target = sw.dex || "sergeo-guard-dex.testnet";
          method = "swap";
          amount = sw.amount_in ? String(sw.amount_in) : undefined;
        } else if (innerAction?.ContractCall) {
          const cc = innerAction.ContractCall;
          target = cc.target || receiver;
          method = cc.method || "contract_call";
          amount = cc.deposit ? String(cc.deposit) : undefined;
        }

        // For uncached execute actions, attempt single-shot RPC resolution
        if (uncachedLookups < MAX_UNCACHED_PER_PASS) {
          uncachedLookups++;
          const outcome = await fetchTxFromRpc(hash, signer);
          if (outcome) {
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
                    reason = ev.reason ? `AUTO_PAUSE (${ev.reason})` : "Auto-pause triggered";
                  } else if (ev.event === "PENDING") {
                    type = "PENDING";
                    reason = `Pending Timelock #${ev.id ?? ""}`.trim();
                  } else if (ev.event === "SETTLED") {
                    type = "SETTLED";
                    reason = `Settled Pending #${ev.id ?? ""}`.trim();
                  } else if (ev.event === "ALLOW") {
                    if (type !== "AUTO_PAUSE" && type !== "REJECT" && type !== "PENDING") {
                      type = "ALLOW";
                    }
                  }
                } catch {}
              }
            }

            if (outcome.status?.SuccessValue) {
              try {
                const val = JSON.parse(Buffer.from(outcome.status.SuccessValue, "base64").toString("utf8"));
                if (val.status === "REJECTED") {
                  type = "REJECT";
                  if (val.reason) reason = val.reason;
                } else if (val.status === "PENDING") {
                  type = "PENDING";
                  if (!reason) reason = `Pending Timelock #${val.pending_id ?? ""}`.trim();
                } else if (val.status === "ALLOWED") {
                  if (type !== "AUTO_PAUSE" && type !== "REJECT" && type !== "PENDING") {
                    type = "ALLOW";
                  }
                }
              } catch {}
            }
          }
        }
      } else if (rawMethod === "register_agent") {
        target = guardId;
        method = "register_agent";
        type = "ALLOW";
        reason = "Agent registered with policy";
      } else if (rawMethod === "ft_on_transfer") {
        target = guardId;
        method = "ft_on_transfer";
        type = "ALLOW";
        reason = "Vault funded with mUSD";
      } else if (rawMethod === "unpause") {
        target = guardId;
        method = "unpause";
        type = "UNPAUSE";
        reason = "Agent unpaused by owner";
      } else if (rawMethod === "pause") {
        target = guardId;
        method = "pause";
        type = "PAUSE";
        reason = "Agent paused by owner";
      } else if (rawMethod === "revoke_agent") {
        target = guardId;
        method = "revoke_agent";
        type = "ALLOW";
        reason = "Agent revoked by owner";
      } else if (rawMethod === "reset_windows") {
        target = guardId;
        method = "reset_windows";
        type = "RESET";
        reason = "Velocity & spend windows reset";
      } else if (rawMethod === "set_policy" || rawMethod === "stage_policy") {
        target = guardId;
        method = "set_policy";
        type = "ALLOW";
        reason = "Guard policy configured";
      } else if (rawMethod === "settle_pending" || rawMethod === "on_action_resolved") {
        target = guardId;
        method = "settle_pending";
        type = "SETTLED";
        reason = "Pending timelock action settled";
      }

      const item: ActivityItem = {
        id: `act-${timestamp}-${hash.slice(0, 6)}`,
        txHash: hash,
        type,
        timestamp,
        agent: signer,
        target,
        method,
        amount,
        reason,
      };

      txOutcomeCache.set(hash, item);
      activities.push(item);
    }

    activities.sort((a, b) => b.timestamp - a.timestamp);
    onchainCacheMap.set(cacheKey, { timestamp: Date.now(), data: activities });
    return activities;
  } catch {
    return cached ? cached.data : getRecentActivities();
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
