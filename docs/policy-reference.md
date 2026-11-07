# ScopeGuard Policy Reference

This document provides a complete technical specification of the ScopeGuard policy schema, typed action variants, and evaluation reason codes.

---

## 1. Policy Schema (`Policy`)

```json
{
  "token": "sergeo-guard-token.testnet",
  "targets": {
    "sergeo-guard-dex.testnet": ["swap"],
    "ref-finance.near": ["swap"]
  },
  "daily_cap": "1000",
  "recipients": ["alice.testnet"],
  "max_actions_per_10min": 10,
  "auto_pause_rejects": 3,
  "auto_pause_window_minutes": 10,
  "high_value_threshold": "500",
  "high_value_delay_seconds": 86400,
  "policy_change_delay_seconds": 600,
  "max_drawdown_bps": 2000,
  "lease_expires_at": 1893456000,
  "intent_recipients": ["0x1234567890abcdef1234567890abcdef12345678"],
  "canary_methods": ["admin_drain", "drain_all", "drain_vault"],
  "near_daily_cap": "5000000000000000000000000",
  "near_high_value_threshold": "2000000000000000000000000"
}
```

### Field Definitions

| Field | Type | Description |
| :--- | :--- | :--- |
| `token` | `AccountId` | Primary NEP-141 custody token contract ID managed in the agent vault. |
| `targets` | `HashMap<AccountId, Vec<String>>` | Map of allowlisted target smart contract accounts to their allowable method names. Wildcards (`*`) are strictly prohibited. |
| `daily_cap` | `U128` | Maximum total NEP-141 token spend permitted across a rolling 24-25h window. |
| `recipients` | `Vec<AccountId>` | Allowlisted NEAR account IDs permitted to receive direct token or NEAR transfers. An empty list forbids all direct transfers. |
| `max_actions_per_10min` | `u32` | Maximum allowable actions within the fixed 10-minute tumbling window (resets every 10 minutes). |
| `auto_pause_rejects` | `u32` | Number of policy rejects (1 to 64) within the configured window that automatically trips the emergency pause circuit breaker. |
| `auto_pause_window_minutes` | `u64` | Tumbling window in minutes for tracking auto-pause rejection strikes. |
| `high_value_threshold` | `U128` | NEP-141 token amount at or above which an action enters the timelock quarantine queue instead of executing immediately. |
| `high_value_delay_seconds` | `u64` | Quarantine duration required before an owner can settle a pending action (production default: 86400s). |
| `policy_change_delay_seconds` | `u64` | Delay required before a newly staged policy modification can be applied. |
| `max_drawdown_bps` | `Option<u16>` | Maximum allowable loss in basis points (100 bps = 1%) relative to the vault all-time high-water mark. |
| `lease_expires_at` | `Option<u64>` | Unix timestamp in seconds when agent authority expires. Once expired, all actions require owner renewal. |
| `intent_recipients` | `Vec<String>` | Allowlisted destination addresses for `IntentTransfer` actions (targets mock deposit contract on testnet). |
| `canary_methods` | `Vec<String>` | Decoy honey-token method names that immediately trip an auto-pause when called. |
| `near_daily_cap` | `Option<U128>` | Maximum total native NEAR spend permitted across a rolling 24-25h window (in yoctoNEAR). Default is disabled (fails closed for NEAR actions). |
| `near_high_value_threshold` | `Option<U128>` | Native NEAR amount (yoctoNEAR) at or above which an action enters the timelock quarantine queue. |

---

## 2. GuardAction Variants

Every transaction dispatched to `execute` must be encoded as a typed `GuardAction`:

### 1. `Transfer`
Direct payout of the internal vault NEP-141 token to an approved recipient.
- Checked against: `recipients`, `daily_cap`, `high_value_threshold`, `vault_balance`.

### 2. `Swap`
Direct token exchange with an allowlisted decentralized exchange (e.g. Ref Finance, Mock DEX).
- Checked against: `targets`, `allowed_methods` (must allow `swap`), `daily_cap`, `vault_balance`.

### 3. `ContractCall`
Generic smart contract call targeting an allowlisted contract.
- Checked against: `targets`, `allowed_methods`, `VALUE_MOVING_DENYLIST`, `near_daily_cap`, `near_vault_balance`.
- Invariant: Calldata must be value-neutral. Attached deposits count against native NEAR budget.

### 4. `IntentTransfer`
Cross-chain solver deposit targeting a mock intent deposit contract on testnet (not real NEAR Intents).
- Checked against: `intent_recipients`, `daily_cap`, `high_value_threshold`, `vault_balance`.

### 5. `NearTransfer`
Direct payout of native NEAR from the agent's internal NEAR vault.
- Checked against: `recipients`, `near_daily_cap`, `near_high_value_threshold`, `near_vault_balance`.

---

## 3. Policy Evaluation Check Order

The Guard checks rules in this exact, immutable order:

1. `NOT_AGENT`: Caller must match the registered agent account ID.
2. `PAUSED`: Agent must not be in a paused state (manual freeze or auto-pause circuit breaker).
3. `LEASE_EXPIRED`: Policy task lease time limit has elapsed.
4. `CANARY_TRIPPED`: Caller attempted to invoke a honeypot canary method.
5. `OVER_VELOCITY_CAP`: Action count in the current 10-minute tumbling window must not exceed `max_actions_per_10min`.
6. `TARGET_NOT_ALLOWED`: Target contract must appear in `targets`. ContractCall cannot target custody token.
7. `METHOD_NOT_ALLOWED`: Method must appear in `targets[target]`. Token transfers cannot use generic ContractCall. Denylisted value-moving methods are blocked.
8. `OVER_DAILY_CAP`: Requested amount plus rolling 24h spend must fit within the daily cap (token or NEAR).
9. `RECIPIENT_NOT_ALLOWED` / `INTENT_RECIPIENT_NOT_ALLOWED`: Destination account must appear in `recipients` (for `Transfer` and `NearTransfer`). For `IntentTransfer`, the destination address must appear in `intent_recipients`.
10. `INSUFFICIENT_VAULT_BALANCE`: Amount must not exceed available internal vault balance (token or NEAR).
11. `DRAWDOWN_EXCEEDED`: Vault balance after action would breach maximum allowed loss below high-water mark floor.
12. `PENDING` / `PENDING_QUEUE_FULL`: Actions at or above threshold are quarantined in timelock queue (outcome `PENDING`), or rejected with `PENDING_QUEUE_FULL` if queue is at capacity (`MAX_PENDING_ACTIONS = 8`).

---

## 4. Reason Codes Reference Table

| Reason Code | Trigger Condition |
| :--- | :--- |
| `NOT_AGENT` | Caller account does not match the registered agent ID. |
| `PAUSED` | Agent is currently frozen by manual owner command or auto-pause circuit breaker. |
| `LEASE_EXPIRED` | Policy task lease time limit has elapsed. |
| `CANARY_TRIPPED` | Caller attempted to execute a honey-token method listed in `canary_methods`. |
| `OVER_VELOCITY_CAP` | Actions in the current 10-minute tumbling window exceed `max_actions_per_10min`. |
| `TARGET_NOT_ALLOWED` | Target contract is not in `policy.targets`, or ContractCall targeted custody token. |
| `METHOD_NOT_ALLOWED` | Method is not in `policy.targets[target]`, or method is in value-moving denylist. |
| `OVER_DAILY_CAP` | Requested spend exceeds available rolling 24-25h budget for the asset. |
| `RECIPIENT_NOT_ALLOWED` | Recipient is not in `policy.recipients`. |
| `INTENT_RECIPIENT_NOT_ALLOWED` | Destination address for `IntentTransfer` is not in `policy.intent_recipients`. |
| `INSUFFICIENT_VAULT_BALANCE` | Requested amount exceeds available internal custody vault balance. |
| `DRAWDOWN_EXCEEDED` | Vault balance has breached the maximum drawdown threshold below high-water mark. |
| `PENDING_QUEUE_FULL` | Timelock quarantine queue is at maximum capacity (8 actions). |

---

## 5. Contract View Query Examples

### Query Agent Policy (`get_policy`)

```bash
near contract call-function as-read-only guard-v4.sergeo-guard.testnet get_policy \
  json-args '{"agent_account": "agent.sergeo-guard.testnet"}' \
  network-config testnet
```

Expected output:

```json
{
  "token": "sergeo-guard-token.testnet",
  "targets": {
    "sergeo-guard-dex.testnet": ["swap"]
  },
  "daily_cap": "500",
  "recipients": ["alice.testnet"],
  "max_actions_per_10min": 5,
  "auto_pause_rejects": 3,
  "auto_pause_window_minutes": 10,
  "high_value_threshold": "250",
  "high_value_delay_seconds": 60,
  "policy_change_delay_seconds": 60,
  "max_drawdown_bps": 2000,
  "lease_expires_at": null,
  "intent_recipients": ["0x1234567890abcdef1234567890abcdef12345678"],
  "canary_methods": ["admin_drain"],
  "near_daily_cap": "5000000000000000000000000",
  "near_high_value_threshold": "2000000000000000000000000"
}
```

### Query Agent Budget (`get_budget`)

```bash
near contract call-function as-read-only guard-v4.sergeo-guard.testnet get_budget \
  json-args '{"agent_account": "agent.sergeo-guard.testnet"}' \
  network-config testnet
```

Expected output:

```json
{
  "cap": "500",
  "spent": "0",
  "remaining": "500",
  "actions_in_window": 0,
  "paused": false,
  "vault_balance": "100",
  "revoked": false,
  "high_water_mark": "100",
  "max_drawdown_bps": 2000,
  "near_vault_balance": "2000000000000000000000000",
  "near_high_water_mark": "2000000000000000000000000",
  "near_cap": "5000000000000000000000000",
  "near_spent": "0",
  "near_remaining": "5000000000000000000000000"
}
```
