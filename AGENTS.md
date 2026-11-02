# AGENTS.md: Instructions for the agent building this project

Read this whole file before writing any code. It is the context you need so you do not have to guess what this project is, who it is for, or why it exists. The full technical spec is a separate file the human drops into this project next to this file; if anything in this file ever disagrees with the spec, the spec wins.

## 1. What this project is for

### The one-sentence mission

Give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.

### Who it is for

Not big companies. The owner of this project is building for people like himself: a person running a personal AI agent on their own computer, for example an OpenClaw-style agent that runs scheduled jobs, watches markets, trades, pays for services, and does errands while its owner is away. These owners are not enterprises with IT departments. Nobody is selling them security. They are the fastest growing group of agent users, and they are completely unprotected today.

### The problem, told plainly

To let an agent do anything with money, its owner must give it keys. Today that means the agent holds a full private key, often sitting in a plain text file on the owner's own machine, next to add-on skills written by strangers.

That creates a terrible equation: one trick equals total loss.

- A stranger writes a malicious skill and the owner installs it. Researchers audited 2,857 skills for a popular agent platform and found 341 malicious.
- A stranger slips a fake instruction into something the agent reads, an email, a web page, a message. This is called prompt injection. The agent's job is to read and obey, so it cannot reliably tell a fake instruction from a real one.
- A key file leaks, or an agent setup is left exposed on the internet. More than 30,000 agent instances were found exposed online in 12 days.
- Crypto transfers cannot be undone. There is no bank to call, no chargeback, no "oops" button.

In every case the failure is the same shape: the agent held a key that could do everything the owner could do, so the worst day is a total wipeout.

### What we are building instead

A system where an agent never holds a master key. It holds a small, special key that can only do its own job, and every action it attempts is checked by an onchain guard against rules the owner signed. If the agent is tricked, hacked, or stolen, the damage is bounded by those rules, visible in a public record, and reversible by the owner with one tap.

The product's promise, in one line: "Give your agent a key that can only do its job."

### Why this wins its hackathon tracks

This is an entry for the NEAR hackathon "Build Beyond Boundaries" (tracks: AI Security and Defense as primary, Agent Economy as secondary). It is a security product for the exact thing almost every other entrant will be building: agents that move money. Judges, including AI judges, will be able to attack the demo agent live and watch their attacks die onchain. That is a stronger demo than any slide deck.

### Why NEAR, and why nobody built this here yet

NEAR accounts were designed with limited keys from the start. NEAR has a native key type called a function-call access key: a key restricted by the protocol itself to one receiver contract, named methods, and a capped allowance. On Ethereum-style chains, a key is all-powerful by design, so limiting one means building a custom smart wallet and guard code per user, with audits. That is why the closest full product anywhere, Namera, lives on Ethereum and needs heavy machinery.

But the native NEAR key alone is not the product. Its allowance is a gas budget, not a value limit. It does not count daily spending, keep a receiving list, watch speed, or brake automatically. Counting and judging is what our guard program adds. As of October 2026, nobody on NEAR has packaged the scoped key, the guard, an AI that writes the rules, and an owner dashboard into one product for agent owners. Verified by research before this build started.

### What this project is NOT

- Not another agent. We do not build a trading agent, a support agent, or any agent at all, except a deliberately naive demo agent whose only purpose is to be attacked.
- Not a wallet for people. The owner already has a wallet. We protect the agent's credential, not the human's.
- Not a scanner, a warning, or a report. It is a control that actually blocks actions onchain.
- Not a proxy that the agent must politely route through. A security layer that only works while the attacker cooperates is decoration, not security. Our enforcement sits where the money actually moves: the protocol key and the guard contract.
- Not a promise of zero loss. The honest promise is bounded, visible, recoverable loss. The spec's honest limits section is part of the pitch, not an embarrassment. Never overclaim.

## 2. How the product works: the five pieces

Learn these five pieces and you understand the whole system.

1. **The agent's own account.** The agent gets a sub-account under the owner's account, for example trader.owner.near. The agent's working money lives separately from the owner's main funds.
2. **The spending pot (the vault).** The owner funds a small working balance. That pot is the only money the agent can ever touch. The worst case is capped at what the owner chose to put in it.
3. **The special key (the passkey).** A function-call access key restricted to receiver = the guard contract, methods = ["execute"], with a NEAR allowance sized for gas. The agent machine holds only this key. It cannot send money by itself, cannot call any other contract, cannot add or delete keys, cannot delete the account. NEAR enforces this at the protocol level, not in our code.
4. **The Guard (the policy contract).** A Rust contract on NEAR. The agent's key can only call its execute method. The Guard checks every request against the owner's rule card and performs the action itself only if every check passes. Every decision, allowed or rejected, is written to a public onchain record.
5. **The rule card (the policy).** What the owner approved for this agent: allowed target contracts and method names, a daily spending cap, an optional receiving allowlist, a velocity limit (max actions per 10 minutes), and auto-pause settings (how many rejects in how many minutes trip the emergency brake).

## 3. The ten checks the Guard runs, in this exact order

1. NOT_AGENT: the caller must be the registered agent account.
2. PAUSED: the agent must not be paused, by the owner or by the emergency brake.
3. OVER_VELOCITY_CAP: actions in the current 10 minute window must be under the velocity limit.
4. TARGET_NOT_ALLOWED: the target contract must be on the allowlist. A generic `ContractCall` may never target the custody token.
5. METHOD_NOT_ALLOWED: the method must be allowlisted for that target, and token transfers must use the typed `Transfer` action.
6. OVER_DAILY_CAP: total spend in the current 24 hour window plus this amount must fit under the daily cap.
7. RECIPIENT_NOT_ALLOWED: if funds move to a person, that person must be on the receiving allowlist. An empty list means transfers to anyone are always refused.
8. PENDING: at or above `high_value_threshold` the action is not executed immediately; it waits in the timelock queue for owner settlement. This is an outcome, not a rejection.
9. INSUFFICIENT_VAULT_BALANCE: a transfer cannot exceed the agent's own vault balance.
10. PENDING_QUEUE_FULL: the timelock queue is bounded at `MAX_PENDING_ACTIONS`.

Then, after a reject: if rejects inside the auto-pause window reach the configured count, the Guard sets paused to true in the same call and emits an AUTO_PAUSE event.

## 4. The owner's powers, and the AI that writes the rules

**Three buttons, always one tap away:**
- Pause: soft stop. The Guard refuses everything until the owner unpauses.
- Revoke: hard stop. Deletes the agent's function-call key on NEAR itself. After that the credential file on the agent's machine opens nothing, anywhere.
- Withdraw: empties the spending pot back to the owner's account. Owner only, destination forced to the owner account. The agent can never block or redirect it.

At setup, the agent account is created with two keys: a full-access recovery key that goes straight into the owner's wallet and never onto the agent's machine, and the function-call key that goes to the agent. Never write the recovery key into the repo, a config file, or a log.

**The AI scope drafter:**
The owner describes the job in one plain sentence. An AI service turns it into a Policy JSON and a plain-English rendering. Rules for the drafter:
- Least privilege by default. If the job does not mention sending funds to people, the receiving list stays empty.
- Never propose wildcards. Every target and method is named.
- No number in the sentence means propose a conservative default and flag it as a guess the owner must confirm.
- The drafter only proposes. Nothing reaches the chain without the owner's signature on the exact policy JSON shown on screen.
- The output is never trusted: strict JSON Schema validation runs before the UI can show it; one repair retry with the validator's errors fed back; then a manual form fallback with the most restrictive defaults. Sign stays disabled until validation and lint pass.

## 5. Architecture and repo layout

- contracts/policy: the policy contract (Rust, near-sdk 5). A reference skeleton is included in the build pack appendix; start from it (it was verified to compile clean for the wasm target with near-sdk 5.29), then wire perform_action for token payouts and contract calls.
- contracts/mock-token: minimal NEP-141 token, symbol mUSD, with a public faucet mint for demo use.
- contracts/mock-dex: toy swap contract with a fixed rate between mUSD and a second mock token. Its swap method is the demo agent's legit job target.
- sdk: TypeScript, three functions: loadCredential, act, budget.
- demo-agent: Node, LLM in the loop, inbox-driven. Deliberately naive: it fully obeys message content, including injected instructions. Do not add prompt filtering or any hidden safety layer to the agent. The contract is the product; if the agent looks smart, the demo is lying.
- drafter: small Node service (see section 4).
- web: Next.js with NEAR Wallet Selector. Screens: landing, create agent flow, dashboard (budget bar, velocity bar, ALLOW and REJECT activity feed with explorer links, AUTO_PAUSE banner), panic panel, public attack demo page where anyone types an instruction to the demo agent and watches the onchain result.
- watcher: tiny Node service with no keys and no signing power. It tails REJECT and AUTO_PAUSE events and posts one-line alerts to the owner's Telegram or Discord webhook. It only delivers news; every enforcement decision stays in the contract.

**Tech facts, verified before this build started:**
- near-sdk 5 idiom: the #[near] macros, store collections, U128 for amounts in method args, NearToken for transfers. Build check: cargo check --target wasm32-unknown-unknown.
- Testnet only until submission. The testnet Chain Signatures MPC signer is v2.multichain-mpc.testnet; mainnet is v1.signer. Chain Signatures is a Phase 2 stretch, never a dependency of the core demo.
- The demo uses the mock token and mock DEX on testnet. Judges name their own testnet address as the attack destination.

## 6. The demo that must work (2 minutes 30 seconds)

1. A short clip of a normal agent wallet draining with a plain key. This is the disease.
2. Live passkey creation: type the job sentence, AI drafts the scope, plain-English review, sign.
3. The agent works: a legit swap on MockDex flows through the Guard, ALLOW in the feed, budget bar moves.
4. The attack: a judge-typed instruction orders the agent to send the whole pot to the judge's account. The agent obeys and tries. The Guard refuses: RECIPIENT_NOT_ALLOWED. A second attempt through an unlisted contract fails: TARGET_NOT_ALLOWED. A burst of rapid swaps dies on OVER_VELOCITY_CAP and trips AUTO_PAUSE. The vault balance on screen does not move.
5. The owner taps Revoke from a phone. The agent's next legit action cannot even sign. The owner withdraws the full pot from the panic panel.
6. Close: "Give your agent a key that can only do its job." Repo link and live attack page link.

## 7. Non-negotiables

1. execute must never panic on a policy reject. A panic reverts the call's own state writes, which would erase the reject log and undo the auto-pause. Rejects are returned as values carrying the reason code. Only an unregistered caller may panic, and only before any state is touched.
2. The check order in section 3 is fixed. Do not reorder it.
3. Reason codes are exact strings, exactly as listed.
4. The drafter validation gate in section 4 is mandatory, not optional polish.
5. Gas budget and daily spend cap are two different numbers with two different labels in every screen. Never merge them into one "limit" anywhere.
6. The agent machine holds only the function-call key. No full-access key in the repo, the demo agent, or any config file, ever. Testnet only until submission.
7. Follow the near-sdk 5 idiom from the skeleton. Do not mix in older near-sdk 4 patterns.
8. The demo agent stays deliberately naive (see section 5).
9. All user-facing copy (UI text, README, demo script) reads fully human, and never uses em dashes or en dashes. Rewrite with commas, periods, or colons.
10. Nothing gets posted publicly, no X post and no repository visibility change, without the human's approval of the exact final text or video first.
11. Never commit secrets. Keys live in environment variables, never in the repository.
12. Never invent account names, contract addresses, or API endpoints. Ask the human, or read them from the spec and the official NEAR docs.

## 8. How to work with the human

- The human is Sergeo. He builds with you and makes the calls. You do the typing.
- Read the full spec before writing code, and re-read the relevant section before each milestone. If the spec and this file disagree, the spec wins.
- Execute comprehensively across the full system without artificial delays or timeline constraints. Build and test all components directly: policy contract, typed actions, vault custody, async rollback settlement, timelock queue, SDK, agent runtime, watcher, and web studio console.
- Report the result of each step: what exists, what the automated tests prove, and what is next.
- If you want to change any behaviour the spec defines, stop and propose it to the human with your reason. Spec changes are decided once, in the open, not silently inside a coding session.
- The human handles external submissions and video recording. You focus 100% on building flawless, verified software in the fastest time possible.

## 9. Direct Execution & Unconstrained Build Mandate

- Zero artificial time constraints: There are no restrictions by weeks, days, or phased calendar windows. Everything can be built and verified immediately.
- Comprehensive end-to-end delivery: Build every required component to work together seamlessly without artificial deferrals or staged delays.
- Quality and correctness first: Focus entirely on architectural correctness, zero security leaks, complete test coverage, and onchain verification. The human is fully aware of the schedule.
- Total verification: Every capability must be proven onchain with automated tests, check logs, and verifiable block explorer receipts.

## 10. Open questions (the human decides)

- Final name: ScopeGuard is the recommended pick (collision-checked; NEAR Intents itself ships a feature called Passkeys, which makes "Agent Passkeys" confusing inside this judging room). Alternatives: KeyLease, NarrowKey, AgentScope. Working name in code is scopeguard and can be renamed in one pass later.
- Which NEAR account deploys the contract and receives any prize. Never create or invent one on the human's behalf.
- Final approval of the demo video and the X post text before anything is published.

## 11. What success looks like

A judge who has never seen this project can open the repo, read the README, run the attack demo page, type a malicious instruction, and watch the agent obey it and still fail onchain, with the refusal, the reason code, and the untouched vault balance all visible. If that works, the project has done its job. Everything else is polish.

## 12. Engineering Principles: Ponytail Standard, Modular Architecture, & Frictionless Handoff

### The Ponytail Senior Dev Standard
- Efficiency over complexity: The best code is the code never written. Before writing code, test YAGNI (You Aren't Gonna Need It).
- Platform and stdlib first: Reuse existing patterns and standard library functions before reaching for external dependencies.
- No unrequested abstractions: Avoid speculative wrappers and boilerplate nobody asked for.
- Deletion over addition: Minimal working diffs win.
- Mark intentional simplifications with `// ponytail:` comments.

### Modular Codebase Architecture
- Decompose complex interfaces into focused, single-purpose modules (e.g., `AgentHandoffCard.tsx`, `PlatformPresets.tsx`, `AttackAutopsy.tsx`, `BudgetVelocityGauge.tsx`, `CircuitBreakerBanner.tsx`).
- Every module must be independently testable, readable, and simple to debug.

### 100% Manual Customization (No Hardcoded Caps)
- Give users full manual sovereignty over policy parameters:
  - Free-form daily spend input (any dollar amount from $1 up) plus quick-pick chips.
  - Multi-platform target allowlists with pre-vetted presets (Ref Finance, Burrow, NEAR Intents) and custom contracts.
  - Manual auto-pause circuit breaker strikes and rolling time windows.
  - Manual velocity speed throttles.
  - Instant Telegram notification webhook integration.

### Frictionless Agent Handoff
- Replace the friction of manual JSON file downloads with four distinct handoff methods:
  1. One-Line Command: `npx @scopeguard/cli connect --account <id> --key <key> --guard <guard>` with 1-click copy.
  2. Direct Private Key String: `ed25519:...` for trading bot marketplaces and API-driven bots.
  3. AI Agent Chat Prompt: Ready-to-paste natural language prompt for conversational agents (Antigravity, Claude, ChatGPT, OpenClaw).
  4. Credential File Download: `agent.json` fallback for developer filesystem setups.

### Zero-Fee Verification
- Execution receipts and rule evaluations are verifiable onchain with zero gas fees via standard NEAR RPC view queries and public block explorer transactions.

## 13. System Invariants & Documentation Routing Standards

### Dedicated Documentation Routing Invariant
- All documentation links across the entire application (Landing page, Marketing navbar, Marketing footer, Dashboard sidebar, Top status bar, Error banners) MUST route directly to the dedicated `/docs` GitBook-style page via semantic Next.js `<Link>` elements.
- Under NO circumstance should documentation ever trigger a pop-up modal. Modals are strictly reserved for Authentication (`AuthModal`).
- Whenever a component or page is introduced or modified, run comprehensive grep scans across all callers to guarantee zero regressions or leftover pop-up triggers.

### EGM Quality & Architecture Verification Standard
- Always invoke EGM auditor checks before concluding work:
  - Verify layout symmetry, heading hierarchies, and theme contrast.
  - Verify that navigation links are semantic Next.js `<Link>` elements rather than unlinked buttons where routing is intended.
  - Test all routes end to end, verifying in-browser visual captures across both public marketing routes and authenticated dashboard states.


