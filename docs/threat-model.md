# ScopeGuard Threat Model & Honest Limits

This document details the threat landscape, trust boundaries, defensive guarantees, and honest operational limits of the ScopeGuard security architecture.

---

## 1. Threat Landscape

ScopeGuard is designed to protect autonomous AI agents operating with financial authority on NEAR Protocol against five primary classes of attacks:

### Threat 1: Master Key Exfiltration & Local Host Compromise
- **Vector:** An agent machine is hacked, an insecure third-party skill reads the local filesystem, or credential environment variables are leaked.
- **Defense:** The agent holds exclusively a scoped NEAR function-call access key. Under NEAR consensus rules, this key can only call `execute` on the Guard contract with a capped gas allowance. It cannot execute native transfers directly, deploy contracts, or manage access keys. The owner retains the full-access recovery key in an isolated wallet.

### Threat 2: Adversarial Prompt Injection & Tool Hijacking
- **Vector:** Untrusted content (emails, web pages, Discord messages) instructs the LLM to ignore prior constraints and transfer treasury funds to an attacker account.
- **Defense:** The Guard sits at the transaction settlement layer on NEAR. Even if an LLM is completely compromised and attempts an unauthorized transfer, the contract evaluates recipient allowlists, target contract allowlists, and daily spend caps onchain. The transaction is rejected without moving funds.

### Threat 3: Rapid Balance Draining & Boundary Double-Spend
- **Vector:** An attacker submits rapid transaction bursts to drain working capital before an owner can intervene, or times transactions right before and after window boundaries.
- **Defense:**
  1. **Sliding Velocity Limit:** Restricts actions within any 10-minute window.
  2. **Rolling 24-Hour Windows:** Uses discrete 1-hour buckets with a 24-hour lookback (24-25 hour effective window) to prevent boundary doubling.
  3. **Auto-Pause Circuit Breakers:** Successive rejections automatically freeze the agent onchain.

### Threat 4: Calldata Evasion via Generic Contract Calls
- **Vector:** An attacker crafts a generic contract invocation to execute token transfer methods (`ft_transfer`, `nft_transfer`, `withdraw`, `storage_withdraw`) or attaches large native NEAR deposits to allowlisted targets.
- **Defense:**
  1. Generic `ContractCall` actions are prohibited from calling methods on the value-moving denylist.
  2. `ContractCall` actions cannot target the custody token contract.
  3. Attached native NEAR deposits are debited from the agent's NEAR vault balance and count against the native daily cap and timelock threshold.

### Threat 5: Large Treasury Drains via Single Actions
- **Vector:** An attacker crafts an allowed action format but with an unusually high amount.
- **Defense:** Actions exceeding `high_value_threshold` are quarantined in a timelock queue for a mandatory delay (e.g. 24 hours), enabling owner review, cancellation, and veto before settlement.

---

## 2. Trust Boundaries

| Entity | Trust Level | Capabilities |
| :--- | :--- | :--- |
| **Owner** | Full Trust | Can pause, unpause, withdraw vault balances, revoke agents, reset windows, and settle quarantined actions. |
| **Guard Contract** | Consensus Enforced | Enforces all policy checks on NEAR Protocol without panicking on rejection. |
| **Agent Runtime** | Untrusted / Adversarial | Can only submit actions through the scoped function-call key. Cannot alter rules or budgets. |
| **Watcher Daemon** | Read-Only | Tails blockchain events and posts webhook alerts. Holds no private keys and cannot sign transactions. |
| **AI Scope Drafter** | Advisory Only | Proposes initial policy configurations. Prohibits wildcards and requires explicit owner cryptographic signature. |

---

## 3. Honest Security Limits

Transparency regarding boundaries is a core engineering principle:

1. **Loss Bound:**
   Financial exposure is strictly bounded by `min(vault balance, rolling 24h cap)` per asset. An attacker cannot drain external balances or exceed the configured cap. However, valid allowed actions within the daily budget could still be triggered if the agent is manipulated.

2. **Single Owner Key:**
   Owner administration relies on the owner's NEAR account key. Multi-signature governance (e.g. SputnikDAO) can be configured upstream for enterprise settings.

3. **Value-Neutral ContractCall Assumption:**
   Because generic `ContractCall` carries no token accounting, allowlisted methods must be value-neutral contract operations (e.g. oracle updates, state updates).

4. **Testnet Operation & Mock Contracts:**
   The current deployment operates on NEAR Testnet using a mock token (mUSD), a mock DEX, and a mock intent deposit contract. Real mainnet deployments will target canonical production tokens and live intent solvers.
