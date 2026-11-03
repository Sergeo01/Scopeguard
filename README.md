# ScopeGuard: Scoped Passkeys for AI Agents on NEAR

Give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.

Built for the NEAR Hackathon: **Build Beyond Boundaries**  
Tracks: **AI Security & Defense** (Primary), **Agent Economy** (Secondary)  
Repository: [https://github.com/Sergeo01/Scopeguard](https://github.com/Sergeo01/Scopeguard) (Public)  
Live Console: [https://scopeguard.blockframe.cloud](https://scopeguard.blockframe.cloud)

---

## 1. Quickstart: 30-Second Verification (Judge Verification Gate)

Prerequisites: cargo and Rust wasm32-unknown-unknown toolchain installed first.

Judges and evaluators can verify the entire project locally and on testnet in under 30 seconds:

```bash
# 1. Run all 42 native Rust smart contract unit tests
cargo test --manifest-path contracts/Cargo.toml

# 2. Run automated judge verification script (rules, codes, timelocks, and consensus behavior)
node scripts/verify-ai-judge.js

# 3. Verify live NEAR testnet consensus state in read-only observer mode
node scripts/reset-demo.js --dry-run

# 4. Build developer studio web console
npm run build --prefix web
```

### Verbatim Expected Outputs

#### 1. Contract Tests (`cargo test --manifest-path contracts/Cargo.toml`)
```
   Compiling policy-contract v0.2.0 (D:\Hackathon\NEAR\contracts\policy)
    Finished `test` profile [unoptimized + debuginfo] target(s)
     Running unittests src\lib.rs
test result: ok. 42 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished
```

#### 2. Judge Verification Script (`node scripts/verify-ai-judge.js`)
```
==================================================================
ScopeGuard: Automated Verification for AI Judges (Claude Code / Codex)
==================================================================

0. Running real Rust smart contract unit test suite (contracts/policy)...
   --> Verified: 42 native Rust tests PASSED with exit code 0.

1. Verifying policy reason codes and check order...
   [Code 1] -> NOT_AGENT
   [Code 2] -> PAUSED
   [Code 3] -> OVER_VELOCITY_CAP
   [Code 4] -> TARGET_NOT_ALLOWED
   [Code 5] -> METHOD_NOT_ALLOWED
   [Code 6] -> OVER_DAILY_CAP
   [Code 7] -> RECIPIENT_NOT_ALLOWED
   [Code 8] -> INSUFFICIENT_VAULT_BALANCE
   [Code 9] -> PENDING_QUEUE_FULL
   --> Verified: all check codes match the specification exactly.

2. Verifying rule enforcement engine...
   [Step A] Action below threshold (100 mUSD) -> ALLOWED immediately
   [Step B] High-value action (500 mUSD) -> PENDING (id: 1, waiting 3600s timelock)
   [Step C] Settle before delay -> REFUSED (executable_at not reached)
   [Step D] Settle after delay (timestamp 4601) -> SETTLED (spent is now 600 mUSD)
   [Step E] Call to evil_contract.testnet -> REJECTED (TARGET_NOT_ALLOWED)
   [Step F] Call to mockdex.testnet::drain -> REJECTED (METHOD_NOT_ALLOWED)
   [Step G] Attempting 500 mUSD (remaining is 400 mUSD) -> REJECTED (OVER_DAILY_CAP)
   [Step H] Transfer to hacker.testnet -> REJECTED (RECIPIENT_NOT_ALLOWED)
   [Step H2] Transfer 150 mUSD with 100 mUSD vault balance -> REJECTED (INSUFFICIENT_VAULT_BALANCE)

3. Verifying circuit breaker auto-pause...
   [Step I] 5th reject tripped the circuit breaker -> Agent is now PAUSED onchain

==================================================================
All automated checks PASSED successfully!
ScopeGuard guarantees bounded, visible, recoverable loss.
==================================================================
```

#### 3. Consensus State Verification (`node scripts/reset-demo.js --dry-run`)
```
==================================================================
 ScopeGuard: One-Command Testnet Demo Reset & State Verifier
==================================================================
RPC:     https://test.rpc.fastnear.com
Guard:   guard2.sergeo-guard.testnet
Agent:   agent.sergeo-guard.testnet
Owner:   sergeo-guard.testnet

[Step 1] Inspecting Current Onchain State...
  Paused:        false
  Remaining:     475 mUSD (Cap: 500)
  Vault Balance: 350 mUSD
  Access Keys:   1 key(s) registered on NEAR consensus.
    - ed25519:Homj5ybH... [FunctionCall -> guard2.sergeo-guard.testnet::execute]

[Step 2] Checking Timelock Queue: 2 item(s) pending.

==================================================================
 Read-Only Inspection Complete (--dry-run / observer mode)
==================================================================
```

#### 4. Web Console Build (`npm run build --prefix web`)
```
> @scopeguard/web@0.1.0 build
> next build
✓ Compiled successfully
✓ Generating static pages (7/7)
✓ Finalizing page optimization
```

---

## 2. The Problem

To let an AI agent do anything with money today, its owner must give it credentials. Right now, that means the agent holds a full private key, sitting in a plaintext file on the owner's machine, next to third-party skills written by strangers.

That creates an unacceptable equation: one trick equals total loss.

- A stranger writes a malicious skill and the owner installs it. Audits of 2,857 skills on ClawHub found 341 malicious.
- A stranger slips an instruction into something the agent reads (prompt injection). The agent cannot reliably distinguish a fake instruction from a real one.
- A credential file leaks or is exposed online. Over 30,000 live agent instances were found exposed in under two weeks.
- Crypto transfers cannot be reversed. There is no bank to call and no chargeback.

In every case, the agent held a key that could do everything the owner could do, so the worst day is a complete loss.

---

## 3. What ScopeGuard Builds Instead

ScopeGuard replaces full keys with limited, scoped identity. An agent never holds a master key. It holds a small, restricted key that can only do its specific job. Every action it attempts is checked by an onchain Policy contract on NEAR against rules the owner signed.

If the agent is tricked, injected, or compromised, the damage is bounded by those rules, recorded in a public audit log, and recoverable by the owner.

The product promise: **"Give your agent a key that can only do its job."**

---

## 4. The Five Core Pieces

1. **The Agent Sub-Account:** The agent operates under its own named sub-account (for example, `agent.alice.testnet`), completely isolated from the owner's main funds.
2. **The Spending Pot (Vault):** The owner funds a limited working balance in the Guard contract. That balance is the hard outer limit of what the agent can touch.
3. **The Scoped Passkey:** A NEAR function-call access key restricted at the protocol level to `receiver = Policy Contract`, `methods = ["execute"]`, with a capped 0.25 NEAR gas fee allowance. It cannot transfer NEAR directly, call other contracts, add keys, or delete the account.
4. **The Policy Guard Contract:** A Rust contract on NEAR implementing ten ordered checks. If checks pass, it executes the action. If any check fails, it writes to an onchain reject log, returns the machine-readable reason code without panicking, and trips an auto-pause circuit breaker if rejections spike.
5. **The Owner Rule Card:** The owner's policy specifying allowed target contracts, allowed methods, a fixed 24-hour spend cap window (protected by a 10-minute velocity throttle against boundary bursts), a recipient allowlist, a velocity limit (actions per 10 minutes), and auto-pause settings.

### The Worst-Case Bound: Mathematical Guarantee

Without any human intervention, the maximum theoretical loss is mathematically bounded at the daily cap ($500 mUSD) because all high-value actions are held in timelock quarantine requiring explicit owner settlement.

Even under continuous malicious prompt injection while the owner is away, the agent can never exceed its daily spend cap ($500 mUSD) in any 24-hour window. Any transaction attempting to move an amount at or above the high-value threshold is halted onchain and placed into timelock quarantine. Because quarantined actions can only be settled by the owner's cryptographic signature, an unattended agent cannot lose more than the daily cap under any circumstance.

---

## 5. The Ten Guard Checks (Strict Order)

1. `NOT_AGENT`: Caller must match the registered agent account.
2. `PAUSED`: Agent must not be paused by owner or circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist. A typed `Transfer` must name the policy token, and a generic `ContractCall` may never target it.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target, and token calls must use typed `GuardAction::Transfer`.
6. `OVER_DAILY_CAP`: Spend in the current 24-hour budget window plus requested amount must fit the daily cap.
7. `RECIPIENT_NOT_ALLOWED`: External recipient must be explicitly allowlisted.
8. `PENDING` (not a rejection): An action at or above `high_value_threshold` is queued for owner settle or veto.
9. `INSUFFICIENT_VAULT_BALANCE`: A `Transfer` may not exceed the agent's own recorded vault balance.
10. `PENDING_QUEUE_FULL`: The quarantine queue is bounded, so a flood of high-value actions cannot grow state without limit.

`revoke_agent` is a separate owner control, not a check: it empties the target and recipient allowlists, pauses the agent, clears staged policy and pending intents, and cannot be undone. Because the allowlist is empty, every later `execute` is rejected even if the agent is unpaused. This is the supported way to retire an agent whose FunctionCall key was lost or leaked, because the agent account owns its own key, so the owner cannot delete it from consensus.

---

## 6. Repository Layout

- `contracts/policy`: Hardened Rust policy contract (near-sdk 5, version 0.2.0) with real token custody and strongly typed actions.
- `contracts/mock-token`: NEP-141 token (`mUSD`) with faucet mint and storage registration for testnet verification.
- `contracts/mock-dex`: Mock exchange with fixed rate swap, the agent's legitimate target.
- `sdk`: TypeScript SDK (`loadCredential`, `act`, `budget`). Notice: repo-only, built from source, not published on npm registry.
- `demo-agent`: Deliberately naive Node.js agent with LLM in the loop.
- `drafter`: AI scope drafter service with JSON Schema validation and lint checks.
- `web`: Next.js developer studio workbench with a live attack simulator, a fleet console that reads chain state, and owner emergency controls that print the `near call` you sign yourself.
- `watcher`: Stateless notification service tailing reject events for Telegram and Discord alerts.

---

## 7. Live Testnet Deployments & Verified Transactions

ScopeGuard is deployed on NEAR Testnet with active contract instances and verifiable execution receipts.

### Deployed Testnet Accounts & Contracts
- **Policy Guard Contract (v0.2.0):** [`guard2.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet)
- **Token Vault (mUSD):** [`sergeo-guard-token.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-token.testnet)
- **Mock DEX Contract:** [`sergeo-guard-dex.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet)
- **Agent Sub-Account:** [`agent.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/agent.sergeo-guard.testnet)
- **Owner Account:** [`sergeo-guard.testnet`](https://testnet.nearblocks.io/address/sergeo-guard.testnet)

### Verified Onchain Execution Proofs

Every hash below was verified against testnet consensus.

1. **Contract deployment (v0.2.0, state preserved):**
   - [`B8bb7pQSUNpf4a6f7uBNcrXJx7xiJxJDXdJKXFumAFev`](https://testnet.nearblocks.io/txns/B8bb7pQSUNpf4a6f7uBNcrXJx7xiJxJDXdJKXFumAFev), signed by `guard2.sergeo-guard.testnet`, redeployed over live state.
2. **Agent retirement via `revoke_agent` (allowlist erased, agent paused):**
   - [`CA9mZuRp1TDFu7hb3Ro6wXnLiD2ft2nUeCd7fpWpkuX9`](https://testnet.nearblocks.io/txns/CA9mZuRp1TDFu7hb3Ro6wXnLiD2ft2nUeCd7fpWpkuX9)
3. **Allowed work under policy:**
   - Swap 10 mUSD executed: [`6MYF5g7TwtSaPEygAnUybRLBLygWBbE45q7Du9fNp8G`](https://testnet.nearblocks.io/txns/6MYF5g7TwtSaPEygAnUybRLBLygWBbE45q7Du9fNp8G)
4. **High-value quarantine:**
   - Swap 300 mUSD queued as intent #1: [`2kvqn2ZP6qefuoZxj5aEe93pDx7A52QtVbWX4v9MPUF5`](https://testnet.nearblocks.io/txns/2kvqn2ZP6qefuoZxj5aEe93pDx7A52QtVbWX4v9MPUF5)
   - Owner vetoed intent #1: [`ApLGg8RcWvEaSnWD6FNvUmDhYFQahZUHevZdqxmjbNJq`](https://testnet.nearblocks.io/txns/ApLGg8RcWvEaSnWD6FNvUmDhYFQahZUHevZdqxmjbNJq)
5. **Rejections returned as data, not panics:**
   - Recipient outside the allowlist (RECIPIENT_NOT_ALLOWED): [`6kEHj53hcqSXbbr2n5j7sLSVrcWwuGjTH6ongEBbsoNL`](https://testnet.nearblocks.io/txns/6kEHj53hcqSXbbr2n5j7sLSVrcWwuGjTH6ongEBbsoNL)
   - Rogue target contract (TARGET_NOT_ALLOWED): [`EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ`](https://testnet.nearblocks.io/txns/EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ)
   - Prompt injection transfer to attacker.testnet (RECIPIENT_NOT_ALLOWED): [`tsNvfGwZ4gkQyLSqXGDGbyV3ZPH2XHDFAYYE8g1ztQ2`](https://testnet.nearblocks.io/txns/tsNvfGwZ4gkQyLSqXGDGbyV3ZPH2XHDFAYYE8g1ztQ2)
6. **Key rotation kills a leaked key:**
   - A swap signed with the retired agent key (`trader.sergeo-guard.testnet`) is refused with `PAUSED`: [`ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5`](https://testnet.nearblocks.io/txns/ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5). The current agent is `agent.sergeo-guard.testnet`, which holds exactly one scoped FunctionCall key.

---

## 8. Site Docs Completeness, Argument Shapes, & Methods Reference

### SDK Local Installation (Repo-Only)
`@scopeguard/sdk` is not published to the npm registry. Install and compile it directly from the local repository:

```bash
git clone https://github.com/Sergeo01/Scopeguard.git
cd Scopeguard/sdk
npm install
npm run build
npm link
```

### Raw Guard `execute` Action Shapes

#### 1. Swap Action
```json
{
  "action": {
    "Swap": {
      "dex": "sergeo-guard-dex.testnet",
      "token_in": "sergeo-guard-token.testnet",
      "amount_in": "25",
      "min_out": "20"
    }
  }
}
```

#### 2. Transfer Action
```json
{
  "action": {
    "Transfer": {
      "token": "sergeo-guard-token.testnet",
      "to": "sergeo-guard.testnet",
      "amount": "50",
      "memo": "Monthly server allowance"
    }
  }
}
```

#### 3. ContractCall Action
```json
{
  "action": {
    "ContractCall": {
      "target": "sergeo-guard-dex.testnet",
      "method": "swap",
      "args": "{\"token_in\":\"sergeo-guard-token.testnet\",\"amount_in\":\"10\"}"
    }
  }
}
```

### `agent.json` Credential Schema
```json
{
  "agentAccountId": "agent.sergeo-guard.testnet",
  "policyContractId": "guard2.sergeo-guard.testnet",
  "publicKey": "ed25519:Homj5yb...",
  "privateKey": "ed25519:...",
  "networkId": "testnet",
  "nodeUrl": "https://test.rpc.fastnear.com",
  "connected_at": "2026-11-01T12:00:00.000Z"
}
```

### Administrative and View Method Signatures

| Method | Access | Arguments | Description / CLI Example |
| :--- | :--- | :--- | :--- |
| `settle_pending` | Owner only | `agent: AccountId, id: u64` | `near call guard2.sergeo-guard.testnet settle_pending '{"agent":"agent.sergeo-guard.testnet","id":1}' --accountId sergeo-guard.testnet --gas 100000000000000`. Note: Failed settle returns a REJECTED outcome and retains the item in queue for retry. |
| `cancel_pending` | Owner only | `agent_account: AccountId, id: u64` | `near call guard2.sergeo-guard.testnet cancel_pending '{"agent_account":"agent.sergeo-guard.testnet","id":1}' --accountId sergeo-guard.testnet --gas 100000000000000` |
| `pause` | Owner only | `agent_account: AccountId` | `near call guard2.sergeo-guard.testnet pause '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000` |
| `unpause` | Owner only | `agent_account: AccountId` | `near call guard2.sergeo-guard.testnet unpause '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000` |
| `withdraw` | Owner only | `agent_account: AccountId, amount: U128` | `near call guard2.sergeo-guard.testnet withdraw '{"agent_account":"agent.sergeo-guard.testnet","amount":"350"}' --accountId sergeo-guard.testnet --gas 100000000000000` (Destination is forced to owner) |
| `revoke_agent` | Owner only | `agent_account: AccountId` | `near call guard2.sergeo-guard.testnet revoke_agent '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000` |
| `reset_windows` | Owner only | `agent_account: AccountId` | `near call guard2.sergeo-guard.testnet reset_windows '{"agent_account":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --gas 100000000000000` |
| `get_budget` | Public View | `agent_account: AccountId` | `near view guard2.sergeo-guard.testnet get_budget '{"agent_account":"agent.sergeo-guard.testnet"}'` |
| `get_policy` | Public View | `agent_account: AccountId` | `near view guard2.sergeo-guard.testnet get_policy '{"agent_account":"agent.sergeo-guard.testnet"}'` |
| `get_agents` | Public View | `owner: AccountId` | `near view guard2.sergeo-guard.testnet get_agents '{"owner":"sergeo-guard.testnet"}'` |
| `get_pending_actions` | Public View | `agent_account: AccountId` | `near view guard2.sergeo-guard.testnet get_pending_actions '{"agent_account":"agent.sergeo-guard.testnet"}'` |
| `get_staged_policy` | Public View | `agent_account: AccountId` | `near view guard2.sergeo-guard.testnet get_staged_policy '{"agent_account":"agent.sergeo-guard.testnet"}'` |
| `get_version` | Public View | None | `near view guard2.sergeo-guard.testnet get_version` (Returns `"0.2.0"`) |

### Vault Deposit Method (`ft_transfer_call`)
```bash
# 1. Mint testnet mock tokens from faucet (owner account)
near call sergeo-guard-token.testnet ft_mint '{"account_id":"sergeo-guard.testnet","amount":"1000"}' --accountId sergeo-guard.testnet --gas 30000000000000

# 2. Storage deposit on token contract for Guard contract (0.0125 NEAR attached)
near call sergeo-guard-token.testnet storage_deposit '{"account_id":"guard2.sergeo-guard.testnet","registration_only":true}' --accountId sergeo-guard.testnet --deposit 0.0125

# 3. Deposit into agent vault via ft_transfer_call (1 yoctoNEAR attached, msg = agent account)
near call sergeo-guard-token.testnet ft_transfer_call '{"receiver_id":"guard2.sergeo-guard.testnet","amount":"100","msg":"agent.sergeo-guard.testnet"}' --accountId sergeo-guard.testnet --depositYocto 1 --gas 100000000000000
```

---

## 9. Prior Art and Architectural Differentiators

Policy engines and spend permissions exist elsewhere in Web3 and Web2:
- **Offchain / Custodial Engines (Turnkey, Privy, Coinbase Developer Platform):** These solutions enforce policies within centralized enclaves or server infrastructure before keys sign transactions. If the platform is compromised or the API is bypassed, security collapses.
- **EVM Smart Contract Wallets (Safe Modules, Squads on Solana):** These enforce rules onchain, but require full smart wallet deployments, audits, and higher transaction fees for every agent.

**The ScopeGuard Differentiator on NEAR:**
NEAR accounts natively support protocol-level function-call access keys. An agent holds a key that the blockchain consensus itself restricts to only calling `guard2.sergeo-guard.testnet::execute` with a gas allowance. ScopeGuard adds the missing layer: **onchain value governance, real NEP-141 token custody, typed action verification, fixed 24-hour spend window accounting with velocity anti-burst throttling, recipient validation, anti-spam velocity limits, high-value timelock quarantine, and circuit breakers.**

---

## 10. Target Audience: Frameworks and Marketplaces

While individual developers can deploy ScopeGuard directly, the primary beneficiaries are **autonomous agent frameworks and bot marketplaces**:
- **Frameworks (OpenClaw, ElizaOS, Rig):** Can embed `@scopeguard/sdk` to offer users "Safe Agent Mode" out of the box.
- **Agent Marketplaces & Launchpads (Virtuals Protocol, NEAR AI):** Can provide creators with verifiable, bounded spending passkeys so users fund bot instances without fear of total wallet wipeouts.

---

## 11. Architectural Integration: IronClaw and ScopeGuard

### The Defense-in-Depth Model: Local Sandboxing Meets Onchain Passkeys

Autonomous AI agents moving money require dual-layer security across both execution tiers: the host environment where the model runs, and the blockchain consensus where money moves.

In this defense-in-depth architecture: IronClaw isolates local compute, tools, and credentials via WASM sandboxing; ScopeGuard isolates funds, keys, and execution onchain via NEAR protocol consensus; connecting them via Model Context Protocol gives IronClaw safe autonomous spending.

- **IronClaw (Local Compute Layer):** IronClaw isolates local compute, tools, and credentials via WASM sandboxing. It prevents malicious agent skills, compromised dependencies, and untrusted tool executions from reading the host filesystem, exfiltrating local environment secrets, or spawning unauthorized child processes.
- **ScopeGuard (Onchain Consensus Layer):** ScopeGuard isolates funds, keys, and execution onchain via NEAR protocol consensus. The agent never holds a master private key. It holds a protocol-scoped FunctionCall access key restricted to `guard.execute`, where 10 ordered policy checks and timelock quarantines govern all value transfers directly on the blockchain.
- **The Connection (Model Context Protocol / MCP):** Connecting them via Model Context Protocol gives IronClaw safe autonomous spending. When an IronClaw-sandboxed agent needs to swap tokens, pay for an API, or settle an invoice, it issues a structured spend request via an MCP tool to ScopeGuard. ScopeGuard cryptographically validates the action against the owner's policy card onchain before any funds can move.

### Why Both Are Essential

Local compute sandboxing alone cannot protect funds once a valid transaction is broadcast to the network: an injected model could instruct a sandboxed tool to transfer all available tokens to an attacker wallet. Conversely, onchain passkeys alone cannot protect local credentials or prevent arbitrary filesystem tampering on the host machine.

Together, IronClaw isolates the execution environment while ScopeGuard bounds financial exposure. Even if an attacker achieves complete model manipulation inside the local WASM sandbox, the attack dies onchain at the ScopeGuard contract.

### Connecting the IronClaw MCP Server

ScopeGuard includes a native Model Context Protocol (MCP) stdio server in `packages/ironclaw-mcp`. The server exposes strictly agent execution tools (`scopeguard_budget`, `scopeguard_preflight`, `scopeguard_act`) and zero owner powers. No `agent.toml` is required.

To register ScopeGuard with IronClaw:
```bash
ironclaw mcp add scopeguard node packages/ironclaw-mcp/dist/index.js --credential demo-agent/credentials/agent.json
```

### Strict Bot Proxy for Unmodified Bots

For trading bots whose internal source code cannot be refactored to call the ScopeGuard SDK directly, ScopeGuard provides an authenticated translation proxy in `proxy/`:
- Holds strictly an agent scoped passkey restricted to `guard.execute` (never an owner master key).
- Authenticates inbound bot requests via Bearer token (`PROXY_API_KEY`).
- Translates direct-style trades to typed `GuardAction` without widening scope.
- Every translation logs the resulting onchain Guard receipt hash.

Run the proxy:
```bash
node proxy/dist/server.js
```

---

## 12. Honest Limits, Known Gaps, and Security Invariants

We believe in radical transparency:
1. **Bounded Loss, Not Zero Loss:** Without any human intervention, the maximum theoretical loss is mathematically bounded at the daily cap ($500 mUSD) because all high-value actions are held in timelock quarantine requiring explicit owner settlement. If an owner configures a $100 daily cap, an injected agent could still execute legitimate trades that lose up to $100 on that day. The guarantee is that the agent can never lose $10,000 or drain external wallets.
2. **Single-Token Vault in v1:** In v1, each Guard policy specifies a single registered NEP-141 token pot (`policy.token`). The Guard strictly verifies the token contract on deposit and ensures transfers move that token. Generic `ContractCall` actions are prohibited from targeting `policy.token` directly, ensuring all value moves strictly through typed `Transfer`. Multi-token asset treasuries are scheduled for v2.
3. **Mock DEX Accounting Scope:** The demo DEX contract demonstrates fixed-rate swap gating and daily cap counting. In v1, swaps do not fake-debit tokens unless real assets move via `ft_transfer_call`. Full DEX AMM liquidity pool integration is planned for v2.
4. **Asynchronous Settlement and Automatic Rollback:** In ScopeGuard, token transfers debit the internal vault balance and daily spend cap before dispatching downstream cross-contract calls. If a transfer fails downstream (for example an unregistered receiver), private callbacks (`on_action_resolved` and `on_withdraw_resolved`) catch the downstream promise failure and automatically restore the internal vault balance and roll back the spend budget.
5. **Non-Custodial Owner Controls:** The ScopeGuard web server does not read owner keys from disk and does not sign with them by default. Emergency powers (pause, unpause, withdraw, revoke, reset) are executed via NEAR CLI or a user wallet directly onchain, and the admin console only prints the command. Two routes (`/api/register`, `/api/fund`) can sign with an owner key for a hosted demo; they are disabled unless the operator sets `SCOPEGUARD_ALLOW_SERVER_SIGNING=true` and supplies `OWNER_PRIVATE_KEY` in the environment, and they reject cross-origin requests. The local demo agent key is a scoped FunctionCall key, not an owner key.
6. **Error Extraction Limitation (near-api-js):** When an administrative contract call fails onchain with an assertion failure (such as non-owner caller or unexpired timelock delay), near-api-js often wraps the contract panic in a generic Wasm trap message. The SDK and web UI format known panic strings into readable explanations, but when the underlying RPC node omits the inner panic trace, the raw error will read as a Wasm trap.
7. **Demo Delays vs Production Defaults Note:** In the live testnet deployment, `high_value_delay_seconds` and `policy_change_delay_seconds` are configured to 60 seconds. This is an intentional testnet demo configuration to allow judges and evaluators to test timelock queuing, veto cancellation, and settlement within a 2-minute testing cycle without waiting 24 hours. In production deployments, both delays default to 86,400 seconds (24 hours).
8. **No Panic Invariant:** All policy rejections return structured value codes without panicking. Panicking on reject would revert state writes, which would silently erase the intrusion audit log and undo circuit breaker strikes.
9. **Pre-Demo Reset:** Because the onchain circuit breaker automatically freezes the agent after repeated attack declines during evaluation, evaluators can reset the agent and timelock queue anytime with one command: `node scripts/reset-demo.js`.

---

## 13. Verification and Testing

See [TESTING_FOR_AI_JUDGES.md](./TESTING_FOR_AI_JUDGES.md) for exact reproduction steps for human and AI evaluators (42 native Rust unit tests, 14 web tests, and automated check scripts).
