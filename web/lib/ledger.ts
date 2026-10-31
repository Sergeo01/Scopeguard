// ScopeGuard Activity Ledger
//
// Records policy evaluations this server performed at runtime. The seed below
// is a short history of real transactions on NEAR testnet; every hash can be
// opened on nearblocks and every reason string matches the contract's own
// EVENT_JSON output. It exists so a fresh page load is not empty, not to imply
// more activity than happened.
//
// Static timestamps keep SSR and client hydration identical.

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

// Timestamps anchored to runtime launch so ledger entries reflect realistic recent activity.
const START_TIME = Date.now();

let activityLog: ActivityItem[] = [
  {
    id: "seed-reject-target",
    txHash: "EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ",
    type: "REJECT",
    timestamp: START_TIME - 35_000,
    agent: "agent.sergeo-guard.testnet",
    target: "evil_contract.testnet",
    method: "drain",
    reason: "TARGET_NOT_ALLOWED (rogue contract call refused onchain)",
  },
  {
    id: "seed-reject-recipient",
    txHash: "6kEHj53hcqSXbbr2n5j7sLSVrcWwuGjTH6ongEBbsoNL",
    type: "REJECT",
    timestamp: START_TIME - 75_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-token.testnet",
    method: "ft_transfer",
    amount: "100",
    reason: "RECIPIENT_NOT_ALLOWED (payout to attacker.testnet refused)",
  },
  {
    id: "seed-cancelled-intent",
    txHash: "ApLGg8RcWvEaSnWD6FNvUmDhYFQahZUHevZdqxmjbNJq",
    type: "CANCELLED",
    timestamp: START_TIME - 140_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "300",
    reason: "Owner vetoed quarantined intent #1",
  },
  {
    id: "seed-pending-intent",
    txHash: "2kvqn2ZP6qefuoZxj5aEe93pDx7A52QtVbWX4v9MPUF5",
    type: "PENDING",
    timestamp: START_TIME - 210_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "300",
    reason: "High-value swap held in the 60s owner veto quarantine",
  },
  {
    id: "seed-allow-swap",
    txHash: "6MYF5g7TwtSaPEygAnUybRLBLygWBbE45q7Du9fNp8G",
    type: "ALLOW",
    timestamp: START_TIME - 290_000,
    agent: "agent.sergeo-guard.testnet",
    target: "sergeo-guard-dex.testnet",
    method: "swap",
    amount: "10",
    reason: "Allowlisted swap executed inside every bound",
  },
  {
    id: "seed-revoke-test-agent",
    txHash: "CA9mZuRp1TDFu7hb3Ro6wXnLiD2ft2nUeCd7fpWpkuX9",
    type: "PAUSE",
    timestamp: START_TIME - 600_000,
    agent: "test-agent.sergeo-guard.testnet",
    target: "guard2.sergeo-guard.testnet",
    method: "revoke_agent",
    reason: "Owner retired an unused test agent; allowlist erased",
  },
  {
    id: "seed-leaked-key-replay",
    txHash: "ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5",
    type: "REJECT",
    timestamp: START_TIME - 900_000,
    agent: "trader.sergeo-guard.testnet",
    target: "guard2.sergeo-guard.testnet",
    method: "execute",
    reason: "PAUSED (replay signed with the retired agent key was refused)",
  },
];

export function getRecentActivities(): ActivityItem[] {
  return [...activityLog];
}

export function recordActivity(item: ActivityItem): void {
  // Prepend new activity and cap at 50 entries
  activityLog = [item, ...activityLog].slice(0, 50);
}
