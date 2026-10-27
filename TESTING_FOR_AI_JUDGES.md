# Verification Guide for Judges (Human & AI Judges)

This document provides exact, reproducible steps for human judges and AI judges (such as Claude Code and Codex) to verify ScopeGuard on NEAR.

## 1. The Core Threat Model

When an AI agent holds an unrestricted private key, a single prompt injection or malicious skill can drain 100% of the funds in one block. 

ScopeGuard replaces unrestricted keys with a protocol-level restricted key (a NEAR function-call access key) paired with an onchain Policy contract. The agent can only call `execute` on the Policy contract, which enforces seven checks in strict sequence:

1. `NOT_AGENT`: Caller must match the registered agent sub-account.
2. `PAUSED`: Agent must not be paused by the owner or the circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target contract.
6. `OVER_DAILY_CAP`: Rolling 24-hour spend plus requested amount must fit the daily limit.
7. `RECIPIENT_NOT_ALLOWED`: Transfers to external recipients must be explicitly allowlisted.

### Critical Engineering Invariant

The `execute` method never panics on a policy rejection. Panicking would revert the transaction's state changes, erasing the audit log and rolling back the circuit breaker. Instead, rejections are recorded in contract state, emitted as structured events, and returned as value outcomes (`status: "REJECTED"`, `reason: "<CODE>"`). Only an unregistered caller panics, before any state is touched.

---

## 2. Unit Test Verification (Cargo)

Run the full smart contract test suite to verify every check code, lazy window reset, and circuit breaker trip:

```bash
cd contracts/policy
cargo test
```

### Expected Output ("Do X, See Y")

- `test tests::test_register_and_views ... ok`
- `test tests::test_recipient_not_allowed ... ok`
- `test tests::test_pending_queue_full_returns_value_not_panic ... ok`
- `test tests::test_legit_action_allowed ... ok`
- `test tests::test_check_order_velocity_before_allowlist ... ok`
- `test tests::test_over_daily_cap ... ok`
- `test tests::test_policy_staging_and_cancellation ... ok`
- `test tests::test_action_below_and_at_threshold ... ok`
- `test tests::test_method_not_allowed ... ok`
- `test tests::test_settle_before_delay_refused - should panic ... ok`
- `test tests::test_settle_after_delay_performs_and_records_spend ... ok`
- `test tests::test_auto_pause_circuit_breaker ... ok`
- `test tests::test_cancel_pending_intent ... ok`
- `test tests::test_owner_pause_and_unpause ... ok`
- `test tests::test_lazy_window_resets ... ok`
- `test tests::test_emergency_powers_not_delayed ... ok`
- `test tests::test_target_not_allowed ... ok`
- `test tests::test_unregistered_caller_panics - should panic ... ok`
- `test tests::test_settle_recheck_failure_discards_intent ... ok`

Result: `19 passed, 0 failed, 0 ignored`

---

## 3. Live NEAR Testnet Protocol Spike Verification

AI and human judges can run the live testnet verification script:

```bash
node scripts/setup-and-spike.js
```

This live script performs 7 concrete onchain operations against live contracts:
1. **Registered Agent Execution:** Executes an authorized swap through `guard.sergeo-guard.testnet` (`ALLOW` emitted, cross-contract swap executed on `sergeo-guard-dex.testnet`).
2. **Timelock Queueing:** Attempts an action exceeding the high-value threshold (`PENDING` emitted with pending id).
3. **Queue Inspection:** Reads the public onchain pending queue via view call.
4. **Owner Veto:** Owner cancels the pending intent with 0 delay (`CANCELLED` emitted, intent purged).
5. **Protocol Target Enforcement:** Agent tries to call DEX directly bypassing the Guard; NEAR consensus rejects with `Wrong AccessKey used for transaction: transaction is sent to receiver_id=sergeo-guard-dex.testnet, but is signed with function call access key that restricted to only use with receiver_id=guard.sergeo-guard.testnet`.
6. **Protocol Method Enforcement:** Agent tries to call an unlisted method on Guard; NEAR consensus rejects with `Transaction method name cancel_policy_change isn't allowed by the access key`.
7. **Protocol Transfer Enforcement:** Agent tries to transfer NEAR directly; NEAR consensus rejects with `The transaction contains more then one action, but it was signed with an access key which allows transaction to apply only one specific action`.

---

## 4. Reason Code Reference Table

| Check Order | Reason Code | Trigger Condition |
| :--- | :--- | :--- |
| 1 | `NOT_AGENT` | Caller predecessor is not registered in the Guard |
| 2 | `PAUSED` | Agent is paused manually by owner or tripped by circuit breaker |
| 3 | `OVER_VELOCITY_CAP` | Actions in the 10-minute window exceed `max_actions_per_10min` |
| 4 | `TARGET_NOT_ALLOWED` | Target contract is not in `policy.targets` |
| 5 | `METHOD_NOT_ALLOWED` | Method name is not allowlisted for the target contract |
| 6 | `OVER_DAILY_CAP` | Amount exceeds daily cap in the rolling 24-hour window |
| 7 | `RECIPIENT_NOT_ALLOWED` | Moving funds to an unlisted recipient address |
