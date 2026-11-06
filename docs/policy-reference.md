# ScopeGuard Policy Reference

This document provides a complete technical specification of the ScopeGuard policy schema, typed action variants, and evaluation reason codes.

---

## 1. Policy Schema (`Policy`)

```json
{
  "daily_cap": "1000",
  "near_daily_cap": "5000000000000000000000000",
  "targets": ["sergeo-guard-dex.testnet", "ref-finance.near"],
  "allowed_methods": ["swap", "deposit"],
  "recipients": ["alice.testnet"],
  "intent_recipients": ["0x1234567890abcdef1234567890abcdef12345678"],
  "max_actions_per_10min": 10,
  "high_value_threshold": "500",
  "near_high_value_threshold": "2000000000000000000000000",
  "high_value_delay_seconds": 86400,
  "auto_pause_rejects": 3,
  "auto_pause_window_seconds": 600,
  "task_lease_duration_seconds": 604800,
  "drawdown_threshold_bps": 2000,
  "canary_methods": ["admin_drain", "drain_all", "drain_vault"]
}
```

### Field Definitions

| Field | Type | Description |
| :--- | :--- | :--- |
| `daily_cap` | `U128` | Maximum total NEP-141 token spend permitted across a rolling 24-25h window. |
| `near_daily_cap` | `Option<U128>` | Maximum total native NEAR spend permitted across a rolling 24-25h window (in yoctoNEAR). Default is disabled (fails closed for NEAR actions). |
| `targets` | `Vec<AccountId>` | Allowlisted smart contract accounts that the agent may invoke. Wildcards (`*`) are strictly prohibited. |
| `allowed_methods` | `Vec<String>` | Allowlisted method names the agent may invoke on target contracts. Wildcards are prohibited. |
| `recipients` | `Vec<AccountId>` | Allowlisted NEAR account IDs permitted to receive direct token or NEAR transfers. An empty list forbids all direct transfers. |
| `intent_recipients` | `Vec<String>` | Allowlisted destination addresses for `IntentTransfer` actions (targets mock deposit contract on testnet). |
| `max_actions_per_10min` | `u32` | Maximum allowable actions within any rolling 10-minute sliding window. |
| `high_value_threshold` | `U128` | NEP-141 token amount at or above which an action enters the timelock quarantine queue instead of executing immediately. |
| `near_high_value_threshold` | `Option<U128>` | Native NEAR amount (yoctoNEAR) at or above which an action enters the timelock quarantine queue. |
| `high_value_delay_seconds` | `u64` | Quarantine duration required before an owner can settle a pending action (production default: 86400s). |
| `auto_pause_rejects` | `u32` | Number of policy rejects within the configured window that automatically trips the emergency pause circuit breaker. |
| `auto_pause_window_seconds` | `u64` | Rolling duration in seconds for tracking auto-pause rejection strikes. |
| `task_lease_duration_seconds` | `Option<u64>` | Maximum lifespan of agent authority from policy activation. Once expired, all actions require owner renewal. |
| `drawdown_threshold_bps` | `Option<u32>` | Maximum allowable loss in basis points (100 bps = 1%) relative to the vault all-time high-water mark. |
| `canary_methods` | `Option<Vec<String>>` | Decoy method names that immediately trip an auto-pause when called. |

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
Cross-chain solver deposit targeting a mock intent deposit contract on testnet.
- Checked against: `intent_recipients`, `daily_cap`, `high_value_threshold`, `vault_balance`.

### 5. `NearTransfer`
Direct payout of native NEAR from the agent's internal NEAR vault.
- Checked against: `recipients`, `near_daily_cap`, `near_high_value_threshold`, `near_vault_balance`.

---

## 3. Policy Evaluation Check Order

The Guard checks rules in this exact, immutable order:

1. `NOT_AGENT`: Caller must be the registered agent account ID.
2. `PAUSED`: Agent must not be in a paused state.
3. `OVER_VELOCITY_CAP`: Current 10-minute action count must be strictly less than `max_actions_per_10min`.
4. `TARGET_NOT_ALLOWED`: Target contract must appear in `targets`. ContractCall cannot target custody token.
5. `METHOD_NOT_ALLOWED`: Method must appear in `allowed_methods`. Token transfers cannot use generic ContractCall. Denylisted value-moving methods are blocked.
6. `OVER_DAILY_CAP`: Requested amount plus rolling 24h spend must fit within the daily cap (token or NEAR).
7. `RECIPIENT_NOT_ALLOWED`: Destination account must appear in `recipients` (or `intent_recipients`).
8. `PENDING`: Actions at or above threshold are deferred to timelock queue (outcome, not rejection).
9. `INSUFFICIENT_VAULT_BALANCE`: Amount must not exceed available internal vault balance.
10. `PENDING_QUEUE_FULL`: The timelock queue cannot exceed capacity (`MAX_PENDING_ACTIONS = 16`).

---

## 4. Reason Codes Reference Table

| Reason Code | Trigger Condition |
| :--- | :--- |
| `NOT_AGENT` | Caller account does not match the registered agent ID. |
| `PAUSED` | Agent is currently frozen by manual owner command or auto-pause circuit breaker. |
| `OVER_VELOCITY_CAP` | Actions in the current 10-minute sliding window exceed `max_actions_per_10min`. |
| `TARGET_NOT_ALLOWED` | Target contract is not in `policy.targets`, or ContractCall targeted custody token. |
| `METHOD_NOT_ALLOWED` | Method is not in `policy.allowed_methods`, or method is in value-moving denylist. |
| `OVER_DAILY_CAP` | Requested spend exceeds available rolling 24-25h budget for the asset. |
| `RECIPIENT_NOT_ALLOWED` | Recipient is not in `policy.recipients` or `policy.intent_recipients`. |
| `INSUFFICIENT_VAULT_BALANCE` | Requested amount exceeds available internal custody vault balance. |
| `PENDING_QUEUE_FULL` | Timelock quarantine queue is at maximum capacity (16 actions). |
| `CANARY_TRIPPED` | Caller attempted to execute a honey-token method listed in `canary_methods`. |
| `DRAWDOWN_EXCEEDED` | Vault balance has breached the maximum drawdown threshold below high-water mark. |
| `TASK_LEASE_EXPIRED` | Policy task lease time limit has elapsed. |
