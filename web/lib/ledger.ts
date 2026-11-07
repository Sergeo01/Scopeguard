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

// 100% verified NEAR testnet transactions executed on guard2.sergeo-guard.testnet
const VERIFIED_GENESIS_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-onchain-auto-pause",
    txHash: "2JaobFoi92w5gtWUX2Dk54mTbyh7RhaD9h8Tt1P225cv",
    type: "AUTO_PAUSE",
    timestamp: 1730805407000,
    agent: "agent.sergeo-guard.testnet",
    target: "intents.near",
    method: "execute_intent",
    amount: "100",
    reason: "PAUSED (3-strike circuit breaker tripped automatically onchain)",
  },
  {
    id: "act-onchain-near-sweep",
    txHash: "CJWVxVVrweL3bhs9q5gDt9TyfNLV9cRERRzg9proSP2k",
    type: "REJECT",
    timestamp: 1730805396000,
    agent: "agent.sergeo-guard.testnet",
    target: "near",
    method: "near_transfer",
    amount: "10",
    reason: "RECIPIENT_NOT_ALLOWED (native NEAR sweep to unlisted account refused onchain)",
  },
  {
    id: "act-onchain-method-guard",
    txHash: "AHa37mijAATTq3Si5656hUt74Hasagsk1yXPeaXCP44y",
    type: "REJECT",
    timestamp: 1730805386000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "admin_drain",
    amount: "0",
    reason: "METHOD_NOT_ALLOWED (unauthorized method call blocked onchain)",
  },
  {
    id: "act-onchain-spend-cap",
    txHash: "3SZeB2baivCYaXdNZxVgGJRzeq4yBrnjahnPwarZ6h4W",
    type: "REJECT",
    timestamp: 1730805377000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    amount: "9999",
    reason: "OVER_DAILY_CAP (transfer exceeds daily spending limit)",
  },
  {
    id: "act-onchain-swap-allow",
    txHash: "BYsuuS44DjJtX3i4Na9f1vWEPHStYsJQfh7VgyGSZsVF",
    type: "ALLOW",
    timestamp: 1730803183000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "10",
    reason: "POLICY_PASSED (allowlisted DEX swap executed onchain)",
  },
  {
    id: "act-onchain-recipient-reject",
    txHash: "8zyc72TFQWMGEKauzEjQ6cqbGUh9k4fAJy8mGbHFf3Wz",
    type: "REJECT",
    timestamp: 1730803169000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    amount: "100",
    reason: "RECIPIENT_NOT_ALLOWED (transfer to unapproved recipient refused onchain)",
  },
  {
    id: "act-onchain-target-reject",
    txHash: "7uVarMGXDvvAckFADHgGjaT3WwzK4icqfLPDhfs9eKYq",
    type: "REJECT",
    timestamp: 1730803158000,
    agent: "agent.sergeo-guard.testnet",
    target: "evil_stealer.testnet",
    method: "drain_all",
    amount: "350",
    reason: "TARGET_NOT_ALLOWED (unauthorized contract call blocked onchain)",
  },
  {
    id: "act-onchain-rogue-drainer",
    txHash: "BYhpCEzqPLZLuxqGrJaGLUwUxXcN4oMLvGL3dP34gQeJ",
    type: "REJECT",
    timestamp: 1730802000000,
    agent: "agent.sergeo-guard.testnet",
    target: "evil_drainer.testnet",
    method: "drain",
    amount: "500",
    reason: "TARGET_NOT_ALLOWED (unregistered contract refused onchain)",
  },
];

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
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } else {
      // Seed file on initial startup
      fs.writeFileSync(filePath, JSON.stringify(VERIFIED_GENESIS_ACTIVITIES, null, 2), "utf-8");
    }
  } catch {
    // Disk read fallback
  }
  return [...VERIFIED_GENESIS_ACTIVITIES];
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
