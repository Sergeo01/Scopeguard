// Policy contract for ScopeGuard on NEAR.
// Implements protocol-restricted agent passkey enforcement with seven ordered
// policy checks, automated circuit breaker, timelocked high-value actions,
// and real NEP-141 token vault custody with strongly typed actions.
//
// Written in near-sdk 5 idiom (#[near] macros, store collections).
// Compile-checked with: cargo check --target wasm32-unknown-unknown

use near_sdk::json_types::U128;
use near_sdk::serde_json;
use near_sdk::store::LookupMap;
use near_sdk::{
    env, near, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseOrValue, Timestamp,
};
use std::collections::HashMap;

pub const REASON_NOT_AGENT: &str = "NOT_AGENT";
pub const REASON_PAUSED: &str = "PAUSED";
pub const REASON_OVER_VELOCITY: &str = "OVER_VELOCITY_CAP";
pub const REASON_TARGET: &str = "TARGET_NOT_ALLOWED";
pub const REASON_METHOD: &str = "METHOD_NOT_ALLOWED";
pub const REASON_CAP: &str = "OVER_DAILY_CAP";
pub const REASON_RECIPIENT: &str = "RECIPIENT_NOT_ALLOWED";
pub const REASON_PENDING_QUEUE_FULL: &str = "PENDING_QUEUE_FULL";

const DAY_NS: u64 = 24 * 60 * 60 * 1_000_000_000;
const TEN_MIN_NS: u64 = 10 * 60 * 1_000_000_000;
const MAX_REJECT_TIMES_KEPT: usize = 64;
const MAX_PENDING_ACTIONS: usize = 8;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
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
    /// action amount at or above this threshold is queued in timelock instead of immediate execution
    pub high_value_threshold: u128,
    /// delay in seconds for high-value actions to sit in pending queue
    pub high_value_delay_seconds: u64,
    /// delay in seconds for owner set_policy change to become effective
    pub policy_change_delay_seconds: u64,
}

/// Strongly typed actions: the Guard constructs calldata from these variants,
/// preventing agents from asserting amount: 1 while transferring 10,000.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GuardAction {
    Transfer {
        token: AccountId,
        to: AccountId,
        amount: U128,
        memo: Option<String>,
    },
    Swap {
        dex: AccountId,
        token_in: AccountId,
        amount_in: U128,
        min_out: U128,
    },
    ContractCall {
        target: AccountId,
        method: String,
        args: String,
    },
}

impl GuardAction {
    pub fn decompose(&self) -> (AccountId, String, Vec<u8>, u128, Option<AccountId>) {
        match self {
            GuardAction::Transfer {
                token,
                to,
                amount,
                memo,
            } => {
                let call_args = serde_json::to_vec(&serde_json::json!({
                    "receiver_id": to,
                    "amount": amount,
                    "memo": memo
                }))
                .unwrap_or_default();
                (
                    token.clone(),
                    "ft_transfer".to_string(),
                    call_args,
                    amount.0,
                    Some(to.clone()),
                )
            }
            GuardAction::Swap {
                dex,
                token_in: _,
                amount_in,
                min_out,
            } => {
                let call_args = serde_json::to_vec(&serde_json::json!({
                    "amount": amount_in,
                    "min_out": min_out
                }))
                .unwrap_or_default();
                (dex.clone(), "swap".to_string(), call_args, amount_in.0, None)
            }
            GuardAction::ContractCall {
                target,
                method,
                args,
            } => (target.clone(), method.clone(), args.as_bytes().to_vec(), 0, None),
        }
    }
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingAction {
    pub id: u64,
    pub action: GuardAction,
    pub target: AccountId,
    pub method: String,
    pub args: String,
    pub amount: u128,
    pub recipient: Option<AccountId>,
    pub created_at: u64,
    pub executable_at: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StagedPolicy {
    pub policy: Policy,
    pub effective_at: u64,
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
    /// pending high-value actions waiting out delay, max 8 entries
    pub pending_actions: Vec<PendingAction>,
    /// staged policy waiting out policy_change_delay_seconds
    pub staged_policy: Option<StagedPolicy>,
    /// next monotonic id for pending actions
    pub next_pending_id: u64,
    /// real NEP-141 token vault balance custody by the Guard
    pub vault_balance: u128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Outcome {
    pub status: String, // "ALLOWED", "REJECTED", "PENDING", "SETTLED"
    pub reason: Option<String>,
    pub pending_id: Option<u64>,
}

#[near(serializers = [json])]
#[derive(Debug, PartialEq, Eq)]
pub struct BudgetView {
    pub cap: U128,
    pub spent: U128,
    pub remaining: U128,
    pub actions_in_window: u32,
    pub paused: bool,
    pub vault_balance: U128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// agent_account -> record
    pub agents: LookupMap<AccountId, AgentRecord>,
    /// owner_account -> list of agent_accounts
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
    // Registration & Policy Management
    // ---------------------------------------------------------------

    pub fn register_agent(&mut self, agent_account: AccountId, policy: Policy) {
        let owner = env::predecessor_account_id();
        assert!(
            !self.agents.contains_key(&agent_account),
            "agent already registered"
        );

        // Bind agent registration to owner: agent must be a sub-account of owner
        assert!(
            agent_account.as_str().ends_with(&format!(".{}", owner)) || agent_account == owner,
            "Agent account must be a sub-account of the owner"
        );

        // Strict policy validation: no wildcards, non-zero cap, threshold <= cap
        assert!(policy.daily_cap > 0, "daily_cap must be greater than zero");
        assert!(
            policy.high_value_threshold <= policy.daily_cap,
            "high_value_threshold cannot exceed daily_cap"
        );
        for (_target, methods) in &policy.targets {
            assert!(!methods.is_empty(), "methods list cannot be empty for target");
            for m in methods {
                assert_ne!(
                    m, "*",
                    "wildcard method '*' is forbidden: name every method explicitly"
                );
            }
        }

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
                pending_actions: Vec::new(),
                staged_policy: None,
                next_pending_id: 1,
                vault_balance: 0,
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

    /// Receives NEP-141 tokens deposited into the agent vault by the owner.
    /// msg specifies the agent_account ID.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let agent_account: AccountId = msg
            .parse()
            .unwrap_or_else(|_| env::panic_str("invalid agent account in msg"));
        let mut rec = match self.agents.get(&agent_account).cloned() {
            Some(r) => r,
            None => env::panic_str(REASON_NOT_AGENT),
        };
        assert_eq!(sender_id, rec.owner, "Only owner can deposit into agent vault");
        rec.vault_balance += amount.0;
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"DEPOSIT\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
            agent_account, amount.0
        ));
        PromiseOrValue::Value(U128(0)) // 0 means all tokens accepted
    }

    /// Owner only. Stages the new policy with effective_at = now + policy_change_delay_seconds.
    /// Does not apply immediately.
    pub fn set_policy(&mut self, agent_account: AccountId, policy: Policy) {
        let mut rec = self.load_owned(&agent_account);
        let now_sec = env::block_timestamp() / 1_000_000_000;
        let effective_at = now_sec + rec.policy.policy_change_delay_seconds;
        rec.staged_policy = Some(StagedPolicy {
            policy,
            effective_at,
        });
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"POLICY_STAGED\",\"agent\":\"{}\",\"effective_at\":{}}}",
            agent_account, effective_at
        ));
    }

    /// Owner only, immediate. Clears the staged policy.
    pub fn cancel_policy_change(&mut self, agent_account: AccountId) {
        let mut rec = self.load_owned(&agent_account);
        assert!(rec.staged_policy.is_some(), "no policy change staged");
        rec.staged_policy = None;
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"POLICY_CHANGE_CANCELLED\",\"agent\":\"{}\"}}",
            agent_account
        ));
    }

    // ---------------------------------------------------------------
    // Owner Emergency Powers
    // ---------------------------------------------------------------

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

    /// Owner only, immediate. Withdraws custodied NEP-141 tokens from vault back to owner.
    pub fn withdraw(&mut self, agent_account: AccountId, token: AccountId, amount: U128) -> Promise {
        let mut rec = self.load_owned(&agent_account);
        assert!(rec.vault_balance >= amount.0, "insufficient vault balance");
        rec.vault_balance -= amount.0;
        self.agents.insert(agent_account.clone(), rec.clone());
        emit(&format!(
            "{{\"event\":\"WITHDRAW\",\"agent\":\"{}\",\"token\":\"{}\",\"amount\":\"{}\"}}",
            agent_account, token, amount.0
        ));
        Promise::new(token).function_call(
            "ft_transfer".to_string(),
            serde_json::to_vec(&serde_json::json!({
                "receiver_id": rec.owner,
                "amount": amount,
                "memo": "ScopeGuard owner withdrawal"
            }))
            .unwrap(),
            NearToken::from_yoctonear(1), // 1 yoctoNEAR required by NEP-141
            Gas::from_tgas(20),
        )
    }

    /// Owner only, immediate. Removes the intent from pending queue.
    /// A queued action is not a reject and never feeds the circuit breaker.
    pub fn cancel_pending(&mut self, agent_account: AccountId, id: u64) {
        let mut rec = self.load_owned(&agent_account);
        let pos = match rec.pending_actions.iter().position(|a| a.id == id) {
            Some(p) => p,
            None => env::panic_str("pending action not found"),
        };
        rec.pending_actions.remove(pos);
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"CANCELLED\",\"agent\":\"{}\",\"id\":{}}}",
            agent_account, id
        ));
    }

    // ---------------------------------------------------------------
    // Execution & Settlement
    // ---------------------------------------------------------------

    /// Primary execution method: accepts either a strongly-typed `action`
    /// or legacy flat parameters (`target`, `method`, `args`, `amount`, `recipient`).
    /// All execution paths derive calldata through GuardAction so amount cannot be spoofed.
    pub fn execute(
        &mut self,
        action: Option<GuardAction>,
        target: Option<AccountId>,
        method: Option<String>,
        args: Option<String>,
        amount: Option<U128>,
        recipient: Option<AccountId>,
    ) -> Outcome {
        let (guard_action, tgt, meth, args_bytes, amt, recip) = if let Some(act) = action {
            let (t, m, ab, a, r) = act.decompose();
            (act, t, m, ab, a, r)
        } else {
            let target = target.expect("target or action required");
            let method = method.expect("method or action required");
            let amount_u128 = amount.unwrap_or(U128(0));
            let args_str = args.unwrap_or_else(|| "{}".to_string());
            let args_b = args_str.as_bytes().to_vec();
            let act = if method == "ft_transfer" && recipient.is_some() {
                GuardAction::Transfer {
                    token: target.clone(),
                    to: recipient.clone().unwrap(),
                    amount: amount_u128,
                    memo: None,
                }
            } else if method == "swap" {
                GuardAction::Swap {
                    dex: target.clone(),
                    token_in: "token.near".parse().unwrap(),
                    amount_in: amount_u128,
                    min_out: U128(0),
                }
            } else {
                GuardAction::ContractCall {
                    target: target.clone(),
                    method: method.clone(),
                    args: args_str,
                }
            };
            (act, target, method, args_b, amount_u128.0, recipient)
        };

        let args_str = String::from_utf8(args_bytes.clone()).unwrap_or_default();
        self.internal_execute(guard_action, tgt, meth, args_str, args_bytes, amt, recip)
    }

    /// Convenience wrapper for typed actions.
    pub fn execute_action(&mut self, action: GuardAction) -> Outcome {
        self.execute(Some(action), None, None, None, None, None)
    }

    /// Convenience wrapper for tests and raw string callers.
    pub fn execute_raw(
        &mut self,
        target: AccountId,
        method: String,
        args: String,
        amount: U128,
        recipient: Option<AccountId>,
    ) -> Outcome {
        self.execute(None, Some(target), Some(method), Some(args), Some(amount), recipient)
    }

    fn internal_execute(
        &mut self,
        action: GuardAction,
        target: AccountId,
        method: String,
        args_str: String,
        args_bytes: Vec<u8>,
        amount: u128,
        recipient: Option<AccountId>,
    ) -> Outcome {
        let caller = env::predecessor_account_id();
        let mut rec = match self.agents.get(&caller).cloned() {
            Some(r) => r,
            None => env::panic_str(REASON_NOT_AGENT),
        };
        let now = env::block_timestamp();
        let now_sec = now / 1_000_000_000;

        // Lazy apply staged policy if effective_at has arrived.
        Self::apply_staged_policy_if_due(&mut rec, now_sec, &caller);

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
        if let Some(r) = &recipient {
            if !rec.policy.recipients.iter().any(|x| x == r) {
                return self.reject(&caller, &mut rec, REASON_RECIPIENT, now);
            }
        }

        // Check if high-value action should be queued into timelock lane.
        if rec.policy.high_value_threshold > 0 && amount >= rec.policy.high_value_threshold {
            rec.actions_in_window += 1;
            if rec.pending_actions.len() >= MAX_PENDING_ACTIONS {
                return self.reject(&caller, &mut rec, REASON_PENDING_QUEUE_FULL, now);
            }
            let id = rec.next_pending_id;
            rec.next_pending_id += 1;
            let executable_at = now_sec + rec.policy.high_value_delay_seconds;
            rec.pending_actions.push(PendingAction {
                id,
                action,
                target: target.clone(),
                method: method.clone(),
                args: args_str,
                amount,
                recipient: recipient.clone(),
                created_at: now_sec,
                executable_at,
            });
            self.agents.insert(caller.clone(), rec);
            emit(&format!(
                "{{\"event\":\"PENDING\",\"agent\":\"{}\",\"id\":{},\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\",\"executable_at\":{}}}",
                caller, id, target, method, amount, executable_at
            ));
            Outcome {
                status: "PENDING".to_string(),
                reason: None,
                pending_id: Some(id),
            }
        } else {
            // Allowed immediately: record spend and velocity, persist, then act.
            rec.spent_in_window += amount;
            rec.actions_in_window += 1;
            rec.vault_balance = rec.vault_balance.saturating_sub(amount);
            self.agents.insert(caller.clone(), rec);
            emit(&format!(
                "{{\"event\":\"ALLOW\",\"agent\":\"{}\",\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\"}}",
                caller, target, method, amount
            ));
            self.perform_action(&target, &method, &args_bytes);
            Outcome {
                status: "ALLOWED".to_string(),
                reason: None,
                pending_id: None,
            }
        }
    }

    /// Settles a pending action after its delay window has passed.
    /// Security invariant: Settling is restricted strictly to the OWNER.
    /// The agent can never approve or settle its own queued high-value actions.
    pub fn settle_pending(&mut self, agent: AccountId, id: u64) -> Outcome {
        let mut rec = match self.agents.get(&agent).cloned() {
            Some(r) => r,
            None => env::panic_str(REASON_NOT_AGENT),
        };
        let caller = env::predecessor_account_id();
        assert_eq!(
            caller, rec.owner,
            "Only the owner can settle or approve timelocked actions"
        );

        let now = env::block_timestamp();
        let now_sec = now / 1_000_000_000;

        // Lazy apply staged policy if effective_at has arrived.
        Self::apply_staged_policy_if_due(&mut rec, now_sec, &agent);

        let action_index = match rec.pending_actions.iter().position(|a| a.id == id) {
            Some(idx) => idx,
            None => env::panic_str("pending action not found"),
        };

        let pending_action = &rec.pending_actions[action_index];
        assert!(now_sec >= pending_action.executable_at, "action not executable yet");

        let pending_action = rec.pending_actions.remove(action_index);

        // Lazy window resets.
        if now >= rec.day_window_start + DAY_NS {
            rec.day_window_start = now;
            rec.spent_in_window = 0;
        }
        if now >= rec.velocity_window_start + TEN_MIN_NS {
            rec.velocity_window_start = now;
            rec.actions_in_window = 0;
        }

        // Re-run all seven checks against current policy and windows.
        if rec.paused {
            return self.reject(&agent, &mut rec, REASON_PAUSED, now);
        }
        if rec.actions_in_window >= rec.policy.max_actions_per_10min {
            return self.reject(&agent, &mut rec, REASON_OVER_VELOCITY, now);
        }
        let methods = match rec.policy.targets.get(&pending_action.target) {
            Some(m) => m.clone(),
            None => return self.reject(&agent, &mut rec, REASON_TARGET, now),
        };
        if !methods.iter().any(|m| m == &pending_action.method) {
            return self.reject(&agent, &mut rec, REASON_METHOD, now);
        }
        if rec.spent_in_window + pending_action.amount > rec.policy.daily_cap {
            return self.reject(&agent, &mut rec, REASON_CAP, now);
        }
        if let Some(r) = &pending_action.recipient {
            if !rec.policy.recipients.iter().any(|x| x == r) {
                return self.reject(&agent, &mut rec, REASON_RECIPIENT, now);
            }
        }

        // All checks passed. Record spend and velocity, persist, emit SETTLED, perform action.
        rec.spent_in_window += pending_action.amount;
        rec.actions_in_window += 1;
        rec.vault_balance = rec.vault_balance.saturating_sub(pending_action.amount);
        self.agents.insert(agent.clone(), rec);
        emit(&format!(
            "{{\"event\":\"SETTLED\",\"agent\":\"{}\",\"id\":{},\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\"}}",
            agent, id, pending_action.target, pending_action.method, pending_action.amount
        ));
        let (_, _, args_bytes, _, _) = pending_action.action.decompose();
        self.perform_action(&pending_action.target, &pending_action.method, &args_bytes);
        Outcome {
            status: "SETTLED".to_string(),
            reason: None,
            pending_id: Some(id),
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
            vault_balance: U128(r.vault_balance),
        })
    }

    pub fn get_agents(&self, owner: AccountId) -> Vec<AccountId> {
        self.agents_by_owner
            .get(&owner)
            .cloned()
            .unwrap_or_default()
    }

    pub fn get_pending_actions(&self, agent_account: AccountId) -> Vec<PendingAction> {
        self.agents
            .get(&agent_account)
            .map(|r| r.pending_actions.clone())
            .unwrap_or_default()
    }

    pub fn get_staged_policy(&self, agent_account: AccountId) -> Option<StagedPolicy> {
        self.agents
            .get(&agent_account)
            .and_then(|r| r.staged_policy.clone())
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    fn load_owned(&self, agent_account: &AccountId) -> AgentRecord {
        let rec = match self.agents.get(agent_account) {
            Some(r) => r.clone(),
            None => env::panic_str(REASON_NOT_AGENT),
        };
        assert_eq!(
            env::predecessor_account_id(),
            rec.owner,
            "only owner may call this method"
        );
        rec
    }

    fn apply_staged_policy_if_due(rec: &mut AgentRecord, now_sec: u64, agent_account: &AccountId) {
        if let Some(ref staged) = rec.staged_policy {
            if now_sec >= staged.effective_at {
                rec.policy = staged.policy.clone();
                rec.staged_policy = None;
                emit(&format!(
                    "{{\"event\":\"POLICY_APPLIED\",\"agent\":\"{}\"}}",
                    agent_account
                ));
            }
        }
    }

    fn reject(
        &mut self,
        agent: &AccountId,
        rec: &mut AgentRecord,
        reason: &str,
        now: Timestamp,
    ) -> Outcome {
        if rec.reject_times.len() >= MAX_REJECT_TIMES_KEPT {
            rec.reject_times.remove(0);
        }
        rec.reject_times.push(now);
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
            pending_id: None,
        }
    }

    fn perform_action(&self, target: &AccountId, method: &String, args_bytes: &[u8]) {
        let call_gas = Gas::from_tgas(25);
        let attached_deposit = if method == "ft_transfer" || method == "ft_transfer_call" {
            NearToken::from_yoctonear(1)
        } else {
            NearToken::from_yoctonear(0)
        };
        let _ = Promise::new(target.clone()).function_call(
            method.clone(),
            args_bytes.to_vec(),
            attached_deposit,
            call_gas,
        );
    }
}

fn emit(line: &str) {
    env::log_str(&format!("EVENT_JSON:{}", line));
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn owner() -> AccountId {
        "alice.near".parse().unwrap()
    }

    fn agent() -> AccountId {
        "trader.alice.near".parse().unwrap()
    }

    fn target() -> AccountId {
        "mockdex.near".parse().unwrap()
    }

    fn bad_target() -> AccountId {
        "evil.near".parse().unwrap()
    }

    fn recipient() -> AccountId {
        "bob.near".parse().unwrap()
    }

    fn bad_recipient() -> AccountId {
        "eve.near".parse().unwrap()
    }

    fn sample_policy() -> Policy {
        let mut targets = HashMap::new();
        targets.insert(target(), vec!["swap".to_string()]);
        targets.insert(
            "token.near".parse().unwrap(),
            vec!["ft_transfer".to_string()],
        );
        Policy {
            targets,
            daily_cap: 1000,
            recipients: vec![recipient()],
            max_actions_per_10min: 3,
            auto_pause_rejects: 5,
            auto_pause_window_minutes: 10,
            high_value_threshold: 0,
            high_value_delay_seconds: 3600,
            policy_change_delay_seconds: 600,
        }
    }

    fn timelocked_policy(threshold: u128) -> Policy {
        let mut p = sample_policy();
        p.high_value_threshold = threshold;
        p
    }

    fn setup_contract(now: u64) -> (Contract, VMContextBuilder) {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .prepaid_gas(Gas::from_tgas(300))
            .block_timestamp(now);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent(agent(), sample_policy());
        (contract, builder)
    }

    #[test]
    fn test_register_and_views() {
        let now = 1_000_000_000;
        let (contract, _) = setup_contract(now);

        let policy = contract.get_policy(agent()).expect("policy should exist");
        assert_eq!(policy.daily_cap, 1000);
        assert_eq!(policy.max_actions_per_10min, 3);

        let budget = contract.get_budget(agent()).expect("budget should exist");
        assert_eq!(budget.cap.0, 1000);
        assert_eq!(budget.spent.0, 0);
        assert_eq!(budget.remaining.0, 1000);
        assert_eq!(budget.actions_in_window, 0);
        assert_eq!(budget.vault_balance.0, 0);
        assert!(!budget.paused);

        let agents = contract.get_agents(owner());
        assert_eq!(agents, vec![agent()]);
    }

    #[test]
    #[should_panic(expected = "NOT_AGENT")]
    fn test_unregistered_caller_panics() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id("stranger.near".parse().unwrap());
        testing_env!(builder.build());

        contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(10),
            None,
        );
    }

    #[test]
    fn test_vault_deposit_and_withdraw() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Owner deposits 5,000 tokens into the agent vault
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());

        let res = contract.ft_on_transfer(owner(), U128(5000), agent().to_string());
        match res {
            PromiseOrValue::Value(val) => assert_eq!(val.0, 0),
            _ => panic!("Expected Value"),
        }

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.vault_balance.0, 5000);

        // Owner withdraws 2,000 tokens
        let _ = contract.withdraw(agent(), "token.near".parse().unwrap(), U128(2000));
        let budget_after = contract.get_budget(agent()).unwrap();
        assert_eq!(budget_after.vault_balance.0, 3000);
    }

    #[test]
    #[should_panic(expected = "wildcard method '*' is forbidden")]
    fn test_wildcard_rejected_at_registration() {
        let now = 1_000_000_000;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        let mut wild_policy = sample_policy();
        wild_policy
            .targets
            .insert("any.near".parse().unwrap(), vec!["*".to_string()]);
        contract.register_agent("bot.alice.near".parse().unwrap(), wild_policy);
    }

    #[test]
    #[should_panic(expected = "Agent account must be a sub-account of the owner")]
    fn test_stranger_cannot_register_arbitrary_agent() {
        let now = 1_000_000_000;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id("attacker.near".parse().unwrap())
            .block_timestamp(now);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent("trader.alice.near".parse().unwrap(), sample_policy());
    }

    #[test]
    fn test_mismatched_amount_cannot_bypass_cap() {
        // Critical test requested by security review:
        // Proves that an agent cannot bypass daily cap by crafting deceptive parameters.
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        // Agent attempts a transfer of 10,000 tokens (cap is 1,000)
        let action = GuardAction::Transfer {
            token: "token.near".parse().unwrap(),
            to: recipient(),
            amount: U128(10000),
            memo: Some("try to move 10000".to_string()),
        };

        let outcome = contract.execute_action(action);
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_CAP.to_string()));

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent.0, 0); // No spend recorded
    }

    #[test]
    fn test_legit_action_allowed() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let action = GuardAction::Swap {
            dex: target(),
            token_in: "token.near".parse().unwrap(),
            amount_in: U128(200),
            min_out: U128(0),
        };

        let outcome = contract.execute_action(action);
        assert_eq!(outcome.status, "ALLOWED");
        assert_eq!(outcome.reason, None);

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent.0, 200);
        assert_eq!(budget.remaining.0, 800);
        assert_eq!(budget.actions_in_window, 1);
    }

    #[test]
    fn test_target_not_allowed() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let action = GuardAction::Swap {
            dex: bad_target(),
            token_in: "token.near".parse().unwrap(),
            amount_in: U128(200),
            min_out: U128(0),
        };

        let outcome = contract.execute_action(action);
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_TARGET.to_string()));
    }

    #[test]
    fn test_method_not_allowed() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute_raw(
            target(),
            "drain".to_string(),
            "{}".to_string(),
            U128(10),
            None,
        );
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_METHOD.to_string()));
    }

    #[test]
    fn test_over_daily_cap() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(1001),
            None,
        );
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_CAP.to_string()));
    }

    #[test]
    fn test_recipient_not_allowed() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(100),
            Some(bad_recipient()),
        );
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_RECIPIENT.to_string()));
    }

    #[test]
    fn test_check_order_velocity_before_allowlist() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        for _ in 0..3 {
            let o = contract.execute_raw(
                target(),
                "swap".to_string(),
                "{}".to_string(),
                U128(10),
                None,
            );
            assert_eq!(o.status, "ALLOWED");
        }

        let o = contract.execute_raw(
            bad_target(),
            "drain".to_string(),
            "{}".to_string(),
            U128(10),
            None,
        );
        assert_eq!(o.status, "REJECTED");
        assert_eq!(o.reason, Some(REASON_OVER_VELOCITY.to_string()));
    }

    #[test]
    fn test_auto_pause_circuit_breaker() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        for i in 0..5 {
            let o = contract.execute_raw(
                bad_target(),
                "swap".to_string(),
                "{}".to_string(),
                U128(10),
                None,
            );
            assert_eq!(o.status, "REJECTED");
            assert_eq!(o.reason, Some(REASON_TARGET.to_string()));
            let budget = contract.get_budget(agent()).unwrap();
            if i == 4 {
                assert!(budget.paused);
            } else {
                assert!(!budget.paused);
            }
        }

        let o = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(10),
            None,
        );
        assert_eq!(o.status, "REJECTED");
        assert_eq!(o.reason, Some(REASON_PAUSED.to_string()));
    }

    #[test]
    fn test_owner_pause_and_unpause() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.pause(agent());

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(10),
            None,
        );
        assert_eq!(o.status, "REJECTED");
        assert_eq!(o.reason, Some(REASON_PAUSED.to_string()));

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.unpause(agent());

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o2 = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(10),
            None,
        );
        assert_eq!(o2.status, "ALLOWED");
    }

    #[test]
    fn test_lazy_window_resets() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let o1 = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(500),
            None,
        );
        assert_eq!(o1.status, "ALLOWED");

        let budget1 = contract.get_budget(agent()).unwrap();
        assert_eq!(budget1.spent.0, 500);

        let day_later = now + DAY_NS + 1;
        builder.block_timestamp(day_later);
        testing_env!(builder.build());

        let o2 = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(600),
            None,
        );
        assert_eq!(o2.status, "ALLOWED");

        let budget2 = contract.get_budget(agent()).unwrap();
        assert_eq!(budget2.spent.0, 600);
    }

    #[test]
    fn test_only_owner_can_settle_timelock() {
        let now_sec = 1_000;
        let now_ns = now_sec * 1_000_000_000;

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent(agent(), timelocked_policy(250));

        // Agent triggers a high-value action of 300 (threshold 250)
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let o = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(300),
            None,
        );
        assert_eq!(o.status, "PENDING");
        let id = o.pending_id.unwrap();

        // Fast forward past delay
        let future_ns = (now_sec + 3601) * 1_000_000_000;
        builder.block_timestamp(future_ns);
        testing_env!(builder.build());

        // Agent attempts to settle its own pending action -> MUST PANIC
        // (Only owner is authorized)
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut c = contract;
            c.settle_pending(agent(), id);
        }));
        assert!(res.is_err(), "Agent settling its own action should fail");
    }

    #[test]
    fn test_owner_settles_after_delay() {
        let now_sec = 1_000;
        let now_ns = now_sec * 1_000_000_000;

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent(agent(), timelocked_policy(250));

        // Agent triggers high-value
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let o = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(300),
            None,
        );
        let id = o.pending_id.unwrap();

        // Fast forward past delay
        let future_ns = (now_sec + 3601) * 1_000_000_000;
        builder
            .predecessor_account_id(owner())
            .block_timestamp(future_ns);
        testing_env!(builder.build());

        // Owner settles
        let settled = contract.settle_pending(agent(), id);
        assert_eq!(settled.status, "SETTLED");

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent.0, 300);
    }

    #[test]
    fn test_cancel_pending_intent() {
        let now_sec = 1_000;
        let now_ns = now_sec * 1_000_000_000;

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent(agent(), timelocked_policy(250));

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let o = contract.execute_raw(
            target(),
            "swap".to_string(),
            "{}".to_string(),
            U128(300),
            None,
        );
        let id = o.pending_id.unwrap();
        assert_eq!(contract.get_pending_actions(agent()).len(), 1);

        // Owner cancels pending action with zero delay
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.cancel_pending(agent(), id);

        assert_eq!(contract.get_pending_actions(agent()).len(), 0);
    }

    #[test]
    fn test_policy_staging_and_cancellation() {
        let now_sec = 1_000;
        let now_ns = now_sec * 1_000_000_000;

        let (mut contract, mut builder) = setup_contract(now_ns);

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());

        let mut new_p = sample_policy();
        new_p.daily_cap = 5000;
        contract.set_policy(agent(), new_p);

        let staged = contract.get_staged_policy(agent()).expect("staged policy should exist");
        assert_eq!(staged.policy.daily_cap, 5000);
        assert_eq!(staged.effective_at, now_sec + 600);

        // Owner cancels staged policy
        contract.cancel_policy_change(agent());
        assert!(contract.get_staged_policy(agent()).is_none());
    }

    #[test]
    fn test_action_below_and_at_threshold() {
        let now_sec = 1_000;
        let now_ns = now_sec * 1_000_000_000;

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent(agent(), timelocked_policy(100));

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        // Below threshold (99) -> ALLOWED immediately
        let o1 = contract.execute_raw(target(), "swap".to_string(), "{}".to_string(), U128(99), None);
        assert_eq!(o1.status, "ALLOWED");

        // At threshold (100) -> PENDING in timelock
        let o2 = contract.execute_raw(target(), "swap".to_string(), "{}".to_string(), U128(100), None);
        assert_eq!(o2.status, "PENDING");
    }
}
