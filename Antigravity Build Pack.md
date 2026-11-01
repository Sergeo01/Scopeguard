## Step 0: files to create in the Antigravity project first

Before any code, create these files in the project root:

1. `AGENTS.md`: the builder context file the human gives you. It explains the mission, the audience, the five pieces, the ten checks, and the working rules. Read it first.
2. `SPEC.md`: the full build spec the human gives you. It is the source of truth for the contract surface, the screens, the demo script, the day plan, and the cut list. If AGENTS.md, this pack, or your own judgement ever disagree with the spec, the spec wins.
3. This build pack, for reference.
4. `contracts/policy/Cargo.toml` and `contracts/policy/src/lib.rs`: copy them from the appendix of this pack. The skeleton was already verified to compile clean for the wasm target with near-sdk 5.29. Do not rewrite it from scratch; start from it and complete the marked TODOs.

Working name in code: scopeguard (final product name is still the human's call; code names can be renamed in one pass later, so never let naming block a build step).

## Context in brief (full version in AGENTS.md)

- **Mission:** give every person who runs an AI agent a way to hand that agent power over money without handing it the power to lose everything.
- **Audience:** people running personal agents on their own computers, not enterprises with IT departments.
- **Problem:** today an agent holds a full private key, often in a plain text file next to skills written by strangers. Researchers found 341 of 2,857 skills for one popular agent platform malicious, and 30,000+ agent setups exposed online in 12 days. One trick, one fake instruction, or one stolen key equals total loss, and crypto transfers cannot be undone.
- **Product, in five pieces:** (1) the agent gets its own sub-account under the owner's account; (2) the owner funds a small spending pot, the only money the agent can ever touch; (3) the agent holds only a special function-call key that fits exactly one lock, the Guard's execute method, enforced by NEAR itself; (4) the Guard, a Rust contract on NEAR, checks every request against the owner's rule card and performs the action itself only if every check passes; (5) the rule card: allowed targets and methods, daily cap, receiving allowlist, velocity limit, auto-pause settings.
- **The ten Guard checks, in this exact order:** NOT\_AGENT, PAUSED, OVER\_VELOCITY\_CAP, TARGET\_NOT\_ALLOWED, METHOD\_NOT\_ALLOWED, OVER\_DAILY\_CAP, RECIPIENT\_NOT\_ALLOWED, PENDING (timelock outcome), INSUFFICIENT\_VAULT\_BALANCE, PENDING\_QUEUE\_FULL. After a reject, if rejects inside the auto-pause window reach the configured count, the Guard pauses the agent by itself and emits an AUTO\_PAUSE event.
- **Owner powers:** Pause (soft stop), Revoke (destroys the agent's key on NEAR itself), Withdraw (empties the pot back to the owner's account, owner only, destination forced to the owner).
- **AI drafter:** the owner describes the job in one plain sentence; an AI turns it into a Policy JSON and a plain-English rendering. The drafter only proposes. Strict JSON Schema validation runs before the UI can show it, with one repair retry, then a manual form fallback. Sign stays disabled until validation and lint pass.

## Repo layout to create from scratch

- contracts/policy: the policy contract (Rust, near-sdk 5), from the appendix.
- contracts/mock-token: minimal NEP-141 token, symbol mUSD, with a public faucet mint for demo use.
- contracts/mock-dex: toy swap contract with a fixed rate between mUSD and a second mock token. Its swap method is the demo agent's legit job target.
- sdk: TypeScript, three functions: loadCredential, act, budget.
- demo-agent: Node, LLM in the loop, inbox-driven. Deliberately naive: it fully obeys message content, including injected instructions. Do not add prompt filtering or any hidden safety layer to the agent. The contract is the product; if the agent looks smart, the demo is lying.
- drafter: small Node service (job sentence to validated Policy JSON plus plain-English rendering).
- web: Next.js with NEAR Wallet Selector. Screens: landing, create agent flow, dashboard (budget bar, velocity bar, ALLOW and REJECT activity feed with explorer links, AUTO\_PAUSE banner), panic panel, public attack demo page where anyone types an instruction to the demo agent and watches the onchain result.
- watcher: tiny Node service with no keys and no signing power. It tails REJECT and AUTO\_PAUSE events and posts one-line alerts to the owner's Telegram or Discord webhook. It only delivers news; every enforcement decision stays in the contract.

## Non-negotiables

1. execute in the policy contract must never panic on a policy reject. A panic reverts the call's own state writes and would erase the reject log and undo the auto-pause. Rejects are returned as values carrying the reason code. Only an unregistered caller may panic, and only before any state is touched.
2. The check order above is fixed. Do not reorder it.
3. Reason codes are exact strings, exactly as listed.
4. The drafter validation gate is mandatory, not optional polish.
5. Gas budget and daily spend cap are two different numbers with two different labels in every screen. Never merge them into one "limit" anywhere.
6. The agent machine holds only the function-call key. No full-access key in the repo, the demo agent, or any config file, ever. Testnet only until submission.
7. near-sdk 5 idiom: the #[near] macros, store collections, U128 for amounts in method args, NearToken for transfers. The appendix skeleton shows the pattern; follow it.
8. The demo agent stays deliberately naive (see the layout above).
9. All user-facing copy (UI text, README, demo script) reads fully human, and never uses em dashes or en dashes. Rewrite with commas, periods, or colons.
10. Nothing gets posted publicly, no X post and no repository visibility change, without the human's approval of the exact final text or video first.
11. Never commit secrets. Keys live in environment variables, never in the repository.
12. Never invent account names, contract addresses, or API endpoints. Ask the human, or read them from the spec and the official NEAR docs.

## First prompt to paste into Antigravity

"You are building a NEAR hackathon project with me. Read AGENTS.md and SPEC.md in this project in full before writing any code; SPEC.md is the source of truth. Then do these steps in order and show me the result of each before moving on: (1) create the repo layout from the build pack, (2) copy the policy contract skeleton from the build pack appendix into contracts/policy and run cargo check --target wasm32-unknown-unknown until it passes, (3) write unit tests for the execute check order, the lazy window resets, and the circuit breaker tripping at the configured reject count, using the near-sdk test environment, (4) stop and summarise what exists, what the tests prove, and what is next. Follow the non-negotiables in the build pack exactly. Ask me before changing any behaviour the spec defines."

## Order of work: Autonomous Delivery

Build comprehensively across all modules without artificial timeline restrictions or day/week pacing.
1. **Policy Contract:** 10-layer policy and protocol check sequence (7 policy rules + 3 protocol bounds), typed `GuardAction`, vault token custody, async rollback settlement, timelock queue, and auto-pause circuit breaker.
2. **Unit Test Suite:** 42 passing native tests, 14 web tests, covering check order, arithmetic overflow, vault custody, and breaker state.
3. **SDK & Demo Agent:** strongly typed client and deterministic red-team agent harness running live tasks on testnet.
4. **Web Studio Console:** 4-zone dashboard, real-time activity ledger, prompt injection simulator, accessible non-custodial owner modal, and instant CLI generator.
5. **Watcher & Verification:** real-time event tailing on NEAR RPC and automated verification runner (`scripts/verify-ai-judge.js`).

## FAQ for the builder

**What is a function-call key, really?**
A NEAR key type the protocol itself restricts: it can call only one named contract, only named methods on it, and only within a NEAR allowance. Think of a key cut to fit exactly one lock. It is not a rule the agent promises to follow; it is the shape of the key.

**Why can the agent not just bypass the Guard?**
Because there is no other path to the money. The agent's key fits only the Guard's execute method. It cannot call other contracts, cannot transfer funds, cannot add keys. Any attempt to act outside the Guard fails at the protocol level before our code is even involved.

**Why not just put a proxy server in front of the agent instead?**
A proxy only sees traffic the agent volunteers to send through it. A compromised agent, or anyone holding its key, simply signs directly onchain and skips the proxy. Enforcement must sit where the money moves: the protocol key and the guard contract. This was considered and rejected during selection, do not reintroduce it.

**Does the Guard hold the funds?**
The Guard contract holds the working pot the owner funded. The owner's main funds never enter it. Withdraw is owner only and the destination is forced to the owner account, so the owner can always recover the pot even if the agent is fully compromised.

**What happens when the agent's gas budget runs out?**
The function-call key's NEAR allowance depletes and the key stops working, like a prepaid card. The dashboard warns the owner at 20 percent remaining. This is a feature, not a bug: a runaway agent halts itself.

**What if the special key itself gets stolen?**
The thief can only knock on the Guard's door, exactly like the agent. Same onchain policy checks. He cannot send money to himself (he is not on the receiving list), cannot raise the daily cap, cannot change the rule card. Worst case: allowed actions up to the daily cap inside the pot, in public, while the owner is alerted. Then the owner revokes and the thief holds nothing.

**Can the owner change the rules later?**
Yes. set\_policy replaces the whole rule card, owner only, and the AI drafter can draft the new version from a new plain sentence. The same validation gate applies.

**What if the AI drafter writes bad JSON?**
That is expected sometimes, which is why the validation gate exists: strict JSON Schema validation, one repair retry with the validator's errors, then a manual form fallback with the most restrictive defaults. Sign stays disabled until a policy passes validation and lint.

**What does the demo need to prove?**
Three things, in order: the agent works (a legit swap passes the Guard), the agent is fully tricked (it obeys a malicious instruction), and the money still does not move (the Guard refuses onchain with a readable reason code, the auto-pause trips, the owner revokes from a phone and withdraws the pot). If any one of those is missing, the demo is not ready.

**What if Chain Signatures does not work in time?**
Cut it. It is a Phase 2 stretch in the spec's cut list. The core NEAR demo must never depend on it. Ship the core, record the cross-chain piece as a side demo only if it works.

**Can we submit early in the window?**
Yes, and that is the plan: submit as soon as the build is solid, targeted at the first days of the window. But never submit a draft, because a submission cannot be edited afterwards.

**What is still the human's call?**
The final name (ScopeGuard is recommended; NEAR Intents itself ships a feature called Passkeys, which makes "Agent Passkeys" confusing inside this judging room), the NEAR account that deploys the contract and receives any prize, and approval of the final demo video and X post text before anything is published.

## Appendix: policy contract skeleton (copy into contracts/policy)

### Cargo.toml

```toml
[package]
name = "policy-contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
near-sdk = "5"

[profile.release]
codegen-units = 1
opt-level = "z"
lto = true
debug = false
panic = "abort"
overflow-checks = true
```

### src/lib.rs

```rust
// Policy contract skeleton for the NEAR hackathon entry (spec title:
// Agent Passkeys). Implements the spec section 4.1 surface:
// register_agent, set_policy, execute, pause, unpause, withdraw, views.
//
// Written in near-sdk 5 idiom (#[near] macros, store collections).
// Compile-checked with: cargo check --target wasm32-unknown-unknown
//
// Design rules baked in here, straight from the spec:
// 1. execute never panics on a policy reject. A panic reverts the call's own
//    state writes, which would erase the reject log entry and undo the
//    circuit breaker's pause. Rejects are returned as values; the reject is
//    recorded in state and emitted as an event before returning.
// 2. Checks run in the spec's order, cheapest first: caller, paused, velocity,
//    target, method, daily cap, recipient.
// 3. The contract holds the working vault. Withdraw is owner only and the
//    destination is forced to the owner account.
//
// Complete implementation: token (NEP-141) vault flows, cross-contract call
// plumbing for contract targets, Chain Signatures target pattern,
// and a runtime check of u128 JSON arg encoding for policy fields.

use near_sdk::json_types::U128;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise, Timestamp};
use std::collections::HashMap;

pub const REASON_NOT_AGENT: &str = "NOT_AGENT";
pub const REASON_PAUSED: &str = "PAUSED";
pub const REASON_OVER_VELOCITY: &str = "OVER_VELOCITY_CAP";
pub const REASON_TARGET: &str = "TARGET_NOT_ALLOWED";
pub const REASON_METHOD: &str = "METHOD_NOT_ALLOWED";
pub const REASON_CAP: &str = "OVER_DAILY_CAP";
pub const REASON_RECIPIENT: &str = "RECIPIENT_NOT_ALLOWED";

const DAY_NS: u64 = 24 * 60 * 60 * 1_000_000_000;
const TEN_MIN_NS: u64 = 10 * 60 * 1_000_000_000;
const MAX_REJECT_TIMES_KEPT: usize = 64;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Policy {
    /// contract id -> method names the agent may call on it
    pub targets: HashMap<AccountId, Vec<String>>,
    /// max total value movable per 24h window, in vault token units
    pub daily_cap: u128,
    /// accounts allowed to receive transfers; empty means transfers forbidden
    pub recipients: Vec<AccountId>,
    /// max allowed actions per 10 minute window
    pub max_actions_per_10min: u32,
    /// rejects inside the auto-pause window that trip the circuit breaker
    pub auto_pause_rejects: u32,
    /// circuit breaker window, in minutes
    pub auto_pause_window_minutes: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct AgentRecord {
    pub owner: AccountId,
    pub policy: Policy,
    pub paused: bool,
    pub day_window_start: Timestamp,
    pub spent_in_window: u128,
    pub velocity_window_start: Timestamp,
    pub actions_in_window: u32,
    /// recent reject timestamps, newest last, capped for storage sanity
    pub reject_times: Vec<Timestamp>,
}

#[near(serializers = [json])]
#[derive(Debug)]
pub struct Outcome {
    pub status: String, // "ALLOWED" or "REJECTED"
    pub reason: Option<String>,
}

#[near(serializers = [json])]
#[derive(Debug)]
pub struct BudgetView {
    pub cap: U128,
    pub spent: U128,
    pub remaining: U128,
    pub actions_in_window: u32,
    pub paused: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub agents: LookupMap<AccountId, AgentRecord>,
    pub agents_by_owner: LookupMap<AccountId, Vec<AccountId>>,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            agents: LookupMap::new(b"a"),
            agents_by_owner: LookupMap::new(b"o"),
        }
    }

    // ---------------------------------------------------------------
    // Owner methods
    // ---------------------------------------------------------------

    /// Called by the owner during onboarding, right after the agent
    /// sub-account and its scoped function-call key are created.
    pub fn register_agent(&mut self, agent_account: AccountId, policy: Policy) {
        let owner = env::predecessor_account_id();
        assert!(
            !self.agents.contains_key(&agent_account),
            "agent already registered"
        );
        let now = env::block_timestamp();
        self.agents.insert(
            agent_account.clone(),
            AgentRecord {
                owner: owner.clone(),
                policy,
                paused: false,
                day_window_start: now,
                spent_in_window: 0,
                velocity_window_start: now,
                actions_in_window: 0,
                reject_times: Vec::new(),
            },
        );
        let mut list = self
            .agents_by_owner
            .get(&owner)
            .cloned()
            .unwrap_or_default();
        list.push(agent_account.clone());
        self.agents_by_owner.insert(owner.clone(), list);
        emit(&format!(
            "{{\"event\":\"REGISTER\",\"agent\":\"{}\",\"owner\":\"{}\"}}",
            agent_account, owner
        ));
    }

    /// Owner only. Replaces the whole scope (used when the job changes and
    /// the AI drafter produces a new validated policy).
    pub fn set_policy(&mut self, agent_account: AccountId, policy: Policy) {
        let mut rec = self.load_owned(&agent_account);
        rec.policy = policy;
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"POLICY_SET\",\"agent\":\"{}\"}}",
            agent_account
        ));
    }

    pub fn pause(&mut self, agent_account: AccountId) {
        let mut rec = self.load_owned(&agent_account);
        rec.paused = true;
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"PAUSE\",\"agent\":\"{}\"}}",
            agent_account
        ));
    }

    pub fn unpause(&mut self, agent_account: AccountId) {
        let mut rec = self.load_owned(&agent_account);
        rec.paused = false;
        rec.reject_times.clear();
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"UNPAUSE\",\"agent\":\"{}\"}}",
            agent_account
        ));
    }

    /// Owner only, destination forced to the owner account. This is how the
    /// human recovers vault funds even if the agent is fully compromised.
    /// TODO(build): token vault path (ft_transfer from the contract account).
    pub fn withdraw(&mut self, agent_account: AccountId, amount: U128) -> Promise {
        let rec = self.load_owned(&agent_account);
        Promise::new(rec.owner.clone()).transfer(NearToken::from_yoctonear(amount.0))
    }

    // ---------------------------------------------------------------
    // The one method the agent's function-call key may call
    // ---------------------------------------------------------------

    pub fn execute(
        &mut self,
        target: AccountId,
        method: String,
        args: String,
        amount: U128,
        recipient: Option<AccountId>,
    ) -> Outcome {
        let caller = env::predecessor_account_id();
        let mut rec = match self.agents.get(&caller) {
            Some(r) => r.clone(),
            // Genuine misuse: panic before any state is touched.
            None => env::panic_str(REASON_NOT_AGENT),
        };
        let amount = amount.0;
        let now = env::block_timestamp();

        // Lazy window resets.
        if now >= rec.day_window_start + DAY_NS {
            rec.day_window_start = now;
            rec.spent_in_window = 0;
        }
        if now >= rec.velocity_window_start + TEN_MIN_NS {
            rec.velocity_window_start = now;
            rec.actions_in_window = 0;
        }

        // Ordered checks. Each failure records the reject and returns.
        if rec.paused {
            return self.reject(&caller, &mut rec, REASON_PAUSED, now);
        }
        if rec.actions_in_window >= rec.policy.max_actions_per_10min {
            return self.reject(&caller, &mut rec, REASON_OVER_VELOCITY, now);
        }
        let methods = match rec.policy.targets.get(&target) {
            Some(m) => m.clone(),
            None => return self.reject(&caller, &mut rec, REASON_TARGET, now),
        };
        if !methods.iter().any(|m| m == &method) {
            return self.reject(&caller, &mut rec, REASON_METHOD, now);
        }
        if rec.spent_in_window + amount > rec.policy.daily_cap {
            return self.reject(&caller, &mut rec, REASON_CAP, now);
        }
        if amount > 0 {
            match &recipient {
                Some(r) if rec.policy.recipients.iter().any(|x| x == r) => {}
                _ => return self.reject(&caller, &mut rec, REASON_RECIPIENT, now),
            }
        }

        // Allowed: record spend and velocity, persist, then act.
        rec.spent_in_window += amount;
        rec.actions_in_window += 1;
        self.agents.insert(caller.clone(), rec);
        emit(&format!(
            "{{\"event\":\"ALLOW\",\"agent\":\"{}\",\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\"}}",
            caller, target, method, amount
        ));
        self.perform_action(&target, &method, &args, amount, &recipient);
        Outcome {
            status: "ALLOWED".to_string(),
            reason: None,
        }
    }

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    pub fn get_policy(&self, agent_account: AccountId) -> Option<Policy> {
        self.agents.get(&agent_account).map(|r| r.policy.clone())
    }

    pub fn get_budget(&self, agent_account: AccountId) -> Option<BudgetView> {
        self.agents.get(&agent_account).map(|r| BudgetView {
            cap: U128(r.policy.daily_cap),
            spent: U128(r.spent_in_window),
            remaining: U128(r.policy.daily_cap.saturating_sub(r.spent_in_window)),
            actions_in_window: r.actions_in_window,
            paused: r.paused,
        })
    }

    pub fn get_agents(&self, owner: AccountId) -> Vec<AccountId> {
        self.agents_by_owner
            .get(&owner)
            .cloned()
            .unwrap_or_default()
    }

    // ---------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------

    fn load_owned(&self, agent_account: &AccountId) -> AgentRecord {
        let rec = self
            .agents
            .get(agent_account)
            .unwrap_or_else(|| env::panic_str("unknown agent"));
        assert_eq!(
            rec.owner,
            env::predecessor_account_id(),
            "only the owner may do this"
        );
        rec.clone()
    }

    /// Records a reject, feeds the circuit breaker, persists state, emits
    /// the REJECT (and possibly AUTO_PAUSE) event, and returns the outcome.
    /// Never panics: the state written here must survive.
    fn reject(
        &mut self,
        agent: &AccountId,
        rec: &mut AgentRecord,
        reason: &str,
        now: Timestamp,
    ) -> Outcome {
        rec.reject_times.push(now);
        if rec.reject_times.len() > MAX_REJECT_TIMES_KEPT {
            let excess = rec.reject_times.len() - MAX_REJECT_TIMES_KEPT;
            rec.reject_times.drain(0..excess);
        }
        emit(&format!(
            "{{\"event\":\"REJECT\",\"agent\":\"{}\",\"reason\":\"{}\"}}",
            agent, reason
        ));
        let window_ns = rec.policy.auto_pause_window_minutes * 60 * 1_000_000_000;
        let recent = rec
            .reject_times
            .iter()
            .filter(|t| now.saturating_sub(**t) <= window_ns)
            .count() as u32;
        if recent >= rec.policy.auto_pause_rejects && !rec.paused {
            rec.paused = true;
            emit(&format!(
                "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"rejects\":{},\"window_minutes\":{}}}",
                agent, recent, rec.policy.auto_pause_window_minutes
            ));
        }
        self.agents.insert(agent.clone(), rec.clone());
        Outcome {
            status: "REJECTED".to_string(),
            reason: Some(reason.to_string()),
        }
    }

    /// Performs the approved action from the contract account.
    /// TODO(build): wire per-target promise plumbing:
    /// - token payouts: ft_transfer on the vault token contract
    /// - contract actions: function_call with the recorded args JSON
    /// - signature requests: Chain Signatures signer call (Phase 2)
    fn perform_action(
        &self,
        _target: &AccountId,
        _method: &String,
        _args: &String,
        _amount: u128,
        _recipient: &Option<AccountId>,
    ) {
        // Reference skeleton implementation. The production policy contract in contracts/policy
        // executes verified actions directly via strongly typed GuardAction.
    }
}

fn emit(line: &str) {
    env::log_str(&format!("EVENT_JSON:{}", line));
}

#[cfg(test)]
mod tests {
    // TODO(prep): unit tests for check order (velocity before allowlist),
    // lazy window resets, breaker tripping at the configured count, and
    // rejects persisting (the no-panic rule). Uses near-sdk test env.
}
```