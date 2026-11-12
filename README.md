# ScopeGuard: Onchain Guardrails for Autonomous Capital

[![ScopeGuard CI](https://github.com/Sergeo01/Scopeguard/actions/workflows/ci.yml/badge.svg)](https://github.com/Sergeo01/Scopeguard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Track:** AI Security & Defense

Give your agents a budget, not your private keys. ScopeGuard provides onchain guardrails, spending bounds, and circuit breakers for autonomous capital on NEAR Protocol.

- **Live Console:** [https://scopeguard.blockframe.cloud](https://scopeguard.blockframe.cloud)
- **Interactive Attack Comparison:** [https://scopeguard.blockframe.cloud/compare](https://scopeguard.blockframe.cloud/compare)
- **Deployed Testnet Contract:** `scopeguard.testnet`

---

## Try it in 60 seconds

1. Open [https://scopeguard.blockframe.cloud/compare](https://scopeguard.blockframe.cloud/compare)
2. Click "Play All" to run the side-by-side comparison between an unprotected agent and the ScopeGuard policy-enforced agent.
3. Observe how the unprotected agent drains the working balance, while the ScopeGuard agent blocks unauthorized targets, enforces speed limits, and trips the circuit breaker on rogue canary calls.

**Expected Outcome:** Identical prompt injection produces opposite outcomes. The protected run displays live onchain preflight evaluations and structured rejection reason codes (`TARGET_NOT_ALLOWED`, `METHOD_NOT_ALLOWED`, `OVER_DAILY_CAP`, `RECIPIENT_NOT_ALLOWED`).

---

## Verify on-chain

Query the deployed policy contract directly using NEAR CLI:

```bash
# Verify contract deployment and version
near view scopeguard.testnet get_version
# Expected output: "0.4.0"

# Query registered agent budget and policy status
# Note: agent_account is required for get_budget and get_policy queries
near view scopeguard.testnet get_budget '{"agent_account": "agent.sergeo-guard.testnet"}'
# Expected output:
# {
#   "cap": "500",
#   "spent": "0",
#   "remaining": "500",
#   "actions_in_window": 0,
#   "paused": false,
#   "vault_balance": "350",
#   "revoked": false,
#   "high_water_mark": "350",
#   "max_drawdown_bps": 2000,
#   "near_vault_balance": "0",
#   "near_high_water_mark": "0",
#   "near_cap": null,
#   "near_spent": "0",
#   "near_remaining": null
# }

# Query registered agent policy rules
near view scopeguard.testnet get_policy '{"agent_account": "agent.sergeo-guard.testnet"}'
```

---

## 1. Quickstart

### Prerequisites
- [Rust](https://rustup.rs/) (1.99.1, pinned in `rust-toolchain.toml`) with target `wasm32-unknown-unknown`
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

### Run the Web Studio

To run the local web studio console:

1. Copy the example environment file:
   ```bash
   cp web/.env.local.example web/.env.local
   ```
2. Set the policy contract ID in `web/.env.local`:
   - `NEXT_PUBLIC_POLICY_CONTRACT_ID`: The canonical public variable inlined into client browser bundles (e.g. `YOUR_POLICY_CONTRACT.testnet`).
   - `SCOPEGUARD_POLICY_CONTRACT`: The canonical variable for server-side API routes and CLI operations.
3. Start the Next.js development server:
   ```bash
   npm run dev --prefix web
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
1. **Agent Sub-Account:** The agent operates under a dedicated sub-account (e.g. `agent.alice.near`), isolated from the owner's main balance.
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
├── docs/               # Technical architecture, policy reference, threat model, and deployment guides
├── sdk/                # TypeScript SDK (@scopeguard/sdk)
├── drafter/            # AI scope drafter with JSON Schema validation and lint
├── packages/
│   ├── ironclaw-mcp/   # Model Context Protocol stdio server for sandboxed runtimes
│   └── plugin-eliza/   # ElizaOS autonomous agent plugin
├── watcher/            # Event tailing daemon for Telegram and Discord alerts
├── demo-agent/         # Naive inbox-driven demo agent for adversarial testing
└── web/                # Next.js 15 studio console with live attack testing
```

For detailed specifications and operational guides:
- [Architecture Guide](docs/architecture.md): System invariants, state layout, and execution flow.
- [Policy Reference](docs/policy-reference.md): Specification of policy rules, validation schema, and reason codes.
- [Threat Model](docs/threat-model.md): Threat vectors, isolation boundaries, and fail-safe mechanisms.
- [Deployment Guide](docs/deployment.md): Commands for building, deploying, configuring, and verifying on testnet.

### NEAR Tech Stack

- **NEAR Smart Contracts (Rust, near-sdk 5.29):** Policy evaluation engine, circuit breaker strike tracking, rolling 24-25h spend accounting, timelock queue, and native NEAR drawdown floor protection.
- **NEAR Function-Call Access Keys:** Scoped keys restricted by protocol consensus to `receiver = Policy Contract`, `methods = ["execute"]`. Agent machine never holds owner keys or transfer permissions.
- **NEAR JSON-RPC & near-api-js:** Direct RPC integration for preflight simulation, transaction submission, receipt decoding, and event tailing.
- **Model Context Protocol (IronClaw MCP Server):** Guarded tool boundary exposing audited NEAR actions to LLM agent runtimes.
- **ElizaOS Plugin (`@scopeguard/plugin-eliza`):** Guardrail action provider and evaluator for autonomous agents.
- **Testnet Mock Contracts:** `mock-token` (test NEP-141 token) and `mock-dex` (test swap contract). Note: `IntentTransfer` targets a mock deposit contract for testing solver flows, not live mainnet NEAR Intents.

---

## 5. Security Model & Honest Limits

Transparency regarding boundaries and threat models:

1. **Loss Bound:** Maximum financial loss is bounded by `min(vault balance, rolling 24h cap)` per asset across an effective 24-25 hour rolling window (1-hour buckets with a 24-hour lookback). An attacker cannot drain external balances or exceed the configured cap, but legitimate allowed actions within the daily budget could still be triggered if the agent is manipulated.
2. **Independent Budgets:** Native NEAR and NEP-141 token assets maintain independent rolling spend windows and timelock thresholds. Native NEAR operations fail closed by default if no native cap is configured.
3. **Rolling Window Semantics:** Spend caps use a rolling window of 1-hour buckets with a 24-hour lookback (effective window: 24 to 25 hours). This prevents boundary double-spend attacks where a daily budget is spent immediately before and after a fixed midnight reset.
4. **ContractCall Value-Neutral Trust Assumption:** Generic `ContractCall` actions carry no token transfer accounting. Therefore, allowlisted methods on target contracts must be value-neutral (queries, state pings, storage registrations). They cannot target the custody token and cannot call value-moving methods (`ft_transfer`, `nft_transfer`, `mt_transfer`, `withdraw`, `near_withdraw`, `storage_withdraw`, `storage_unregister`). Attached deposits debit the agent's NEAR vault balance and count against the native NEAR budget.
5. **Single Owner Key:** Owner administrative controls (pause, unpause, withdraw, revoke, reset) require the owner's cryptographic signature.
6. **Asynchronous Settlement & Rollback:** Downstream cross-contract failures trigger internal refund callbacks, returning funds to the agent vault and rolling back the recorded spend in the original bucket.
7. **Mock Contracts & Testnet:** The current deployment operates on NEAR Testnet using mock token and mock DEX contracts. IntentTransfer targets a mock deposit contract, not real NEAR Intents.
8. **EVM & Chain Signatures Scope:** Cross-chain foreign EVM signing via NEAR MPC and HTTP x402 micro-allowances are future roadmap milestones; the current release strictly governs NEAR native operations and NEP-141 token custody.
9. **Indexer Architecture:** The web console and watcher query NEAR testnet RPC endpoints directly with automatic fleet failover; a dedicated NearLake indexer is not required for testnet operation.
10. **Attack Arena Demo Keys:** In the hosted web demo (`/api/attack`), `SCOPEGUARD_AGENT_PRIVATE_KEY` is maintained server-side solely to execute live testnet transactions on demand for evaluators. In production deployments, agent keys reside exclusively in the agent's local environment, and server signing should remain disabled (`SCOPEGUARD_ALLOW_SERVER_SIGNING` unset).

---

## 6. Environment & Security Configuration

The ScopeGuard architecture uses canonical environment variables for contract binding and owner signing controls:

| Variable | Default | Purpose & Constraints |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_POLICY_CONTRACT_ID` | unset | Canonical public variable inlined into client browser bundles by Next.js. Required for client-side contract interactions. |
| `SCOPEGUARD_POLICY_CONTRACT` | unset | Canonical variable for server-side API routes, event watcher daemons, and CLI scripts. |
| `SCOPEGUARD_ALLOW_SERVER_SIGNING` | unset (false) | When unset or false, server signing is disabled. Privileged endpoints reject signing requests and return the exact CLI command for local execution. In production, this should remain unset. |
| `SCOPEGUARD_SHARED_SECRET` | unset | Required when `SCOPEGUARD_ALLOW_SERVER_SIGNING=true`. Must match incoming `Authorization: Bearer <secret>` or `x-scopeguard-secret` header via constant-time comparison (`crypto.timingSafeEqual`). |

**Fail-Closed Security Invariant:** If `SCOPEGUARD_ALLOW_SERVER_SIGNING=true` but `SCOPEGUARD_SHARED_SECRET` is unset or empty, the API refuses owner-signing requests with HTTP status 500 (fail-closed).

---

## 7. Administrative Operations

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

## 8. License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
