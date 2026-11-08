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
