# Verification Guide for Judges (Human & AI Judges)

This document provides exact, reproducible steps for human judges and AI judges (such as Claude Code and Codex) to verify ScopeGuard on NEAR.

## 1. The Core Threat Model

When an AI agent holds an unrestricted private key, a single prompt injection or malicious skill can drain 100% of the funds in one block. 

ScopeGuard replaces unrestricted keys with a protocol-level restricted key (a NEAR function-call access key) paired with an onchain Policy contract. The agent can only call `execute` on the Policy contract, which enforces seven checks in strict sequence:

1. `NOT_AGENT`: Caller must match the registered agent sub-account.
2. `PAUSED`: Agent must not be paused by the owner or the circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target contract, and token transfers must use typed `GuardAction::Transfer`.
6. `OVER_DAILY_CAP`: Rolling 24-hour spend plus requested amount must fit the daily limit.
7. `RECIPIENT_NOT_ALLOWED`: Transfers to external recipients must be explicitly allowlisted.

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

`24 passed, 0 failed, 0 ignored` (finished in ~0.5s)

Key verified properties:
- `test_contract_call_cannot_bypass_transfer_cap_or_recipient`: Proves generic `ContractCall` to `ft_transfer` is refused with `METHOD_NOT_ALLOWED`.
- `test_unauthorized_token_cannot_deposit_to_vault`: Proves unauthorized callers cannot call `ft_on_transfer` to inflate the vault.
- `test_staged_wildcard_policy_rejected`: Proves wildcard methods are rejected during policy updates.
- `test_swap_does_not_falsely_debit_vault`: Proves vault balance only decrements on real token movement.
- `test_only_owner_can_settle_timelock`: Proves agents cannot settle their own quarantined intents.

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
- **Agent Sub-Account:** [`trader.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/trader.sergeo-guard.testnet)
- **Owner Account:** [`sergeo-guard.testnet`](https://testnet.nearblocks.io/address/sergeo-guard.testnet)

### Live Onchain Verified Transactions:
1. **Contract Deployment:** `Bu3g5C3S3xvhH7H1XktVrdD37ZPMuZ1xYUEo8ukE8fiG`
2. **Contract Initialization (`new`):** `Fo5FSTsnjieAx6CDKYyKeV1rZDwfCXMBHY42HvtGTZZF`
3. **Agent Registration:** `9j7E9oAkntMHcRvUyvekkosoAqkcjY4j3xJdTYknMDuL`
4. **Scoped Passkey Added:** `57geTR5EE9ksrHG8xH1MeaFtUHmWQZUZSa9RQw45tsKc`
5. **Real NEP-141 Vault Deposit (100 mUSD):** `58QZh1CgMFBT3tCC5gR5sSKthC3SBYpn6o23j7c9U8Ha`
6. **Legitimate Swap Allowed on DEX:** `mzA18HKp6DEg3RKtNLLdxLTekg4TvkUb9FEJYMd1nVp`
7. **Timelock Intent Quarantined:** `DiQFdBMVvi4T3MMu84DBhMYDrf7E2RBxY7KRodw7nCWa`
8. **Owner Veto Cancellation:** `2bhmibshKH7cEQHc6WZwW1JWXaXRnGKBmwDyKnD4FEq8`
9. **Prompt Injection Blocked (`RECIPIENT_NOT_ALLOWED`):** `3L7ysZD5rfHYTGUwtyzoY57iXReqNfXs91sasGKTvsV7`
10. **Rogue Contract Call Blocked (`TARGET_NOT_ALLOWED`):** `Bguq14HrksWRw5ChCFeHbzPRNzarrL2yr51uLCevSxG`
11. **Bypass Attempt Blocked (`METHOD_NOT_ALLOWED` & `AUTO_PAUSE`):** `FUyNWR84dQqx1EPJxX7FhmSZn7CeFHfTJocgxrd5Nb8Z`

---

## 5. Reason Code Reference Table

| Check Order | Reason Code | Trigger Condition |
| :--- | :--- | :--- |
| 1 | `NOT_AGENT` | Caller predecessor is not registered in the Guard |
| 2 | `PAUSED` | Agent is paused manually by owner or tripped by circuit breaker |
| 3 | `OVER_VELOCITY_CAP` | Actions in the 10-minute window exceed `max_actions_per_10min` |
| 4 | `TARGET_NOT_ALLOWED` | Target contract is not in `policy.targets` |
| 5 | `METHOD_NOT_ALLOWED` | Method name is not allowlisted for target, or token call tried to bypass `GuardAction::Transfer` |
| 6 | `OVER_DAILY_CAP` | Amount exceeds daily cap in the rolling 24-hour window |
| 7 | `RECIPIENT_NOT_ALLOWED` | Moving funds to an unlisted recipient address |
