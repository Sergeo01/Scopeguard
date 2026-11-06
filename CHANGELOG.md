# Changelog: ScopeGuard

All notable changes to the ScopeGuard project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-11-06

### Added
- **Rolling 24-25h Spend Window:** Replaced fixed midnight reset with rolling 1-hour buckets across a 24-hour lookback, preventing window boundary double-spend attacks.
- **Independent Native NEAR Budget:** Added `near_daily_cap` and `near_high_value_threshold` to `Policy`, providing isolated budgets and timelock quarantine for native NEAR actions alongside token limits.
- **ContractCall Value-Moving Denylist:** Generic `ContractCall` actions are prohibited from invoking value-moving methods (`ft_transfer`, `nft_transfer`, `mt_transfer`, `withdraw`, `near_withdraw`, `storage_withdraw`, `storage_unregister`). Attached deposits are debited from the native NEAR vault and count against native spend caps.
- **Root Setup & Test Runners:** Added cross-platform `scripts/setup.js` and `scripts/test-all.js` entry points ensuring proper build ordering and unified testing across all components.
- **API Guard Enhancements:** Added sliding window rate limiting and optional shared secret validation for non-browser callers accessing hosted demo endpoints.
- **Technical Documentation:** Added comprehensive architecture, policy reference, threat model, and deployment guides in `docs/`.

### Changed
- Bumped policy contract version to 0.4.0 with backward-compatible deserialization for legacy v0.3.0 records.
- Refined drafter linting and JSON Schema validation to cover native NEAR budget fields and denylisted contract call methods.
- Updated demo reset endpoint to verify whether state actually requires resetting before dispatching onchain transactions, and record reset events to the activity ledger.

### Removed
- Removed evaluator-specific scripts and guides in favor of standard developer workflows and automated continuous integration.
- Removed legacy unreferenced scratch artifacts and development logs.

---

## [0.3.0] - 2026-10-31

### Added
- **Drawdown Circuit Breaker:** Added high-water-mark tracking and basis-point drawdown threshold (`drawdown_threshold_bps`) to freeze trading if capital experiences severe drawdowns.
- **Canary Honeypot Methods:** Configurable decoy method names in `policy.canary_methods` that immediately trip an emergency auto-pause when invoked.
- **Task Leases:** Added `task_lease_duration_seconds` to enforce bounded agent execution lifespans from policy activation.
- **Native NEAR Vault:** Added `deposit_near` and `withdraw_near` methods for holding and withdrawing native NEAR working capital directly on the Guard contract.
- **IronClaw MCP Server:** Model Context Protocol stdio server (`packages/ironclaw-mcp`) enabling LLM agents to inspect rules, simulate actions, and execute guarded calls.
- **ElizaOS Plugin:** Autonomous agent integration plugin (`packages/plugin-eliza`) providing balance providers, preflight simulations, and transaction execution.
- **Multi-RPC Failover Fleet:** Added automatic RPC failover across multiple testnet endpoints in SDK, watcher, and web services.

---

## [0.2.0] - 2026-10-30

### Added
- **`revoke_agent` Method:** Allows owners to permanently wipe allowlists and pause an agent while preserving vault balances for owner withdrawal.
- **`reset_windows` Method:** Allows owners to clear rolling spend buckets, velocity counters, and auto-pause strike history without altering policy permissions.
- **Stateless Event Watcher:** Added daemon service (`watcher/`) tailing contract logs and dispatching webhook notifications to Discord and Telegram.

### Changed
- Rotated testnet demo agent to `agent.sergeo-guard.testnet` holding a scoped FunctionCall key.
- Disabled server-side owner signing by default, requiring explicit `SCOPEGUARD_ALLOW_SERVER_SIGNING=true` configuration for hosted demos.

---

## [0.1.0] - 2026-10-25

### Added
- Initial release of ScopeGuard policy contract on NEAR Protocol with near-sdk 5.
- Typed `GuardAction` variants (`Transfer`, `Swap`, `ContractCall`, `IntentTransfer`).
- Internal vault token custody with asynchronous rollback on failed downstream calls.
- Timelock quarantine queue for high-value actions with owner veto and settlement controls.
- Auto-pause circuit breaker after repeated policy rejections.
- TypeScript SDK (`@scopeguard/sdk`) with credential loader and action dispatcher.
- Developer studio web console with real-time telemetry and rule editor.
