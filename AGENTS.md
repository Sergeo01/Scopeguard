# Contributor Guidelines for ScopeGuard

This document outlines the core architectural invariants, system specifications, and testing requirements for contributors and automated agents working on the ScopeGuard codebase.

## 1. System Mission & Core Threat Model

ScopeGuard provides scoped, policy-enforced transaction guardrails for autonomous AI agents on NEAR Protocol.

### The Problem
Traditional agents hold full-access cryptographic private keys on host machines. If an agent executes an untrusted tool, encounters prompt injection, or suffers credential compromise, an attacker can drain all funds and modify account keys immediately.

### The ScopeGuard Solution
1. **Agent Sub-Account:** The agent operates under a dedicated sub-account (e.g. `agent.alice.near`), isolated from the owner's primary account.
2. **Internal Vault Custody:** The owner funds a working balance inside the Guard contract. The agent can only move funds that reside inside this vault.
3. **Scoped Protocol Key:** The agent machine holds exclusively a NEAR function-call access key restricted to `receiver = Policy Contract`, `methods = ["execute"]`, with a capped gas allowance. The agent cannot transfer native NEAR directly, deploy contracts, or manage access keys.
4. **Onchain Guard Policy:** Every action is checked by the Guard contract on NEAR against owner-configured rules. If checks pass, the Guard performs the action on behalf of the agent. If checks fail, a structured rejection code is returned without panicking.
5. **Circuit Breakers & Timelocks:** Rapid successive rejections trip an automatic auto-pause. High-value actions enter a timelock queue for owner review.

---

## 2. The Check Order Invariant

The Guard policy contract executes checks in a strictly fixed order. This ordering must be preserved across all implementations:

1. `NOT_AGENT`: Caller must match the registered agent account ID.
2. `PAUSED`: Agent must not be paused (manual owner pause or auto-pause circuit breaker).
3. `OVER_VELOCITY_CAP`: Total actions within the fixed 10-minute tumbling window must not exceed `max_actions_per_10min`.
4. `TARGET_NOT_ALLOWED`: Target contract must be allowlisted. Generic `ContractCall` may never target the custody token or value-moving methods.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target. Token transfers must use typed `Transfer` actions.
6. `OVER_DAILY_CAP`: Spend in the rolling 24-25h window plus requested amount must not exceed the daily cap (separate caps for tokens and native NEAR).
7. `RECIPIENT_NOT_ALLOWED`: Direct recipient transfers must match the recipient allowlist.
8. `PENDING`: Actions at or above `high_value_threshold` enter the timelock quarantine for owner settlement. This is an outcome, not a rejection.
9. `INSUFFICIENT_VAULT_BALANCE`: Transfer or deposit amount cannot exceed the agent's vault balance.
10. `PENDING_QUEUE_FULL`: The timelock quarantine queue cannot exceed `MAX_PENDING_ACTIONS`.

### Circuit Breaker Auto-Pause
When a policy rejection occurs, the contract increments the agent's strike counter in the same transaction. If the strike counter reaches `auto_pause_rejects` within `auto_pause_window_seconds`, the contract sets `paused = true` and emits an `AUTO_PAUSE` event.

---

## 3. Strict Development Invariants

1. **No-Panic on Policy Rejection:**
   `execute` must never panic on a policy reject. Panicking reverts contract state changes, which would erase the reject audit log and reset circuit breaker strikes. Rejections return structured `Outcome::Rejected { reason }` values. Panics are reserved exclusively for unauthorized callers before any state is touched.

2. **Rolling Window Budgets:**
   Daily spend caps use a rolling window of 1-hour buckets with a 24-hour lookback (effective duration: 24 to 25 hours). Spend reads, debits, preflight simulations, and refunds must calculate the rolling sum across active buckets. Refunds return spend to the original bucket if still within the window.

3. **Independent Asset Budgets:**
   Native NEAR and NEP-141 token amounts maintain separate rolling budgets and separate timelock thresholds. Native NEAR operations fail closed by default if no native cap is configured.

4. **Value-Neutral ContractCall Enforcement:**
   Generic `ContractCall` actions carry no token transfer accounting. Any method capable of transferring tokens or withdrawing balances (`ft_transfer`, `nft_transfer`, `mt_transfer`, `withdraw`, `storage_withdraw`, etc.) is strictly forbidden for `ContractCall`. Attached NEAR deposits debit the agent's NEAR vault balance and count against the native NEAR spend cap.

5. **Asynchronous Settlement & Rollbacks:**
   Token debits and native deposits are held during action execution. If downstream contract calls fail, private rollback callbacks (`on_action_resolved`, `on_withdraw_resolved`) refund the vault and restore the spend budget in the original bucket.

6. **Agent Credential Scope:**
   The agent runtime holds only the scoped function-call key. Full-access keys belong exclusively to the owner and must never be stored in agent configuration, code, or repositories.

---

## 4. Repository Layout & Package Architecture

- `contracts/`: Rust smart contracts (near-sdk 5).
  - `policy/`: Main Guard policy contract.
  - `mock-token/`: Minimal NEP-141 test token (mUSD).
  - `mock-dex/`: Fixed-rate swap contract for agent trading scenarios.
- `sdk/`: TypeScript client SDK (`@scopeguard/sdk`).
- `drafter/`: Policy drafting service with JSON Schema validation and security lint rules.
- `packages/`:
  - `ironclaw-mcp/`: Model Context Protocol server exposing guarded actions to LLM runtimes.
  - `plugin-eliza/`: Autonomous agent plugin for the ElizaOS runtime.
- `watcher/`: Read-only event daemon tailing block logs for webhook alerts.
- `demo-agent/`: Naive test agent for verifying adversarial attack defense.
- `web/`: Next.js 15 studio console and transaction explorer.

---

## 5. Verification & Testing Standards

All code modifications must pass the complete test suite:

- Run `npm test` from the root directory to verify all suites (Rust unit and property tests, SDK, Web Studio, Watcher, MCP Server, and ElizaOS Plugin).
- Every bug fix requires a regression test proving the failure before the fix and pass after the fix.
- Do not weaken, skip, or delete existing tests.
- Maintain cross-platform compatibility across Windows and Linux environments.
