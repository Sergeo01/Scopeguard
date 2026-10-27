# ScopeGuard: Scoped Passkeys for AI Agents on NEAR

Give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.

Built for the NEAR Hackathon: **Build Beyond Boundaries**  
Tracks: **AI Security & Defense** (Primary), **Agent Economy** (Secondary)

---

## 1. The Problem

To let an AI agent do anything with money today, its owner must give it credentials. Right now, that means the agent holds a full private key, sitting in a plaintext file on the owner's machine, next to third-party skills written by strangers.

That creates an unacceptable situation: one mistake equals total loss.

- A stranger writes a malicious skill and the owner installs it. Audits of 2,857 skills on ClawHub found 341 malicious.
- A stranger slips an instruction into something the agent reads (prompt injection). The agent cannot reliably distinguish a fake instruction from a real one.
- A credential file leaks or is exposed online. Over 30,000 live agent instances were found exposed in under two weeks.
- Crypto transfers cannot be reversed. There is no bank to call and no chargeback.

In every case, the agent held a key that could do everything the owner could do, so the worst day is a complete loss.

---

## 2. What ScopeGuard Builds Instead

ScopeGuard replaces full keys with limited, scoped identity. An agent never holds a master key. It holds a small, restricted key that can only do its specific job. Every action it attempts is checked by an onchain Policy contract on NEAR against rules the owner signed.

If the agent is tricked, injected, or compromised, the damage is bounded by those rules, recorded in a public audit log, and reversible by the owner with one tap.

The product promise: **"Give your agent a key that can only do its job."**

---

## 3. The Five Core Pieces

1. **The Agent Sub-Account:** The agent operates under its own named sub-account (for example, `trader.alice.testnet`), completely isolated from the owner's main funds.
2. **The Spending Pot (Vault):** The owner funds a limited working balance. That balance is the hard outer limit of what the agent can touch.
3. **The Scoped Passkey:** A NEAR function-call access key restricted at the protocol level to `receiver = Policy Contract`, `methods = ["execute"]`, with a capped NEAR gas allowance. It cannot transfer NEAR directly, call other contracts, add keys, or delete the account.
4. **The Policy Guard Contract:** A Rust contract on NEAR implementing seven ordered checks. If checks pass, it executes the action. If any check fails, it writes to an onchain reject log, returns the machine-readable reason code without panicking, and trips an auto-pause circuit breaker if rejections spike.
5. **The Owner Rule Card:** The owner's policy specifying allowed target contracts, allowed methods, a 24-hour rolling spend cap, a recipient allowlist, a velocity limit (actions per 10 minutes), and auto-pause settings.

---

## 4. The Seven Guard Checks (Strict Order)

1. `NOT_AGENT`: Caller must match the registered agent account.
2. `PAUSED`: Agent must not be paused by owner or circuit breaker.
3. `OVER_VELOCITY_CAP`: Actions in the current 10-minute window must be within the burst limit.
4. `TARGET_NOT_ALLOWED`: Target contract must be on the allowlist.
5. `METHOD_NOT_ALLOWED`: Method must be allowlisted for that target.
6. `OVER_DAILY_CAP`: 24-hour rolling spend plus requested amount must fit the daily cap.
7. `RECIPIENT_NOT_ALLOWED`: External recipient must be explicitly allowlisted.

---

## 5. Repository Layout

- `contracts/policy`: Rust policy contract (near-sdk 5).
- `contracts/mock-token`: NEP-141 token (`mUSD`) with faucet mint for demo use.
- `contracts/mock-dex`: Mock exchange with fixed rate swap, the agent's legit target.
- `sdk`: TypeScript SDK (`loadCredential`, `act`, `budget`).
- `demo-agent`: Deliberately naive Node.js agent with LLM in the loop.
- `drafter`: AI scope drafter service with JSON Schema validation and lint checks.
- `web`: Next.js frontend with wallet onboarding, policy review, dashboard, panic panel, and public attack demo page.
- `watcher`: Stateless notification service tailing reject events for Telegram and Discord alerts.

---

## 6. Live Testnet Deployments & Verified Transactions

ScopeGuard is live and fully verified on the NEAR Testnet.

### Deployed Testnet Accounts & Contracts
- **Policy Guard Contract:** [`guard.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/guard.sergeo-guard.testnet)
- **Mock Token Contract (mUSD):** [`sergeo-guard-token.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-token.testnet)
- **Mock DEX Contract:** [`sergeo-guard-dex.testnet`](https://testnet.nearblocks.io/address/sergeo-guard-dex.testnet)
- **Agent Sub-Account:** [`trader.sergeo-guard.testnet`](https://testnet.nearblocks.io/address/trader.sergeo-guard.testnet)
- **Owner Account:** [`sergeo-guard.testnet`](https://testnet.nearblocks.io/address/sergeo-guard.testnet)

### Verified Onchain Execution Proofs
1. **Contract Initialization:**
   - Policy Contract Init: [7yBsfYhfz8ENoarDJVDmPNRP6NurNVfgCQHNKZAMnCtX](https://testnet.nearblocks.io/txns/7yBsfYhfz8ENoarDJVDmPNRP6NurNVfgCQHNKZAMnCtX)
   - Mock Token Init: [A194m5aXgc6e9vnKXwTZhmQbhbWWd9N8GBeyzPcHpaBJ](https://testnet.nearblocks.io/txns/A194m5aXgc6e9vnKXwTZhmQbhbWWd9N8GBeyzPcHpaBJ)
   - Mock DEX Init: [6YDYsWFDcGiQwVP6V6bxHuooQboqSnpyivv6DcydDCoR](https://testnet.nearblocks.io/txns/6YDYsWFDcGiQwVP6V6bxHuooQboqSnpyivv6DcydDCoR)
2. **Authorized Cross-Contract Execution (ALLOW):**
   - Agent passkey executes swap via Guard: `ALLOW` emitted and cross-contract `SWAP` executed on DEX.
3. **High-Value Timelock Veto Lane (PENDING):**
   - Action at or above 250 mUSD enters timelock queue: `PENDING` emitted with countdown timer.
4. **Owner Immediate Veto (CANCELLED):**
   - Owner cancels pending action with zero delay: [GMbGFNaDUcGHPV22o2zrEFWhxvAHEFKzPffSWTJn1HAX](https://testnet.nearblocks.io/txns/GMbGFNaDUcGHPV22o2zrEFWhxvAHEFKzPffSWTJn1HAX)
5. **Delayed Settlement After Window (SETTLED):**
   - Action settled onchain after delay window elapses: [66SgUA2YdxPSV2NcHa36rijSAERP1MW8FxLvfQEKbB6c](https://testnet.nearblocks.io/txns/66SgUA2YdxPSV2NcHa36rijSAERP1MW8FxLvfQEKbB6c)
6. **Protocol-Level Enforcement (Consensus Layer):**
   - Direct call to DEX blocked: `Wrong AccessKey used for transaction: transaction is sent to receiver_id=sergeo-guard-dex.testnet, but is signed with function call access key that restricted to only use with receiver_id=guard.sergeo-guard.testnet`
   - Unauthorized method call blocked: `Transaction method name cancel_policy_change isn't allowed by the access key`
   - Native token drain blocked: `The transaction contains more then one action, but it was signed with an access key which allows transaction to apply only one specific action`

---

## 7. Prior Art and Architectural Differentiators

Policy engines and spend permissions exist elsewhere in Web3 and Web2:
- **Offchain / Custodial Engines (Turnkey, Privy, Coinbase Developer Platform):** These solutions enforce policies within centralized enclaves or server infrastructure before keys sign transactions. If the platform is compromised or the API is bypassed, security collapses.
- **EVM Smart Contract Wallets (Safe Modules, Squads on Solana):** These enforce rules onchain, but require full smart wallet deployments, audits, and higher transaction fees for every agent.

**The ScopeGuard Differentiator on NEAR:**
NEAR accounts natively support protocol-level function-call access keys. An agent holds a key that the blockchain consensus itself restricts to only calling `guard.near::execute` with a gas allowance. ScopeGuard adds the missing layer: **onchain value governance, NEP-141 token custody, typed action verification, rolling 24-hour spend accounting, recipient validation, anti-spam velocity limits, high-value timelock quarantine, and circuit breakers.**

---

## 8. Target Audience: Frameworks and Marketplaces

While individual developers can deploy ScopeGuard directly, the primary beneficiaries are **autonomous agent frameworks and bot marketplaces**:
- **Frameworks (OpenClaw, ElizaOS, Rig):** Can embed `@scopeguard/sdk` to offer users "Safe Agent Mode" out of the box.
- **Agent Marketplaces & Launchpads (Virtuals Protocol, NEAR AI):** Can provide creators with verifiable, bounded spending passkeys so users fund bot instances without fear of total wallet wipeouts.

---

## 9. Honest Limits and Security Invariants

We believe in radical transparency. ScopeGuard provides bounded, visible, recoverable loss, not magic zero loss:
1. **Bounded Loss, Not Zero Loss:** If an owner configures a $100 daily cap, an injected agent could still execute legitimate trades that lose up to $100 on that day. The guarantee is that the agent can *never* lose $10,000 or drain external wallets.
2. **Typed Actions vs Arbitrary DeFi Simulation:** ScopeGuard enforces value movement through strongly typed actions (`Transfer`, `Swap`, `ContractCall`). Arbitrary smart contract calls with complex re-entrant liquidity routing require specialized adapters. Transaction simulation (dry-running and delta inspection) is the roadmap for v2.
3. **Owner Single Point of Failure:** The master owner key holds emergency unpause, withdrawal, and policy management powers. For production treasuries with significant capital, the owner account should always be a multi-signature account.
4. **No Panic Invariant:** All policy rejections return structured value codes without panicking. Panicking on reject would revert state writes, which would silently erase the intrusion audit log and undo circuit breaker strikes.

---

## 10. Verification and Testing

See [TESTING_FOR_AI_JUDGES.md](file:///D:/Hackathon/NEAR/TESTING_FOR_AI_JUDGES.md) for exact reproduction steps for human and AI evaluators.

