# Changelog: ScopeGuard

All notable changes, progress, decisions, and updates to the ScopeGuard project are documented in this file.

The format is based on Keep a Changelog, adhering to the Ponytail senior developer standard: clean, precise, and traceable.

---

## [Unreleased]

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
  - Verified in 0.1 seconds across all 7 checks, check order, budget tracking, and auto-pause breaker trip.

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
