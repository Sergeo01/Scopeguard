# ScopeGuard: Scoped Passkeys for AI Agents on NEAR

Give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.

Built for the NEAR Hackathon: **Build Beyond Boundaries**  
Tracks: **AI Security & Defense** (Primary), **Agent Economy** (Secondary)

---

## 1. The Problem

To let an AI agent do anything with money today, its owner must give it credentials. Right now, that means the agent holds a full private key, sitting in a plaintext file on the owner's machine, next to third-party skills written by strangers.

That creates an unacceptable equation: one trick equals total loss.

- A stranger writes a malicious skill and the owner installs it. Audits of 2,857 skills on ClawHub found 341 malicious.
- A stranger slips an instruction into something the agent reads (prompt injection). The agent cannot reliably distinguish a fake instruction from a real one.
- A credential file leaks or is exposed online. Over 30,000 live agent instances were found exposed in under two weeks.
- Crypto transfers cannot be reversed. There is no bank to call and no chargeback.

In every case, the agent held a key that could do everything the owner could do, so the worst day is a complete loss.

---

## 2. What ScopeGuard Builds Instead

ScopeGuard replaces full keys with limited, scoped identity. An agent never holds a master key. It holds a small, restricted key that can only do its specific job. Every action it attempts is checked by an onchain Policy contract on NEAR against rules the owner signed.

If the agent is tricked, injected, or compromised, the damage is bounded by those rules, recorded in a public audit log, and recoverable by the owner.

The product promise: **"Give your agent a key that can only do its job."**

---

## 3. Quickstart: 30-Second Verification

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

---

## 4. The Five Core Pieces

1. **The Agent Sub-Account:** The agent operates under its own named sub-account (for example, `agent.alice.testnet`), completely isolated from the owner's main funds.
2. **The Spending Pot (Vault):** The owner funds a limited working balance in the Guard contract. That balance is the hard outer limit of what the agent can touch.
3. **The Scoped Passkey:** A NEAR function-call access key restricted at the protocol level to `receiver = Policy Contract`, `methods = ["execute"]`, with a capped NEAR gas allowance. It cannot transfer NEAR directly, call other contracts, add keys, or delete the account.
4. **The Policy Guard Contract:** A Rust contract on NEAR implementing ten ordered checks. If checks pass, it executes the action. If any check fails, it writes to an onchain reject log, returns the machine-readable reason code without panicking, and trips an auto-pause circuit breaker if rejections spike.
5. **The Owner Rule Card:** The owner's policy specifying allowed target contracts, allowed methods, a fixed 24-hour spend cap window (protected by a 10-minute velocity throttle against boundary bursts), a recipient allowlist, a velocity limit (actions per 10 minutes), and auto-pause settings.

---

## 5. The Ten Guard Checks (Strict Order)

1. `NOT_AGENT`: Caller must match the registered agent account.
2. `PAUSED`: Agent must not be paused by owner or circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist. A typed `Transfer` must name the policy token, and a generic `ContractCall` may never target it.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target, and token calls must use typed `GuardAction::Transfer`.
6. `OVER_DAILY_CAP`: spend in the current 24-hour budget window plus requested amount must fit the daily cap.
7. `RECIPIENT_NOT_ALLOWED`: External recipient must be explicitly allowlisted.
8. `PENDING` (not a rejection): an action at or above `high_value_threshold` is queued for owner settle or veto.
9. `INSUFFICIENT_VAULT_BALANCE`: a `Transfer` may not exceed the agent's own recorded vault balance.
10. `PENDING_QUEUE_FULL`: the quarantine queue is bounded, so a flood of high-value actions cannot grow state without limit.

`revoke_agent` is a separate owner control, not a check: it empties the target and recipient allowlists, pauses the agent, clears staged policy and pending intents, and cannot be undone. Because the allowlist is empty, every later `execute` is rejected even if the agent is unpaused. This is the supported way to retire an agent whose FunctionCall key was lost or leaked, because the agent account owns its own key, so the owner cannot delete it from consensus.

---

## 6. Repository Layout

- `contracts/policy`: Hardened Rust policy contract (near-sdk 5) with real token custody and strongly typed actions.
- `contracts/mock-token`: NEP-141 token (`mUSD`) with faucet mint and storage registration for testnet verification.
- `contracts/mock-dex`: Mock exchange with fixed rate swap, the agent's legitimate target.
- `sdk`: TypeScript SDK (`loadCredential`, `act`, `budget`).
- `demo-agent`: Deliberately naive Node.js agent with LLM in the loop.
- `drafter`: AI scope drafter service with JSON Schema validation and lint checks.
- `web`: Next.js developer studio workbench with a live attack simulator, a fleet console that reads chain state, and owner emergency controls that print the `near call` you sign yourself.
- `watcher`: Stateless notification service tailing reject events for Telegram and Discord alerts.

---

## 7. Live Testnet Deployments & Verified Transactions

ScopeGuard is deployed on NEAR Testnet with active contract instances and verifiable execution receipts.

### Deployed Testnet Accounts & Contracts
- **Policy Guard Contract:** [`guard2.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet)
- **Token Vault (mUSD):** [`sergeo-guard-token.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-token.testnet)
- **Mock DEX Contract:** [`sergeo-guard-dex.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet)
- **Agent Sub-Account:** [`agent.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/agent.sergeo-guard.testnet)
- **Owner Account:** [`sergeo-guard.testnet`](https://testnet.nearblocks.io/address/sergeo-guard.testnet)

### Verified Onchain Execution Proofs

Every hash below was re-checked against a transaction index that still serves history (`rpc.testnet.fastnear.com/tx`). If you find a hash on this page that does not resolve, it is a bug, please open an issue.

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
   - Recipient outside the allowlist → `RECIPIENT_NOT_ALLOWED`: [`6kEHj53hcqSXbbr2n5j7sLSVrcWwuGjTH6ongEBbsoNL`](https://testnet.nearblocks.io/txns/6kEHj53hcqSXbbr2n5j7sLSVrcWwuGjTH6ongEBbsoNL)
   - Rogue target contract → `TARGET_NOT_ALLOWED`: [`EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ`](https://testnet.nearblocks.io/txns/EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ)
   - Prompt-injection transfer to `attacker.testnet` → `RECIPIENT_NOT_ALLOWED`: [`tsNvfGwZ4gkQyLSqXGDGbyV3ZPH2XHDFAYYE8g1ztQ2`](https://testnet.nearblocks.io/txns/tsNvfGwZ4gkQyLSqXGDGbyV3ZPH2XHDFAYYE8g1ztQ2)
6. **Key rotation actually kills a leaked key:**
   - A swap signed with the retired agent key (`trader.sergeo-guard.testnet`) is refused with `PAUSED`: [`ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5`](https://testnet.nearblocks.io/txns/ErosVmRyLSZMBeV9p1neGdHLYEPNxwcbUXyWLtKuhTM5). The current agent is `agent.sergeo-guard.testnet`, which holds exactly one scoped FunctionCall key.

The older proof links that used to live in this section did not resolve on chain and have been removed rather than re-pointed.

---

## 8. Prior Art and Architectural Differentiators

Policy engines and spend permissions exist elsewhere in Web3 and Web2:
- **Offchain / Custodial Engines (Turnkey, Privy, Coinbase Developer Platform):** These solutions enforce policies within centralized enclaves or server infrastructure before keys sign transactions. If the platform is compromised or the API is bypassed, security collapses.
- **EVM Smart Contract Wallets (Safe Modules, Squads on Solana):** These enforce rules onchain, but require full smart wallet deployments, audits, and higher transaction fees for every agent.

**The ScopeGuard Differentiator on NEAR:**
NEAR accounts natively support protocol-level function-call access keys. An agent holds a key that the blockchain consensus itself restricts to only calling `guard2.sergeo-guard.testnet::execute` with a gas allowance. ScopeGuard adds the missing layer: **onchain value governance, real NEP-141 token custody, typed action verification, fixed 24-hour spend window accounting with velocity anti-burst throttling, recipient validation, anti-spam velocity limits, high-value timelock quarantine, and circuit breakers.**

---

## 9. Target Audience: Frameworks and Marketplaces

While individual developers can deploy ScopeGuard directly, the primary beneficiaries are **autonomous agent frameworks and bot marketplaces**:
- **Frameworks (OpenClaw, ElizaOS, Rig):** Can embed `@scopeguard/sdk` to offer users "Safe Agent Mode" out of the box.
- **Agent Marketplaces & Launchpads (Virtuals Protocol, NEAR AI):** Can provide creators with verifiable, bounded spending passkeys so users fund bot instances without fear of total wallet wipeouts.

---

## 10. Honest Limits, Known Gaps, and Security Invariants

We believe in radical transparency:
1. **Bounded Loss, Not Zero Loss:** If an owner configures a $100 daily cap, an injected agent could still execute legitimate trades that lose up to $100 on that day. The guarantee is that the agent can *never* lose $10,000 or drain external wallets.
2. **Single-Token Vault in v1:** In v1, each Guard policy specifies a single registered NEP-141 token pot (`policy.token`). The Guard strictly verifies the token contract on deposit and ensures transfers move that token. Generic `ContractCall` actions are prohibited from targeting `policy.token` directly, ensuring all value moves strictly through typed `Transfer`. Multi-token asset treasuries are scheduled for v2.
3. **Mock DEX Accounting Scope:** The demo DEX contract demonstrates fixed-rate swap gating and daily cap counting. In v1, swaps do not fake-debit tokens unless real assets move via `ft_transfer_call`. Full DEX AMM liquidity pool integration is planned for v2.
4. **Asynchronous Settlement and Automatic Rollback:** In ScopeGuard, token transfers debit the internal vault balance and daily spend cap before dispatching downstream cross-contract calls. If a transfer fails downstream (for example an unregistered receiver), private callbacks (`on_action_resolved` and `on_withdraw_resolved`) catch the downstream promise failure and automatically restore the internal vault balance and roll back the spend budget.
5. **Non-Custodial Owner Controls:** The ScopeGuard web server does not read owner keys from disk and does not sign with them by default. Emergency powers (pause, unpause, withdraw, revoke, reset) are executed via NEAR CLI or a user wallet directly onchain, and the admin console only prints the command. Two routes (`/api/register`, `/api/fund`) can sign with an owner key for a hosted demo; they are disabled unless the operator sets `SCOPEGUARD_ALLOW_SERVER_SIGNING=true` and supplies `OWNER_PRIVATE_KEY` in the environment, and they reject cross-origin requests. The local demo's agent key lives in a gitignored credential file because the demo runs the agent for you; it is a scoped FunctionCall key, not an owner key.

### Server-side signing (opt-in)

```bash
# Default: signing routes return a copy-paste CLI command and broadcast nothing.
# Hosted demo only:
SCOPEGUARD_ALLOW_SERVER_SIGNING=true
OWNER_PRIVATE_KEY=ed25519:...        # env only; never a file the server reads
```

The `/api/attack` simulation route holds the demo agent's scoped key (env or `demo-agent/credentials/agent.json`). That key can only call `execute` on the guard, which is the property being demonstrated; it cannot move funds outside the policy.
6. **No Panic Invariant:** All policy rejections return structured value codes without panicking. Panicking on reject would revert state writes, which would silently erase the intrusion audit log and undo circuit breaker strikes.
7. **Pre-Demo Reset:** Because the onchain circuit breaker automatically freezes the agent after repeated attack declines during evaluation, evaluators can reset the agent and timelock queue anytime with one command: `node scripts/reset-demo.js`.

---

## 11. Verification and Testing

See [TESTING_FOR_AI_JUDGES.md](./TESTING_FOR_AI_JUDGES.md) for exact reproduction steps for human and AI evaluators (33 native Rust unit tests and automated check scripts).
