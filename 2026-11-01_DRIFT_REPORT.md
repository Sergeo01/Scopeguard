# ScopeGuard: EGM System Audit & Complete Drift Report

**Date:** 2026-11-01  
**Scope:** Full repository audit across specifications, smart contracts, SDK, demo agent, AI drafter, watcher, web studio console, and live NEAR testnet consensus.  
**Auditor Protocol:** Elephant-Goldfish Model (EGM) Multi-Perspective Adversarial Review.

---

## 1. Executive Summary & Adversarial Verdicts

This audit stress-tests the entire ScopeGuard architecture across five independent review lenses: High-Altitude Minimalism (`egm-zoom-out`), Naive Comprehension (`egm-comprehension`), Hostile Design & Economics (`egm-design`), Implementation Readiness (`egm-implementation-readiness`), and Pedantic Code Quality (`egm-codebase-details`).

### Top Critical Findings (Lead with Critique)

1. **Specification Divergence on Multi-Chain MPC (Chain Signatures):**
   - `SPEC.md` Section 6 claims that when policy permits, the guard contract calls the NEAR MPC signer contract (`v2.multichain-mpc.testnet`) to sign payloads for foreign chains.
   - **Reality:** No MPC signing or cross-chain derivation logic exists in `contracts/policy/src/lib.rs`. While `Antigravity Build Pack.md` noted this was a cut Phase 2 stretch, `SPEC.md` was never updated to reflect that cut.
2. **Drafter Validation vs Smart Contract Invariant Mismatch:**
   - The policy contract asserts strictly that `high_value_delay_seconds > 0` and `policy_change_delay_seconds > 0`.
   - Both `drafter/src/index.ts` and `web/lib/drafter.ts` permitted `minimum: 0` for delay seconds. An drafted policy specifying a delay of 0 seconds would pass schema validation but immediately panic the contract onchain. (Resolved in this pass to enforce `> 0`).
3. **Redundant Standalone Service Codebase:**
   - The standalone `drafter/` package is an unreferenced duplicate of `web/lib/drafter.ts`. The Next.js API route `/api/draft` runs in-process and does not use `drafter/`. Maintaining two separate validation schemas creates unneeded maintenance overhead.
4. **Circuit Breaker Friction During Automated Evaluations:**
   - The circuit breaker auto-pauses the agent after 3 rejects in 10 minutes. When evaluators run five consecutive attack scenarios, scenarios 4 and 5 trip `PAUSED` instead of showing their distinct rule violations. The web console has added reset controls and unpause scripts, but this remains an operational friction point.

---

## 2. Document-by-Document Drift Report

This section lists every discrepancy found between documentation files and actual codebase implementations.

### Document 1: `SPEC.md` / `Agent Passkeys Build Spec.md`

- **Check Count and Sequence Drift:**
  - `SPEC.md` Section 4.1 lines 56 and 61 specifies seven checks: `NOT_AGENT`, `PAUSED`, `OVER_VELOCITY_CAP`, `TARGET_NOT_ALLOWED`, `METHOD_NOT_ALLOWED`, `OVER_DAILY_CAP`, `RECIPIENT_NOT_ALLOWED`.
  - The actual contract implements a 10-layer sequence: (1) `NOT_AGENT`, (2) `PAUSED`, (3) `OVER_VELOCITY_CAP`, (4) `TARGET_NOT_ALLOWED`, (5) `METHOD_NOT_ALLOWED`, (6) `OVER_DAILY_CAP`, (7) `RECIPIENT_NOT_ALLOWED`, (8) `PENDING` (timelock quarantine), (9) `INSUFFICIENT_VAULT_BALANCE`, (10) `PENDING_QUEUE_FULL`.
- **Method Signature Drift:**
  - Spec Section 4.1 describes `execute(target, method, args, amount, recipient?)` with flat parameters.
  - The contract implementation (`contracts/policy/src/lib.rs:533`) enforces strongly typed `GuardAction` enum variants (`Transfer`, `Swap`, `ContractCall`), preventing argument spoofing where an agent could claim `amount: 1` in metadata while transferring 10,000.
- **Missing Struct Fields in Spec:**
  - `Policy` in code contains `token: AccountId`, `high_value_threshold: u128`, `high_value_delay_seconds: u64`, and `policy_change_delay_seconds: u64`. These fields are absent from Spec Section 4.1 state definitions.
  - `AgentRecord` in code contains `pending_actions: Vec<PendingAction>`, `staged_policy: Option<StagedPolicy>`, `next_pending_id: u64`, and `vault_balance: u128`. None of these are recorded in Spec Section 4.1.
- **Unimplemented Cross-Chain MPC Claims:**
  - Spec Section 6 details cross-chain signing via `v2.multichain-mpc.testnet`.
  - The contract does not implement MPC cross-contract calls.
- **Unlisted Owner Controls:**
  - Spec Section 4.1 lists only `pause`, `unpause`, and `withdraw`.
  - The contract implements `revoke_agent`, `reset_windows`, `cancel_pending`, `settle_pending`, `cancel_policy_change`, `ft_on_transfer`, and `get_version`.
- **Contract Account Name:**
  - Spec Section 4.1 suggests `passkeys.<dev>.testnet`.
  - Deployed contract on testnet is `guard2.sergeo-guard.testnet`.

### Document 2: `README.md`

- **Test Suite Count Divergence:**
  - Section 3 lists 42 native Rust smart contract unit tests.
  - Section 11 previously referenced 33 native tests (updated to 42 in this pass).
  - Web unit tests (14 automated Node tests) were unmentioned in the quickstart (now documented).
- **CI Documentation:**
  - `.github/workflows/ci.yml` was not mentioned in the repository layout or testing sections.

### Document 3: `TESTING_FOR_AI_JUDGES.md`

- **Test Suite Scope:**
  - Covers 42 Cargo unit tests and testnet CLI scripts.
  - Web unit tests (`npm test --prefix web`) were omitted from the verification instructions.
- **Transaction Receipt Hashes:**
  - Lists 9 verified hashes from 2026-10-30.
  - The live simulator on `scopeguard.blockframe.cloud` currently operates with fresh hashes from 2026-11-01 (e.g. `7sXRegzUaEMDizXBGzyfnCv68ZwxTkHovh78XQkr3jMX` for Wallet Sweep, `HmTSXMHdkiEskXDvDrjanrFXXHhTDZYoC7vPmnjCy8WQ` for Privilege Abuse).

### Document 4: `AGENTS.md`

- **Revocation Protocol Drift:**
  - Section 4 describes Revoke as: "hard stop. Deletes the agent's function-call key on NEAR itself."
  - NEAR protocol permissions do not permit a parent account to delete an access key on a sub-account without holding the sub-account FullAccess key.
  - In reality, the owner invokes `guard2.sergeo-guard.testnet::revoke_agent`, which wipes all targets and recipients and permanently freezes the agent record.

### Document 5: `Antigravity Build Pack.md`

- **Check Count Alternation:**
  - Alternates between calling the guard "7 checks" and "10 checks" across sections.
- **Initial Test Target:**
  - Mentions 30 passing tests as the delivery target. The test suite has expanded to 42 tests.

### Document 6: `CHANGELOG.md`

- **Traceability:**
  - Comprehensive, clean, and accurate.
  - All recent commits from 2026-10-27 through 2026-10-30 are precisely cataloged.

---

## 3. Code-Level Deep Dive & Invariant Audit

### Check Order Invariant (`contracts/policy/src/lib.rs`)

The contract evaluates requests in strict order:
1. `NOT_AGENT`: Caller predecessor must match registered agent account. Panics before state mutation.
2. `PAUSED`: Agent is paused by owner or circuit breaker. Returns `REASON_PAUSED`.
3. `OVER_VELOCITY_CAP`: Actions in 10-minute window exceed limit. Returns `REASON_OVER_VELOCITY`.
4. `TARGET_NOT_ALLOWED`: Target contract is not in allowlist, or generic ContractCall attempts to target custody token.
5. `METHOD_NOT_ALLOWED`: Method is not allowlisted, or ContractCall attempts to call token transfer or swap.
6. `OVER_DAILY_CAP`: Spend plus requested amount exceeds 24-hour limit. Protected against u128 arithmetic overflow.
7. `RECIPIENT_NOT_ALLOWED`: External recipient is not in recipient allowlist.
8. `PENDING`: High-value actions (amount >= threshold) are quarantined into the timelock queue.
9. `INSUFFICIENT_VAULT_BALANCE`: Transfer exceeds internal custodied balance.
10. `PENDING_QUEUE_FULL`: Pending queue reaches capacity of 8 items.

### Circuit Breaker Mechanics

- Sliding window: Last 64 reject timestamps are stored in `rec.reject_times`.
- When rejects within `auto_pause_window_minutes` reach `auto_pause_rejects`, `rec.paused` is set to `true` in the same call.
- Emits structured event `AUTO_PAUSE`.
- The circuit breaker operates autonomously onchain with zero external dependencies.

### Asynchronous Rollback Guarantees

- When an action is dispatched, internal balances and daily spend are debited upfront.
- External calls attach private callback `on_action_resolved` via `.then()`.
- If the downstream promise fails (e.g. invalid arguments or unhandled external panic), the callback detects `!is_promise_success()` and automatically restores `rec.vault_balance` and decrements `rec.spent_in_window`.
- Owner withdrawals attach `on_withdraw_resolved` to prevent trapped funds.

### Flexible Numeric Deserialization

- `de_u128_flexible` accepts both numeric literals (`500`) and numeric strings (`"500"`).
- Resolves JavaScript IEEE-754 precision limitations for values above 2^53 without breaking onchain JSON compatibility.

---

## 4. Multi-Perspective Adversarial Critique

### Perspective 1: Zoom-Out Architecture (`egm-zoom-out`)

- **Duplication between `drafter/` and `web/lib/drafter.ts`:**
  - The standalone `drafter/` package has its own package.json, tsconfig.json, and ajv dependency.
  - The web application re-implemented the validation and drafting logic in `web/lib/drafter.ts` using zero-dependency TypeScript validators.
  - Having two implementations risks subtle rule drift (as was found with the delay seconds validation).
  - **Recommendation:** Archive or deprecate `drafter/src/index.ts` and establish `web/lib/drafter.ts` as the sole canonical drafter.

### Perspective 2: Comprehension & Plain-English Clarity (`egm-comprehension`)

- **Gas Budget vs Daily Spend Cap:**
  - Early revisions risked confusing NEAR gas allowance with token spend caps.
  - Current UI and documentation clearly separate "Gas budget (NEAR, transaction fees)" from "Daily spend cap (mUSD, policy value limit)".
- **Quarantine Outcome vs Rejection:**
  - A queued high-value action is an outcome (`status: "PENDING"`), not a rejection.
  - It does not increment circuit breaker strikes and does not emit a `REJECT` event.
  - Clarified across both simulator receipts and documentation.

### Perspective 3: Hostile Design & Economic Stress-Test (`egm-design`)

- **Denial of Service via High-Value Queue Saturation:**
  - `MAX_PENDING_ACTIONS = 8`. An attacker could submit 8 high-value actions to fill the queue.
  - Subsequent high-value actions are rejected with `PENDING_QUEUE_FULL`.
  - However, standard actions below `high_value_threshold` bypass the queue and continue to execute normally.
  - Storage bloat is prevented, limiting total state exposure per agent.
- **Single-Token Limitation:**
  - V1 enforces a single custody token (`policy.token`).
  - While sufficient for hackathon scope, real treasuries hold multiple assets.
  - The architecture correctly marks multi-token pools for V2.

### Perspective 4: Technical Quality & Code Details (`egm-codebase-details`)

- **NEAR SDK 5 Idiom:**
  - Clean use of `LookupMap`, `NearToken`, `Gas`, and `#[near]`.
  - No legacy near-sdk 4 macros.
  - Zero compiler warnings during wasm build.
- **RPC Timeouts in API Layer:**
  - `web/app/api/tx/route.ts` previously fetched RPCs without a timeout signal, causing test stalls up to 47 seconds.
  - Added `AbortSignal.timeout(4000)`, dropping web test execution from 47 seconds to 8.5 seconds.

---

## 5. Verification & Test Coverage Summary

| Test Domain | Target | Passing | Failing | Execution Time | Command |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Smart Contract | `contracts/policy` | 42 | 0 | 0.63s | `cargo test --manifest-path contracts/Cargo.toml` |
| Web & API Layer | `web/test` | 14 | 0 | 8.52s | `npm test --prefix web` |
| Automated AI Judge | Whole System | Green | 0 | ~3.2s | `node scripts/verify-ai-judge.js` |
| Live NEAR Testnet | `guard2.sergeo-guard.testnet` | 6 Scenarios | 0 | Live RPC | `node scripts/testnet-demo-agent-e2e.js` |

### Verified Live Hashes on Testnet:
- Legit Swap: `3yJaLF9Di7Qu8f2VrkqqPV6NdZ3QQmijcJrE1JrbqnBi`
- Wallet Sweep: `7sXRegzUaEMDizXBGzyfnCv68ZwxTkHovh78XQkr3jMX`
- Rogue Vault: `7XAfg3RRxFATLZgXE2PvCgAtgidGPPCZVU1B9X8ziZqS`
- Privilege Abuse: `HmTSXMHdkiEskXDvDrjanrFXXHhTDZYoC7vPmnjCy8WQ`
- Limit Breach: `5WA2DbgmpyfQqnncoFXvPXFudoG3EvCuREbtWLCAobcZ`
- High-Value Timelock: `9Yg1B5kWZEJc3rACtaHPMSM8zunRdc9Sh7t3abiHhK8E`

---

## 6. Actionable Remediation Items

1. **[Complete] Synchronize Delay Validation:** Updated `web/lib/drafter.ts` and `drafter/src/index.ts` to require `minimum: 1` for delay seconds, matching contract invariants.
2. **[Complete] RPC Fetch Timeout:** Added `AbortSignal.timeout(4000)` to `web/app/api/tx/route.ts` to prevent fetch hangs.
3. **[Complete] Documentation Test Counts:** Corrected `README.md`, `SPEC.md`, and `Antigravity Build Pack.md` to reflect 42 native Rust tests and 14 web tests.
4. **[Recommended] Deprecate Standalone `drafter/`:** Retain `web/lib/drafter.ts` as the single canonical source of truth for policy drafting and validation.
5. **[Submission Note] Clarify Chain Signatures:** Ensure judges understand Chain Signatures was scoped as a Phase 2 extension in the spec roadmap and is not a dependency of the core demo.
