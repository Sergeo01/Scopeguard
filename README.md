# ScopeGuard: Scoped Passkeys for AI Agents on NEAR

[![ScopeGuard CI](https://github.com/Sergeo01/Scopeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/Sergeo01/Scopeguard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.

Live Console: [https://scopeguard.blockframe.cloud](https://scopeguard.blockframe.cloud)

---

## 1. Quickstart

### Prerequisites
- [Rust](https://rustup.rs/) (stable toolchain) with target `wasm32-unknown-unknown`
- [Node.js](https://nodejs.org/) (v18 or v20) and `npm`

### Installation & Build
Clone the repository and run the root setup script, which builds the SDK before configuring dependent packages:

```bash
git clone https://github.com/Sergeo01/Scopeguard.git
cd Scopeguard
npm run setup
```

### Running Tests
Execute the unified test runner across all smart contract and TypeScript suites:

```bash
npm test
```

To run individual component test suites:

```bash
# Smart contracts (Rust unit & property tests)
npm run test:contracts

# TypeScript SDK
npm run test:sdk

# Web Studio & Drafter
npm run test:web

# Event Watcher
npm run test:watcher

# IronClaw MCP Server
npm run test:mcp

# ElizaOS Plugin
npm run test:eliza
```

---

## 2. The Problem

To let an AI agent transact today, its owner must give it credentials. In practice, that means the agent holds a full private key in a plaintext file on the owner's machine, alongside third-party skills written by unknown contributors.

This creates an acute security hazard:
- A malicious skill or tool accesses the local filesystem and extracts master keys.
- Prompt injection in untrusted input instructs the agent to drain funds. The model cannot reliably distinguish real instructions from adversarial injections.
- A credential file leaks from an exposed server.
- Onchain transactions are final and irreversible.

In every failure mode, the root cause is the same: the agent held a master key that could sign any action the owner could sign.

---

## 3. How ScopeGuard Works

ScopeGuard replaces master keys with protocol-enforced, scoped function-call access keys on NEAR Protocol:
1. **Agent Sub-Account:** The agent operates under a dedicated sub-account (e.g. `trader.alice.near`), isolated from the owner's main balance.
2. **Spending Vault:** The owner deposits a working balance into the Guard contract. The agent can only move funds that reside inside this vault.
3. **Scoped Function-Call Key:** The agent machine holds a NEAR function-call access key restricted by protocol consensus to `receiver = Policy Contract`, `methods = ["execute"]`, with a capped gas allowance. It cannot transfer native NEAR directly, deploy code, add or delete keys, or call arbitrary contracts.
4. **Onchain Guard Policy:** Every action is checked by a Rust contract on NEAR against owner-signed rules. If all checks pass, the Guard performs the action on behalf of the agent. If any check fails, the transaction records a structured reason code onchain without panicking and increments an auto-pause strike counter.
5. **Circuit Breakers & Timelocks:** Repeated policy violations trip an automatic pause. Actions at or above a configured threshold enter a timelock quarantine requiring explicit owner settlement.

---

## 4. Architecture & Repository Layout

```
Scopeguard/
├── contracts/
│   ├── policy/         # Guard contract (Rust, near-sdk 5.29)
│   ├── mock-token/     # Minimal NEP-141 token (mUSD) with faucet
│   └── mock-dex/       # Fixed-rate swap contract (agent demo target)
├── sdk/                # TypeScript SDK (@scopeguard/sdk)
├── drafter/            # AI scope drafter with JSON Schema validation and lint
├── packages/
│   ├── ironclaw-mcp/   # Model Context Protocol stdio server for sandboxed runtimes
│   └── plugin-eliza/   # ElizaOS autonomous agent plugin
├── watcher/            # Event tailing daemon for Telegram and Discord alerts
├── demo-agent/         # Naive inbox-driven demo agent for adversarial testing
└── web/                # Next.js 15 studio console with live attack testing
```

---

## 5. Security Model & Honest Limits

Transparency regarding boundaries and threat models:

1. **Loss Bound:** Maximum financial loss is bounded by `min(vault balance, rolling 24h cap)` per asset. An attacker cannot drain external balances or exceed the configured cap, but legitimate allowed actions within the daily budget could still be triggered if the agent is manipulated.
2. **Independent Budgets:** Native NEAR and NEP-141 token assets maintain independent rolling spend windows and timelock thresholds. Native NEAR operations fail closed by default if no native cap is configured.
3. **Rolling Window Semantics:** Spend caps use a rolling window of 1-hour buckets with a 24-hour lookback (effective window: 24 to 25 hours). This prevents boundary double-spend attacks where a daily budget is spent immediately before and after a fixed midnight reset.
4. **ContractCall Restrictions:** Generic `ContractCall` actions cannot target the custody token and cannot call value-moving methods (`ft_transfer`, `nft_transfer`, `mt_transfer`, `withdraw`, `storage_withdraw`, etc.). Calldata actions must be value-neutral, and attached deposits count against the native NEAR budget.
5. **Single Owner Key:** Owner administrative controls (pause, unpause, withdraw, revoke, reset) require the owner's cryptographic signature.
6. **Asynchronous Settlement & Rollback:** Downstream cross-contract failures trigger internal refund callbacks, returning funds to the agent vault and rolling back the recorded spend in the original bucket.
7. **Mock Contracts & Testnet:** The current deployment operates on NEAR Testnet using mock token and mock DEX contracts. Intent transfers route to a mock deposit contract.

---

## 6. Administrative Operations

Owner actions can be executed via NEAR CLI or directly through the web console:

| Method | Access | Description |
| :--- | :--- | :--- |
| `pause` | Owner only | Halts all agent actions until unpaused |
| `unpause` | Owner only | Restores normal execution after an auto-pause or manual freeze |
| `withdraw` | Owner only | Withdraws tokens from the agent vault directly back to owner |
| `withdraw_near` | Owner only | Withdraws native NEAR from the agent vault back to owner |
| `revoke_agent` | Owner only | Permanently clears target/recipient allowlists and pauses agent |
| `reset_windows` | Owner only | Clears rolling spend buckets and reset auto-pause strikes |
| `settle_pending` | Owner only | Approves and executes a quarantined timelocked action |
| `cancel_pending` | Owner only | Cancels and purges a quarantined timelocked action |

---

## 7. License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
