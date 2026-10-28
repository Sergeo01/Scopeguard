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

## 3. The Five Core Pieces

1. **The Agent Sub-Account:** The agent operates under its own named sub-account (for example, `trader.alice.testnet`), completely isolated from the owner's main funds.
2. **The Spending Pot (Vault):** The owner funds a limited working balance in the Guard contract. That balance is the hard outer limit of what the agent can touch.
3. **The Scoped Passkey:** A NEAR function-call access key restricted at the protocol level to `receiver = Policy Contract`, `methods = ["execute"]`, with a capped NEAR gas allowance. It cannot transfer NEAR directly, call other contracts, add keys, or delete the account.
4. **The Policy Guard Contract:** A Rust contract on NEAR implementing seven ordered checks. If checks pass, it executes the action. If any check fails, it writes to an onchain reject log, returns the machine-readable reason code without panicking, and trips an auto-pause circuit breaker if rejections spike.
5. **The Owner Rule Card:** The owner's policy specifying allowed target contracts, allowed methods, a fixed 24-hour spend cap window (protected by a 10-minute velocity throttle against boundary bursts), a recipient allowlist, a velocity limit (actions per 10 minutes), and auto-pause settings.

---

## 4. The Seven Guard Checks (Strict Order)

1. `NOT_AGENT`: Caller must match the registered agent account.
2. `PAUSED`: Agent must not be paused by owner or circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target, and token calls must use typed `GuardAction::Transfer`.
6. `OVER_DAILY_CAP`: spend in the current 24-hour budget window plus requested amount must fit the daily cap.
7. `RECIPIENT_NOT_ALLOWED`: External recipient must be explicitly allowlisted.

---

## 5. Repository Layout

- `contracts/policy`: Hardened Rust policy contract (near-sdk 5) with real token custody and strongly typed actions.
- `contracts/mock-token`: NEP-141 token (`mUSD`) with faucet mint and storage registration for testnet verification.
- `contracts/mock-dex`: Mock exchange with fixed rate swap, the agent's legitimate target.
- `sdk`: TypeScript SDK (`loadCredential`, `act`, `budget`).
- `demo-agent`: Deliberately naive Node.js agent with LLM in the loop.
- `drafter`: AI scope drafter service with JSON Schema validation and lint checks.
- `web`: Next.js developer studio workbench with live attack simulator, agent treasury console, and interactive owner emergency controls.
- `watcher`: Stateless notification service tailing reject events for Telegram and Discord alerts.

---

## 6. Live Testnet Deployments & Verified Transactions

ScopeGuard is live and fully verified on the NEAR Testnet.

### Deployed Testnet Accounts & Contracts
- **Policy Guard Contract:** [`guard2.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/guard2.sergeo-guard.testnet)
- **Token Vault (mUSD):** [`sergeo-guard-token.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-token.testnet)
- **Mock DEX Contract:** [`sergeo-guard-dex.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet)
- **Agent Sub-Account:** [`trader.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/trader.sergeo-guard.testnet)
- **Owner Account:** [`sergeo-guard.testnet`](https://testnet.nearblocks.io/address/sergeo-guard.testnet)

### Verified Onchain Execution Proofs
1. **Contract Deployment:**
   - Policy Contract: [Bu3g5C3S3xvhH7H1XktVrdD37ZPMuZ1xYUEo8ukE8fiG](https://testnet.nearblocks.io/txns/Bu3g5C3S3xvhH7H1XktVrdD37ZPMuZ1xYUEo8ukE8fiG)
   - Contract Init (`new`): [Fo5FSTsnjieAx6CDKYyKeV1rZDwfCXMBHY42HvtGTZZF](https://testnet.nearblocks.io/txns/Fo5FSTsnjieAx6CDKYyKeV1rZDwfCXMBHY42HvtGTZZF)
2. **Agent Registration:**
   - Bound to sub-account: [9j7E9oAkntMHcRvUyvekkosoAqkcjY4j3xJdTYknMDuL](https://testnet.nearblocks.io/txns/9j7E9oAkntMHcRvUyvekkosoAqkcjY4j3xJdTYknMDuL)
3. **Scoped Passkey Added:**
   - Function-call key restricted to Guard.execute: [57geTR5EE9ksrHG8xH1MeaFtUHmWQZUZSa9RQw45tsKc](https://testnet.nearblocks.io/txns/57geTR5EE9ksrHG8xH1MeaFtUHmWQZUZSa9RQw45tsKc)
4. **Clean Passkey Cryptographic Isolation (0 FullAccess Keys):**
   - FullAccess key deleted from agent sub-account: [5tKBMR7b7GEFpt1Mh8LkCceygmDBfbvRxAbaAKgHJ8Lv](https://testnet.nearblocks.io/txns/5tKBMR7b7GEFpt1Mh8LkCceygmDBfbvRxAbaAKgHJ8Lv)
   - Stale old key deleted: [6UnuFDAzghb9JCb2igbtFVhDC2cNQiRS7z5eUkyGWKPh](https://testnet.nearblocks.io/txns/6UnuFDAzghb9JCb2igbtFVhDC2cNQiRS7z5eUkyGWKPh)
   - Duplicate key deleted: [DULYWiS4Eb98tob7b6doJowXiftj5TVNt9iMXg3RVHCK](https://testnet.nearblocks.io/txns/DULYWiS4Eb98tob7b6doJowXiftj5TVNt9iMXg3RVHCK)
5. **Real NEP-141 Vault Deposit (100 mUSD):**
   - Transferred via `ft_transfer_call`: [58QZh1CgMFBT3tCC5gR5sSKthC3SBYpn6o23j7c9U8Ha](https://testnet.nearblocks.io/txns/58QZh1CgMFBT3tCC5gR5sSKthC3SBYpn6o23j7c9U8Ha)
6. **Passkey Onchain Rejection (`TARGET_NOT_ALLOWED`):**
   - Unauthorized contract call refused onchain without panic: [7W8BXSfQCboJi29WfBu1DYofKyXfkcehS82VbT6kPkSv](https://testnet.nearblocks.io/txns/7W8BXSfQCboJi29WfBu1DYofKyXfkcehS82VbT6kPkSv)
7. **Owner Veto Cancellation (CANCELLED):**
   - Owner veto of pending intent #3: [A2aDb1YxXzWHfVxtzoRr2Pz1wcfKSAAjgxmbPKJNeSjj](https://testnet.nearblocks.io/txns/A2aDb1YxXzWHfVxtzoRr2Pz1wcfKSAAjgxmbPKJNeSjj)
   - Owner veto of pending intent #2: [AnSZkgJCsvwi7sTbxrN43QQWyPHFyX2s7UGSYDXWi9yp](https://testnet.nearblocks.io/txns/AnSZkgJCsvwi7sTbxrN43QQWyPHFyX2s7UGSYDXWi9yp)
   - Owner veto of pending intent #1: [2bhmibshKH7cEQHc6WZwW1JWXaXRnGKBmwDyKnD4FEq8](https://testnet.nearblocks.io/txns/2bhmibshKH7cEQHc6WZwW1JWXaXRnGKBmwDyKnD4FEq8)
8. **Owner Unpause on Guard2:**
   - Active state restored by owner: [7a3G4tqvsKQTUUuVyUuRbPjVZhbr41VM5Mo9eFNpVygt](https://testnet.nearblocks.io/txns/7a3G4tqvsKQTUUuVyUuRbPjVZhbr41VM5Mo9eFNpVygt)

---

## 7. Prior Art and Architectural Differentiators

Policy engines and spend permissions exist elsewhere in Web3 and Web2:
- **Offchain / Custodial Engines (Turnkey, Privy, Coinbase Developer Platform):** These solutions enforce policies within centralized enclaves or server infrastructure before keys sign transactions. If the platform is compromised or the API is bypassed, security collapses.
- **EVM Smart Contract Wallets (Safe Modules, Squads on Solana):** These enforce rules onchain, but require full smart wallet deployments, audits, and higher transaction fees for every agent.

**The ScopeGuard Differentiator on NEAR:**
NEAR accounts natively support protocol-level function-call access keys. An agent holds a key that the blockchain consensus itself restricts to only calling `guard2.sergeo-guard.testnet::execute` with a gas allowance. ScopeGuard adds the missing layer: **onchain value governance, real NEP-141 token custody, typed action verification, fixed 24-hour spend window accounting with velocity anti-burst throttling, recipient validation, anti-spam velocity limits, high-value timelock quarantine, and circuit breakers.**

---

## 8. Target Audience: Frameworks and Marketplaces

While individual developers can deploy ScopeGuard directly, the primary beneficiaries are **autonomous agent frameworks and bot marketplaces**:
- **Frameworks (OpenClaw, ElizaOS, Rig):** Can embed `@scopeguard/sdk` to offer users "Safe Agent Mode" out of the box.
- **Agent Marketplaces & Launchpads (Virtuals Protocol, NEAR AI):** Can provide creators with verifiable, bounded spending passkeys so users fund bot instances without fear of total wallet wipeouts.

---

## 9. Honest Limits, Known Gaps, and Security Invariants

We believe in radical transparency:
1. **Bounded Loss, Not Zero Loss:** If an owner configures a $100 daily cap, an injected agent could still execute legitimate trades that lose up to $100 on that day. The guarantee is that the agent can *never* lose $10,000 or drain external wallets.
2. **Single-Token Vault in v1:** In v1, each Guard policy specifies a single registered NEP-141 token pot (`policy.token`). The Guard strictly verifies the token contract on deposit and ensures transfers move that token. Generic `ContractCall` actions are prohibited from targeting `policy.token` directly, ensuring all value moves strictly through typed `Transfer`. Multi-token asset treasuries are scheduled for v2.
3. **Mock DEX Accounting Scope:** The demo DEX contract demonstrates fixed-rate swap gating and daily cap counting. In v1, swaps do not fake-debit tokens unless real assets move via `ft_transfer_call`. Full DEX AMM liquidity pool integration is planned for v2.
4. **Optimistic Settlement and Closed-Direction Invariant:** In v1, token transfers debit the internal vault balance and daily spend cap optimistically prior to cross-contract settlement. If a recipient contract refuses the transfer (for example an unregistered receiver), the spend cap remains debited. This fails closed in the direction that protects treasury funds against runaway drain, while full asynchronous rollback callbacks are slated for v2.
5. **Non-Custodial Owner Controls:** The ScopeGuard web server never custodies owner master private keys. Emergency powers (pause, unpause, withdraw, revoke) are executed via NEAR CLI or user wallets directly onchain.
6. **No Panic Invariant:** All policy rejections return structured value codes without panicking. Panicking on reject would revert state writes, which would silently erase the intrusion audit log and undo circuit breaker strikes.
7. **Pre-Demo Reset:** Because the onchain circuit breaker automatically freezes the agent after repeated attack declines during evaluation, evaluators can reset the agent and timelock queue anytime with one command: `node scripts/reset-demo.js`.

---

## 10. Verification and Testing

See [TESTING_FOR_AI_JUDGES.md](file:///D:/Hackathon/NEAR/TESTING_FOR_AI_JUDGES.md) for exact reproduction steps for human and AI evaluators (30 native Rust unit tests and automated check scripts).
