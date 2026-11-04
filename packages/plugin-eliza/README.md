# @scopeguard/plugin-eliza

Official ScopeGuard security plugin for [ElizaOS](https://github.com/elizaos/eliza) agents on NEAR Protocol.

Provides scoped onchain passkeys, daily spending caps, circuit breakers, and timelocked quarantine queues for autonomous AI agents.

---

## The Problem ScopeGuard Solves

Today, autonomous agents hold master private keys. If an agent is tricked by a prompt injection attack, all funds in the wallet can be completely drained in a single transaction.

With `@scopeguard/plugin-eliza`, the agent never touches a full master key:
- It operates using a limited NEAR FunctionCall passkey restricted to `execute`.
- Every action is verified onchain against rules the human owner configured.
- Attacks die onchain with explicit refusal reason codes (`RECIPIENT_NOT_ALLOWED`, `TARGET_NOT_ALLOWED`, `OVER_DAILY_CAP`).
- A 3-strike circuit breaker halts execution automatically if an attacker attempts rapid-fire exploits.

---

## Installation

```bash
npm install @scopeguard/plugin-eliza @scopeguard/sdk
```

---

## Setup & Quickstart

### 1. Configure the Agent Character in ElizaOS

Add `@scopeguard/plugin-eliza` to your agent character file:

```json
{
  "name": "TraderAgent",
  "plugins": ["@scopeguard/plugin-eliza"],
  "settings": {
    "secrets": {
      "SCOPEGUARD_CREDENTIAL_PATH": "./agent.json"
    }
  }
}
```

Or pass the credential directly via an environment variable in `.env`:

```env
SCOPEGUARD_CREDENTIAL_JSON={"agentAccountId":"trader.owner.near","policyContractId":"guard.owner.near","privateKey":"ed25519:...","publicKey":"ed25519:...","networkId":"testnet"}
```

---

## Capabilities Provided

### 1. Real-Time Policy Provider (`SCOPEGUARD_POLICY_PROVIDER`)

Automatically injects live onchain security context directly into the agent's prompt:
- Active agent account ID and policy contract ID
- Daily spending cap, amount spent today, and remaining budget
- Vault balance (tokens and native NEAR)
- Operating status (`ACTIVE` vs `PAUSED`)
- Velocity limit and action count in the rolling 10-minute window
- Quarantine threshold for high-value transactions

### 2. Actions

| Action | Description | Similes |
| :--- | :--- | :--- |
| `EXECUTE_ONCHAIN_ACTION` | Executes a transaction scoped through the ScopeGuard passkey. Handles `ALLOWED`, `PENDING` (timelock quarantine), and `REJECTED` outcomes. | `CALL_CONTRACT`, `TRANSFER_FUNDS`, `SWAP_TOKENS`, `NEAR_TRANSFER` |
| `GET_WALLET_BUDGET` | Queries current spend, velocity, vault balance, and circuit breaker health. | `CHECK_BUDGET`, `CHECK_ALLOWANCE`, `CHECK_VAULT_BALANCE` |
| `SIMULATE_ONCHAIN_ACTION` | Zero-gas preflight simulation to check if an action will pass before broadcasting. | `CHECK_ACTION`, `PREFLIGHT_TRANSACTION`, `DRY_RUN_ACTION` |

---

## Handling Escalations & High-Value Timelocks

When an agent executes an action that meets or exceeds the owner's `high_value_threshold`, ScopeGuard does not reject it. Instead, it quarantines the action in a timelock queue onchain with status `PENDING`.

The plugin automatically provides human-readable escalation messages so the agent can inform its owner:
```
Action queued in ScopeGuard review quarantine (Pending ID: #3).
Estimated review delay: 3600 seconds.
The owner must approve this in the ScopeGuard dashboard before funds move.
```

---

## Verifying the Plugin

Run the native test suite:

```bash
npm test --prefix packages/plugin-eliza
```
