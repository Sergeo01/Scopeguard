# ScopeGuard System Architecture

ScopeGuard enforces programmatic risk controls for autonomous AI agents on NEAR Protocol. It ensures that an agent operating on behalf of a human owner cannot exceed explicit spending limits, call unallowlisted smart contracts, transfer funds to unauthorized parties, or drain treasury assets.

---

## 1. Core Architectural Components

The ScopeGuard architecture consists of five core tiers:

```
+-------------------------------------------------------------------+
|                        Owner Web Console                          |
|  - Policy editor with validation & security linter                |
|  - Real-time spend, velocity, and drawdown telemetry              |
|  - Emergency controls: Pause, Unpause, Withdraw, Revoke, Settle   |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                     NEAR Protocol Consensus                       |
|                                                                   |
|   +-----------------------------------------------------------+   |
|   |                 Agent Sub-Account                         |   |
|   |  - Holds ONLY scoped FunctionCall key                     |   |
|   |  - receiver: Guard Contract, method: ["execute"]          |   |
|   |  - Limited NEAR gas allowance                             |   |
|   +-----------------------------------------------------------+   |
|                                 |                                 |
|                                 | calls execute()                 |
|                                 v                                 |
|   +-----------------------------------------------------------+   |
|   |                 ScopeGuard Policy Contract                |   |
|   |  - 10-step invariant check pipeline                       |   |
|   |  - Dual internal vaults: NEP-141 token + Native NEAR      |   |
|   |  - Rolling 24-25h spend bucket windows (1-hour bins)      |   |
|   |  - Fixed 10-minute tumbling velocity rate limiter         |   |
|   |  - Timelock quarantine queue with owner settlement        |   |
|   |  - Auto-pause circuit breaker & canary tripwires          |   |
|   |  - Drawdown floor protection against high-water marks     |   |
|   +-----------------------------------------------------------+   |
|                                 |                                 |
|                                 | dispatches on ALLOW             |
|                                 v                                 |
|   +-----------------------------------------------------------+   |
|   |                  External Ecosystem Targets               |   |
|   |  - Allowlisted DEX swaps (e.g. Ref Finance, Mock DEX)     |   |
|   |  - Approved lending interactions (e.g. Burrow)            |   |
|   |  - Cross-chain intent deposit solvers                     |   |
|   |  - Verified recipient payouts                             |   |
|   +-----------------------------------------------------------+   |
+-------------------------------------------------------------------+
                                  ^
                                  | logs events
+-------------------------------------------------------------------+
|                     Stateless Event Watcher                       |
|  - Tails NEAR consensus blocks for REJECT and AUTO_PAUSE logs     |
|  - Broadcasts immediate webhooks to Telegram and Discord          |
|  - Zero signing authority and zero access keys                    |
+-------------------------------------------------------------------+
```

---

## 2. Vault Custody & Separation of Funds

1. **Agent Sub-Account Isolation:**
   The agent executes from a dedicated NEAR sub-account (e.g. `agent.alice.near`), entirely segregated from the owner's primary account (`alice.near`).

2. **Dual-Asset Internal Vaults:**
   Funds managed by the agent are held in custody by the Guard contract:
   - **Token Vault:** NEP-141 custody token balance deposited by the owner via `ft_transfer_call`.
   - **Native NEAR Vault:** Native NEAR balance deposited by the owner via `deposit_near`.
   The agent cannot access any funds outside these internal vaults.

3. **Protocol Key Limitation:**
   The agent machine stores only a function-call access key. Under NEAR protocol consensus rules, this key can only invoke `execute` on the Guard contract. It cannot transfer native NEAR directly, deploy contracts, or manage keys.

---

## 3. Execution Pipeline & Settlement Paths

When the agent invokes `execute(action)`, the contract runs an invariant evaluation pipeline:

### A. Immediate Execution Path
For actions that pass all 10 policy checks and fall below the `high_value_threshold`:
- Vault balance is debited immediately.
- Spend is recorded in the current 1-hour rolling bucket.
- The contract dispatches the corresponding cross-contract call (`ft_transfer`, contract invocation, or native transfer).
- An asynchronous callback (`on_action_resolved`) monitors execution. If the downstream call fails, the vault balance is restored and spend is rolled back in the original bucket.

### B. Timelock Quarantine Path
For actions whose amount meets or exceeds `high_value_threshold`:
- The action is not executed immediately.
- The action is stored in the `pending_actions` timelock quarantine queue.
- An `executable_at` timestamp is computed based on `high_value_delay_seconds`.
- The contract emits a `PENDING` event and returns `Outcome::Pending`.
- The owner can review the quarantined action in the web console and either settle it after the delay elapses or cancel and purge it immediately.

### C. Policy Rejection & Circuit Breakers
If any policy check fails:
- The contract returns a structured `Outcome::Rejected { reason }` value without panicking.
- In the same atomic transaction, an intrusion strike is added to the agent's rolling counter.
- If strikes reach `auto_pause_rejects` within `auto_pause_window_seconds`, the agent is automatically marked `paused = true` and an `AUTO_PAUSE` event is emitted.

---

## 4. Advanced Risk Features

### Rolling 24-Hour Spend Windows
Spend limits are evaluated across 24 discrete 1-hour buckets with a 24-hour lookback. This provides an effective window of 24 to 25 hours, preventing boundary exploitation where a daily limit could be doubled immediately before and after midnight resets.

### Drawdown Breaker
The policy tracks the agent vault's all-time high-water mark. If the current vault balance drops below the allowable drawdown percentage (`drawdown_threshold_bps`), subsequent actions are blocked with `DRAWDOWN_EXCEEDED` until the owner resets windows or deposits additional funds.

### Canary Decoy Methods
The owner can configure honey-token method names (e.g. `admin_drain`, `emergency_withdraw`) in `policy.canary_methods`. If an untrusted agent or prompt injection triggers any canary method, execution is aborted with `CANARY_TRIPPED` and the agent is locked out immediately.

### Scoped Task Leases
To prevent autonomous agents from running indefinitely without supervision, policies can enforce a `task_lease_duration_seconds`. After the lease duration expires from policy activation, calls fail with `TASK_LEASE_EXPIRED` until the owner unpauses or refreshes the lease.

### Multi-RPC Failover Fleet
Client runtimes and the web console maintain an active pool of NEAR RPC endpoints (FastNEAR, official NEAR Testnet RPC, and secondary backups). If an RPC node encounters rate limits, timeouts, or network splits, the client fails over automatically across the fleet.

### Multi-Framework Integrations
- **IronClaw MCP Server:** Exposes policy-guarded actions to any Model Context Protocol host (Cursor, Claude Desktop, standard MCP clients).
- **ElizaOS Plugin:** Integrates directly with Eliza autonomous agent runtimes, exposing balance providers, preflight simulations, and policy-checked actions.
