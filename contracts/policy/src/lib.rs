// Policy contract for ScopeGuard on NEAR.
// Implements protocol-restricted agent passkey enforcement with ordered
// policy checks, automated circuit breaker, timelocked high-value actions,
// and real NEP-141 and native NEAR vault custody with strongly typed actions.

pub mod types;
pub use types::*;

use near_sdk::json_types::U128;
use near_sdk::serde_json;
use near_sdk::store::LookupMap;
use near_sdk::{
    env, is_promise_success, near, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue, Timestamp,
};

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
            agents: LookupMap::new(b"ag".as_slice()),
            agents_by_owner: LookupMap::new(b"ow".as_slice()),
        }
    }

    pub fn migrate_state(&mut self) {
        let caller = env::predecessor_account_id();
        let owner: AccountId = "sergeo-guard.testnet".parse().unwrap();
        assert!(
            caller == env::current_account_id() || caller == owner,
            "Unauthorized"
        );
        let agents = ["agent.sergeo-guard.testnet", "trader.sergeo-guard.testnet"];
        for agent_str in agents {
            if let Ok(agent) = agent_str.parse::<AccountId>() {
                let mut key = b"ag".to_vec();
                near_sdk::borsh::BorshSerialize::serialize(&agent, &mut key).unwrap();
                if let Some(bytes) = env::storage_read(&key) {
                    if bytes.len() == 497 || bytes.len() == 498 {
                        let policy_part = &bytes[0..391];
                        let record_middle = &bytes[391..497];
                        let mut new_bytes = Vec::with_capacity(524);
                        new_bytes.extend_from_slice(policy_part);
                        new_bytes.push(0);
                        new_bytes.push(0);
                        new_bytes.extend_from_slice(record_middle);
                        new_bytes.extend_from_slice(&[0u8; 16]);
                        new_bytes.extend_from_slice(&[0u8; 4]);
                        new_bytes.extend_from_slice(&[0u8; 4]);
                        new_bytes.push(0);
                        env::storage_write(&key, &new_bytes);
                    }
                }
            }
        }
    }

    // ---------------------------------------------------------------
    // Registration & Policy Management
    // ---------------------------------------------------------------

    fn validate_policy(policy: &Policy) {
        assert!(policy.daily_cap > 0, "daily_cap must be greater than zero");
        assert!(
            policy.max_actions_per_10min > 0,
            "max_actions_per_10min must be greater than zero"
        );
        assert!(
            policy.auto_pause_rejects > 0 && policy.auto_pause_rejects as usize <= MAX_REJECT_TIMES_KEPT,
            "auto_pause_rejects must be between 1 and 64"
        );
        assert!(
            policy.auto_pause_window_minutes > 0,
            "auto_pause_window_minutes must be greater than zero"
        );
        assert!(
            policy.high_value_delay_seconds > 0,
            "high_value_delay_seconds must be greater than zero"
        );
        assert!(
            policy.policy_change_delay_seconds > 0,
            "policy_change_delay_seconds must be greater than zero"
        );
        assert!(
            policy.high_value_threshold <= policy.daily_cap,
            "high_value_threshold cannot exceed daily_cap"
        );
        if let (Some(near_thresh), Some(near_cap)) = (policy.near_high_value_threshold, policy.near_daily_cap) {
            assert!(
                near_thresh <= near_cap,
                "near_high_value_threshold cannot exceed near_daily_cap"
            );
        }
        if let Some(bps) = policy.max_drawdown_bps {
            assert!(bps <= 10000, "max_drawdown_bps cannot exceed 10000 (100%)");
        }
        for (_target, methods) in &policy.targets {
            assert!(!methods.is_empty(), "methods list cannot be empty for target");
            for m in methods {
                assert_ne!(
                    m, "*",
                    "wildcard method '*' is forbidden: name every method explicitly"
                );
            }
        }
        for canary in &policy.canary_methods {
            assert!(!canary.trim().is_empty(), "canary method cannot be empty");
        }
        for ir in &policy.intent_recipients {
            assert!(!ir.trim().is_empty(), "intent recipient cannot be empty");
        }
    }

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
        Self::validate_policy(&policy);

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
                unconfirmed_recipients: Vec::new(),
                high_water_mark: U128(0),
                near_vault_balance: 0,
                near_high_water_mark: U128(0),
                spend_buckets: Vec::new(),
                near_spend_buckets: Vec::new(),
                revoked: false,
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
        // Predecessor MUST match the policy's registered token contract
        let token_caller = env::predecessor_account_id();
        assert_eq!(token_caller, rec.policy.token, "Unauthorized token contract");

        rec.vault_balance += amount.0;
        if rec.vault_balance > rec.high_water_mark.0 {
            rec.high_water_mark = U128(rec.vault_balance);
        }
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"DEPOSIT\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
            agent_account, amount.0
        ));
        PromiseOrValue::Value(U128(0)) // 0 means all tokens accepted
    }

    /// Receives native NEAR deposited into the agent vault pot by the owner.
    #[payable]
    pub fn deposit_near(&mut self, agent_account: AccountId) {
        let deposit_amount = env::attached_deposit().as_yoctonear();
        assert!(deposit_amount > 0, "attached deposit must be greater than zero");
        let mut rec = match self.agents.get(&agent_account).cloned() {
            Some(r) => r,
            None => env::panic_str(REASON_NOT_AGENT),
        };
        let sender = env::predecessor_account_id();
        assert_eq!(sender, rec.owner, "Only owner can deposit into agent vault");

        rec.near_vault_balance = rec.near_vault_balance.saturating_add(deposit_amount);
        if rec.near_vault_balance > rec.near_high_water_mark.0 {
            rec.near_high_water_mark = U128(rec.near_vault_balance);
        }
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"DEPOSIT_NEAR\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
            agent_account, deposit_amount
        ));
    }

    /// Owner only. Stages the new policy with effective_at = now + policy_change_delay_seconds.
    /// Does not apply immediately. Strictly validates policy before staging.
    pub fn set_policy(&mut self, agent_account: AccountId, policy: Policy) {
        let mut rec = self.load_owned(&agent_account);
        assert!(!rec.revoked, "Cannot stage policy for a permanently revoked agent");
        Self::validate_policy(&policy);
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
    pub fn withdraw(&mut self, agent_account: AccountId, amount: U128) -> Promise {
        let mut rec = self.load_owned(&agent_account);
        assert!(rec.vault_balance >= amount.0, "insufficient vault balance");
        rec.vault_balance -= amount.0;
        if rec.vault_balance < rec.high_water_mark.0 {
            rec.high_water_mark = U128(rec.vault_balance);
        }
        let token = rec.policy.token.clone();
        self.agents.insert(agent_account.clone(), rec.clone());
        emit(&format!(
            "{{\"event\":\"WITHDRAW\",\"agent\":\"{}\",\"token\":\"{}\",\"amount\":\"{}\"}}",
            agent_account, token, amount.0
        ));
        Promise::new(token)
            .function_call(
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
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_withdraw_resolved(agent_account, amount),
            )
    }

    /// Owner only, immediate. Withdraws native NEAR from vault back to owner.
    pub fn withdraw_near(&mut self, agent_account: AccountId, amount: U128) -> Promise {
        let mut rec = self.load_owned(&agent_account);
        assert!(rec.near_vault_balance >= amount.0, "insufficient vault balance");
        rec.near_vault_balance -= amount.0;
        let owner = rec.owner.clone();
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"WITHDRAW_NEAR\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
            agent_account, amount.0
        ));
        Promise::new(owner)
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .on_withdraw_near_resolved(agent_account, amount),
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

    /// Owner only, immediate and permanent. Revokes every permission the agent
    /// has: allowlisted targets, recipients, staged policy and pending intents.
    ///
    /// The agent record is kept so the audit trail and any vault balance remain
    /// queryable and withdrawable, but `targets` and `recipients` are emptied.
    /// Because the allowlist is empty, every future `execute` is rejected even
    /// if the agent is unpaused later. This is the only way to retire an agent
    /// whose FunctionCall key was lost or leaked: the agent account owns its
    /// key, so the owner cannot delete it from consensus.
    pub fn revoke_agent(&mut self, agent_account: AccountId) {
        let mut rec = self.load_owned(&agent_account);
        rec.revoked = true;
        rec.paused = true;
        rec.staged_policy = None;
        rec.pending_actions.clear();
        rec.policy.targets.clear();
        rec.policy.recipients.clear();
        rec.unconfirmed_recipients.clear();
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"REVOKE\",\"agent\":\"{}\"}}",
            agent_account
        ));
    }

    /// Owner only. Clears the rolling daily/velocity windows and reject strikes.
    ///
    /// This is an operational and demo affordance: the windows reset lazily
    /// after 24h / 10min, which makes a repeated live walkthrough return
    /// OVER_VELOCITY_CAP instead of the scenario being demonstrated. It never
    /// changes the policy, the allowlist or the pause state, so it grants no
    /// new permission - the owner can already lift any cap via `set_policy`.
    pub fn reset_windows(&mut self, agent_account: AccountId) {
        let mut rec = self.load_owned(&agent_account);
        assert!(
            !rec.revoked && !rec.policy.targets.is_empty(),
            "agent is revoked: nothing to reset"
        );
        let now = env::block_timestamp();
        rec.day_window_start = now;
        rec.spent_in_window = 0;
        rec.velocity_window_start = now;
        rec.actions_in_window = 0;
        rec.reject_times.clear();
        rec.high_water_mark = U128(rec.vault_balance);
        rec.near_high_water_mark = U128(rec.near_vault_balance);
        rec.spend_buckets.clear();
        rec.near_spend_buckets.clear();
        self.agents.insert(agent_account.clone(), rec);
        emit(&format!(
            "{{\"event\":\"WINDOWS_RESET\",\"agent\":\"{}\"}}",
            agent_account
        ));
    }

    // ---------------------------------------------------------------
    // Execution & Settlement
    // ---------------------------------------------------------------

    /// Primary execution method: strictly accepts strongly-typed GuardAction.
    /// No flat arguments or bypass paths exist. The Guard constructs calldata.
    pub fn execute(&mut self, action: GuardAction) -> Outcome {
        let (target, method, args_bytes, amount, recipient) = action.decompose();
        let args_str = String::from_utf8(args_bytes.clone()).unwrap_or_default();
        self.internal_execute(action, target, method, args_str, args_bytes, amount, recipient)
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

        // Lazy velocity reset (10 min fixed window).
        if now >= rec.velocity_window_start + TEN_MIN_NS {
            rec.velocity_window_start = now;
            rec.actions_in_window = 0;
        }

        // Ordered checks. Each failure records the reject and returns.
        if rec.paused {
            return self.reject(&caller, &mut rec, REASON_PAUSED, now);
        }
        if let Some(expires_at) = rec.policy.lease_expires_at {
            if now >= expires_at {
                return self.reject(&caller, &mut rec, REASON_LEASE_EXPIRED, now);
            }
        }
        if rec.policy.canary_methods.iter().any(|m| m == &method) {
            rec.paused = true;
            emit(&format!(
                "{{\"event\":\"CANARY_TRIPPED\",\"agent\":\"{}\",\"method\":\"{}\"}}",
                caller, method
            ));
            emit(&format!(
                "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"reason\":\"CANARY_TRIPPED\"}}",
                caller
            ));
            return self.reject(&caller, &mut rec, REASON_CANARY_TRIPPED, now);
        }
        if rec.actions_in_window >= rec.policy.max_actions_per_10min {
            return self.reject(&caller, &mut rec, REASON_OVER_VELOCITY, now);
        }

        let is_near_transfer = matches!(action, GuardAction::NearTransfer { .. });
        let contract_call_deposit = if let GuardAction::ContractCall { deposit: Some(d), .. } = &action {
            d.0
        } else {
            0
        };
        let is_near_movement = is_near_transfer || contract_call_deposit > 0;
        let near_amount = if is_near_transfer { amount } else { contract_call_deposit };
        let token_amount = if !is_near_transfer && !matches!(action, GuardAction::ContractCall { .. }) {
            amount
        } else {
            0
        };

        // Checks 4 & 5: TARGET_NOT_ALLOWED & METHOD_NOT_ALLOWED
        if !is_near_transfer {
            // Security check: if this is a Transfer, enforce that token must match the policy custody token
            if let GuardAction::Transfer { token, .. } = &action {
                if token != &rec.policy.token {
                    return self.reject(&caller, &mut rec, REASON_TARGET, now);
                }
            }
            if let GuardAction::Swap { token_in, .. } = &action {
                if token_in != &rec.policy.token {
                    return self.reject(&caller, &mut rec, REASON_TARGET, now);
                }
            }
            // Security check: ContractCall must NEVER target the custody token
            if let GuardAction::ContractCall { target: ref cc_target, .. } = &action {
                if cc_target == &rec.policy.token {
                    return self.reject(&caller, &mut rec, REASON_TARGET, now);
                }
            }
            let methods = match rec.policy.targets.get(&target) {
                Some(m) => m.clone(),
                None => return self.reject(&caller, &mut rec, REASON_TARGET, now),
            };
            if !methods.iter().any(|m| m == &method) {
                return self.reject(&caller, &mut rec, REASON_METHOD, now);
            }
            // Security check: ContractCall must NEVER invoke swap, execute_intent, or methods from VALUE_MOVING_DENYLIST
            if let GuardAction::ContractCall { method: ref cc_method, .. } = &action {
                if cc_method == "swap" || cc_method == "execute_intent" || VALUE_MOVING_DENYLIST.contains(&cc_method.as_str()) {
                    return self.reject(&caller, &mut rec, REASON_METHOD, now);
                }
            }
        }

        // Check 6: OVER_DAILY_CAP
        if token_amount > 0 {
            let current_spent = rec.rolling_spend(now);
            let new_spent = match current_spent.checked_add(token_amount) {
                Some(val) => val,
                None => return self.reject(&caller, &mut rec, REASON_CAP, now),
            };
            if new_spent > rec.policy.daily_cap {
                return self.reject(&caller, &mut rec, REASON_CAP, now);
            }
        }
        if is_near_movement {
            let near_cap = match rec.policy.near_daily_cap {
                Some(c) if c > 0 => c,
                _ => return self.reject(&caller, &mut rec, REASON_CAP, now),
            };
            let current_near_spent = rec.rolling_near_spend(now);
            let new_near_spent = match current_near_spent.checked_add(near_amount) {
                Some(val) => val,
                None => return self.reject(&caller, &mut rec, REASON_CAP, now),
            };
            if new_near_spent > near_cap {
                return self.reject(&caller, &mut rec, REASON_CAP, now);
            }
        }

        // Check 7: RECIPIENT_NOT_ALLOWED
        if let Some(r) = &recipient {
            if !rec.policy.recipients.iter().any(|x| x == r) {
                return self.reject(&caller, &mut rec, REASON_RECIPIENT, now);
            }
        }
        if let GuardAction::IntentTransfer { ref recipient, .. } = &action {
            if !rec.policy.intent_recipients.iter().any(|x| x == recipient) {
                return self.reject(&caller, &mut rec, REASON_INTENT_RECIPIENT, now);
            }
        }

        // Check 8: INSUFFICIENT_VAULT_BALANCE
        let reduces_token_vault = token_amount > 0 && (
            matches!(action, GuardAction::Transfer { .. }) || matches!(action, GuardAction::IntentTransfer { .. })
        );
        if reduces_token_vault && token_amount > rec.vault_balance {
            return self.reject(&caller, &mut rec, REASON_INSUFFICIENT_VAULT, now);
        }
        if is_near_movement {
            if contract_call_deposit > SAFE_STORAGE_DEPOSIT_CEILING {
                return self.reject(&caller, &mut rec, REASON_CAP, now);
            }
            if near_amount > rec.near_vault_balance {
                return self.reject(&caller, &mut rec, REASON_INSUFFICIENT_VAULT, now);
            }
        }

        // Check 9: Net Drawdown Breaker check: calculate projected balance against high-water mark floor
        if let Some(max_bps) = rec.policy.max_drawdown_bps {
            if reduces_token_vault {
                let current_bal = rec.vault_balance;
                let peak = rec.high_water_mark.0;
                let projected_balance = current_bal.saturating_sub(token_amount);
                let floor = compute_drawdown_floor(peak, max_bps);
                if projected_balance < floor {
                    rec.paused = true;
                    emit(&format!(
                        "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"reason\":\"DRAWDOWN_EXCEEDED\"}}",
                        caller
                    ));
                    return self.reject(&caller, &mut rec, REASON_DRAWDOWN_EXCEEDED, now);
                }
            }
            if is_near_movement && rec.near_high_water_mark.0 > 0 {
                let current_near = rec.near_vault_balance;
                let peak_near = rec.near_high_water_mark.0;
                let projected_near = current_near.saturating_sub(near_amount);
                let floor_near = compute_drawdown_floor(peak_near, max_bps);
                if projected_near < floor_near {
                    rec.paused = true;
                    emit(&format!(
                        "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"reason\":\"DRAWDOWN_EXCEEDED\"}}",
                        caller
                    ));
                    return self.reject(&caller, &mut rec, REASON_DRAWDOWN_EXCEEDED, now);
                }
            }
        }

        // Check 10: Timelock quarantine vs PENDING_QUEUE_FULL
        let is_unconfirmed = match &recipient {
            Some(r) => rec.unconfirmed_recipients.contains(r),
            None => false,
        };
        let is_high_value_token = rec.policy.high_value_threshold > 0 && token_amount >= rec.policy.high_value_threshold;
        let is_high_value_near = rec.policy.near_high_value_threshold.map_or(false, |t| t > 0 && near_amount >= t);

        if is_high_value_token || is_high_value_near || is_unconfirmed {
            rec.actions_in_window += 1;
            if rec.pending_actions.len() >= MAX_PENDING_ACTIONS {
                return self.reject(&caller, &mut rec, REASON_PENDING_QUEUE_FULL, now);
            }
            let id = rec.next_pending_id;
            rec.next_pending_id += 1;
            let executable_at = now_sec + rec.policy.high_value_delay_seconds;
            let pending_amount = if is_near_movement { near_amount } else { token_amount };
            rec.pending_actions.push(PendingAction {
                id,
                action,
                target: target.clone(),
                method: method.clone(),
                args: args_str,
                amount: pending_amount,
                recipient: recipient.clone(),
                created_at: now_sec,
                executable_at,
            });
            self.agents.insert(caller.clone(), rec);
            emit(&format!(
                "{{\"event\":\"PENDING\",\"agent\":\"{}\",\"id\":{},\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\",\"executable_at\":{}}}",
                caller, id, target, method, pending_amount, executable_at
            ));
            Outcome {
                status: "PENDING".to_string(),
                reason: None,
                pending_id: Some(id),
            }
        } else {
            // Allowed immediately: record spend and velocity, persist, then act.
            rec.actions_in_window += 1;
            if token_amount > 0 {
                rec.record_spend(now, token_amount);
                if reduces_token_vault {
                    rec.vault_balance -= token_amount;
                }
            }
            if is_near_movement {
                rec.record_near_spend(now, near_amount);
                rec.near_vault_balance = rec.near_vault_balance.saturating_sub(near_amount);
            }
            self.agents.insert(caller.clone(), rec);
            let emit_amount = if is_near_movement { near_amount } else { amount };
            emit(&format!(
                "{{\"event\":\"ALLOW\",\"agent\":\"{}\",\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\"}}",
                caller, target, method, emit_amount
            ));
            let is_transfer = reduces_token_vault || is_near_movement;
            let bucket = now / HOUR_NS;
            self.dispatch_action(&caller, &action, &target, &method, &args_bytes, emit_amount, is_transfer, bucket);
            Outcome {
                status: "ALLOWED".to_string(),
                reason: None,
                pending_id: None,
            }
        }
    }

    fn reject_pending_settlement(
        &mut self,
        agent: &AccountId,
        mut rec: AgentRecord,
        id: u64,
        reason: &str,
    ) -> Outcome {
        rec.pending_actions.retain(|a| a.id != id);
        self.agents.insert(agent.clone(), rec);
        Outcome {
            status: "REJECTED".to_string(),
            reason: Some(reason.to_string()),
            pending_id: Some(id),
        }
    }

    /// Settles a pending action after its delay window has passed.
    /// Security invariant: Settling is restricted strictly to the OWNER.
    /// The agent can never approve or settle its own queued high-value actions.
    pub fn settle_pending(
        &mut self,
        agent: Option<AccountId>,
        agent_account: Option<AccountId>,
        id: u64,
    ) -> Outcome {
        let agent = agent_account.or(agent).unwrap_or_else(|| env::panic_str("missing agent account"));
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

        let pending_action = match rec.pending_actions.iter().find(|a| a.id == id) {
            Some(a) => a.clone(),
            None => env::panic_str("pending action not found"),
        };
        assert!(now_sec >= pending_action.executable_at, "action not executable yet");

        if now >= rec.velocity_window_start + TEN_MIN_NS {
            rec.velocity_window_start = now;
            rec.actions_in_window = 0;
        }

        self.agents.insert(agent.clone(), rec.clone());

        // Re-run checks against current policy and windows.
        // Owner-triggered settle checks do not penalize the agent with reject strikes.
        if rec.paused {
            return self.reject_pending_settlement(&agent, rec, id, REASON_PAUSED);
        }
        if let Some(expires_at) = rec.policy.lease_expires_at {
            if now >= expires_at {
                return self.reject_pending_settlement(&agent, rec, id, REASON_LEASE_EXPIRED);
            }
        }
        if rec.policy.canary_methods.iter().any(|m| m == &pending_action.method) {
            rec.paused = true;
            emit(&format!(
                "{{\"event\":\"CANARY_TRIPPED\",\"agent\":\"{}\",\"method\":\"{}\"}}",
                agent, pending_action.method
            ));
            emit(&format!(
                "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"reason\":\"CANARY_TRIPPED\"}}",
                agent
            ));
            return self.reject_pending_settlement(&agent, rec, id, REASON_CANARY_TRIPPED);
        }

        let is_near_transfer = matches!(pending_action.action, GuardAction::NearTransfer { .. });
        let contract_call_deposit = if let GuardAction::ContractCall { deposit: Some(d), .. } = &pending_action.action {
            d.0
        } else {
            0
        };
        let is_near_movement = is_near_transfer || contract_call_deposit > 0;
        let near_amount = if is_near_transfer { pending_action.amount } else { contract_call_deposit };
        let token_amount = if !is_near_transfer && !matches!(pending_action.action, GuardAction::ContractCall { .. }) {
            pending_action.amount
        } else {
            0
        };

        if !is_near_transfer {
            if let GuardAction::Transfer { ref token, .. } = &pending_action.action {
                if token != &rec.policy.token {
                    return self.reject_pending_settlement(&agent, rec, id, REASON_TARGET);
                }
            }
            if let GuardAction::ContractCall { target: ref cc_target, .. } = &pending_action.action {
                if cc_target == &rec.policy.token {
                    return self.reject_pending_settlement(&agent, rec, id, REASON_TARGET);
                }
            }
            let methods = match rec.policy.targets.get(&pending_action.target) {
                Some(m) => m.clone(),
                None => {
                    return self.reject_pending_settlement(&agent, rec, id, REASON_TARGET);
                }
            };
            if !methods.iter().any(|m| m == &pending_action.method) {
                return self.reject_pending_settlement(&agent, rec, id, REASON_METHOD);
            }
            if let GuardAction::ContractCall { method: ref cc_method, .. } = &pending_action.action {
                if VALUE_MOVING_DENYLIST.contains(&cc_method.as_str()) {
                    return self.reject_pending_settlement(&agent, rec, id, REASON_METHOD);
                }
            }
        }

        // Check 6: Cap check at settlement time (checked against rolling windows)
        if token_amount > 0 {
            let current_spent = rec.rolling_spend(now);
            if current_spent.checked_add(token_amount).map_or(true, |s| s > rec.policy.daily_cap) {
                return self.reject_pending_settlement(&agent, rec, id, REASON_CAP);
            }
        }
        if is_near_movement {
            let near_cap = match rec.policy.near_daily_cap {
                Some(c) if c > 0 => c,
                _ => return self.reject_pending_settlement(&agent, rec, id, REASON_CAP),
            };
            let current_near_spent = rec.rolling_near_spend(now);
            if current_near_spent.checked_add(near_amount).map_or(true, |s| s > near_cap) {
                return self.reject_pending_settlement(&agent, rec, id, REASON_CAP);
            }
        }

        if let Some(r) = &pending_action.recipient {
            if !rec.policy.recipients.iter().any(|x| x == r) {
                return self.reject_pending_settlement(&agent, rec, id, REASON_RECIPIENT);
            }
        }
        if let GuardAction::IntentTransfer { ref recipient, .. } = pending_action.action {
            if !rec.policy.intent_recipients.iter().any(|x| x == recipient) {
                return self.reject_pending_settlement(&agent, rec, id, REASON_INTENT_RECIPIENT);
            }
        }

        let reduces_token_vault = token_amount > 0 && (
            matches!(pending_action.action, GuardAction::Transfer { .. })
                || matches!(pending_action.action, GuardAction::IntentTransfer { .. })
        );
        if reduces_token_vault && token_amount > rec.vault_balance {
            return self.reject_pending_settlement(&agent, rec, id, REASON_INSUFFICIENT_VAULT);
        }
        if is_near_movement {
            if contract_call_deposit > SAFE_STORAGE_DEPOSIT_CEILING {
                return self.reject_pending_settlement(&agent, rec, id, REASON_CAP);
            }
            if near_amount > rec.near_vault_balance {
                return self.reject_pending_settlement(&agent, rec, id, REASON_INSUFFICIENT_VAULT);
            }
        }

        // Drawdown Breaker check at settlement time
        if let Some(max_bps) = rec.policy.max_drawdown_bps {
            if reduces_token_vault {
                let current_bal = rec.vault_balance;
                let peak = rec.high_water_mark.0;
                let projected_balance = current_bal.saturating_sub(token_amount);
                let floor = compute_drawdown_floor(peak, max_bps);
                if projected_balance < floor {
                    rec.paused = true;
                    emit(&format!(
                        "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"reason\":\"DRAWDOWN_EXCEEDED\"}}",
                        agent
                    ));
                    return self.reject_pending_settlement(&agent, rec, id, REASON_DRAWDOWN_EXCEEDED);
                }
            }
            if is_near_movement && rec.near_high_water_mark.0 > 0 {
                let current_near = rec.near_vault_balance;
                let peak_near = rec.near_high_water_mark.0;
                let projected_near = current_near.saturating_sub(near_amount);
                let floor_near = compute_drawdown_floor(peak_near, max_bps);
                if projected_near < floor_near {
                    rec.paused = true;
                    emit(&format!(
                        "{{\"event\":\"AUTO_PAUSE\",\"agent\":\"{}\",\"reason\":\"DRAWDOWN_EXCEEDED\"}}",
                        agent
                    ));
                    return self.reject_pending_settlement(&agent, rec, id, REASON_DRAWDOWN_EXCEEDED);
                }
            }
        }

        // All checks passed. Evict from pending queue.
        rec.pending_actions.retain(|a| a.id != id);

        // If this action was quarantined for an unconfirmed recipient, mark confirmed.
        if let Some(ref r) = pending_action.recipient {
            if let Some(pos) = rec.unconfirmed_recipients.iter().position(|x| x == r) {
                rec.unconfirmed_recipients.remove(pos);
                emit(&format!(
                    "{{\"event\":\"RECIPIENT_CONFIRMED\",\"agent\":\"{}\",\"recipient\":\"{}\"}}",
                    agent, r
                ));
            }
        }

        // All checks passed. Record spend, deduct vault balances, persist, emit SETTLED, perform action.
        if token_amount > 0 {
            rec.record_spend(now, token_amount);
            if reduces_token_vault {
                rec.vault_balance -= token_amount;
            }
        }
        if is_near_movement {
            rec.record_near_spend(now, near_amount);
            rec.near_vault_balance = rec.near_vault_balance.saturating_sub(near_amount);
        }

        self.agents.insert(agent.clone(), rec);
        let emit_amount = if is_near_movement { near_amount } else { pending_action.amount };
        emit(&format!(
            "{{\"event\":\"SETTLED\",\"agent\":\"{}\",\"id\":{},\"target\":\"{}\",\"method\":\"{}\",\"amount\":\"{}\"}}",
            agent, id, pending_action.target, pending_action.method, emit_amount
        ));
        let (_, _, args_bytes, _, _) = pending_action.action.decompose();
        let is_transfer = reduces_token_vault || is_near_movement;
        let bucket = now / HOUR_NS;
        self.dispatch_action(
            &agent,
            &pending_action.action,
            &pending_action.target,
            &pending_action.method,
            &args_bytes,
            emit_amount,
            is_transfer,
            bucket,
        );
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
        let now = env::block_timestamp();
        self.agents.get(&agent_account).map(|r| {
            let spent = r.rolling_spend(now);
            let near_spent = r.rolling_near_spend(now);
            BudgetView {
                cap: U128(r.policy.daily_cap),
                spent: U128(spent),
                remaining: U128(r.policy.daily_cap.saturating_sub(spent)),
                actions_in_window: r.actions_in_window,
                paused: r.paused,
                vault_balance: U128(r.vault_balance),
                revoked: r.revoked || (r.policy.targets.is_empty() && r.policy.recipients.is_empty()),
                high_water_mark: r.high_water_mark,
                max_drawdown_bps: r.policy.max_drawdown_bps,
                near_vault_balance: Some(U128(r.near_vault_balance)),
                near_high_water_mark: Some(r.near_high_water_mark),
                near_cap: r.policy.near_daily_cap.map(U128),
                near_spent: Some(U128(near_spent)),
                near_remaining: r.policy.near_daily_cap.map(|c| U128(c.saturating_sub(near_spent))),
            }
        })
    }

    pub fn get_near_vault_balance(&self, agent_account: AccountId) -> U128 {
        self.agents
            .get(&agent_account)
            .map(|r| U128(r.near_vault_balance))
            .unwrap_or(U128(0))
    }

    pub fn get_near_high_water_mark(&self, agent_account: AccountId) -> U128 {
        self.agents
            .get(&agent_account)
            .map(|r| r.near_high_water_mark)
            .unwrap_or(U128(0))
    }

    pub fn get_reject_times(&self, agent_account: AccountId) -> Vec<u64> {
        self.agents
            .get(&agent_account)
            .map(|r| r.reject_times.clone())
            .unwrap_or_default()
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

    pub fn get_version(&self) -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }

    pub fn get_unconfirmed_recipients(&self, agent_account: AccountId) -> Vec<AccountId> {
        self.agents
            .get(&agent_account)
            .map(|r| r.unconfirmed_recipients.clone())
            .unwrap_or_default()
    }

    /// Read-only preflight simulation of Guard execution.
    /// Evaluates policy checks in the exact same fixed check order as execute.
    /// Never mutates state, never records reject strikes, returns NOT_AGENT as a value.
    pub fn preflight(&self, agent_account: AccountId, action: GuardAction) -> PreflightResult {
        let mut rec = match self.agents.get(&agent_account) {
            Some(r) => r.clone(),
            None => {
                return PreflightResult {
                    status: "REJECTED".to_string(),
                    reason: Some(REASON_NOT_AGENT.to_string()),
                    delay_seconds: None,
                    budget: None,
                    velocity_used: 0,
                    velocity_max: 0,
                    velocity_remaining: 0,
                    vault_balance: U128(0),
                    near_vault_balance: None,
                    near_high_water_mark: None,
                };
            }
        };

        let now = env::block_timestamp();
        let now_sec = now / 1_000_000_000;

        // Lazy apply staged policy if effective_at has arrived (simulated read-only)
        Self::apply_staged_policy_if_due(&mut rec, now_sec, &agent_account);

        if now >= rec.velocity_window_start + TEN_MIN_NS {
            rec.velocity_window_start = now;
            rec.actions_in_window = 0;
        }

        let velocity_used = rec.actions_in_window;
        let velocity_max = rec.policy.max_actions_per_10min;
        let velocity_remaining = velocity_max.saturating_sub(velocity_used);
        let vault_balance = U128(rec.vault_balance);
        let near_vault_balance = Some(U128(rec.near_vault_balance));
        let near_high_water_mark = Some(rec.near_high_water_mark);
        let spent = rec.rolling_spend(now);
        let near_spent = rec.rolling_near_spend(now);
        let budget = BudgetView {
            cap: U128(rec.policy.daily_cap),
            spent: U128(spent),
            remaining: U128(rec.policy.daily_cap.saturating_sub(spent)),
            actions_in_window: rec.actions_in_window,
            paused: rec.paused,
            vault_balance,
            revoked: rec.revoked || (rec.policy.targets.is_empty() && rec.policy.recipients.is_empty()),
            high_water_mark: rec.high_water_mark,
            max_drawdown_bps: rec.policy.max_drawdown_bps,
            near_vault_balance,
            near_high_water_mark,
            near_cap: rec.policy.near_daily_cap.map(U128),
            near_spent: Some(U128(near_spent)),
            near_remaining: rec.policy.near_daily_cap.map(|c| U128(c.saturating_sub(near_spent))),
        };

        let reject = |reason: &str| PreflightResult {
            status: "REJECTED".to_string(),
            reason: Some(reason.to_string()),
            delay_seconds: None,
            budget: Some(budget.clone()),
            velocity_used,
            velocity_max,
            velocity_remaining,
            vault_balance,
            near_vault_balance,
            near_high_water_mark,
        };

        // Check 1: NOT_AGENT (handled above)
        // Check 2: PAUSED
        if rec.paused {
            return reject(REASON_PAUSED);
        }
        if let Some(expires_at) = rec.policy.lease_expires_at {
            if now >= expires_at {
                return reject(REASON_LEASE_EXPIRED);
            }
        }

        let (target, method, _args_bytes, amount, recipient) = action.decompose();

        // Canary Decoy Tripwire
        if rec.policy.canary_methods.iter().any(|m| m == &method) {
            return reject(REASON_CANARY_TRIPPED);
        }

        // Check 3: OVER_VELOCITY_CAP
        if rec.actions_in_window >= rec.policy.max_actions_per_10min {
            return reject(REASON_OVER_VELOCITY);
        }

        let is_near_transfer = matches!(action, GuardAction::NearTransfer { .. });
        let contract_call_deposit = if let GuardAction::ContractCall { deposit: Some(d), .. } = &action {
            d.0
        } else {
            0
        };
        let is_near_movement = is_near_transfer || contract_call_deposit > 0;
        let near_amount = if is_near_transfer { amount } else { contract_call_deposit };
        let token_amount = if !is_near_transfer && !matches!(action, GuardAction::ContractCall { .. }) {
            amount
        } else {
            0
        };

        // Checks 4 & 5: TARGET_NOT_ALLOWED & METHOD_NOT_ALLOWED
        if !is_near_transfer {
            // Check 4: TARGET_NOT_ALLOWED
            if let GuardAction::Transfer { ref token, .. } = action {
                if token != &rec.policy.token {
                    return reject(REASON_TARGET);
                }
            }
            if let GuardAction::Swap { ref token_in, .. } = action {
                if token_in != &rec.policy.token {
                    return reject(REASON_TARGET);
                }
            }
            if let GuardAction::ContractCall { target: ref cc_target, .. } = action {
                if cc_target == &rec.policy.token {
                    return reject(REASON_TARGET);
                }
            }
            let methods = match rec.policy.targets.get(&target) {
                Some(m) => m,
                None => return reject(REASON_TARGET),
            };

            // Check 5: METHOD_NOT_ALLOWED
            if !methods.iter().any(|m| m == &method) {
                return reject(REASON_METHOD);
            }
            if let GuardAction::ContractCall { method: ref cc_method, .. } = action {
                if cc_method == "swap" || cc_method == "execute_intent" || VALUE_MOVING_DENYLIST.contains(&cc_method.as_str()) {
                    return reject(REASON_METHOD);
                }
            }
        }

        // Check 6: OVER_DAILY_CAP
        if token_amount > 0 {
            let current_spent = rec.rolling_spend(now);
            let new_spent = match current_spent.checked_add(token_amount) {
                Some(val) => val,
                None => return reject(REASON_CAP),
            };
            if new_spent > rec.policy.daily_cap {
                return reject(REASON_CAP);
            }
        }
        if is_near_movement {
            let near_cap = match rec.policy.near_daily_cap {
                Some(c) if c > 0 => c,
                _ => return reject(REASON_CAP),
            };
            let current_near_spent = rec.rolling_near_spend(now);
            let new_near_spent = match current_near_spent.checked_add(near_amount) {
                Some(val) => val,
                None => return reject(REASON_CAP),
            };
            if new_near_spent > near_cap {
                return reject(REASON_CAP);
            }
        }

        // Check 7: RECIPIENT_NOT_ALLOWED
        if let Some(ref r) = recipient {
            if !rec.policy.recipients.iter().any(|x| x == r) {
                return reject(REASON_RECIPIENT);
            }
        }
        if let GuardAction::IntentTransfer { ref recipient, .. } = action {
            if !rec.policy.intent_recipients.iter().any(|x| x == recipient) {
                return reject(REASON_INTENT_RECIPIENT);
            }
        }

        // Check 8: INSUFFICIENT_VAULT_BALANCE
        let reduces_token_vault = token_amount > 0 && (
            matches!(action, GuardAction::Transfer { .. }) || matches!(action, GuardAction::IntentTransfer { .. })
        );
        if reduces_token_vault && token_amount > rec.vault_balance {
            return reject(REASON_INSUFFICIENT_VAULT);
        }
        if is_near_movement {
            if contract_call_deposit > SAFE_STORAGE_DEPOSIT_CEILING {
                return reject(REASON_CAP);
            }
            if near_amount > rec.near_vault_balance {
                return reject(REASON_INSUFFICIENT_VAULT);
            }
        }

        // Check 9: Net Drawdown Breaker check: calculate projected balance against high-water mark floor
        if let Some(max_bps) = rec.policy.max_drawdown_bps {
            if reduces_token_vault {
                let current_bal = rec.vault_balance;
                let peak = rec.high_water_mark.0;
                let projected_balance = current_bal.saturating_sub(token_amount);
                let floor = compute_drawdown_floor(peak, max_bps);
                if projected_balance < floor {
                    return reject(REASON_DRAWDOWN_EXCEEDED);
                }
            }
            if is_near_movement && rec.near_high_water_mark.0 > 0 {
                let current_near = rec.near_vault_balance;
                let peak_near = rec.near_high_water_mark.0;
                let projected_near = current_near.saturating_sub(near_amount);
                let floor_near = compute_drawdown_floor(peak_near, max_bps);
                if projected_near < floor_near {
                    return reject(REASON_DRAWDOWN_EXCEEDED);
                }
            }
        }

        // Check 10: Timelock quarantine vs PENDING_QUEUE_FULL
        let is_unconfirmed = match &recipient {
            Some(r) => rec.unconfirmed_recipients.contains(r),
            None => false,
        };
        let is_high_value_token = rec.policy.high_value_threshold > 0 && token_amount >= rec.policy.high_value_threshold;
        let is_high_value_near = rec.policy.near_high_value_threshold.map_or(false, |t| t > 0 && near_amount >= t);

        if is_high_value_token || is_high_value_near || is_unconfirmed {
            if rec.pending_actions.len() >= MAX_PENDING_ACTIONS {
                return reject(REASON_PENDING_QUEUE_FULL);
            }
            return PreflightResult {
                status: "PENDING".to_string(),
                reason: None,
                delay_seconds: Some(rec.policy.high_value_delay_seconds),
                budget: Some(budget),
                velocity_used,
                velocity_max,
                velocity_remaining,
                vault_balance,
                near_vault_balance,
                near_high_water_mark,
            };
        }

        // ALLOWED
        PreflightResult {
            status: "ALLOWED".to_string(),
            reason: None,
            delay_seconds: None,
            budget: Some(budget),
            velocity_used,
            velocity_max,
            velocity_remaining,
            vault_balance,
            near_vault_balance,
            near_high_water_mark,
        }
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
                // First-use quarantine: any recipient present in the new policy
                // but absent from the old one is flagged unconfirmed.
                for r in &staged.policy.recipients {
                    if !rec.policy.recipients.contains(r) && !rec.unconfirmed_recipients.contains(r) {
                        rec.unconfirmed_recipients.push(r.clone());
                    }
                }
                rec.unconfirmed_recipients.retain(|r| staged.policy.recipients.contains(r));
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

    /// Private callback: invoked after the external cross-contract call completes.
    /// If the external transfer or call failed, refunds the agent's vault balance
    /// and rolls back spent_in_window in the original bucket so funds are never permanently trapped.
    #[private]
    pub fn on_action_resolved(
        &mut self,
        agent: AccountId,
        amount: U128,
        is_transfer: bool,
        is_near: Option<bool>,
        refund_spend: Option<bool>,
        spend_bucket: Option<u64>,
    ) -> bool {
        let success = is_promise_success();
        if !success {
            if let Some(mut rec) = self.agents.get(&agent).cloned() {
                if is_transfer {
                    if is_near.unwrap_or(false) {
                        rec.near_vault_balance = rec.near_vault_balance.saturating_add(amount.0);
                        if rec.near_vault_balance > rec.near_high_water_mark.0 {
                            rec.near_high_water_mark = U128(rec.near_vault_balance);
                        }
                    } else {
                        rec.vault_balance = rec.vault_balance.saturating_add(amount.0);
                        if rec.vault_balance > rec.high_water_mark.0 {
                            rec.high_water_mark = U128(rec.vault_balance);
                        }
                    }
                }
                if refund_spend.unwrap_or(true) {
                    let now = env::block_timestamp();
                    let orig_bucket = spend_bucket.unwrap_or(now / HOUR_NS);
                    if is_near.unwrap_or(false) {
                        rec.refund_near_spend(now, orig_bucket, amount.0);
                    } else {
                        rec.refund_spend(now, orig_bucket, amount.0);
                    }
                }
                self.agents.insert(agent.clone(), rec);
                emit(&format!(
                    "{{\"event\":\"ACTION_FAILED\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
                    agent, amount.0
                ));
            }
            return false;
        }
        true
    }

    /// Private callback: invoked after owner withdraw cross-contract call completes.
    /// If the token transfer failed, restores the agent's vault balance so funds are not trapped.
    #[private]
    pub fn on_withdraw_resolved(
        &mut self,
        agent: AccountId,
        amount: U128,
    ) -> bool {
        let success = is_promise_success();
        if !success {
            if let Some(mut rec) = self.agents.get(&agent).cloned() {
                rec.vault_balance = rec.vault_balance.saturating_add(amount.0);
                if rec.vault_balance > rec.high_water_mark.0 {
                    rec.high_water_mark = U128(rec.vault_balance);
                }
                self.agents.insert(agent.clone(), rec);
                emit(&format!(
                    "{{\"event\":\"WITHDRAW_FAILED\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
                    agent, amount.0
                ));
            }
            return false;
        }
        true
    }

    /// Private callback: invoked after owner withdraw_near transfer completes.
    /// If the transfer failed, restores the agent's near_vault_balance so funds are not trapped.
    #[private]
    pub fn on_withdraw_near_resolved(
        &mut self,
        agent: AccountId,
        amount: U128,
    ) -> bool {
        let success = is_promise_success();
        if !success {
            if let Some(mut rec) = self.agents.get(&agent).cloned() {
                rec.near_vault_balance = rec.near_vault_balance.saturating_add(amount.0);
                self.agents.insert(agent.clone(), rec);
                emit(&format!(
                    "{{\"event\":\"WITHDRAW_NEAR_FAILED\",\"agent\":\"{}\",\"amount\":\"{}\"}}",
                    agent, amount.0
                ));
            }
            return false;
        }
        true
    }

    fn dispatch_action(
        &self,
        caller: &AccountId,
        action: &GuardAction,
        target: &AccountId,
        method: &String,
        args_bytes: &[u8],
        amount: u128,
        is_transfer: bool,
        spend_bucket: u64,
    ) {
        let callback_gas = Gas::from_tgas(10);
        let available_gas = env::prepaid_gas().saturating_sub(env::used_gas());
        // In unit tests, multiple execute calls share a single 300 TGas VMContext budget without reset.
        // Forward 20 TGas in tests so sequential test actions fit within mock VM budget.
        // In onchain execution, dynamically forward available gas reserving callback and 15 TGas receipt buffer.
        let call_gas = if cfg!(test) {
            Gas::from_tgas(20)
        } else {
            let needed_callback = if amount > 0 { callback_gas } else { Gas::from_tgas(0) };
            available_gas
                .saturating_sub(needed_callback)
                .saturating_sub(Gas::from_tgas(15))
        };

        match action {
            GuardAction::NearTransfer { to, amount: near_amt } => {
                let promise = Promise::new(to.clone()).transfer(NearToken::from_yoctonear(near_amt.0));
                if near_amt.0 > 0 {
                    let _ = promise.then(
                        Self::ext(env::current_account_id())
                            .with_static_gas(callback_gas)
                            .on_action_resolved(caller.clone(), *near_amt, true, Some(true), Some(true), Some(spend_bucket)),
                    );
                }
            }
            GuardAction::ContractCall { deposit, .. } => {
                let attached_deposit = deposit
                    .map(|d| NearToken::from_yoctonear(d.0))
                    .unwrap_or_else(|| NearToken::from_yoctonear(0));
                let promise = Promise::new(target.clone()).function_call(
                    method.clone(),
                    args_bytes.to_vec(),
                    attached_deposit,
                    call_gas,
                );
                let dep_val = deposit.map(|d| d.0).unwrap_or(0);
                if dep_val > 0 {
                    let _ = promise.then(
                        Self::ext(env::current_account_id())
                            .with_static_gas(callback_gas)
                            .on_action_resolved(caller.clone(), U128(dep_val), true, Some(true), Some(true), Some(spend_bucket)),
                    );
                }
            }
            _ => {
                self.perform_action(caller, target, method, args_bytes, amount, is_transfer, spend_bucket);
            }
        }
    }

    fn perform_action(
        &self,
        caller: &AccountId,
        target: &AccountId,
        method: &String,
        args_bytes: &[u8],
        amount: u128,
        is_transfer: bool,
        spend_bucket: u64,
    ) {
        let callback_gas = Gas::from_tgas(10);
        let available_gas = env::prepaid_gas().saturating_sub(env::used_gas());
        // In unit tests, multiple execute calls share a single 300 TGas VMContext budget without reset.
        // Forward 20 TGas in tests so sequential test actions fit within mock VM budget.
        // In onchain execution, dynamically forward available gas reserving callback and 15 TGas receipt buffer.
        let call_gas = if cfg!(test) {
            Gas::from_tgas(20)
        } else {
            let needed_callback = if amount > 0 { callback_gas } else { Gas::from_tgas(0) };
            available_gas
                .saturating_sub(needed_callback)
                .saturating_sub(Gas::from_tgas(15))
        };

        let attached_deposit = if method == "ft_transfer" || method == "ft_transfer_call" {
            NearToken::from_yoctonear(1)
        } else {
            NearToken::from_yoctonear(0)
        };
        let promise = Promise::new(target.clone()).function_call(
            method.clone(),
            args_bytes.to_vec(),
            attached_deposit,
            call_gas,
        );

        if amount > 0 {
            let _ = promise.then(
                Self::ext(env::current_account_id())
                    .with_static_gas(callback_gas)
                    .on_action_resolved(caller.clone(), U128(amount), is_transfer, Some(false), Some(true), Some(spend_bucket)),
            );
        }
    }
}

fn emit(line: &str) {
    env::log_str(&format!("EVENT_JSON:{}", line));
}


#[cfg(test)]
mod tests;
