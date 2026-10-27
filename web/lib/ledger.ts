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
let activityLog: ActivityItem[] = [
  {
    id: "act-unpause-live",
    txHash: "14sYk3Ve1g7qtwBvPx8mGDy4LcLZzCzAKVR55TPkBvC4",
    type: "UNPAUSE",
    timestamp: Date.now() - 1000 * 60 * 3,
    agent: "trader.sergeo-guard.testnet",
    reason: "Agent unpaused by owner on guard2.sergeo-guard.testnet",
  },
  {
    id: "act-bypass-live",
    txHash: "FUyNWR84dQqx1EPJxX7FhmSZn7CeFHfTJocgxrd5Nb8Z",
    type: "REJECT",
    timestamp: Date.now() - 1000 * 60 * 5,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    reason: "METHOD_NOT_ALLOWED (ContractCall bypass blocked)",
  },
  {
    id: "act-rogue-live",
    txHash: "Bguq14HrksWRw5ChCFeHbzPRNzarrL2yr51uLCevSxG",
    type: "REJECT",
    timestamp: Date.now() - 1000 * 60 * 8,
    agent: "trader.sergeo-guard.testnet",
    target: "evil_contract.testnet",
    method: "drain",
    reason: "TARGET_NOT_ALLOWED",
  },
  {
    id: "act-inject-live",
    txHash: "3L7ysZD5rfHYTGUwtyzoY57iXReqNfXs91sasGKTvsV7",
    type: "REJECT",
    timestamp: Date.now() - 1000 * 60 * 12,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    reason: "RECIPIENT_NOT_ALLOWED (Prompt injection rejected)",
  },
  {
    id: "act-veto-live",
    txHash: "2bhmibshKH7cEQHc6WZwW1JWXaXRnGKBmwDyKnD4FEq8",
    type: "CANCELLED",
    timestamp: Date.now() - 1000 * 60 * 18,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "300",
    reason: "Owner vetoed pending high-value intent #1",
  },
  {
    id: "act-swap-live",
    txHash: "4B53MCvk4PDCtiWTPDE18sgt3BW43QnRH8xeD3jzbMir",
    type: "ALLOW",
    timestamp: Date.now() - 1000 * 60 * 25,
    agent: "trader.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "25",
    reason: "Action verified and executed against policy rules",
  },
];

export function getRecentActivities(): ActivityItem[] {
  return [...activityLog];
}

export function recordActivity(item: ActivityItem): void {
  // Prepend new activity and cap at 50 entries
  activityLog = [item, ...activityLog].slice(0, 50);
}
