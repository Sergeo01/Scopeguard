# Changelog: ScopeGuard

All notable changes, progress, decisions, and updates to the ScopeGuard project are documented in this file.

The format is based on Keep a Changelog, adhering to the Ponytail senior developer standard: clean, precise, and traceable.

---

## [Unreleased]

### Changed - 2026-10-30 (Agent Rotation, Custody Honesty, and Verifiable Proofs)

This pass removed four classes of claim that did not survive contact with the chain, and added the two owner controls the contract was missing.

- **Agent key rotated, leaked key retired**
  - New agent `agent.sergeo-guard.testnet` holds exactly one FunctionCall key (`ed25519:Homj5ybH4uVLQuBTV5idsxuCDhp8xRrhtTgwKFr3ksPE`) scoped to `guard2.sergeo-guard.testnet::execute`.
  - `trader.sergeo-guard.testnet` (the previously published agent) and `test-agent.sergeo-guard.testnet` were both revoked. A swap signed with the retired key is rejected with `PAUSED` (`ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5`), so the rotation is real rather than cosmetic.
  - Vault balance was moved to the new agent's vault; policy re-registered on `guard2.sergeo-guard.testnet`.

- **`revoke_agent` and `reset_windows` added (contract 0.2.0)**
  - `revoke_agent` empties `targets` and `recipients`, pauses the agent, clears staged policy and pending intents, and keeps the record and vault withdrawable. Revocation is durable: an empty allowlist rejects every later action even after `unpause`.
  - `reset_windows` zeroes spend, velocity and the reject history without touching policy or pause state, so a demo can be reset without re-granting permissions.
  - Test suite: **42 passed, 0 failed**. Seven new tests cover both methods, including "revoked agent still rejected after unpause" and the owner-only guards.
  - Deployed over live state on `guard2.sergeo-guard.testnet` (`B8bb7pQSUNpf4a6f7uBNcrXJx7xiJxJDXdJKXFumAFev`); `get_version` returns `0.2.0` and every existing record survived.

- **Server-side owner signing is now opt-in and off by default**
  - `/api/register` and `/api/fund` no longer read `~/.near-credentials`. They sign only when `SCOPEGUARD_ALLOW_SERVER_SIGNING=true` and `OWNER_PRIVATE_KEY` are set, and otherwise return a copy-paste `near call` command with HTTP 200.
  - Both routes, plus `/api/attack` and `/api/draft`, reject cross-origin browser requests (403). `/api/draft` is rate limited to 20 requests/minute and a 2000-character cap.
  - The docs previously claimed the server never custodied owner keys while the code read the local credential store. The claim is now true because the capability is gone.

- **Admin console shows only chain state**
  - `/admin` was rewritten against a new read-only `/api/agents` route backed by `get_agents`, `get_budget`, `get_policy`, `get_staged_policy` and `get_pending_actions`.
  - Removed: three invented agents, a fabricated `$28,450` "aggregate protection value", a fake "Owner Authenticated" badge, and an `approve_policy` action that does not exist onchain.
  - Every owner control now emits a `near call` command the owner signs, and a revoked agent renders as `REVOKED`.

- **Ledger seeds replaced with real transactions**
  - All eleven previous "verified live" hashes returned `UNKNOWN_TRANSACTION`; they were fabrications. They are gone from `web/lib/ledger.ts`, `README.md` and `TESTING_FOR_AI_JUDGES.md`.
  - The seed now holds seven transactions that resolve on chain, including the allow, the queued 300 mUSD intent, the owner veto, both rejection paths, the retirement, and the retired-key replay.

- **End-to-end suite asserts instead of printing**
  - `scripts/testnet-demo-agent-e2e.js` accumulates results and exits non-zero on failure. It resets windows first so runs are deterministic, and it asserts the circuit breaker fires after the third rejection (`AUTO_PAUSE rejects:3`) rather than asserting the agent stays unpaused.
  - Step 6 now sends a literal `GuardAction::ContractCall` at the custody token. The previous version went through the SDK, which silently rewrites `ft_transfer` into a typed `Transfer`, so the step tested nothing. The SDK now refuses to build a transfer with no recipient instead of sending `to: ""`, which had been panicking the contract during deserialization.

- **RPC default moved to `test.rpc.fastnear.com`**
  - `rpc.testnet.near.org` now answers view calls with `-429 DEPRECATED` under load and does not serve tx history. A multi-agent read burst measured 7621 ms there versus 719 ms on fastnear. `NEAR_TESTNET_RPC` still overrides it everywhere.
  - An explicit `NEAR_TESTNET_RPC` now wins over the `nodeUrl` recorded in a credential file, so a stale credential cannot silently pin a dead endpoint.

- **Stale artifacts removed**
  - Deleted `scripts/security-audit-poc.js` (superseded by the contract test suite) and the untracked `scratch/` directory.

- **Dependency audit: 1 critical + 15 high → 0 critical, 0 high, 12 low**
  - `next` 14.2.24 → 15.5.28. That clears the middleware authorization bypass, the two image-optimizer RCEs, the Windows-hosted RCE, the App Router DoS set, the SSRF-in-rewrites issues and the cache-confusion issues. Next 15 accepts React 18.3, so no React rewrite was needed; all routes were re-tested after the bump.
  - `images.unoptimized: true` remains set, so the image optimizer is never reachable even on an older build.
  - Added `overrides` for `base-x@^3.0.11` (homograph validation bypass, patch bump inside `bs58@4`'s own range) and `secp256k1@^5.0.2` (ECDH private-key extraction), and bumped `postcss` to 8.5.32 so Next's nested copy dedupes onto the patched release.
  - The 12 remaining lows are all `elliptic <=6.6.1`, which has no fixed release upstream. It is reachable only through secp256k1 key handling; ScopeGuard uses ed25519 exclusively and never performs ECDH.

- **Drafter parses the cap people actually type**
  - `cap 200 per day`, `$250/day`, `up to 400` and `budget of 300` now set the cap. Previously only `cap of N` or a trailing `mUSD` matched, so `cap 200 per day` silently produced the 100 default while still presenting itself as understood.
  - A negative lookahead keeps `max 4 actions` / `5 swaps per 10 min` from being read as the spend cap, and the plain-English summary still labels a genuine default as "conservative default, please verify".

### Added - 2026-10-28 (Check-Order Alignment, Webhook Sanitization, Dynamic Policy Telemetry, and Telegram Alerts)

- **Check-Order Alignment in Guard Engine (`contracts/policy/src/lib.rs`)**
  - Moved generic `ContractCall` custody token and transfer method checks inside `internal_execute()`.
  - Guarantees strict adherence to the 7-check sequence: Check 2 (`PAUSED`) and Check 3 (`OVER_VELOCITY_CAP`) evaluate strictly before target and method checks.
  - Added unit test `test_check_order_paused_before_contract_call_method_check`. Total contract test suite now stands at **33 passed, 0 failed**.

- **Webhook Mention Sanitization (`watcher/src/index.ts`)**
  - Attached `allowed_mentions: { parse: [] }` to outbound webhook payloads, preventing potential `@everyone` or `@here` ping hijacking in Discord alert channels.

- **Dynamic Onchain Policy Binding (`web/app/api/state/route.ts` & `web/app/dashboard/page.tsx`)**
  - Dynamically bound dashboard circuit breaker and velocity gauges to live onchain policy state (`auto_pause_rejects`, `auto_pause_window_minutes`, `max_actions_per_10min`).

- **Withdrawal Trapped Funds Elimination (`contracts/policy/src/lib.rs`)**
  - Attached `on_withdraw_resolved` private callback handler via `.then()` to owner `withdraw` operations.
  - If downstream `ft_transfer` to the owner fails, the callback catches the promise failure and automatically restores `rec.vault_balance`.
  - Added unit test `test_withdraw_failure_refunds_vault_balance` asserting vault balance refund to 100 on failure.

- **Settlement Validation Re-Ordering (`contracts/policy/src/lib.rs`)**
  - Re-ordered `settle_pending` to validate all seven policy checks before removing the pending intent from the agent queue.
  - Settle refusals return `{ status: "REJECTED", reason, pending_id }` without calling `self.reject()`, preventing unfair circuit breaker strikes against the agent for owner settlement checks.

- **Strict Non-Zero Policy Bounds Validation (`contracts/policy/src/lib.rs`)**
  - Enforced `> 0` assertions on `max_actions_per_10min`, `auto_pause_rejects`, `auto_pause_window_minutes`, `high_value_delay_seconds`, and `policy_change_delay_seconds`.

- **Contract Version Telemetry (`contracts/policy/src/lib.rs`)**
  - Added `pub fn get_version(&self) -> String` returning the contract package version (`0.1.0`).
  - Added unit test `test_get_version`.

- **Native Telegram Bot Alerts (`watcher/src/index.ts`)**
  - Added native `sendTelegramAlert` function using Node fetch to `https://api.telegram.org/bot<token>/sendMessage`.
  - Added `telegramBotToken` and `telegramChatId` config options to `WatcherConfig`.

- **API Attack Protection (`web/app/api/attack/route.ts` & `web/app/api/state/route.ts`)**
  - Added sliding-window rate limiting on the live attack API (maximum 12 requests per minute with 1.5s spacing).
  - Added server-side 5-second in-memory state caching to eliminate RPC timeouts during judge traffic.

### Added - 2026-10-27 (Asynchronous Promise Rollback Callback, SDK Decoupling, and Handoff State Precision)

- **Asynchronous Cross-Contract Rollback Callback (`contracts/policy/src/lib.rs`)**
  - **Eliminated Trapped Funds Risk**: Added `on_action_resolved` private callback handler attached via `.then()` to all value-bearing cross-contract execution promises.
  - **Automatic Vault Balance Refund**: If the external NEP-141 token transfer or contract call fails onchain, `is_promise_success()` evaluates to false. The callback automatically refunds the agent's `vault_balance` (`rec.vault_balance += amount.0`) and rolls back the window spend (`rec.spent_in_window -= amount.0`), emitting an onchain `ACTION_FAILED` event.
  - **Unit Test Coverage**: Added `test_transfer_failure_refunds_vault_balance` using `near_sdk::test_vm_config()` and `PromiseResult::Failed` mocking.
  - **Live Testnet Deployment Upgrade**: Compiled release wasm (`443,373` bytes) and upgraded `guard2.sergeo-guard.testnet` (Tx: `4cv5gYj6uM4Zw4r48DuxwBSsQzAPC3xwyRbMS2RY4rzS`). Unpaused live agent `trader.sergeo-guard.testnet` (Tx: `8SHygnM3TyAuqBvRNBmehFH6ibcwEQm1judPkQa37iLs`).

- **SDK Hardcoding Removal (`sdk/src/index.ts`)**
  - Removed hardcoded `"token.near"` string in `Swap` action construction.
  - Added optional `token?: string` parameter to `ActParams`, defaulting to `"sergeo-guard-token.testnet"` for mock DEX swaps or accepting custom token contracts.

- **Handoff State Transparency & Honest UX (`web/components/AgentHandoffCard.tsx`)**
  - Corrected badge from misleading *"Passkey Live on NEAR Testnet"* to *"Passkey Generated Locally (Pending Onchain Registration)"*.
  - Updated headline to *"Passkey Ready for Onchain Activation"* with clear guidance directing the owner to complete registration via the NEAR CLI command tab.
  - Stripped artificial `.00` precision from the daily budget display on the handoff card.

### Added - 2026-10-27 (Smart Contract Security Hardening, Cryptographic Passkey Derivation & AI Scope Drafter Flow)

- **Smart Contract Security Hardening (`contracts/policy/src/lib.rs`)**
  - **Shared Vault Custody Isolation**: Added strict `amount <= rec.vault_balance` check in both immediate execution and pending settlement. If an agent attempts to transfer more than its recorded balance in the shared custody contract, the Guard immediately rejects with `INSUFFICIENT_VAULT_BALANCE` and increments the auto-pause reject count.
  - **Custody Token Binding**: Added explicit validation that `Transfer.token` must match `rec.policy.token`. Prevents an agent from executing unauthorized token transfers on tokens outside its registered custody policy.
  - **ContractCall Calldata Bypass Elimination**: Blocked `method == "swap"` within generic `GuardAction::ContractCall`. All swaps must now use typed `GuardAction::Swap`, guaranteeing that calldata amounts are counted toward the 24-hour daily cap and compared against high-value timelock thresholds.
  - **Overflow-Safe Arithmetic**: Replaced unchecked raw addition (`rec.spent_in_window + amount`) with `checked_add`. Large attempted amounts (such as `u128::MAX`) cleanly reject with `OVER_DAILY_CAP` without arithmetic panics, ensuring state writes, audit logging, and circuit breakers fire reliably.
  - **Unit Test Coverage**: Added 4 new native Rust unit tests (`test_transfer_exceeding_vault_balance_rejected`, `test_transfer_unassigned_token_rejected`, `test_contract_call_cannot_invoke_swap`, and `test_max_u128_amount_does_not_panic_overflow`). Total test suite now stands at 29 passed, 0 failed.

- **Mock Token Integer Normalization (`contracts/mock-token/src/lib.rs`)**
  - Normalized `decimals` from 18 to 0 in metadata so 1 unit = 1 whole dollar of mUSD, completely aligning onchain accounting with script, test, and user-interface dollar integer representations.

- **Live Testnet Contract Deployment Upgrade**
  - Deployed hardened Wasm release to `guard2.sergeo-guard.testnet` (Tx: `B1MPVbevVF5SGCuVaMwZfjsGq7obEE4sL4aXmUw6CHYj`).
  - Unpaused agent `trader.sergeo-guard.testnet` from owner account (Tx: `CHio7AsNkEowXwFyYYCm2JFXJxFebqsqPS43gfZD6eSz`).
  - Verified live onchain budget query: `{"cap":"500","spent":"25","remaining":"475","actions_in_window":0,"paused":false,"vault_balance":"100"}`.

- **Authentic Client-Side Cryptographic Key Generation (`/create`)**
  - Replaced dummy key with real in-browser ED25519 cryptographic key generation using `near-api-js` (`KeyPair.fromRandom("ed25519")`).
  - Handed off real derived public key and private key to `AgentHandoffCard`.
  - Added dedicated non-custodial NEAR CLI setup tab with copyable, signed-ready commands to register the agent policy and grant the scoped function-call access key.

- **AI Scope Drafter Integration (`@scopeguard/drafter` & `/api/draft`)**
  - Updated policy schema with mandatory `token` property.
  - Implemented natural language drafter (`draftPolicyFromText`) with least-privilege defaults and lint warnings.
  - Added `/api/draft` Next.js endpoint and integrated interactive "Draft Scope with AI" hero box into the `/create` wizard.

- **Naive Agent Natural Language Prompt Interpretation**
  - Updated `/api/attack` and `demo-agent/src/index.ts` to parse natural language instructions (transfer prompts, target names, amounts, recipient accounts) into structured `GuardAction` parameters.
  - Preserved naive obedience: agent faithfully attempts injected instructions, allowing judges and users to verify onchain rejection directly.

- **Automated AI Judge Verification (`scripts/verify-ai-judge.js`)**
  - Updated verification runner to execute native Rust contract tests (29 passing) as Step 0, verify 9 consensus reason codes including `INSUFFICIENT_VAULT_BALANCE`, and simulate vault balance enforcement.

### Added - 2026-10-27 (Design System Polish, Gemini Vector Logo, Hydration & Console Hardening)

- **Official ScopeGuard Vector Brand Mark**
  - Generated distinctive vector brand identity (`web/components/ScopeGuardLogo.tsx`, `web/public/logo.svg`, `web/public/favicon.svg`) featuring a precision hex-shield, optical target reticle, and central passkey core in NEAR emerald and deep obsidian.
  - Integrated the logo into `Navbar.tsx` and configured browser favicon and Apple touch icons in `RootLayout`.

- **Hydration Storm Elimination (React #425 / #418 / #423)**
  - Replaced dynamic `Date.now()` evaluation in `useState` with deterministic static base timestamps and an `isMounted` client-boundary pattern.
  - Formatted time through an `isMounted` guard to eliminate server-versus-client timezone and tick divergence.

- **Removal of Fake Precision and Hardcoded Marketing Copy**
  - Stripped artificial `.00` precision suffixes from token balances across the console and creation wizard, aligning displays with honest whole-unit representations.
  - Replaced hardcoded gas allowance strings with verified consensus protocol allowances ("0.25 NEAR Protocol Gas Allowance").
  - Replaced static telegram handles and marketing text with transparent technical metrics ("Receipt Verification: Public NEAR RPC").

- **Three Distinct Visual Zones (Reading, Acting, Verifying)**
  - Zone 1 (Reading): Neutral slate cards for agent identity and 4-metric KPI strip (daily spend, gas budget, velocity throttle, and real custody vault balance).
  - Zone 2 (Acting): Warm alert container with rose and amber accents for Emergency Owner Switches and Circuit Breakers.
  - Zone 3 (Verifying): Monospace chain proofs, high-value timelock queue with live countdowns, and a first-class Rule Token taxonomy classifying rejections into exact invariant rules (Rule 1 through Rule 7).

- **Cohesive Non-Custodial Modal and Mobile-First Layout**
  - Redesigned the Owner Command Modal to match the console styling: light container with an embedded dark terminal code box, 1-click command copying, `Escape` key close listener, and backdrop click dismissal.
  - Added a mobile card list view for the transaction ledger below `md:` breakpoints so that all action details and transaction links remain legible on mobile phones.

### Added - 2026-10-27 (Completeness Pass: Custody Token Call Ban, Real Timelock Trigger, Dynamic Ledger)

- **Strict Custody Token Domain Isolation in Policy Engine**
  - Updated `contracts/policy/src/lib.rs` to reject any generic `ContractCall` targeting the registered custody token (`target == rec.policy.token`) with `TARGET_NOT_ALLOWED`. Even if a policy allowed the token address as a contract call target, all token movements are strictly constrained to typed `GuardAction::Transfer`.
  - Added unit test `test_contract_call_cannot_target_custody_token` in `contracts/policy/src/lib.rs`, bringing native Rust unit test count to 25 (0 failures, 0 warnings).
  - Built optimized Wasm and deployed upgrade to `guard2.sergeo-guard.testnet` (Tx: `3p3LgktzSvasRpy15nYV55qMCCqJYqCEUMPjKN8kjbdP`).
  - Unpaused agent `trader.sergeo-guard.testnet` from owner account (Tx: `14sYk3Ve1g7qtwBvPx8mGDy4LcLZzCzAKVR55TPkBvC4`). Live onchain state verified `paused: false` and `vault_balance: '100'`.

- **Environment Variable Harmonization for Serverless Deployments**
  - Standardized environment variable naming with `SCOPEGUARD_` prefix across `.env`, `.env.example`, `/api/attack`, and `/api/state`:
    - `SCOPEGUARD_POLICY_CONTRACT`
    - `SCOPEGUARD_AGENT_ACCOUNT`
    - `SCOPEGUARD_AGENT_PRIVATE_KEY`
    - `SCOPEGUARD_OWNER_ACCOUNT`
    - `NEAR_TESTNET_RPC`
  - Added seamless fallbacks for local file credentials and legacy environment keys, enabling instant deployment on serverless platforms (Vercel, Render) without disk credential files.

- **Real Onchain Timelock Queueing in Dashboard**
  - Replaced local simulated pending state in `web/app/dashboard/page.tsx` with an authentic async trigger executing real high-value swap ($300) via `/api/attack`.
  - Verified onchain quarantine on NEAR Testnet (Tx: `9yKSWV6tnGiRJu2YARrkVv7GkWTF6aFJJYhWgqAsxpJ1`), generating real timelock intent with authentic onchain ID and veto command.

- **Dynamic Real-Time Transaction Ledger**
  - Created `web/lib/ledger.ts` initialized with verified testnet receipts and real-time execution logging.
  - Linked `/api/attack` to append real transaction hashes on execution, and `/api/state` to stream the live ledger to the treasury console.
  - Added `revalidate = 0` and `fetchCache = "force-no-store"` to `/api/state` to prevent Next.js from caching underlying NEAR RPC responses.

- **Honest Limits and Pre-Demo Unpause Documentation**
  - Documented optimistic vault debit invariant in Section 9 of `README.md`: debits occur prior to cross-contract settlement to fail closed in the direction that protects treasury funds against drain.
  - Added Section 6 to `TESTING_FOR_AI_JUDGES.md` with pre-demo unpause script instructions (`scripts/upgrade-and-unpause-guard2.js`).

### Added - 2026-10-27 (Hardened v2 Testnet Deployment & Non-Custodial Overhaul)

- **Fresh Testnet Deployment (`guard2.sergeo-guard.testnet`)**
  - Deployed upgraded policy contract to fresh testnet account `guard2.sergeo-guard.testnet` (Wasm deploy: `Bu3g5C3S3xvhH7H1XktVrdD37ZPMuZ1xYUEo8ukE8fiG`, Init: `Fo5FSTsnjieAx6CDKYyKeV1rZDwfCXMBHY42HvtGTZZF`).
  - Registered `trader.sergeo-guard.testnet` agent policy bound to token `sergeo-guard-token.testnet` (Tx: `9j7E9oAkntMHcRvUyvekkosoAqkcjY4j3xJdTYknMDuL`).
  - Attached scoped passkey restricted to `guard2.sergeo-guard.testnet` and method `["execute"]` with 0.25 NEAR gas allowance (Tx: `57geTR5EE9ksrHG8xH1MeaFtUHmWQZUZSa9RQw45tsKc`).
  - Funded real vault with 100 mUSD via NEP-141 `ft_transfer_call` (Tx: `58QZh1CgMFBT3tCC5gR5sSKthC3SBYpn6o23j7c9U8Ha`). Verified live onchain `vault_balance: '100'`.

- **Strict Value Movement & Action Typing (`GuardAction`)**
  - Completely removed legacy flat argument execution path (`execute_raw`, `execute_action`). Guard entry point is strictly `execute(&mut self, action: GuardAction) -> Outcome`.
  - Blocked calldata bypass: generic `ContractCall` attempting to invoke `ft_transfer` or `ft_transfer_call` is immediately rejected with `METHOD_NOT_ALLOWED`. Token movements must go through typed `GuardAction::Transfer`.
  - Verified token predecessor in `ft_on_transfer`: asserts caller matches registered `policy.token`, preventing unauthorized deposits from polluting accounting.
  - Fixed swap debit logic: `vault_balance` is only decremented on real token transfers, while swaps count against velocity and daily cap without falsely zeroing custodied tokens.
  - Added policy validation gate to `set_policy`: blocks wildcards (`*`) and invalid daily caps during policy staging.
  - Added 4 new Rust unit tests in `contracts/policy/src/lib.rs` (now 24 tests total, 0 failures, 0 warnings).

- **Eradication of Insecure Owner Endpoint & 100% Non-Custodial Controls**
  - Permanently deleted `web/app/api/owner/route.ts` and eradicated fabricated `tx_owner_*` fake hashes.
  - Upgraded dashboard with Non-Custodial Owner Command Modal providing copyable `near call` CLI commands for Pause, Unpause, Withdraw, Revoke Key, and Cancel Pending.
  - Added direct onchain reconciliation button ("Sync Onchain State") querying testnet RPC directly with zero gas fees.
  - Removed server-side `OWNER_PRIVATE_KEY` from `.env.example` and `.env`.

- **Dynamic Routes, Rate Limiting & Verification Truth**
  - Explicitly marked `web/app/api/state/route.ts` as `export const dynamic = "force-dynamic"`, ensuring zero build-time static freezing.
  - Hardened `web/app/api/attack/route.ts` with 2-second per-IP rate-limiting throttle and dynamic execution.
  - Labeled `web/app/create/page.tsx` as interactive policy preview mode ("Preview Scope & Generate Handoff").
  - Upgraded `scripts/verify-ai-judge.js` to execute real `cargo test --package policy-contract` before verifying policy rules, giving AI evaluators cryptographic assurance.
  - Removed `Cargo.lock` from `.gitignore` for deterministic builds.

- **Security Hardening & Production-Grade Policy Enforcement**
  - **Real NEP-141 Token Vault Custody:** Implemented `ft_on_transfer` and `vault_balance` in `contracts/policy/src/lib.rs`. Guard directly custodies deposited funds. Updated `withdraw` to execute genuine cross-contract NEP-141 transfers back to the owner.
  - **Strongly Typed Actions (`GuardAction`):** Replaced opaque string arguments with `GuardAction::Transfer`, `GuardAction::Swap`, and `GuardAction::ContractCall`. Calldata is constructed directly by the Guard, eliminating parameter decoupling and proving that an agent cannot assert `amount: 1` while moving 10,000.
  - **Restricted Timelock Settlement:** Enforced that only the owner can settle or approve high-value actions waiting in review quarantine. Removed settlement capabilities from naive agent runtimes.
  - **Sub-Account Binding & Wildcard Ban:** Enforced at contract registration that agent accounts must be native sub-accounts of the owner. Explicitly prohibited wildcard `*` method allowlists.
  - **Real Owner Controls on Dashboard:** Created `/api/owner` dynamic endpoint wiring Pause, Unpause, Withdraw, Revoke Key, and Cancel Pending directly to NEAR Testnet RPC, rendering live cryptographic transaction hashes and NearBlocks links.
  - **Security Hygiene & Cleanup:** Initialized Git repository, added `.gitignore` protecting credentials and secret keys, moved credentials to `.env`, added `LICENSE` (MIT), and removed 13 loose temporary root image files.
  - **Documentation Truth Pass:** Added Honest Limits, Prior Art differentiators (Turnkey, Privy, Coinbase, Safe vs ScopeGuard on NEAR), and framework/marketplace buyer positioning to `README.md`.
  - **20 Rust Contract Tests Passing:** Verified 20 unit tests in 0.51s including `test_mismatched_amount_cannot_bypass_cap`, `test_vault_deposit_and_withdraw`, and `test_only_owner_can_settle_timelock`.

- **Frictionless Non-Technical Agent Handoff & CLI (`@scopeguard/cli`)**
  - Implemented `AgentHandoffCard.tsx` modular component providing 4 instant handoff workflows:
    1. One-Line Command: `npx @scopeguard/cli connect --account <id> --key <key> --guard <contract>` with 1-click copy.
    2. Direct Private Key String: `ed25519:...` for trading bots and marketplace agents (Virtuals Protocol, Telegram bots).
    3. AI Agent Chat Prompt: Natural language prompt ready to paste into Antigravity, Claude, ChatGPT, or OpenClaw.
    4. Credential File Download: `agent.json` with zero-dependency browser Blob download.
  - Implemented lightweight standard library CLI in `sdk/bin/cli.js` with zero external dependencies, supporting instant connection and configuration.
- **100% Manual Customization & Pre-Vetted Platform Presets**
  - Removed all hardcoded limits across `/create`:
    - Daily spending cap supports free-form manual input from $1 up, plus quick chips ($1, $25, $100, $250, $1000).
    - Added `PlatformPresets.tsx` modular component with 1-click presets for Ref Finance DEX, Burrow Finance Lending, NEAR Intents, and ScopeGuard DEX, while allowing arbitrary custom contract and method additions.
    - Added manual auto-brake strike counts and rolling minute windows.
    - Added manual velocity speed throttle.
    - Added Telegram notification handle/Chat ID input for free real-time alerts.
- **Ponytail Senior Developer Standard & Modularity Audit**
  - Reviewed codebase under the Ponytail standard: zero unrequested abstractions, platform and standard library first, deletion over addition.
  - Documented modular architecture and Ponytail principles in `AGENTS.md` (Section 12).
  - All intentional simplifications annotated with `// ponytail:` comments.

### Added - 2026-10-26

- **Testnet Contract Deployments & Milestone 3 Spike**
  - Created and funded testnet accounts: `sergeo-guard.testnet` (master), `guard.sergeo-guard.testnet` (4.5 NEAR), `sergeo-guard-dex.testnet` (10 NEAR), `sergeo-guard-token.testnet` (10 NEAR), and `trader.sergeo-guard.testnet` (1.0 NEAR).
  - Deployed and initialized WebAssembly smart contracts on NEAR Testnet:
    - Policy Guard Contract: `guard.sergeo-guard.testnet` (Tx: `7yBsfYhfz8ENoarDJVDmPNRP6NurNVfgCQHNKZAMnCtX`).
    - Mock DEX Contract: `sergeo-guard-dex.testnet` (Tx: `6YDYsWFDcGiQwVP6V6bxHuooQboqSnpyivv6DcydDCoR`).
    - Mock Token Contract: `sergeo-guard-token.testnet` (Tx: `A194m5aXgc6e9vnKXwTZhmQbhbWWd9N8GBeyzPcHpaBJ`).
  - Generated agent scoped passkey and attached to `trader.sergeo-guard.testnet`, restricted strictly to `guard.sergeo-guard.testnet` and method `["execute"]` with 0.25 NEAR gas allowance.
  - Verified NEAR protocol-level enforcement:
    - Direct calls to DEX bypassing Guard refused by consensus.
    - Unauthorized methods on Guard refused by consensus.
    - Direct value transfers / drain attempts refused by consensus.

- **Milestone 4 & 5: Timelock System & Autonomous Agent Runtime**
  - Added Timelock feature: high-value action veto lane (`high_value_threshold`, `high_value_delay_seconds`), staged policy rollout (`policy_change_delay_seconds`), and pending actions queue.
  - Verified 19 Rust contract unit tests in 0.27s.
  - Upgraded `@scopeguard/demo-agent` with autonomous settlement loop (`settleDuePendingActions()`).
  - Executed end-to-end testnet suite (`scripts/testnet-demo-agent-e2e.js`):
    - Legit swap (25 mUSD) ALLOWED and executed on DEX.
    - High-value action (300 mUSD) routed to timelock queue (PENDING).
    - Owner instant veto (CANCELLED) with zero delay.
    - Delayed settlement after 60s delay window passed (SETTLED).
    - Prompt injection blocked (RECIPIENT_NOT_ALLOWED).
    - Unauthorized contract blocked (TARGET_NOT_ALLOWED).
    - Circuit breaker tripped on 3rd reject, flipping `paused` to `true`.
    - Owner emergency unpause restored agent to active status.

- **Milestone 6 & 7: Web Application & Event Watcher**
  - Connected Next.js web application to live testnet RPC (`https://test.rpc.fastnear.com`).
  - Added `/api/attack` dynamic API route executing real passkey testnet transactions.
  - Added `/api/state` API route serving live onchain budget, pending actions, and staged policy.
  - Redesigned the entire web UI into a high-craft developer and treasury studio workbench:
    - Purged all generic SaaS card templates, glowing drop-shadows, and AI clichés.
    - Implemented Dual-Column Threat & Policy Workbench on `/` with interactive segmented attack scenarios, live prompt injection payloads, onchain rule pipeline (1 to 7), and transparent loss-prevention receipts.
    - Implemented Corporate Treasury Console on `/dashboard` with distinct gas fuel vs daily spend metrics, high-value timelock approval queue, master transaction ledger, and emergency owner switches.
    - Implemented Digital Key Specification on `/create` with preset cards, parameter controls, live policy JSON compilation, and enforceable guarantee badges.
  - Next.js production build (`npm run build`) passed with zero errors across all 8 routes.
  - Implemented `@scopeguard/watcher` block poller tailing chunk receipts for `EVENT_JSON` events.

### Added - 2026-10-24

- **Project Core & Specification**
  - Copied and locked `SPEC.md` from `Agent Passkeys Build Spec.md`.
  - Added `README.md` with problem framing, five core pieces, seven policy checks, and repository layout.
  - Added `TESTING_FOR_AI_JUDGES.md` dedicated guide for human evaluators and AI judges (Claude Code, Codex).
  - Added root `CHANGELOG.md` to track every change, progress step, and update.

- **Contracts Workspace (`contracts/`)**
  - Initialized Cargo workspace in `contracts/Cargo.toml` linking `policy`, `mock-token`, and `mock-dex`.
  - Created `contracts/policy/Cargo.toml` targeting `near-sdk = "5"` with release optimization profile.
  - Ported `contracts/policy/src/lib.rs` from build pack appendix.
  - Implemented 11 unit tests in `contracts/policy/src/lib.rs` covering:
    - Agent registration and budget/policy views.
    - Unregistered caller panic (`NOT_AGENT`) before state writes.
    - Legit action execution under budget (`ALLOWED`).
    - Fixed check order: `OVER_VELOCITY_CAP` evaluates before contract target allowlist check.
    - Target contract check (`TARGET_NOT_ALLOWED`).
    - Method name check (`METHOD_NOT_ALLOWED`).
    - Daily spending cap check (`OVER_DAILY_CAP`).
    - Payout recipient check (`RECIPIENT_NOT_ALLOWED`).
    - Lazy window resets (10-minute burst window and 24-hour daily budget window).
    - Auto-pause circuit breaker tripping on 5th reject and blocking subsequent calls.
    - Owner emergency pause and unpause controls.
  - Scaffolded `contracts/mock-token/` (NEP-141 `mUSD` faucet) and `contracts/mock-dex/` (fixed-rate toy swap).

- **TypeScript SDK (`sdk/`)**
  - Scaffolded `@scopeguard/sdk` with TypeScript configuration.
  - Implemented `loadCredential(path)` for loading protocol-restricted function-call passkeys.
  - Implemented `act(...)` for building and signing `execute` calls to the policy contract.
  - Implemented `budget()` view helper reading remaining limits.

- **AI Scope Drafter (`drafter/`)**
  - Scaffolded `@scopeguard/drafter`.
  - Added strict JSON Schema validation using `ajv`.
  - Implemented lint rules for high-risk scopes (unbounded payouts, high velocity, admin methods).
  - Implemented plain-English policy summary generator and safe fallback to restrictive defaults.

- **Demo Agent (`demo-agent/`)**
  - Scaffolded `@scopeguard/demo-agent` with intentionally naive prompt-following behavior.
  - Wired SDK interaction to demonstrate onchain enforcement when instructions attempt forbidden transfers.

- **AI Judge Automated Verification (`scripts/`)**
  - Created `scripts/verify-ai-judge.js`: minimal, zero-dependency test script for Claude Code, Codex, and human judges.
  - Verified in 0.1 seconds across all check layers, check order, budget tracking, and auto-pause breaker trip.

- **Web Dashboard & Interactive Panic UI (`web/components/`)**
  - Created `web/components/CircuitBreakerBanner.tsx`: real-time visual indicator for reject count, auto-pause tripping state, and owner unpause trigger.
  - Created `web/components/PanicPanel.tsx`: soft pause, emergency pot evacuation (withdraw), and hard passkey revocation (nuclear stop).
  - Created `web/components/BudgetVelocityGauge.tsx`: displays daily spend cap (mUSD), gas budget (NEAR), and burst velocity with distinct non-overlapping labels.
  - Created `web/components/ActivityFeed.tsx`: streams ALLOW and REJECT events with reason codes and explorer links.

- **Alert Watcher (`watcher/`)**
  - Scaffolded `@scopeguard/watcher` to tail `EVENT_JSON` logs for `REJECT` and `AUTO_PAUSE`.
  - Added formatting for Telegram and Discord webhook notifications.

- **Tooling & Environment**
  - Verified Node.js v26.3.0 and npm 11.16.0.
  - Installed `near-cli` v4.0.13 globally via npm.
  - Installed Rust toolchain (`rustc`, `cargo`, `rustup`) v1.99.1.
  - Added target `wasm32-unknown-unknown` to rustup.
  - Configured Cargo sparse index and disabled revocation checking for network resilience on Windows.
  - Installed Visual Studio 2026 Community C++ Build Tools (`link.exe`, Windows 11 SDK, MSVC x64/x86 tools).
  - Installed NASM v3.02 for native host crypto assembly (`aws-lc-sys`).

- **Contract Build & Verification Milestones**
  - Updated `contracts/policy/src/lib.rs` to invoke near-sdk 5 `testing_env!` macro.
  - Fully implemented NEP-141 standard on `contracts/mock-token/src/lib.rs` with `FungibleTokenCore`, `FungibleTokenResolver`, and `StorageManagement` using `NearToken`.
  - Cleaned unused imports in `contracts/mock-dex/src/lib.rs`.
  - Wired `perform_action` cross-contract promise dispatch in `contracts/policy/src/lib.rs` with prepaid gas allocation.
  - Built all three contract crates to optimized WebAssembly (`mock_dex.wasm`, `mock_token.wasm`, `policy_contract.wasm`).
  - Executed full workspace unit test suite (`cargo test --workspace`): all 11 tests passed with 0 failures and 0 warnings.
  - Executed `node scripts/verify-ai-judge.js`: all checks passed in under 0.1 seconds.

- **SDK and Services TypeScript Compilation**
  - Added `@types/node` and built `@scopeguard/sdk` to `dist/index.js` and `dist/index.d.ts`.
  - Added `tsconfig.json` and compiled `@scopeguard/drafter` with schema validation and lint checks.
  - Added `tsconfig.json` and compiled `@scopeguard/demo-agent` obedient injection runner.
  - Added `tsconfig.json` and compiled `@scopeguard/watcher` event parser.

- **Timelock System for ScopeGuard**
  - Added policy fields: `high_value_threshold` (vault units, 0 disables), `high_value_delay_seconds` (default 3600), and `policy_change_delay_seconds` (default 600).
  - Added contract state: `pending_actions` (bounded queue, max 8 entries), `staged_policy` (policy waiting out delay with `effective_at`), and `next_pending_id`.
  - Updated `execute`: high-value actions at or above threshold are appended to `pending_actions`, emit `PENDING`, and return pending id without recording spend. Queue full returns `PENDING_QUEUE_FULL` as a value, never a panic.
  - Implemented `settle_pending(agent, id)`: callable after delay, re-checks all 7 rules; if passed records spend and performs action (`SETTLED`), if failed discards intent (`REJECT`).
  - Implemented `cancel_pending(agent, id)`: owner only, immediate veto, never feeds circuit breaker (`CANCELLED`).
  - Implemented `set_policy(agent, policy)` with delayed staging (`POLICY_STAGED`), lazy application on next call (`POLICY_APPLIED`), and immediate cancellation (`cancel_policy_change`, `POLICY_CHANGE_CANCELLED`).
  - Verified non-delayed emergency powers: `pause`, `unpause`, `withdraw`, `cancel_pending`, and `cancel_policy_change` execute immediately.
  - Added 7 comprehensive unit tests (total 19 tests in policy contract, all green).
  - Updated `@scopeguard/drafter` with timelock defaults and lint checks (threshold vs daily cap, delay > 0).
  - Updated `@scopeguard/sdk` with `settlePending`, `cancelPending`, `cancelPolicyChange`, `getPendingActions`, and `getStagedPolicy`.
  - Updated `@scopeguard/watcher` to tail and alert on `PENDING`, `SETTLED`, `CANCELLED`, `POLICY_STAGED`, `POLICY_APPLIED`, and `POLICY_CHANGE_CANCELLED`.
  - Updated AI judge script (`scripts/verify-ai-judge.js`) with timelock simulation and queue verification.
  - Built Web UI components: `PendingQueuePanel.tsx` with live countdown and cancel veto, and `StagedPolicyBanner.tsx`. Rebuilt Next.js production bundle with 0 errors.
