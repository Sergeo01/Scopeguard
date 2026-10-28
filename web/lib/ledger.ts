// ScopeGuard Activity Ledger
// Stores verified onchain receipts and real-time execution logs.

export interface ActivityItem {
  id: string;
  txHash?: string;
  type: "ALLOW" | "REJECT" | "AUTO_PAUSE" | "SETTLED" | "CANCELLED" | "PAUSE" | "UNPAUSE" | "PENDING";
  timestamp: number;
  agent: string;
  target?: string;
  method?: string;
  amount?: string;
  reason?: string;
}

// Initialized with verified live NEAR testnet transactions
// Static base timestamps prevent SSR and client hydration divergence
const BASE_TIME = 1793122000000;

let activityLog: ActivityItem[] = [
  {
    id: "act-unpause-live-current",
    txHash: "7a3G4tqvsKQTUUuVyUuRbPjVZhbr41VM5Mo9eFNpVygt",
    type: "UNPAUSE",
    timestamp: BASE_TIME + 120000,
    agent: "trader.sergeo-guard.testnet",
    reason: "Agent unpaused by owner on guard2.sergeo-guard.testnet",
  },
  {
    id: "act-veto-intent3-live",
    txHash: "A2aDb1YxXzWHfVxtzoRr2Pz1wcfKSAAjgxmbPKJNeSjj",
    type: "CANCELLED",
    timestamp: BASE_TIME + 60000,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "300",
    reason: "Owner vetoed quarantined pending intent #3",
  },
  {
    id: "act-unpause-live",
    txHash: "14sYk3Ve1g7qtwBvPx8mGDy4LcLZzCzAKVR55TPkBvC4",
    type: "UNPAUSE",
    timestamp: BASE_TIME,
    agent: "trader.sergeo-guard.testnet",
    reason: "Agent unpaused by owner on guard2.sergeo-guard.testnet",
  },
  {
    id: "act-rogue-live",
    txHash: "7W8BXSfQCboJi29WfBu1DYofKyXfkcehS82VbT6kPkSv",
    type: "REJECT",
    timestamp: BASE_TIME - 120000,
    agent: "trader.sergeo-guard.testnet",
    target: "evil_contract.testnet",
    method: "drain",
    reason: "TARGET_NOT_ALLOWED (Rogue contract call blocked onchain)",
  },
  {
    id: "act-veto-intent2-live",
    txHash: "AnSZkgJCsvwi7sTbxrN43QQWyPHFyX2s7UGSYDXWi9yp",
    type: "CANCELLED",
    timestamp: BASE_TIME - 300000,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "300",
    reason: "Owner vetoed quarantined pending intent #2",
  },
  {
    id: "act-veto-live",
    txHash: "2bhmibshKH7cEQHc6WZwW1JWXaXRnGKBmwDyKnD4FEq8",
    type: "CANCELLED",
    timestamp: BASE_TIME - 500000,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "300",
    reason: "Owner vetoed pending high-value intent #1",
  },
];

export function getRecentActivities(): ActivityItem[] {
  return [...activityLog];
}

export function recordActivity(item: ActivityItem): void {
  // Prepend new activity and cap at 50 entries
  activityLog = [item, ...activityLog].slice(0, 50);
}
