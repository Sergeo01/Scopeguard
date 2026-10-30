# Verification Guide for Judges (Human & AI Judges)

This document provides exact, reproducible steps for human judges and AI judges (such as Claude Code and Codex) to verify ScopeGuard on NEAR.

## 1. The Core Threat Model

When an AI agent holds an unrestricted private key, a single prompt injection or malicious skill can drain 100% of the funds in one block. 

ScopeGuard replaces unrestricted keys with a protocol-level restricted key (a NEAR function-call access key) paired with an onchain Policy contract. The agent can only call `execute` on the Policy contract, which enforces ten ordered checks:

1. `NOT_AGENT`: Caller must match the registered agent sub-account.
2. `PAUSED`: Agent must not be paused by the owner or the circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist. A generic `ContractCall` may never target the custody token.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target contract, and token transfers must use typed `GuardAction::Transfer`.
6. `OVER_DAILY_CAP`: Spend in the current 24-hour budget window plus requested amount must fit the daily cap.
7. `RECIPIENT_NOT_ALLOWED`: Transfers to external recipients must be explicitly allowlisted.
8. `PENDING` (an outcome, not a rejection): at or above `high_value_threshold`, the action waits for owner settlement.
9. `INSUFFICIENT_VAULT_BALANCE`: A `Transfer` cannot exceed the agent's own vault.
10. `PENDING_QUEUE_FULL`: The timelock queue is bounded.

### Critical Engineering Invariant

The `execute` method never panics on a policy rejection. Panicking would revert the transaction's state changes, erasing the audit log and rolling back the circuit breaker. Instead, rejections are recorded in contract state, emitted as structured events, and returned as value outcomes (`status: "REJECTED"`, `reason: "<CODE>"`). Only an unregistered caller panics, before any state is touched.

---

## 2. Unit Test Verification (Cargo)

Run the full smart contract test suite to verify every check code, lazy window reset, token predecessor check, and circuit breaker trip:

```bash
cd contracts/policy
cargo test
```

### Result

`42 passed, 0 failed, 0 ignored` (finished in ~0.6s)

Key verified properties:
- `test_contract_call_cannot_target_custody_token`: Proves generic `ContractCall` cannot target the custody token to bypass typed transfers.
- `test_contract_call_cannot_bypass_transfer_cap_or_recipient`: Proves generic `ContractCall` to `ft_transfer` is refused with `METHOD_NOT_ALLOWED`.
- `test_check_order_paused_before_contract_call_method_check`: Proves `PAUSED` (Check 2) is evaluated strictly before method and target checks.
- `test_unauthorized_token_cannot_deposit_to_vault`: Proves unauthorized callers cannot call `ft_on_transfer` to inflate the vault.
- `test_staged_wildcard_policy_rejected`: Proves wildcard methods are rejected during policy updates.
- `test_swap_does_not_falsely_debit_vault`: Proves vault balance only decrements on real token movement.
- `test_only_owner_can_settle_timelock`: Proves agents cannot settle their own quarantined intents.
- `test_transfer_failure_refunds_vault_balance`: Proves asynchronous rollback restores internal vault balance and spent budget if downstream transfer fails.
- `test_withdraw_failure_refunds_vault_balance`: Proves internal vault balance is refunded if downstream owner withdrawal transfer fails.
- `test_revoke_agent_wipes_allowlists_and_pauses`: Proves `revoke_agent` empties targets and recipients and sets both `paused` and `revoked` while keeping the vault withdrawable.
- `test_revoked_agent_still_rejected_after_unpause`: Proves unpausing a revoked agent does not restore anything: the empty allowlist still rejects.
- `test_revoke_agent_clears_staged_policy_and_pending`: Proves revocation also clears a staged policy and the pending queue.
- `test_revoke_agent_is_owner_only`: Proves an agent cannot revoke itself.
- `test_reset_windows_clears_spend_velocity_and_strikes`: Proves `reset_windows` zeroes spend, velocity and strikes without touching the policy or pause state.
- `test_reset_windows_is_owner_only` / `test_reset_windows_rejects_revoked_agent`: Prove the reset is owner-only and refuses a revoked agent.
- `test_get_version`: Proves contract version query returns `0.2.0`.

---

## 3. Automated AI Judge Verification Script

Run the automated judge runner (which runs the native Rust test suite plus rule evaluations in one command):

```bash
node scripts/verify-ai-judge.js
```

---

## 4. Live NEAR Testnet Verification

AI and human judges can verify live consensus enforcement on NEAR Testnet:

```bash
node scripts/testnet-demo-agent-e2e.js
```

### Live Testnet Deployments:
- **Guard Policy Contract:** [`guard2.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet)
- **Token Vault (mUSD):** [`sergeo-guard-token.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-token.testnet)
- **Mock DEX:** [`sergeo-guard-dex.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet)
- **Agent Sub-Account:** [`agent.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/agent.sergeo-guard.testnet)
- **Owner Account:** [`sergeo-guard.testnet`](https://testnet.nearblocks.io/address/sergeo-guard.testnet)

### Live Onchain Verified Transactions:
Every hash below resolves on a transaction index that still serves history. Verified 2026-10-30.

1. **Contract Deployment (v0.2.0, state preserved):** `B8bb7pQSUNpf4a6f7uBNcrXJx7xiJxJDXdJKXFumAFev`
2. **Agent Retirement (`revoke_agent`, allowlist erased):** `CA9mZuRp1TDFu7hb3Ro6wXnLiD2ft2nUeCd7fpWpkuX9`
3. **Allowed Swap (10 mUSD):** `6MYF5g7TwtSaPEygAnUybRLBLygWBbE45q7Du9fNp8G`
4. **High-Value Quarantine (swap 300 → intent #1):** `2kvqn2ZP6qefuoZxj5aEe93pDx7A52QtVbWX4v9MPUF5`
5. **Owner Veto (`cancel_pending` #1):** `ApLGg8RcWvEaSnWD6FNvUmDhYFQahZUHevZdqxmjbNJq`
6. **Rejection: `RECIPIENT_NOT_ALLOWED`:** `6kEHj53hcqSXbbr2n5j7sLSVrcWwuGjTH6ongEBbsoNL`
7. **Rejection: `TARGET_NOT_ALLOWED`:** `EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ`
8. **Rejection: prompt-injection transfer → `RECIPIENT_NOT_ALLOWED`:** `tsNvfGwZ4gkQyLSqXGDGbyV3ZPH2XHDFAYYE8g1ztQ2`
9. **Retired key replay → `PAUSED`:** `ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5`

The e2e script asserts each of these outcomes on a fresh run, and exits non-zero if any check fails.

---

## 5. Reason Code Reference Table

| Check Order | Reason Code | Trigger Condition |
| :--- | :--- | :--- |
| 1 | `NOT_AGENT` | Caller predecessor is not registered in the Guard |
| 2 | `PAUSED` | Agent is paused manually by owner or tripped by circuit breaker |
| 3 | `OVER_VELOCITY_CAP` | Actions in the 10-minute window exceed `max_actions_per_10min` |
| 4 | `TARGET_NOT_ALLOWED` | Target contract is not in `policy.targets` |
| 5 | `METHOD_NOT_ALLOWED` | Method name is not allowlisted for target, or token call tried to bypass `GuardAction::Transfer` |
| 6 | `OVER_DAILY_CAP` | Amount exceeds daily cap in the 24-hour spend window |
| 7 | `RECIPIENT_NOT_ALLOWED` | Moving funds to an unlisted recipient address |
| 8 | `PENDING` | At or above `high_value_threshold`; queued for owner settle/veto |
| 9 | `INSUFFICIENT_VAULT_BALANCE` | `Transfer` amount exceeds the agent's own vault balance |
| 10 | `PENDING_QUEUE_FULL` | The bounded timelock queue is full |

---

## 6. Pre-Demo Reset and Status Verification

If the agent has been paused by the circuit breaker, or a previous evaluation consumed the velocity window, reset with one command:

```bash
node scripts/reset-demo.js
```

It unpauses the agent, vetoes and clears pending intents, and calls `reset_windows` to zero the spend and velocity counters. It does not change the policy, the allowlist, or the vault balance. Use `--dry-run` to inspect state without signing anything.

Or execute the owner calls directly with NEAR CLI:

```bash
near call guard2.sergeo-guard.testnet reset_windows '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000
near call guard2.sergeo-guard.testnet unpause '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000
```

---

## 7. Web Console Notes for Judges

- The fleet console at `/admin` reads `get_agents(owner)` and `get_budget` live. It contains no fixture agents, and it does not claim the visitor is authenticated: viewing needs no wallet, and every action produces a `near call` command you sign yourself.
- Server-side owner signing is off by default. `/api/register` and `/api/fund` return a CLI command unless the operator sets `SCOPEGUARD_ALLOW_SERVER_SIGNING=true`; they never read `~/.near-credentials`.
- `/api/attack` returns the contract's own outcome and reason code. A rejection is a 200 with `status: "REJECTED"`, because the contract returns data rather than panicking.
