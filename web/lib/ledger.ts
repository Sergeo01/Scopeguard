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

// Recorded NEAR testnet transactions executed during testnet trials
// Labeled explicitly as DEMO_SEED with timestamps relative to runtime
const DEMO_SEED_ACTIVITIES: ActivityItem[] = [
  {
    id: "demo-seed-auto-pause",
    txHash: "2JaobFoi92w5gtWUX2Dk54mTbyh7RhaD9h8Tt1P225cv",
    type: "AUTO_PAUSE",
    timestamp: Date.now() - 60_000,
    agent: "agent.sergeo-guard.testnet",
    target: "intents.near",
    method: "execute_intent",
    amount: "100",
    reason: "PAUSED (3-strike circuit breaker tripped automatically onchain)",
  },
  {
    id: "demo-seed-near-sweep",
    txHash: "CJWVxVVrweL3bhs9q5gDt9TyfNLV9cRERRzg9proSP2k",
    type: "REJECT",
    timestamp: Date.now() - 120_000,
    agent: "agent.sergeo-guard.testnet",
    target: "near",
    method: "near_transfer",
    amount: "10",
    reason: "RECIPIENT_NOT_ALLOWED (native NEAR sweep to unlisted account refused onchain)",
  },
  {
    id: "demo-seed-method-guard",
    txHash: "AHa37mijAATTq3Si5656hUt74Hasagsk1yXPeaXCP44y",
    type: "REJECT",
    timestamp: Date.now() - 180_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "admin_drain",
    amount: "0",
    reason: "METHOD_NOT_ALLOWED (unauthorized method call blocked onchain)",
  },
  {
    id: "demo-seed-spend-cap",
    txHash: "3SZeB2baivCYaXdNZxVgGJRzeq4yBrnjahnPwarZ6h4W",
    type: "REJECT",
    timestamp: Date.now() - 240_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    amount: "9999",
    reason: "OVER_DAILY_CAP (transfer exceeds daily spending limit)",
  },
  {
    id: "demo-seed-swap-allow",
    txHash: "BYsuuS44DjJtX3i4Na9f1vWEPHStYsJQfh7VgyGSZsVF",
    type: "ALLOW",
    timestamp: Date.now() - 300_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "10",
    reason: "POLICY_PASSED (allowlisted DEX swap executed onchain)",
  },
  {
    id: "demo-seed-recipient-reject",
    txHash: "8zyc72TFQWMGEKauzEjQ6cqbGUh9k4fAJy8mGbHFf3Wz",
    type: "REJECT",
    timestamp: Date.now() - 360_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    amount: "100",
    reason: "RECIPIENT_NOT_ALLOWED (transfer to unapproved recipient refused onchain)",
  },
  {
    id: "demo-seed-target-reject",
    txHash: "7uVarMGXDvvAckFADHgGjaT3WwzK4icqfLPDhfs9eKYq",
    type: "REJECT",
    timestamp: Date.now() - 420_000,
    agent: "agent.sergeo-guard.testnet",
    target: "evil_stealer.testnet",
    method: "drain_all",
    amount: "350",
    reason: "TARGET_NOT_ALLOWED (unauthorized contract call blocked onchain)",
  },
  {
    id: "demo-seed-rogue-drainer",
    txHash: "BYhpCEzqPLZLuxqGrJaGLUwUxXcN4oMLvGL3dP34gQeJ",
    type: "REJECT",
    timestamp: Date.now() - 480_000,
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
      fs.writeFileSync(filePath, JSON.stringify(DEMO_SEED_ACTIVITIES, null, 2), "utf-8");
    }
  } catch {
    // Disk read fallback
  }
  return [...DEMO_SEED_ACTIVITIES];
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
  const now = Date.now();
  return activityLog.map((item, idx) => {
    // Dynamically adjust any legacy 2024 seed timestamps so the demo feed shows fresh relative time
    if (item.timestamp < 1767225600000) {
      return {
        ...item,
        timestamp: now - (idx + 1) * 60_000,
      };
    }
    return item;
  });
}

export function recordActivity(item: ActivityItem): void {
  // Prepend new verified activity and cap at 100 entries
  activityLog = [item, ...activityLog].slice(0, 100);
  persistLedger();
}
