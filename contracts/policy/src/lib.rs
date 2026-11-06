// Policy contract for ScopeGuard on NEAR.
// Implements protocol-restricted agent passkey enforcement with seven ordered
// policy checks, automated circuit breaker, timelocked high-value actions,
// and real NEP-141 token vault custody with strongly typed actions.
//
// Written in near-sdk 5 idiom (#[near] macros, store collections).
// Compile-checked with: cargo check --target wasm32-unknown-unknown

use near_sdk::borsh::BorshDeserialize;
use near_sdk::json_types::U128;
use near_sdk::serde_json;
use near_sdk::store::LookupMap;
use near_sdk::{
    env, is_promise_success, near, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue, Timestamp,
};
use std::collections::HashMap;

pub const REASON_NOT_AGENT: &str = "NOT_AGENT";
pub const REASON_PAUSED: &str = "PAUSED";
pub const REASON_LEASE_EXPIRED: &str = "LEASE_EXPIRED";
pub const REASON_CANARY_TRIPPED: &str = "CANARY_TRIPPED";
pub const REASON_OVER_VELOCITY: &str = "OVER_VELOCITY_CAP";
pub const REASON_TARGET: &str = "TARGET_NOT_ALLOWED";
pub const REASON_METHOD: &str = "METHOD_NOT_ALLOWED";
pub const REASON_CAP: &str = "OVER_DAILY_CAP";
pub const REASON_INSUFFICIENT_VAULT: &str = "INSUFFICIENT_VAULT_BALANCE";
pub const REASON_DRAWDOWN_EXCEEDED: &str = "DRAWDOWN_EXCEEDED";
pub const REASON_RECIPIENT: &str = "RECIPIENT_NOT_ALLOWED";
pub const REASON_INTENT_RECIPIENT: &str = "INTENT_RECIPIENT_NOT_ALLOWED";
pub const REASON_PENDING_QUEUE_FULL: &str = "PENDING_QUEUE_FULL";
pub const SAFE_STORAGE_DEPOSIT_CEILING: u128 = 2_000_000_000_000_000_000_000_000; // 2 NEAR in yoctoNEAR

pub const VALUE_MOVING_DENYLIST: &[&str] = &[
    "ft_transfer",
    "ft_transfer_call",
    "nft_transfer",
    "nft_transfer_call",
    "mt_transfer",
    "mt_transfer_call",
    "storage_unregister",
    "storage_withdraw",
    "near_withdraw",
    "withdraw",
];

#[allow(dead_code)]
const DAY_NS: u64 = 24 * 60 * 60 * 1_000_000_000;
const HOUR_NS: u64 = 3_600 * 1_000_000_000;
const TEN_MIN_NS: u64 = 10 * 60 * 1_000_000_000;
const MAX_REJECT_TIMES_KEPT: usize = 64;
const MAX_PENDING_ACTIONS: usize = 8;

/// Accepts both `500` and `"500"` for u128 policy fields.
///
/// The web handoff console and the AI drafter have historically emitted numeric
/// strings because JSON loses precision above 2^53. The contract stores a plain
/// u128 and the canonical onchain view emits a JSON number, so both shapes are
/// accepted here to keep every client artifact registerable.
fn de_u128_flexible<'de, D>(deserializer: D) -> Result<u128, D::Error>
where
    D: near_sdk::serde::Deserializer<'de>,
{
    use near_sdk::serde::de::{self, Visitor};

    struct FlexibleU128;

    impl<'de> Visitor<'de> for FlexibleU128 {
        type Value = u128;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a non-negative integer or a numeric string")
        }

        fn visit_u64<E: de::Error>(self, value: u64) -> Result<u128, E> {
            Ok(value as u128)
        }

        fn visit_u128<E: de::Error>(self, value: u128) -> Result<u128, E> {
            Ok(value)
        }

        fn visit_i64<E: de::Error>(self, value: i64) -> Result<u128, E> {
            if value < 0 {
                Err(E::custom("expected a non-negative integer"))
            } else {
                Ok(value as u128)
            }
        }

        fn visit_str<E: de::Error>(self, value: &str) -> Result<u128, E> {
            value
                .trim()
                .parse::<u128>()
                .map_err(|_| E::custom("invalid number"))
        }
    }

    deserializer.deserialize_any(FlexibleU128)
}

/// Accepts null, omitted, numeric integers (e.g. 1700000000000000000), or numeric strings
/// (e.g. "1700000000000000000") for lease expiration timestamps to prevent precision loss.
fn de_u64_opt_flexible<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
where
    D: near_sdk::serde::Deserializer<'de>,
{
    use near_sdk::serde::de::{self, Visitor};

    struct FlexibleOptU64;

    impl<'de> Visitor<'de> for FlexibleOptU64 {
        type Value = Option<u64>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("null, a non-negative integer or a numeric string")
        }

        fn visit_none<E: de::Error>(self) -> Result<Option<u64>, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Option<u64>, E> {
            Ok(None)
        }

        fn visit_some<D: near_sdk::serde::Deserializer<'de>>(
            self,
            deserializer: D,
        ) -> Result<Option<u64>, D::Error> {
            deserializer.deserialize_any(FlexibleOptU64)
        }

        fn visit_u64<E: de::Error>(self, value: u64) -> Result<Option<u64>, E> {
            Ok(Some(value))
        }

        fn visit_u128<E: de::Error>(self, value: u128) -> Result<Option<u64>, E> {
            u64::try_from(value).map(Some).map_err(|_| E::custom("u64 overflow"))
        }

        fn visit_i64<E: de::Error>(self, value: i64) -> Result<Option<u64>, E> {
            if value < 0 {
                Err(E::custom("expected a non-negative integer"))
            } else {
                Ok(Some(value as u64))
            }
        }

        fn visit_str<E: de::Error>(self, value: &str) -> Result<Option<u64>, E> {
            let s = value.trim();
            if s.is_empty() || s == "null" {
                Ok(None)
            } else {
                s.parse::<u64>().map(Some).map_err(|_| E::custom("invalid number"))
            }
        }
    }

    deserializer.deserialize_any(FlexibleOptU64)
}

/// Accepts null, omitted, numeric integers (e.g. 500), or numeric strings (e.g. "500")
/// for optional u128 policy fields like native NEAR caps and thresholds.
fn de_u128_opt_flexible<'de, D>(deserializer: D) -> Result<Option<u128>, D::Error>
where
    D: near_sdk::serde::Deserializer<'de>,
{
    use near_sdk::serde::de::{self, Visitor};

    struct FlexibleOptU128;

    impl<'de> Visitor<'de> for FlexibleOptU128 {
        type Value = Option<u128>;

        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("null, a non-negative integer or a numeric string")
        }

        fn visit_none<E: de::Error>(self) -> Result<Option<u128>, E> {
            Ok(None)
        }

        fn visit_unit<E: de::Error>(self) -> Result<Option<u128>, E> {
            Ok(None)
        }

        fn visit_some<D: near_sdk::serde::Deserializer<'de>>(
            self,
            deserializer: D,
        ) -> Result<Option<u128>, D::Error> {
            deserializer.deserialize_any(FlexibleOptU128)
        }

        fn visit_u64<E: de::Error>(self, value: u64) -> Result<Option<u128>, E> {
            Ok(Some(value as u128))
        }

        fn visit_u128<E: de::Error>(self, value: u128) -> Result<Option<u128>, E> {
            Ok(Some(value))
        }

        fn visit_i64<E: de::Error>(self, value: i64) -> Result<Option<u128>, E> {
            if value < 0 {
                Err(E::custom("expected a non-negative integer"))
            } else {
                Ok(Some(value as u128))
            }
        }

        fn visit_str<E: de::Error>(self, value: &str) -> Result<Option<u128>, E> {
            let s = value.trim();
            if s.is_empty() || s == "null" {
                Ok(None)
            } else {
                s.parse::<u128>().map(Some).map_err(|_| E::custom("invalid number"))
            }
        }
    }

    deserializer.deserialize_any(FlexibleOptU128)
}

/// Computes the drawdown floor: hwm * (10000 - max_drawdown_bps) / 10000.
/// Avoids arithmetic overflow and premature saturation for large u128 values.
pub(crate) fn compute_drawdown_floor(hwm: u128, max_drawdown_bps: u16) -> u128 {
    let mult = 10000u128.saturating_sub(max_drawdown_bps as u128);
    let q = hwm / 10000;
    let r = hwm % 10000;
    q.saturating_mul(mult).saturating_add((r * mult) / 10000)
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Policy {
    /// single registered NEP-141 token custodies by the vault in v1
    pub token: AccountId,
    /// contract id -> method names the agent may call on it
    pub targets: HashMap<AccountId, Vec<String>>,
    /// max total value movable per 24h window, in vault token units
    #[serde(deserialize_with = "de_u128_flexible")]
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
    #[serde(deserialize_with = "de_u128_flexible")]
    pub high_value_threshold: u128,
    /// delay in seconds for high-value actions to sit in pending queue
    pub high_value_delay_seconds: u64,
    /// delay in seconds for owner set_policy change to become effective
    pub policy_change_delay_seconds: u64,
    /// optional maximum drawdown in basis points (e.g. 1500 = 15.00%)
    #[serde(default)]
    pub max_drawdown_bps: Option<u16>,
    /// optional lease expiration timestamp in nanoseconds
    #[serde(default, deserialize_with = "de_u64_opt_flexible")]
    pub lease_expires_at: Option<u64>,
    /// allowlisted cross-chain destination addresses (e.g. EVM 0x... or Solana)
    #[serde(default)]
    pub intent_recipients: Vec<String>,
    /// decoy honeypot methods that trigger immediate auto-pause
    #[serde(default)]
    pub canary_methods: Vec<String>,
    /// optional native NEAR rolling daily budget, in yoctoNEAR (default disabled, fail closed)
    #[serde(default, deserialize_with = "de_u128_opt_flexible")]
    pub near_daily_cap: Option<u128>,
    /// optional timelock threshold for native NEAR movement, in yoctoNEAR
    #[serde(default, deserialize_with = "de_u128_opt_flexible")]
    pub near_high_value_threshold: Option<u128>,
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
        #[serde(default)]
        deposit: Option<U128>,
    },
    IntentTransfer {
        deposit_address: AccountId,
        amount: U128,
        destination_asset: String,
        recipient: String,
    },
    NearTransfer {
        to: AccountId,
        amount: U128,
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
                deposit: _,
            } => (target.clone(), method.clone(), args.as_bytes().to_vec(), 0, None),
            GuardAction::IntentTransfer {
                deposit_address,
                amount,
                destination_asset,
                recipient,
            } => {
                let call_args = serde_json::to_vec(&serde_json::json!({
                    "recipient": recipient,
                    "destination_asset": destination_asset,
                    "amount": amount
                }))
                .unwrap_or_default();
                (
                    deposit_address.clone(),
                    "execute_intent".to_string(),
                    call_args,
                    amount.0,
                    None,
                )
            }
            GuardAction::NearTransfer { to, amount } => (
                to.clone(),
                "near_transfer".to_string(),
                Vec::new(),
                amount.0,
                Some(to.clone()),
            ),
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

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SpendBucket {
    pub bucket: u64,
    pub amount: u128,
}

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
    /// recipients added via staged policy that have not yet had a settled transfer
    pub unconfirmed_recipients: Vec<AccountId>,
    /// peak vault balance for Net Drawdown Breaker calculations
    pub high_water_mark: U128,
    /// real native NEAR vault balance custody by the Guard
    pub near_vault_balance: u128,
    /// peak native NEAR vault balance for Net Drawdown Breaker calculations
    pub near_high_water_mark: U128,
    /// 1-hour rolling spend buckets for NEP-141 token
    pub spend_buckets: Vec<SpendBucket>,
    /// 1-hour rolling spend buckets for native NEAR
    pub near_spend_buckets: Vec<SpendBucket>,
}

impl near_sdk::borsh::BorshSerialize for AgentRecord {
    fn serialize<W: std::io::Write>(&self, writer: &mut W) -> std::io::Result<()> {
        self.owner.serialize(writer)?;
        self.policy.serialize(writer)?;
        self.paused.serialize(writer)?;
        self.day_window_start.serialize(writer)?;
        self.spent_in_window.serialize(writer)?;
        self.velocity_window_start.serialize(writer)?;
        self.actions_in_window.serialize(writer)?;
        self.reject_times.serialize(writer)?;
        self.pending_actions.serialize(writer)?;
        self.staged_policy.serialize(writer)?;
        self.next_pending_id.serialize(writer)?;
        self.vault_balance.serialize(writer)?;
        self.unconfirmed_recipients.serialize(writer)?;
        self.high_water_mark.serialize(writer)?;
        self.near_vault_balance.serialize(writer)?;
        self.near_high_water_mark.serialize(writer)?;
        self.spend_buckets.serialize(writer)?;
        self.near_spend_buckets.serialize(writer)?;
        Ok(())
    }
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct OldPolicyV3 {
    pub token: AccountId,
    pub targets: HashMap<AccountId, Vec<String>>,
    pub daily_cap: u128,
    pub recipients: Vec<AccountId>,
    pub max_actions_per_10min: u32,
    pub auto_pause_rejects: u32,
    pub auto_pause_window_minutes: u64,
    pub high_value_threshold: u128,
    pub high_value_delay_seconds: u64,
    pub policy_change_delay_seconds: u64,
    pub max_drawdown_bps: Option<u16>,
    pub lease_expires_at: Option<u64>,
    pub intent_recipients: Vec<String>,
    pub canary_methods: Vec<String>,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct OldAgentRecordV3 {
    pub owner: AccountId,
    pub policy: OldPolicyV3,
    pub paused: bool,
    pub day_window_start: Timestamp,
    pub spent_in_window: u128,
    pub velocity_window_start: Timestamp,
    pub actions_in_window: u32,
    pub reject_times: Vec<Timestamp>,
    pub pending_actions: Vec<PendingAction>,
    pub staged_policy: Option<StagedPolicy>,
    pub next_pending_id: u64,
    pub vault_balance: u128,
    pub unconfirmed_recipients: Vec<AccountId>,
    pub high_water_mark: U128,
    pub near_vault_balance: u128,
}

impl near_sdk::borsh::BorshDeserialize for AgentRecord {
    fn deserialize_reader<R: std::io::Read>(reader: &mut R) -> std::io::Result<Self> {
        let mut raw = Vec::new();
        reader.read_to_end(&mut raw)?;
        if let Ok(old3) = OldAgentRecordV3::try_from_slice(&raw) {
            return Ok(Self {
                owner: old3.owner,
                policy: Policy {
                    token: old3.policy.token,
                    targets: old3.policy.targets,
                    daily_cap: old3.policy.daily_cap,
                    recipients: old3.policy.recipients,
                    max_actions_per_10min: old3.policy.max_actions_per_10min,
                    auto_pause_rejects: old3.policy.auto_pause_rejects,
                    auto_pause_window_minutes: old3.policy.auto_pause_window_minutes,
                    high_value_threshold: old3.policy.high_value_threshold,
                    high_value_delay_seconds: old3.policy.high_value_delay_seconds,
                    policy_change_delay_seconds: old3.policy.policy_change_delay_seconds,
                    max_drawdown_bps: old3.policy.max_drawdown_bps,
                    lease_expires_at: old3.policy.lease_expires_at,
                    intent_recipients: old3.policy.intent_recipients,
                    canary_methods: old3.policy.canary_methods,
                    near_daily_cap: None,
                    near_high_value_threshold: None,
                },
                paused: old3.paused,
                day_window_start: old3.day_window_start,
                spent_in_window: old3.spent_in_window,
                velocity_window_start: old3.velocity_window_start,
                actions_in_window: old3.actions_in_window,
                reject_times: old3.reject_times,
                pending_actions: old3.pending_actions,
                staged_policy: old3.staged_policy,
                next_pending_id: old3.next_pending_id,
                vault_balance: old3.vault_balance,
                unconfirmed_recipients: old3.unconfirmed_recipients,
                high_water_mark: old3.high_water_mark,
                near_vault_balance: old3.near_vault_balance,
                near_high_water_mark: U128(old3.near_vault_balance),
                spend_buckets: if old3.spent_in_window > 0 {
                    vec![SpendBucket { bucket: old3.day_window_start / HOUR_NS, amount: old3.spent_in_window }]
                } else {
                    Vec::new()
                },
                near_spend_buckets: Vec::new(),
            });
        }
        let mut cur = std::io::Cursor::new(raw);
        let owner = AccountId::deserialize_reader(&mut cur)?;
        let policy = Policy::deserialize_reader(&mut cur)?;
        let paused = bool::deserialize_reader(&mut cur)?;
        let day_window_start = Timestamp::deserialize_reader(&mut cur)?;
        let spent_in_window = u128::deserialize_reader(&mut cur)?;
        let velocity_window_start = Timestamp::deserialize_reader(&mut cur)?;
        let actions_in_window = u32::deserialize_reader(&mut cur)?;
        let reject_times = Vec::<Timestamp>::deserialize_reader(&mut cur)?;
        let pending_actions = Vec::<PendingAction>::deserialize_reader(&mut cur)?;
        let staged_policy = Option::<StagedPolicy>::deserialize_reader(&mut cur)?;
        let next_pending_id = u64::deserialize_reader(&mut cur)?;
        let vault_balance = u128::deserialize_reader(&mut cur)?;
        let unconfirmed_recipients = Vec::<AccountId>::deserialize_reader(&mut cur)?;
        let high_water_mark = U128::deserialize_reader(&mut cur)?;
        let near_vault_balance = u128::deserialize_reader(&mut cur)?;
        let near_high_water_mark = U128::deserialize_reader(&mut cur).unwrap_or(U128(near_vault_balance));
        let spend_buckets = Vec::<SpendBucket>::deserialize_reader(&mut cur).unwrap_or_else(|_| {
            if spent_in_window > 0 {
                vec![SpendBucket { bucket: day_window_start / HOUR_NS, amount: spent_in_window }]
            } else {
                Vec::new()
            }
        });
        let near_spend_buckets = Vec::<SpendBucket>::deserialize_reader(&mut cur).unwrap_or_default();
        Ok(Self {
            owner,
            policy,
            paused,
            day_window_start,
            spent_in_window,
            velocity_window_start,
            actions_in_window,
            reject_times,
            pending_actions,
            staged_policy,
            next_pending_id,
            vault_balance,
            unconfirmed_recipients,
            high_water_mark,
            near_vault_balance,
            near_high_water_mark,
            spend_buckets,
            near_spend_buckets,
        })
    }
}

impl AgentRecord {
    pub fn rolling_spend(&self, now: Timestamp) -> u128 {
        let current_bucket = now / HOUR_NS;
        self.spend_buckets
            .iter()
            .filter(|b| current_bucket.saturating_sub(b.bucket) <= 24)
            .fold(0u128, |acc, b| acc.saturating_add(b.amount))
    }

    pub fn rolling_near_spend(&self, now: Timestamp) -> u128 {
        let current_bucket = now / HOUR_NS;
        self.near_spend_buckets
            .iter()
            .filter(|b| current_bucket.saturating_sub(b.bucket) <= 24)
            .fold(0u128, |acc, b| acc.saturating_add(b.amount))
    }

    pub fn record_spend(&mut self, now: Timestamp, amount: u128) {
        let current_bucket = now / HOUR_NS;
        self.spend_buckets.retain(|b| current_bucket.saturating_sub(b.bucket) <= 24);
        if let Some(b) = self.spend_buckets.iter_mut().find(|b| b.bucket == current_bucket) {
            b.amount = b.amount.saturating_add(amount);
        } else {
            self.spend_buckets.push(SpendBucket { bucket: current_bucket, amount });
        }
        self.spent_in_window = self.rolling_spend(now);
    }

    pub fn record_near_spend(&mut self, now: Timestamp, amount: u128) {
        let current_bucket = now / HOUR_NS;
        self.near_spend_buckets.retain(|b| current_bucket.saturating_sub(b.bucket) <= 24);
        if let Some(b) = self.near_spend_buckets.iter_mut().find(|b| b.bucket == current_bucket) {
            b.amount = b.amount.saturating_add(amount);
        } else {
            self.near_spend_buckets.push(SpendBucket { bucket: current_bucket, amount });
        }
    }

    pub fn refund_spend(&mut self, now: Timestamp, original_bucket: u64, amount: u128) {
        let current_bucket = now / HOUR_NS;
        if current_bucket.saturating_sub(original_bucket) <= 24 {
            if let Some(b) = self.spend_buckets.iter_mut().find(|b| b.bucket == original_bucket) {
                b.amount = b.amount.saturating_sub(amount);
            }
        }
        self.spend_buckets.retain(|b| current_bucket.saturating_sub(b.bucket) <= 24);
        self.spent_in_window = self.rolling_spend(now);
    }

    pub fn refund_near_spend(&mut self, now: Timestamp, original_bucket: u64, amount: u128) {
        let current_bucket = now / HOUR_NS;
        if current_bucket.saturating_sub(original_bucket) <= 24 {
            if let Some(b) = self.near_spend_buckets.iter_mut().find(|b| b.bucket == original_bucket) {
                b.amount = b.amount.saturating_sub(amount);
            }
        }
        self.near_spend_buckets.retain(|b| current_bucket.saturating_sub(b.bucket) <= 24);
    }
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreflightResult {
    pub status: String, // "ALLOWED", "PENDING", "REJECTED"
    pub reason: Option<String>,
    pub delay_seconds: Option<u64>,
    pub budget: Option<BudgetView>,
    pub velocity_used: u32,
    pub velocity_max: u32,
    pub velocity_remaining: u32,
    pub vault_balance: U128,
    #[serde(default)]
    pub near_vault_balance: Option<U128>,
    #[serde(default)]
    pub near_high_water_mark: Option<U128>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Outcome {
    pub status: String, // "ALLOWED", "REJECTED", "PENDING", "SETTLED"
    pub reason: Option<String>,
    pub pending_id: Option<u64>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BudgetView {
    pub cap: U128,
    pub spent: U128,
    pub remaining: U128,
    pub actions_in_window: u32,
    pub paused: bool,
    pub vault_balance: U128,
    /// true once the owner has permanently revoked this agent's allowlist
    pub revoked: bool,
    pub high_water_mark: U128,
    pub max_drawdown_bps: Option<u16>,
    #[serde(default)]
    pub near_vault_balance: Option<U128>,
    #[serde(default)]
    pub near_high_water_mark: Option<U128>,
    #[serde(default)]
    pub near_cap: Option<U128>,
    #[serde(default)]
    pub near_spent: Option<U128>,
    #[serde(default)]
    pub near_remaining: Option<U128>,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct OldPolicy {
    pub token: AccountId,
    pub targets: HashMap<AccountId, Vec<String>>,
    pub daily_cap: u128,
    pub recipients: Vec<AccountId>,
    pub max_actions_per_10min: u32,
    pub auto_pause_rejects: u32,
    pub auto_pause_window_minutes: u64,
    pub high_value_threshold: u128,
    pub high_value_delay_seconds: u64,
    pub policy_change_delay_seconds: u64,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct OldAgentRecord {
    pub owner: AccountId,
    pub policy: OldPolicy,
    pub paused: bool,
    pub day_window_start: Timestamp,
    pub spent_in_window: u128,
    pub velocity_window_start: Timestamp,
    pub actions_in_window: u32,
    pub reject_times: Vec<Timestamp>,
    pub pending_actions: Vec<PendingAction>,
    pub staged_policy: Option<StagedPolicy>,
    pub next_pending_id: u64,
    pub vault_balance: u128,
    pub unconfirmed_recipients: Vec<AccountId>,
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
            agents: LookupMap::new(b"ag".as_slice()),
            agents_by_owner: LookupMap::new(b"ow".as_slice()),
        }
    }

    /// Migration initializer to cleanly bind upgraded contract state
    #[init(ignore_state)]
    pub fn clean_init() -> Self {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Unauthorized: self only"
        );
        Self::new()
    }

    /// Alias for contract migration
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Unauthorized: self only"
        );
        Self::new()
    }

    /// Upgrades agent records from v0.2.0 (pre-drawdown/native-vault) to v0.3.0.
    /// Restricted to self (contract account) only.
    pub fn upgrade_v3(&mut self, agent_accounts: Vec<AccountId>) {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "Unauthorized: self only"
        );
        for agent in agent_accounts {
            let mut storage_key = b"ag".to_vec();
            near_sdk::borsh::BorshSerialize::serialize(&agent, &mut storage_key).unwrap();
            if let Some(raw_bytes) = env::storage_read(&storage_key) {
                if let Ok(old) = OldAgentRecord::try_from_slice(&raw_bytes) {
                    let new_policy = Policy {
                        token: old.policy.token,
                        targets: old.policy.targets,
                        daily_cap: old.policy.daily_cap,
                        recipients: old.policy.recipients,
                        max_actions_per_10min: old.policy.max_actions_per_10min,
                        auto_pause_rejects: old.policy.auto_pause_rejects,
                        auto_pause_window_minutes: old.policy.auto_pause_window_minutes,
                        high_value_threshold: old.policy.high_value_threshold,
                        high_value_delay_seconds: old.policy.high_value_delay_seconds,
                        policy_change_delay_seconds: old.policy.policy_change_delay_seconds,
                        max_drawdown_bps: None,
                        lease_expires_at: None,
                        intent_recipients: Vec::new(),
                        canary_methods: Vec::new(),
                        near_daily_cap: None,
                        near_high_value_threshold: None,
                    };
                    let new_rec = AgentRecord {
                        owner: old.owner,
                        policy: new_policy,
                        paused: old.paused,
                        day_window_start: old.day_window_start,
                        spent_in_window: old.spent_in_window,
                        velocity_window_start: old.velocity_window_start,
                        actions_in_window: old.actions_in_window,
                        reject_times: old.reject_times,
                        pending_actions: old.pending_actions,
                        staged_policy: old.staged_policy,
                        next_pending_id: old.next_pending_id,
                        vault_balance: old.vault_balance,
                        unconfirmed_recipients: old.unconfirmed_recipients,
                        high_water_mark: U128(old.vault_balance),
                        near_vault_balance: 0,
                        near_high_water_mark: U128(0),
                        spend_buckets: if old.spent_in_window > 0 {
                            vec![SpendBucket { bucket: old.day_window_start / HOUR_NS, amount: old.spent_in_window }]
                        } else {
                            Vec::new()
                        },
                        near_spend_buckets: Vec::new(),
                    };
                    let new_bytes = near_sdk::borsh::to_vec(&new_rec).unwrap();
                    env::storage_write(&storage_key, &new_bytes);
                    emit(&format!(
                        "{{\"event\":\"UPGRADE_V3\",\"agent\":\"{}\"}}",
                        agent
                    ));
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
            policy.auto_pause_rejects > 0,
            "auto_pause_rejects must be greater than zero"
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
            !rec.policy.targets.is_empty(),
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
                revoked: r.policy.targets.is_empty() && r.policy.recipients.is_empty(),
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
    /// Evaluates the exact same 10 checks in the exact same order as execute.
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
            revoked: rec.policy.targets.is_empty() && rec.policy.recipients.is_empty(),
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
            token: "token.near".parse().unwrap(),
            targets,
            daily_cap: 1000,
            recipients: vec![recipient()],
            max_actions_per_10min: 3,
            auto_pause_rejects: 5,
            auto_pause_window_minutes: 10,
            high_value_threshold: 0,
            high_value_delay_seconds: 3600,
            policy_change_delay_seconds: 600,
            max_drawdown_bps: None,
            lease_expires_at: None,
            intent_recipients: Vec::new(),
            canary_methods: Vec::new(),
            near_daily_cap: Some(1000),
            near_high_value_threshold: None,
        }
    }

    fn swap_action(amount: u128) -> GuardAction {
        GuardAction::Swap {
            dex: target(),
            token_in: "token.near".parse().unwrap(),
            amount_in: U128(amount),
            min_out: U128(0),
        }
    }

    fn transfer_action(amount: u128, to: AccountId) -> GuardAction {
        GuardAction::Transfer {
            token: "token.near".parse().unwrap(),
            to,
            amount: U128(amount),
            memo: None,
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

    fn setup_fresh_contract(now: u64) -> (Contract, VMContextBuilder) {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .prepaid_gas(Gas::from_tgas(300))
            .block_timestamp(now);
        testing_env!(builder.build());
        (Contract::new(), builder)
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

        contract.execute(swap_action(10));
    }

    #[test]
    fn test_vault_deposit_and_withdraw() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Predecessor must be the policy registered token ("token.near")
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());

        let res = contract.ft_on_transfer(owner(), U128(5000), agent().to_string());
        match res {
            PromiseOrValue::Value(val) => assert_eq!(val.0, 0),
            _ => panic!("Expected Value"),
        }

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.vault_balance.0, 5000);

        // Owner withdraws 2,000 tokens
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        let _ = contract.withdraw(agent(), U128(2000));
        let budget_after = contract.get_budget(agent()).unwrap();
        assert_eq!(budget_after.vault_balance.0, 3000);
    }

    #[test]
    #[should_panic(expected = "Unauthorized token contract")]
    fn test_unauthorized_token_cannot_deposit_to_vault() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Random fake token caller tries to inflate vault
        builder.predecessor_account_id("fake_token.near".parse().unwrap());
        testing_env!(builder.build());

        let _ = contract.ft_on_transfer(owner(), U128(5000), agent().to_string());
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
    #[should_panic(expected = "wildcard method '*' is forbidden")]
    fn test_staged_wildcard_policy_rejected() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());

        let mut wild_policy = sample_policy();
        wild_policy
            .targets
            .insert("any.near".parse().unwrap(), vec!["*".to_string()]);
        contract.set_policy(agent(), wild_policy);
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

        let outcome = contract.execute(action);
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_CAP.to_string()));

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent.0, 0); // No spend recorded
    }

    #[test]
    fn test_contract_call_cannot_bypass_transfer_cap_or_recipient() {
        // Critical test: an attacker attempting to call ft_transfer via generic ContractCall
        // to evade recipient allowlist or daily cap is strictly refused with METHOD_NOT_ALLOWED.
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let bypass_action = GuardAction::ContractCall {
            target: target(),
            method: "ft_transfer".to_string(),
            args: serde_json::json!({
                "receiver_id": bad_recipient(),
                "amount": "100000"
            })
            .to_string(),
            deposit: None,
        };

        let outcome = contract.execute(bypass_action);
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_METHOD.to_string()));
    }

    #[test]
    fn test_contract_call_cannot_target_custody_token() {
        // Critical test: generic ContractCall cannot target the custody token with arbitrary methods.
        // All token movements must strictly use GuardAction::Transfer.
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let rogue_call = GuardAction::ContractCall {
            target: "token.near".parse().unwrap(),
            method: "custom_drain".to_string(),
            args: serde_json::json!({ "to": bad_recipient(), "amount": "500" }).to_string(),
            deposit: None,
        };

        let outcome = contract.execute(rogue_call);
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_TARGET.to_string()));
    }

    #[test]
    fn test_swap_does_not_falsely_debit_vault() {
        // Honest accounting test: Swaps affect daily spend cap and velocity,
        // but do not falsely decrement custodied vault balance when tokens did not leave the vault.
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Deposit 1,000 into vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(1000), agent().to_string());

        // Agent performs legit swap of 200
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let outcome = contract.execute(swap_action(200));
        assert_eq!(outcome.status, "ALLOWED");

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent.0, 200);
        assert_eq!(budget.remaining.0, 800);
        // Vault balance remains intact at 1000 (no fake debiting)
        assert_eq!(budget.vault_balance.0, 1000);

        // Real transfer of 150 DOES debit vault
        let transfer = contract.execute(transfer_action(150, recipient()));
        assert_eq!(transfer.status, "ALLOWED");
        let budget_after = contract.get_budget(agent()).unwrap();
        assert_eq!(budget_after.spent.0, 350);
        assert_eq!(budget_after.vault_balance.0, 850);
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

        let outcome = contract.execute(action);
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

        let outcome = contract.execute(action);
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_TARGET.to_string()));
    }

    #[test]
    fn test_method_not_allowed() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute(GuardAction::ContractCall {
            target: target(),
            method: "drain".to_string(),
            args: "{}".to_string(),
            deposit: None,
        });
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_METHOD.to_string()));
    }

    #[test]
    fn test_over_daily_cap() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute(swap_action(1001));
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason, Some(REASON_CAP.to_string()));
    }

    #[test]
    fn test_recipient_not_allowed() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute(transfer_action(100, bad_recipient()));
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
            let o = contract.execute(swap_action(10));
            assert_eq!(o.status, "ALLOWED");
        }

        let o = contract.execute(GuardAction::ContractCall {
            target: bad_target(),
            method: "drain".to_string(),
            args: "{}".to_string(),
            deposit: None,
        });
        assert_eq!(o.status, "REJECTED");
        assert_eq!(o.reason, Some(REASON_OVER_VELOCITY.to_string()));
    }

    #[test]
    fn test_check_order_paused_before_contract_call_method_check() {
        let (mut contract, mut builder) = setup_contract(100);

        // Pause agent from owner account
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.pause(agent());

        // Agent attempts rogue ContractCall to ft_transfer
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let rogue_call = GuardAction::ContractCall {
            target: target(),
            method: "ft_transfer".to_string(),
            args: "{}".to_string(),
            deposit: None,
        };

        // Check 2 (PAUSED) must fire before Check 5 (METHOD_NOT_ALLOWED)
        let out = contract.execute(rogue_call);
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason.as_deref(), Some(REASON_PAUSED));
    }

    #[test]
    fn test_auto_pause_circuit_breaker() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        for i in 0..5 {
            let o = contract.execute(GuardAction::Swap {
                dex: bad_target(),
                token_in: "token.near".parse().unwrap(),
                amount_in: U128(10),
                min_out: U128(0),
            });
            assert_eq!(o.status, "REJECTED");
            assert_eq!(o.reason, Some(REASON_TARGET.to_string()));
            let budget = contract.get_budget(agent()).unwrap();
            if i == 4 {
                assert!(budget.paused);
            } else {
                assert!(!budget.paused);
            }
        }

        let o = contract.execute(swap_action(10));
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
        let o = contract.execute(swap_action(10));
        assert_eq!(o.status, "REJECTED");
        assert_eq!(o.reason, Some(REASON_PAUSED.to_string()));

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.unpause(agent());

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o2 = contract.execute(swap_action(10));
        assert_eq!(o2.status, "ALLOWED");
    }

    #[test]
    fn test_lazy_window_resets() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let o1 = contract.execute(swap_action(500));
        assert_eq!(o1.status, "ALLOWED");

        let budget1 = contract.get_budget(agent()).unwrap();
        assert_eq!(budget1.spent.0, 500);

        let day_later = now + 25 * HOUR_NS + 1;
        builder.block_timestamp(day_later);
        testing_env!(builder.build());

        let o2 = contract.execute(swap_action(600));
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

        let o = contract.execute(swap_action(300));
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
            c.settle_pending(Some(agent()), None, id);
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

        let o = contract.execute(swap_action(300));
        let id = o.pending_id.unwrap();

        // Fast forward past delay
        let future_ns = (now_sec + 3601) * 1_000_000_000;
        builder
            .predecessor_account_id(owner())
            .block_timestamp(future_ns);
        testing_env!(builder.build());

        // Owner settles
        let settled = contract.settle_pending(Some(agent()), None, id);
        assert_eq!(settled.status, "SETTLED");

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent.0, 300);
    }

    #[test]
    fn test_owner_can_settle_even_when_velocity_limit_reached() {
        let now_sec = 1_000;
        let now_ns = now_sec * 1_000_000_000;

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        let mut policy = timelocked_policy(250);
        policy.high_value_delay_seconds = 10; // short 10s delay within same 10min window
        contract.register_agent(agent(), policy);

        // 1. Agent queues high-value action (enters timelock, velocity = 1)
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o = contract.execute(swap_action(300));
        let id = o.pending_id.unwrap();

        // 2. Agent consumes remaining 2 actions in 10-minute window (velocity reaches cap of 3)
        for _ in 0..2 {
            let res = contract.execute(swap_action(10));
            assert_eq!(res.status, "ALLOWED");
        }

        // 3. Agent attempts 4th action -> blocked by velocity cap (3 / 3 reached)
        let blocked = contract.execute(swap_action(10));
        assert_eq!(blocked.status, "REJECTED");
        assert_eq!(blocked.reason.as_deref(), Some(REASON_OVER_VELOCITY));

        // 4. Advance 15 seconds (still in same 10-minute window, but past 10s timelock)
        builder
            .predecessor_account_id(owner())
            .block_timestamp(now_ns + 15 * 1_000_000_000);
        testing_env!(builder.build());

        // 5. Owner settles pending action -> must succeed, owner is not locked out by agent burst
        let settled = contract.settle_pending(Some(agent()), None, id);
        assert_eq!(settled.status, "SETTLED");

        // 6. Verify velocity count was not double incremented (still 3)
        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.actions_in_window, 3);
        assert_eq!(budget.spent.0, 320);
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

        let o = contract.execute(swap_action(300));
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
        let o1 = contract.execute(swap_action(99));
        assert_eq!(o1.status, "ALLOWED");

        // At threshold (100) -> PENDING in timelock
        let o2 = contract.execute(swap_action(100));
        assert_eq!(o2.status, "PENDING");
    }

    #[test]
    fn test_transfer_exceeding_vault_balance_rejected() {
        let (mut contract, mut builder) = setup_contract(100);

        // Agent has 0 vault balance initially
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let out = contract.execute(transfer_action(50, recipient()));
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason.as_deref(), Some(REASON_INSUFFICIENT_VAULT));

        // Deposit 100 into agent's vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(100), agent().to_string());

        // Now attempt 50 -> should succeed
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let out_ok = contract.execute(transfer_action(50, recipient()));
        assert_eq!(out_ok.status, "ALLOWED");
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance, U128(50));

        // Attempt 60 -> exceeds remaining 50 -> rejected
        let out_too_much = contract.execute(transfer_action(60, recipient()));
        assert_eq!(out_too_much.status, "REJECTED");
        assert_eq!(out_too_much.reason.as_deref(), Some(REASON_INSUFFICIENT_VAULT));
    }

    #[test]
    fn test_transfer_unassigned_token_rejected() {
        let (mut contract, mut builder) = setup_contract(100);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let wrong_token_action = GuardAction::Transfer {
            token: "other_token.near".parse().unwrap(),
            to: recipient(),
            amount: U128(10),
            memo: None,
        };

        let out = contract.execute(wrong_token_action);
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason.as_deref(), Some(REASON_TARGET));
    }

    #[test]
    fn test_contract_call_cannot_invoke_swap() {
        let (mut contract, mut builder) = setup_contract(100);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let rogue_call = GuardAction::ContractCall {
            target: target(),
            method: "swap".to_string(),
            args: "{\"amount\":\"1000\"}".to_string(),
            deposit: None,
        };

        let out = contract.execute(rogue_call);
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason.as_deref(), Some(REASON_METHOD));
    }

    #[test]
    fn test_max_u128_amount_does_not_panic_overflow() {
        let (mut contract, mut builder) = setup_contract(100);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        // Prior spend = 10
        let out1 = contract.execute(swap_action(10));
        assert_eq!(out1.status, "ALLOWED");

        // Large amount that would overflow u128 if added to 10
        let huge_action = GuardAction::Swap {
            dex: target(),
            token_in: "token.near".parse().unwrap(),
            amount_in: U128(u128::MAX),
            min_out: U128(0),
        };

        // Must reject cleanly with OVER_DAILY_CAP without panicking
        let out2 = contract.execute(huge_action);
        assert_eq!(out2.status, "REJECTED");
        assert_eq!(out2.reason.as_deref(), Some(REASON_CAP));
    }

    #[test]
    fn test_transfer_failure_refunds_vault_balance() {
        let (mut contract, mut builder) = setup_contract(100);

        // Deposit 100 into agent vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(100), agent().to_string());

        // Execute transfer of 40
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let out = contract.execute(transfer_action(40, recipient()));
        assert_eq!(out.status, "ALLOWED");
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance, U128(60));
        assert_eq!(contract.get_budget(agent()).unwrap().spent, U128(40));

        // Simulate callback when external transfer failed (promise failed)
        // Predecessor is the contract itself for #[private] callback methods
        builder.predecessor_account_id("guard.near".parse().unwrap());
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::default(),
            vec![near_sdk::PromiseResult::Failed],
        );
        let handled = contract.on_action_resolved(agent(), U128(40), true, None, Some(true), None);
        assert!(!handled);

        // Vault balance should be refunded to 100, spent rolled back to 0, and near vault balance unaffected
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance, U128(100));
        assert_eq!(contract.get_near_vault_balance(agent()).0, 0);
        assert_eq!(contract.get_budget(agent()).unwrap().spent, U128(0));
    }

    #[test]
    fn test_withdraw_failure_refunds_vault_balance() {
        let (mut contract, mut builder) = setup_contract(100);

        // Deposit 100 into agent vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(100), agent().to_string());

        // Owner initiates withdrawal of 40
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        let _ = contract.withdraw(agent(), U128(40));
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance, U128(60));

        // Simulate callback when external ft_transfer failed
        builder.predecessor_account_id("guard.near".parse().unwrap());
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::default(),
            vec![near_sdk::PromiseResult::Failed],
        );
        let handled = contract.on_withdraw_resolved(agent(), U128(40));
        assert!(!handled);

        // Vault balance should be refunded to 100, and near vault balance unaffected
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance, U128(100));
        assert_eq!(contract.get_near_vault_balance(agent()).0, 0);
    }

    #[test]
    fn test_near_transfer_failure_refunds_near_vault_balance() {
        let (mut contract, mut builder) = setup_contract(100);

        // Deposit 100 native NEAR into agent vault
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(100));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        // Agent transfers 40 native NEAR
        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());
        let action = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(40),
        };
        let out = contract.execute(action);
        assert_eq!(out.status, "ALLOWED");
        assert_eq!(contract.get_near_vault_balance(agent()).0, 60);
        assert_eq!(contract.get_budget(agent()).unwrap().spent, U128(0));
        assert_eq!(contract.get_budget(agent()).unwrap().near_spent.unwrap(), U128(40));

        // Simulate callback when external transfer failed
        builder.predecessor_account_id("guard.near".parse().unwrap());
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::default(),
            vec![near_sdk::PromiseResult::Failed],
        );
        let handled = contract.on_action_resolved(agent(), U128(40), true, Some(true), Some(true), None);
        assert!(!handled);

        // Near vault balance refunded to 100, spent rolled back to 0, token vault unaffected
        assert_eq!(contract.get_near_vault_balance(agent()).0, 100);
        assert_eq!(contract.get_budget(agent()).unwrap().spent, U128(0));
        assert_eq!(contract.get_budget(agent()).unwrap().near_spent.unwrap(), U128(0));
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance.0, 0);
    }

    #[test]
    fn test_get_version() {
        let (contract, _) = setup_contract(100);
        assert_eq!(contract.get_version(), "0.4.0");
    }

    #[test]
    fn test_policy_deserialization_from_number_and_string() {
        // Test numeric format
        let json_num = r#"{
            "token": "token.near",
            "targets": { "dex.near": ["swap"] },
            "daily_cap": 500,
            "recipients": [],
            "max_actions_per_10min": 5,
            "auto_pause_rejects": 3,
            "auto_pause_window_minutes": 10,
            "high_value_threshold": 250,
            "high_value_delay_seconds": 60,
            "policy_change_delay_seconds": 600,
            "lease_expires_at": 1793742193647000000
        }"#;
        let policy_num: Policy = near_sdk::serde_json::from_str(json_num).unwrap();
        assert_eq!(policy_num.daily_cap, 500);
        assert_eq!(policy_num.high_value_threshold, 250);
        assert_eq!(policy_num.lease_expires_at, Some(1793742193647000000));

        // Test string format
        let json_str = r#"{
            "token": "token.near",
            "targets": { "dex.near": ["swap"] },
            "daily_cap": "500",
            "recipients": [],
            "max_actions_per_10min": 5,
            "auto_pause_rejects": 3,
            "auto_pause_window_minutes": 10,
            "high_value_threshold": "250",
            "high_value_delay_seconds": 60,
            "policy_change_delay_seconds": 600,
            "lease_expires_at": "1793742193647000000"
        }"#;
        let policy_str: Policy = near_sdk::serde_json::from_str(json_str).unwrap();
        assert_eq!(policy_str.daily_cap, 500);
        assert_eq!(policy_str.high_value_threshold, 250);
        assert_eq!(policy_str.lease_expires_at, Some(1793742193647000000));
    }

    // ---------------------------------------------------------------
    // revoke_agent / reset_windows
    // ---------------------------------------------------------------

    #[test]
    fn test_revoke_agent_wipes_allowlists_and_pauses() {
        let now = 1_000_000_000;
        let (mut contract, builder) = setup_contract(now);

        contract.revoke_agent(agent());

        let policy = contract.get_policy(agent()).unwrap();
        assert!(policy.targets.is_empty(), "targets must be emptied");
        assert!(policy.recipients.is_empty(), "recipients must be emptied");

        let budget = contract.get_budget(agent()).unwrap();
        assert!(budget.paused, "revoked agent must be paused");
        assert!(budget.revoked, "revoked flag must be set");

        // The record survives so the owner can still withdraw the vault.
        assert_eq!(budget.cap, U128(1000));
        let _ = builder;
    }

    #[test]
    fn test_revoked_agent_still_rejected_after_unpause() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        builder.predecessor_account_id(owner());
        testing_env!(builder.clone().build());
        contract.revoke_agent(agent());

        // Owner lifts the pause. The allowlist is empty, so nothing is restored.
        testing_env!(builder.clone().build());
        contract.unpause(agent());
        assert!(!contract.get_budget(agent()).unwrap().paused);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let outcome = contract.execute(swap_action(10));
        assert_eq!(outcome.status, "REJECTED");
        assert_eq!(outcome.reason.as_deref(), Some(REASON_TARGET));
    }

    #[test]
    fn test_revoke_agent_clears_staged_policy_and_pending() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Stage a policy change.
        let mut raised = sample_policy();
        raised.daily_cap = 5000;
        contract.set_policy(agent(), raised);
        assert!(contract.get_staged_policy(agent()).is_some());

        // Queue a high-value intent so pending_actions is non-empty.
        let mut queued = sample_policy();
        queued.high_value_threshold = 100;
        contract.set_policy(agent(), queued.clone());
        builder.predecessor_account_id(owner());
        testing_env!(builder.clone().build());
        // Apply the staged policy immediately by moving past effective_at.
        builder.block_timestamp(now + 601 * 1_000_000_000);
        testing_env!(builder.clone().build());
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let pending = contract.execute(swap_action(150));
        assert_eq!(pending.status, "PENDING");
        assert_eq!(contract.get_pending_actions(agent()).len(), 1);

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.revoke_agent(agent());

        assert!(contract.get_staged_policy(agent()).is_none());
        assert!(contract.get_pending_actions(agent()).is_empty());
    }

    #[test]
    #[should_panic(expected = "only owner may call this method")]
    fn test_revoke_agent_is_owner_only() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        contract.revoke_agent(agent());
    }

    #[test]
    fn test_reset_windows_clears_spend_velocity_and_strikes() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        // Burn the velocity allowance (max_actions_per_10min = 3).
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        for _ in 0..3 {
            let out = contract.execute(swap_action(10));
            assert_eq!(out.status, "ALLOWED");
        }

        // A fourth call trips the velocity cap and records a strike.
        let capped = contract.execute(swap_action(10));
        assert_eq!(capped.status, "REJECTED");
        assert_eq!(capped.reason.as_deref(), Some(REASON_OVER_VELOCITY));

        let before = contract.get_budget(agent()).unwrap();
        assert_eq!(before.spent, U128(30));
        assert_eq!(before.actions_in_window, 3);

        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.reset_windows(agent());

        let after = contract.get_budget(agent()).unwrap();
        assert_eq!(after.spent, U128(0));
        assert_eq!(after.actions_in_window, 0);
        assert_eq!(after.remaining, U128(1000));
        // Pause state and policy are untouched by a window reset.
        assert!(!after.paused);
        assert_eq!(contract.get_policy(agent()).unwrap().daily_cap, 1000);

        // The velocity lane is usable again.
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let allowed = contract.execute(swap_action(10));
        assert_eq!(allowed.status, "ALLOWED");
    }

    #[test]
    #[should_panic(expected = "only owner may call this method")]
    fn test_reset_windows_is_owner_only() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        contract.reset_windows(agent());
    }

    #[test]
    #[should_panic(expected = "agent is revoked: nothing to reset")]
    fn test_reset_windows_rejects_revoked_agent() {
        let now = 1_000_000_000;
        let (mut contract, builder) = setup_contract(now);
        contract.revoke_agent(agent());
        let _ = builder;
        contract.reset_windows(agent());
    }

    // ---------------------------------------------------------------
    // Preflight View & First-Use Quarantine
    // ---------------------------------------------------------------

    #[test]
    fn test_preflight_view_simulation_and_checks() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Preflight on unknown agent returns NOT_AGENT as a value (no panic)
        let unknown_agent: AccountId = "stranger.near".parse().unwrap();
        let pf_not_agent = contract.preflight(unknown_agent, swap_action(50));
        assert_eq!(pf_not_agent.status, "REJECTED");
        assert_eq!(pf_not_agent.reason.as_deref(), Some(REASON_NOT_AGENT));
        assert!(pf_not_agent.budget.is_none());

        // Deposit 200 into vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(200), agent().to_string());

        // Preflight on valid swap
        let pf_allowed = contract.preflight(agent(), swap_action(50));
        assert_eq!(pf_allowed.status, "ALLOWED");
        assert!(pf_allowed.reason.is_none());
        assert!(pf_allowed.delay_seconds.is_none());
        assert_eq!(pf_allowed.velocity_used, 0);
        assert_eq!(pf_allowed.velocity_max, 3);
        assert_eq!(pf_allowed.velocity_remaining, 3);
        assert_eq!(pf_allowed.vault_balance, U128(200));
        let b = pf_allowed.budget.unwrap();
        assert_eq!(b.cap, U128(1000));
        assert_eq!(b.spent, U128(0));
        assert_eq!(b.remaining, U128(1000));

        // Preflight does NOT write state or spend budget
        let live_budget = contract.get_budget(agent()).unwrap();
        assert_eq!(live_budget.spent, U128(0));
        assert_eq!(live_budget.actions_in_window, 0);

        // Preflight for target not allowed
        let pf_bad_target = contract.preflight(
            agent(),
            GuardAction::Swap {
                dex: bad_target(),
                token_in: "token.near".parse().unwrap(),
                amount_in: U128(10),
                min_out: U128(1),
            },
        );
        assert_eq!(pf_bad_target.status, "REJECTED");
        assert_eq!(pf_bad_target.reason.as_deref(), Some(REASON_TARGET));

        // Preflight for recipient not allowed
        let pf_bad_recipient = contract.preflight(
            agent(),
            GuardAction::Transfer {
                token: "token.near".parse().unwrap(),
                to: bad_recipient(),
                amount: U128(10),
                memo: None,
            },
        );
        assert_eq!(pf_bad_recipient.status, "REJECTED");
        assert_eq!(pf_bad_recipient.reason.as_deref(), Some(REASON_RECIPIENT));

        // Preflight for over daily cap
        let pf_over_cap = contract.preflight(agent(), swap_action(1500));
        assert_eq!(pf_over_cap.status, "REJECTED");
        assert_eq!(pf_over_cap.reason.as_deref(), Some(REASON_CAP));

        // Preflight for transfer exceeding vault balance (vault has 200, requesting 300)
        let pf_insufficient_vault = contract.preflight(
            agent(),
            GuardAction::Transfer {
                token: "token.near".parse().unwrap(),
                to: recipient(),
                amount: U128(300),
                memo: None,
            },
        );
        assert_eq!(pf_insufficient_vault.status, "REJECTED");
        assert_eq!(
            pf_insufficient_vault.reason.as_deref(),
            Some(REASON_INSUFFICIENT_VAULT)
        );

        // Preflight does not add strikes: auto_pause is not tripped
        assert!(!contract.get_budget(agent()).unwrap().paused);

        // Preflight when paused
        builder.predecessor_account_id(owner());
        testing_env!(builder.clone().build());
        contract.pause(agent());
        let pf_paused = contract.preflight(agent(), swap_action(10));
        assert_eq!(pf_paused.status, "REJECTED");
        assert_eq!(pf_paused.reason.as_deref(), Some(REASON_PAUSED));
    }

    #[test]
    fn test_first_use_quarantine_lifecycle() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Deposit 500 tokens in vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        // Stage policy change adding charlie.near as a new recipient
        let charlie: AccountId = "charlie.near".parse().unwrap();
        let mut new_policy = sample_policy();
        new_policy.recipients = vec![recipient(), charlie.clone()];
        builder.predecessor_account_id(owner());
        testing_env!(builder.clone().build());
        contract.set_policy(agent(), new_policy);

        // Advance past policy change delay (600s)
        let policy_effective_time = now + 601 * 1_000_000_000;
        builder.block_timestamp(policy_effective_time);
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());

        // Preflight: transfer of 20 tokens to charlie should return PENDING due to first-use quarantine
        let transfer_to_charlie = GuardAction::Transfer {
            token: "token.near".parse().unwrap(),
            to: charlie.clone(),
            amount: U128(20),
            memo: Some("first transfer to charlie".to_string()),
        };
        let pf = contract.preflight(agent(), transfer_to_charlie.clone());
        assert_eq!(pf.status, "PENDING");
        assert_eq!(pf.delay_seconds, Some(3600));

        // Agent executes the transfer: quarantined to PENDING
        let outcome = contract.execute(transfer_to_charlie.clone());
        assert_eq!(outcome.status, "PENDING");
        let pending_id = outcome.pending_id.unwrap();
        assert_eq!(pending_id, 1);

        // Verify charlie is in unconfirmed_recipients
        let unconfirmed = contract.get_unconfirmed_recipients(agent());
        assert_eq!(unconfirmed, vec![charlie.clone()]);

        // Advance time past high_value_delay_seconds (3600s)
        let settle_time = policy_effective_time + 3601 * 1_000_000_000;
        builder.block_timestamp(settle_time);
        builder.predecessor_account_id(owner());
        testing_env!(builder.clone().build());

        // Owner settles the pending action
        let settle_outcome = contract.settle_pending(Some(agent()), None, pending_id);
        assert_eq!(settle_outcome.status, "SETTLED");

        // Verify charlie is now confirmed and removed from unconfirmed_recipients
        let unconfirmed_after = contract.get_unconfirmed_recipients(agent());
        assert!(unconfirmed_after.is_empty());

        // Next transfer to charlie (below high-value threshold) is ALLOWED immediately
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let pf_second = contract.preflight(agent(), transfer_to_charlie.clone());
        assert_eq!(pf_second.status, "ALLOWED");

        let second_outcome = contract.execute(transfer_to_charlie);
        assert_eq!(second_outcome.status, "ALLOWED");
        assert!(second_outcome.pending_id.is_none());
    }

    #[test]
    fn test_drawdown_allowance_vs_rejection_at_threshold() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        // 1500 bps = 15.00% max drawdown
        let mut policy = sample_policy();
        policy.max_drawdown_bps = Some(1500);
        policy.daily_cap = 2000;
        contract.register_agent(agent(), policy);

        // Deposit 1000 tokens into vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(1000), agent().to_string());

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.vault_balance, U128(1000));
        assert_eq!(budget.high_water_mark, U128(1000));
        assert_eq!(budget.max_drawdown_bps, Some(1500));

        // Transfer 150 tokens: projected balance is 850 (exactly 85.00% of 1000 HWM), floor is 850
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let action_allow = transfer_action(150, recipient());

        let pf_allow = contract.preflight(agent(), action_allow.clone());
        assert_eq!(pf_allow.status, "ALLOWED");

        let outcome_allow = contract.execute(action_allow);
        assert_eq!(outcome_allow.status, "ALLOWED");

        // Next transfer of 1 token: projected balance would be 849 (< 850 floor)
        // Must reject with DRAWDOWN_EXCEEDED and trip auto-pause
        let action_breach = transfer_action(1, recipient());
        let pf_breach = contract.preflight(agent(), action_breach.clone());
        assert_eq!(pf_breach.status, "REJECTED");
        assert_eq!(pf_breach.reason, Some("DRAWDOWN_EXCEEDED".to_string()));

        let outcome_breach = contract.execute(action_breach);
        assert_eq!(outcome_breach.status, "REJECTED");
        assert_eq!(outcome_breach.reason, Some("DRAWDOWN_EXCEEDED".to_string()));

        // Verify contract is now auto-paused
        let budget_after = contract.get_budget(agent()).unwrap();
        assert!(budget_after.paused);

        // Subsequent calls reject on PAUSED
        let outcome_paused = contract.execute(swap_action(10));
        assert_eq!(outcome_paused.status, "REJECTED");
        assert_eq!(outcome_paused.reason, Some("PAUSED".to_string()));
    }

    #[test]
    fn test_high_water_mark_updating_on_profit_or_deposit() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        // 2000 bps = 20.00% max drawdown
        let mut policy = sample_policy();
        policy.max_drawdown_bps = Some(2000);
        policy.daily_cap = 5000;
        contract.register_agent(agent(), policy);

        // Initial deposit of 500 tokens
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        let budget1 = contract.get_budget(agent()).unwrap();
        assert_eq!(budget1.high_water_mark, U128(500));

        // Spend 50 tokens: balance becomes 450, HWM stays at 500
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let out1 = contract.execute(transfer_action(50, recipient()));
        assert_eq!(out1.status, "ALLOWED");

        let budget2 = contract.get_budget(agent()).unwrap();
        assert_eq!(budget2.vault_balance, U128(450));
        assert_eq!(budget2.high_water_mark, U128(500));

        // Deposit 550 tokens: balance reaches 1000, HWM increases to 1000
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(550), agent().to_string());

        let budget3 = contract.get_budget(agent()).unwrap();
        assert_eq!(budget3.vault_balance, U128(1000));
        assert_eq!(budget3.high_water_mark, U128(1000));

        // New floor is 1000 * 8000 / 10000 = 800
        // Transfer 150: projected is 850 >= 800 -> ALLOWED
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let out2 = contract.execute(transfer_action(150, recipient()));
        assert_eq!(out2.status, "ALLOWED");

        // Transfer 60: projected is 790 < 800 -> DRAWDOWN_EXCEEDED
        let out3 = contract.execute(transfer_action(60, recipient()));
        assert_eq!(out3.status, "REJECTED");
        assert_eq!(out3.reason, Some("DRAWDOWN_EXCEEDED".to_string()));
    }

    #[test]
    fn test_task_lease_active_vs_expired() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        let mut policy = sample_policy();
        let lease_expiry = now + 5_000_000_000; // 5 seconds in future
        policy.lease_expires_at = Some(lease_expiry);
        contract.register_agent(agent(), policy);

        // While lease is active: action is allowed
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let pf_active = contract.preflight(agent(), swap_action(50));
        assert_eq!(pf_active.status, "ALLOWED");

        let out_active = contract.execute(swap_action(50));
        assert_eq!(out_active.status, "ALLOWED");

        // Advance past lease expiry
        builder.block_timestamp(lease_expiry + 1);
        testing_env!(builder.clone().build());

        let pf_expired = contract.preflight(agent(), swap_action(50));
        assert_eq!(pf_expired.status, "REJECTED");
        assert_eq!(pf_expired.reason, Some("LEASE_EXPIRED".to_string()));

        let out_expired = contract.execute(swap_action(50));
        assert_eq!(out_expired.status, "REJECTED");
        assert_eq!(out_expired.reason, Some("LEASE_EXPIRED".to_string()));
    }

    #[test]
    fn test_intent_shield_cross_chain_allowlist() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        let mut policy = sample_policy();
        let intents_contract: AccountId = "intents.near".parse().unwrap();
        policy.targets.insert(intents_contract.clone(), vec!["execute_intent".to_string()]);
        policy.intent_recipients = vec![
            "0x71C8363837381F025701262B4527964b071661A4".to_string(),
            "solana_safe_treasury_address".to_string(),
        ];
        contract.register_agent(agent(), policy);

        // Deposit 500 tokens into vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());

        // Allowed cross-chain transfer to allowlisted EVM recipient
        let allow_action = GuardAction::IntentTransfer {
            deposit_address: intents_contract.clone(),
            amount: U128(100),
            destination_asset: "ETH".to_string(),
            recipient: "0x71C8363837381F025701262B4527964b071661A4".to_string(),
        };

        let pf_allow = contract.preflight(agent(), allow_action.clone());
        assert_eq!(pf_allow.status, "ALLOWED");

        let out_allow = contract.execute(allow_action);
        assert_eq!(out_allow.status, "ALLOWED");

        let budget_after_allow = contract.get_budget(agent()).unwrap();
        assert_eq!(budget_after_allow.vault_balance, U128(400));

        // Blocked cross-chain transfer to unlisted attacker recipient
        let block_action = GuardAction::IntentTransfer {
            deposit_address: intents_contract.clone(),
            amount: U128(100),
            destination_asset: "ETH".to_string(),
            recipient: "0xEvilAttackerAddress1234567890".to_string(),
        };

        let pf_block = contract.preflight(agent(), block_action.clone());
        assert_eq!(pf_block.status, "REJECTED");
        assert_eq!(pf_block.reason, Some("INTENT_RECIPIENT_NOT_ALLOWED".to_string()));

        let out_block = contract.execute(block_action);
        assert_eq!(out_block.status, "REJECTED");
        assert_eq!(out_block.reason, Some("INTENT_RECIPIENT_NOT_ALLOWED".to_string()));

        // Vault balance remains untouched at 400
        let budget_after_block = contract.get_budget(agent()).unwrap();
        assert_eq!(budget_after_block.vault_balance, U128(400));
    }

    #[test]
    fn test_canary_decoy_tripwire() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        let mut policy = sample_policy();
        policy.canary_methods = vec![
            "emergency_withdraw_all".to_string(),
            "drain_vault".to_string(),
        ];
        contract.register_agent(agent(), policy);

        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());

        // Attacker attempts to call honeypot decoy method
        let canary_action = GuardAction::ContractCall {
            target: target(),
            method: "drain_vault".to_string(),
            args: "{}".to_string(),
            deposit: None,
        };

        let pf_canary = contract.preflight(agent(), canary_action.clone());
        assert_eq!(pf_canary.status, "REJECTED");
        assert_eq!(pf_canary.reason, Some("CANARY_TRIPPED".to_string()));

        let out_canary = contract.execute(canary_action);
        assert_eq!(out_canary.status, "REJECTED");
        assert_eq!(out_canary.reason, Some("CANARY_TRIPPED".to_string()));

        // Verify agent is immediately paused onchain
        let budget = contract.get_budget(agent()).unwrap();
        assert!(budget.paused);

        // Next legitimate action is immediately rejected due to PAUSED
        let legit_action = swap_action(50);
        let out_paused = contract.execute(legit_action);
        assert_eq!(out_paused.status, "REJECTED");
        assert_eq!(out_paused.reason, Some("PAUSED".to_string()));
    }

    #[test]
    fn test_safe_drawdown_floor_computation_no_overflow() {
        // Edge case: 0 bps = 0% drawdown (floor must equal hwm)
        assert_eq!(compute_drawdown_floor(1000, 0), 1000);

        // Edge case: 10000 bps = 100% drawdown (floor must be 0)
        assert_eq!(compute_drawdown_floor(1000, 10000), 0);

        // Standard case: 1500 bps = 15% drawdown (floor must be 85% = 850)
        assert_eq!(compute_drawdown_floor(1000, 1500), 850);

        // Extreme u128 value: verify no overflow or saturation panic
        let max_val = u128::MAX;
        let floor = compute_drawdown_floor(max_val, 1500);
        assert!(floor > 0);
        assert!(floor < max_val);
    }

    #[test]
    fn test_contract_call_cannot_invoke_execute_intent() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        let mut policy = sample_policy();
        let intents: AccountId = "intents.near".parse().unwrap();
        policy.targets.insert(intents.clone(), vec!["execute_intent".to_string()]);
        contract.register_agent(agent(), policy);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        // Attacker attempts generic ContractCall to bypass IntentTransfer validation
        let bypass_call = GuardAction::ContractCall {
            target: intents,
            method: "execute_intent".to_string(),
            args: "{}".to_string(),
            deposit: None,
        };

        let pf = contract.preflight(agent(), bypass_call.clone());
        assert_eq!(pf.status, "REJECTED");
        assert_eq!(pf.reason, Some("METHOD_NOT_ALLOWED".to_string()));

        let out = contract.execute(bypass_call);
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason, Some("METHOD_NOT_ALLOWED".to_string()));
    }

    #[test]
    fn test_settle_pending_checks_drawdown_and_canary() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        // Setup policy with drawdown, canary methods, and timelock
        let mut policy = sample_policy();
        policy.max_drawdown_bps = Some(1500); // 15% max drawdown (floor = 850)
        policy.high_value_threshold = 100;
        policy.high_value_delay_seconds = 60;
        contract.register_agent(agent(), policy);

        // Deposit 1000 tokens into vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.clone().build());
        let _ = contract.ft_on_transfer(owner(), U128(1000), agent().to_string());

        // Agent submits high-value transfer of 120 (quarantined to pending: 120 >= 100, projected 880 >= 850)
        builder.predecessor_account_id(agent());
        testing_env!(builder.clone().build());
        let action = transfer_action(120, recipient());
        let out_pending = contract.execute(action);
        assert_eq!(out_pending.status, "PENDING");
        let id = out_pending.pending_id.unwrap();

        // While pending action sits in timelock, agent executes an immediate transfer of 40 (projected 960 >= 850)
        let intermediate_action = transfer_action(40, recipient());
        let out_inter = contract.execute(intermediate_action);
        assert_eq!(out_inter.status, "ALLOWED");
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance, U128(960));

        // Advance time past delay (65 seconds)
        builder.block_timestamp(now + 65 * 1_000_000_000);
        builder.predecessor_account_id(owner());
        testing_env!(builder.clone().build());

        // Owner attempts to settle, but settling 120 from remaining 960 leaves 840 (< 850 floor)
        // Must reject with DRAWDOWN_EXCEEDED and pause
        let settle_out = contract.settle_pending(Some(agent()), None, id);
        assert_eq!(settle_out.status, "REJECTED");
        assert_eq!(settle_out.reason, Some("DRAWDOWN_EXCEEDED".to_string()));

        let budget = contract.get_budget(agent()).unwrap();
        assert!(budget.paused);
    }

    #[test]
    fn test_near_transfer_allowed_within_policy() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Owner deposits 500 yoctoNEAR of native NEAR into the agent vault
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(500));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        let action = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(200),
        };

        let pf = contract.preflight(agent(), action.clone());
        assert_eq!(pf.status, "ALLOWED");

        let out = contract.execute(action);
        assert_eq!(out.status, "ALLOWED");
        assert_eq!(out.reason, None);

        let budget = contract.get_budget(agent()).unwrap();
        assert_eq!(budget.spent, U128(0));
        assert_eq!(budget.remaining, U128(1000));
        assert_eq!(budget.near_spent.unwrap(), U128(200));
        assert_eq!(budget.near_remaining.unwrap(), U128(800));
        assert_eq!(contract.get_near_vault_balance(agent()).0, 300);
    }

    #[test]
    fn test_near_transfer_blocked_when_exceeding_cap() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let action = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(1500),
        };

        let pf = contract.preflight(agent(), action.clone());
        assert_eq!(pf.status, "REJECTED");
        assert_eq!(pf.reason, Some(REASON_CAP.to_string()));

        let out = contract.execute(action);
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason, Some(REASON_CAP.to_string()));
    }

    #[test]
    fn test_near_transfer_blocked_when_recipient_not_allowlisted() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        let action = GuardAction::NearTransfer {
            to: bad_recipient(),
            amount: U128(100),
        };

        let pf = contract.preflight(agent(), action.clone());
        assert_eq!(pf.status, "REJECTED");
        assert_eq!(pf.reason, Some(REASON_RECIPIENT.to_string()));

        let out = contract.execute(action);
        assert_eq!(out.status, "REJECTED");
        assert_eq!(out.reason, Some(REASON_RECIPIENT.to_string()));
    }

    #[test]
    fn test_deposit_near_and_vault_balance_check() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Owner deposits 500 yoctoNEAR of native NEAR into the agent vault
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(500));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        assert_eq!(contract.get_near_vault_balance(agent()).0, 500);

        // Agent attempts to transfer 600 native NEAR (exceeds vault balance of 500)
        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        let over_action = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(600),
        };
        let out_over = contract.execute(over_action);
        assert_eq!(out_over.status, "REJECTED");
        assert_eq!(out_over.reason, Some(REASON_INSUFFICIENT_VAULT.to_string()));

        // Agent transfers 400 native NEAR (fits within 500 vault balance and 1000 daily cap)
        let ok_action = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(400),
        };
        let out_ok = contract.execute(ok_action);
        assert_eq!(out_ok.status, "ALLOWED");
        assert_eq!(contract.get_near_vault_balance(agent()).0, 100);
    }

    #[test]
    fn test_contract_call_with_storage_deposit() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        let mut policy = sample_policy();
        policy.near_daily_cap = Some(1_000_000_000_000_000_000_000_000);
        let target_contract: AccountId = "dex.near".parse().unwrap();
        policy.targets.insert(target_contract.clone(), vec!["storage_deposit".to_string()]);
        contract.register_agent(agent(), policy);

        // Owner deposits 1 NEAR of native NEAR into agent vault
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(1_000_000_000_000_000_000_000_000));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        // Allowed storage deposit within safe ceiling and vault balance
        let deposit_action = GuardAction::ContractCall {
            target: target_contract.clone(),
            method: "storage_deposit".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(12_500_000_000_000_000_000_000)), // 0.0125 NEAR
        };
        let out = contract.execute(deposit_action);
        assert_eq!(out.status, "ALLOWED");

        // Rejected storage deposit exceeding 2 NEAR ceiling
        let huge_deposit_action = GuardAction::ContractCall {
            target: target_contract,
            method: "storage_deposit".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(3_000_000_000_000_000_000_000_000)), // 3 NEAR > 2 NEAR
        };
        let out_huge = contract.execute(huge_deposit_action);
        assert_eq!(out_huge.status, "REJECTED");
        assert_eq!(out_huge.reason, Some(REASON_CAP.to_string()));
    }

    #[test]
    #[should_panic(expected = "insufficient vault balance")]
    fn test_withdraw_near_fails_when_only_token_vault_has_balance() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Deposit 500 tokens (NEP-141) via ft_on_transfer
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance.0, 500);
        assert_eq!(contract.get_near_vault_balance(agent()).0, 0);

        // Owner tries to withdraw native NEAR when only token balance exists
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        let _ = contract.withdraw_near(agent(), U128(500));
    }

    #[test]
    fn test_deposit_near_does_not_inflate_token_vault_balance() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Deposit 500 native NEAR
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(500));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        assert_eq!(contract.get_near_vault_balance(agent()).0, 500);
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance.0, 0);
    }

    #[test]
    fn test_near_transfer_does_not_reduce_token_vault_balance() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Deposit 500 tokens (NEP-141) via ft_on_transfer
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        // Deposit 500 native NEAR
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(500));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        // Agent executes NearTransfer of 200 within policy daily cap
        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());
        let action = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(200),
        };
        let out = contract.execute(action);
        assert_eq!(out.status, "ALLOWED");

        // Token vault balance must remain untouched at 500
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance.0, 500);
        // Near vault balance reduced by 200 to 300
        assert_eq!(contract.get_near_vault_balance(agent()).0, 300);
    }

    #[test]
    fn test_settle_pending_evicts_rejected_action_on_failure() {
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

        // Agent triggers a high-value action of 300
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o = contract.execute(swap_action(300));
        assert_eq!(o.status, "PENDING");
        let id = o.pending_id.unwrap();
        assert_eq!(contract.get_pending_actions(agent()).len(), 1);

        // Pause agent before settlement
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        contract.pause(agent());

        // Fast forward past delay
        let future_ns = (now_sec + 3601) * 1_000_000_000;
        builder.block_timestamp(future_ns);
        testing_env!(builder.build());

        // Owner attempts to settle, fails on PAUSED
        let settled = contract.settle_pending(Some(agent()), None, id);
        assert_eq!(settled.status, "REJECTED");
        assert_eq!(settled.reason.as_deref(), Some("PAUSED"));

        // Crucial invariant: rejected action must be evicted from pending queue
        assert_eq!(
            contract.get_pending_actions(agent()).len(),
            0,
            "Rejected action must be evicted from pending queue"
        );
    }

    #[test]
    fn test_settle_pending_deducts_contract_call_deposit() {
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

        // Deposit 200 yoctoNEAR into native vault
        builder.attached_deposit(NearToken::from_yoctonear(200));
        testing_env!(builder.build());
        contract.deposit_near(agent());
        assert_eq!(contract.get_near_vault_balance(agent()).0, 200);

        // Insert a pending ContractCall with 100 yoctoNEAR deposit into queue
        let mut rec = contract.agents.get(&agent()).cloned().unwrap();
        let call_action = GuardAction::ContractCall {
            target: target(),
            method: "swap".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(100)),
        };
        let id = rec.next_pending_id;
        rec.next_pending_id += 1;
        rec.pending_actions.push(PendingAction {
            id,
            action: call_action,
            target: target(),
            method: "swap".to_string(),
            args: "{}".to_string(),
            amount: 0,
            recipient: None,
            created_at: now_sec,
            executable_at: now_sec + 60,
        });
        contract.agents.insert(agent(), rec);
        assert_eq!(contract.get_pending_actions(agent()).len(), 1);

        // Fast forward past delay
        let future_ns = (now_sec + 3601) * 1_000_000_000;
        builder.predecessor_account_id(owner());
        builder.block_timestamp(future_ns);
        testing_env!(builder.build());

        // Owner settles
        let settled = contract.settle_pending(Some(agent()), None, id);
        assert_eq!(settled.status, "SETTLED");

        // Native vault balance must have been deducted by 100 yoctoNEAR
        assert_eq!(contract.get_near_vault_balance(agent()).0, 100);
        // Pending queue must be empty
        assert_eq!(contract.get_pending_actions(agent()).len(), 0);
    }

    #[test]
    fn test_near_deposit_does_not_corrupt_token_high_water_mark() {
        let now = 1_000_000_000;
        let (mut contract, mut builder) = setup_contract(now);

        // Before token deposit, deposit 250 yoctoNEAR
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(250));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        // Token high_water_mark must NOT be set to 250 yoctoNEAR (no unit collision)
        assert_eq!(contract.get_budget(agent()).unwrap().high_water_mark.0, 0);
        assert_eq!(contract.get_near_vault_balance(agent()).0, 250);

        // Now deposit 500 tokens
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(500), agent().to_string());

        // Token peak should be 500, Near balance remains 250
        assert_eq!(contract.get_budget(agent()).unwrap().high_water_mark.0, 500);
        assert_eq!(contract.get_near_vault_balance(agent()).0, 250);
    }

    #[test]
    fn test_deserialize_live_355_byte_record_onchain_exact() {
        use near_sdk::borsh::BorshDeserialize;
        use near_sdk::base64::engine::general_purpose::STANDARD;
        use near_sdk::base64::Engine;
        // Exact 355-byte base64 state from guard2.sergeo-guard.testnet for agent.sergeo-guard.testnet
        let bytes = STANDARD.decode("FAAAAHNlcmdlby1ndWFyZC50ZXN0bmV0GgAAAHNlcmdlby1ndWFyZC10b2tlbi50ZXN0bmV0AgAAABgAAABzZXJnZW8tZ3VhcmQtZGV4LnRlc3RuZXQBAAAABAAAAHN3YXAaAAAAc2VyZ2VvLWd1YXJkLXRva2VuLnRlc3RuZXQBAAAACwAAAGZ0X3RyYW5zZmVy9AEAAAAAAAAAAAAAAAAAAAEAAAAUAAAAc2VyZ2VvLWd1YXJkLnRlc3RuZXQFAAAAAwAAAAoAAAAAAAAA+gAAAAAAAAAAAAAAAAAAADwAAAAAAAAAPAAAAAAAAAAAAAAAAAAAAAAAAE/pO42u1OQYAAAAAAAAAAAAAAAAAAAAAE/pO42u1OQYAAAAAAAAAAAAAAAAAAMAAAAAAAAAXgEAAAAAAAAAAAAAAAAAAAAAAABeAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==").unwrap();
        assert_eq!(bytes.len(), 355);
        let rec = AgentRecord::try_from_slice(&bytes).expect("Live 355-byte record must deserialize cleanly into AgentRecord");
        assert_eq!(rec.owner.as_str(), "sergeo-guard.testnet");
        assert_eq!(rec.vault_balance, 350);
        assert_eq!(rec.high_water_mark.0, 350);
        assert_eq!(rec.near_vault_balance, 0);
    }

    #[test]
    fn test_deserialize_live_bytes_and_upgrade_v3() {
        use near_sdk::borsh::BorshDeserialize;
        use near_sdk::base64::engine::general_purpose::STANDARD;
        use near_sdk::base64::Engine;
        let bytes = STANDARD.decode("FAAAAHNlcmdlby1ndWFyZC50ZXN0bmV0GgAAAHNlcmdlby1ndWFyZC10b2tlbi50ZXN0bmV0AgAAABgAAABzZXJnZW8tZ3VhcmQtZGV4LnRlc3RuZXQBAAAABAAAAHN3YXAaAAAAc2VyZ2VvLWd1YXJkLXRva2VuLnRlc3RuZXQBAAAACwAAAGZ0X3RyYW5zZmVy9AEAAAAAAAAAAAAAAAAAAAEAAAAUAAAAc2VyZ2VvLWd1YXJkLnRlc3RuZXQFAAAAAwAAAAoAAAAAAAAA+gAAAAAAAAAAAAAAAAAAADwAAAAAAAAAPAAAAAAAAAAAiOP1xISH5BgZAAAAAAAAAAAAAAAAAAAALzbWLMXQ5BgBAAAAAgAAAC821izF0OQYquWhHcvQ5BgAAAAAAAIAAAAAAAAAXgEAAAAAAAAAAAAAAAAAAAAAAAA=").unwrap();
        let res = OldAgentRecord::try_from_slice(&bytes);
        assert!(res.is_ok(), "Deserialization failed: {:?}", res.err());
        let rec = res.unwrap();
        assert_eq!(rec.owner.as_str(), "sergeo-guard.testnet");
        assert_eq!(rec.vault_balance, 350);
        assert_eq!(rec.spent_in_window, 25);

        // Test running upgrade_v3
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id("guard.near".parse().unwrap())
            .block_timestamp(1_000_000_000);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        let test_agent: AccountId = "agent.sergeo-guard.testnet".parse().unwrap();
        let mut storage_key = b"ag".to_vec();
        near_sdk::borsh::BorshSerialize::serialize(&test_agent, &mut storage_key).unwrap();
        env::storage_write(&storage_key, &bytes);

        contract.upgrade_v3(vec![test_agent.clone()]);
        let upgraded = contract.get_budget(test_agent).unwrap();
        assert_eq!(upgraded.vault_balance.0, 350);
        assert_eq!(upgraded.spent.0, 25);
        assert_eq!(upgraded.high_water_mark.0, 350);
    }

    #[test]
    fn test_settle_pending_exact_balance_and_insufficient_balance() {
        let now_sec = 2_000;
        let now_ns = now_sec * 1_000_000_000;

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        contract.register_agent(agent(), timelocked_policy(250));

        // Deposit 150 yoctoNEAR into native vault
        builder.attached_deposit(NearToken::from_yoctonear(150));
        testing_env!(builder.build());
        contract.deposit_near(agent());
        assert_eq!(contract.get_near_vault_balance(agent()).0, 150);

        // Queue action 1: ContractCall with deposit equal to exact balance (150 yoctoNEAR)
        let mut rec = contract.agents.get(&agent()).cloned().unwrap();
        let call_action = GuardAction::ContractCall {
            target: target(),
            method: "swap".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(150)),
        };
        let id1 = rec.next_pending_id;
        rec.next_pending_id += 1;
        rec.pending_actions.push(PendingAction {
            id: id1,
            action: call_action,
            target: target(),
            method: "swap".to_string(),
            args: "{}".to_string(),
            amount: 0,
            recipient: None,
            created_at: now_sec,
            executable_at: now_sec + 60,
        });

        // Queue action 2: ContractCall with deposit 1 yoctoNEAR (will exceed balance after action 1 settles)
        let id2 = rec.next_pending_id;
        rec.next_pending_id += 1;
        let call_action2 = GuardAction::ContractCall {
            target: target(),
            method: "swap".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(1)),
        };
        rec.pending_actions.push(PendingAction {
            id: id2,
            action: call_action2,
            target: target(),
            method: "swap".to_string(),
            args: "{}".to_string(),
            amount: 0,
            recipient: None,
            created_at: now_sec,
            executable_at: now_sec + 60,
        });
        contract.agents.insert(agent(), rec);
        assert_eq!(contract.get_pending_actions(agent()).len(), 2);

        // Fast forward past execution delay
        let future_ns = (now_sec + 100) * 1_000_000_000;
        builder.predecessor_account_id(owner());
        builder.block_timestamp(future_ns);
        testing_env!(builder.build());

        // Settle action 1: exact balance saturation must succeed
        let res1 = contract.settle_pending(Some(agent()), None, id1);
        assert_eq!(res1.status, "SETTLED");
        assert_eq!(contract.get_near_vault_balance(agent()).0, 0);
        assert_eq!(contract.get_pending_actions(agent()).len(), 1);

        // Settle action 2: now that vault is 0, deposit 1 must be rejected and evicted
        let res2 = contract.settle_pending(Some(agent()), None, id2);
        assert_eq!(res2.status, "REJECTED");
        assert_eq!(res2.reason.as_deref(), Some("INSUFFICIENT_VAULT_BALANCE"));
        assert_eq!(contract.get_pending_actions(agent()).len(), 0);
    }

    #[test]
    fn test_repro_daily_cap_doubling_across_window_boundary() {
        let now = 1_000_000_000u64; // t = 1s
        let (mut contract, mut builder) = setup_contract(now);
        // Deposit 5000 tokens to vault
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(5000), agent().to_string());

        // Advance to 24h - 1s
        let t1 = DAY_NS - 1_000_000_000;
        builder.predecessor_account_id(agent());
        builder.block_timestamp(t1);
        testing_env!(builder.build());

        let res1 = contract.execute(swap_action(1000));
        assert_eq!(res1.status, "ALLOWED");

        // Advance 2 seconds to 24h + 1s (across the old fixed 24h boundary)
        let t2 = DAY_NS + 1_000_000_000;
        builder.block_timestamp(t2);
        testing_env!(builder.build());

        let res2 = contract.execute(swap_action(1000));
        // Under rolling window, hour 23 spend is still within 24h lookback!
        // This must be REJECTED with OVER_DAILY_CAP!
        assert_eq!(res2.status, "REJECTED");
        assert_eq!(res2.reason.as_deref(), Some(REASON_CAP));
    }

    #[test]
    fn test_repro_native_near_and_token_share_one_cap() {
        let now = 1_000_000_000u64;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        // 1. Fail closed: policy with near_daily_cap = None (default) must reject NearTransfer
        let mut p_default = sample_policy();
        p_default.near_daily_cap = None;
        contract.register_agent(agent(), p_default);

        // Owner funds both vaults
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(2000), agent().to_string());

        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(10_000_000_000_000_000_000_000_000)); // 10 NEAR
        testing_env!(builder.build());
        contract.deposit_near(agent());

        // Agent attempts 0.001 NEAR (1e21 yocto) -> must fail closed because near_daily_cap is None
        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        let near_act = GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(1_000_000_000_000_000_000_000), // 0.001 NEAR
        };
        let out_fail_closed = contract.execute(near_act.clone());
        assert_eq!(out_fail_closed.status, "REJECTED");
        assert_eq!(out_fail_closed.reason.as_deref(), Some(REASON_CAP));

        // 2. Set independent near_daily_cap = 5 NEAR (5e24 yocto) and token daily_cap = 1000
        builder.predecessor_account_id(owner());
        testing_env!(builder.build());
        let mut p_configured = sample_policy();
        p_configured.daily_cap = 1000;
        p_configured.near_daily_cap = Some(5_000_000_000_000_000_000_000_000); // 5 NEAR
        p_configured.policy_change_delay_seconds = 0; // immediate in test
        let mut rec = contract.agents.get(&agent()).cloned().unwrap();
        rec.policy = p_configured;
        contract.agents.insert(agent(), rec);

        // Agent spends 500 tokens
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let out_token = contract.execute(swap_action(500));
        assert_eq!(out_token.status, "ALLOWED");

        let b1 = contract.get_budget(agent()).unwrap();
        assert_eq!(b1.spent.0, 500);
        assert_eq!(b1.remaining.0, 500);
        assert_eq!(b1.near_spent.unwrap().0, 0);
        assert_eq!(b1.near_remaining.unwrap().0, 5_000_000_000_000_000_000_000_000);

        // Agent spends 0.001 NEAR (1e21 yocto) -> allowed under 5 NEAR cap
        let out_near = contract.execute(near_act);
        assert_eq!(out_near.status, "ALLOWED");

        let b2 = contract.get_budget(agent()).unwrap();
        // Token budget must be completely untouched by NEAR transfer
        assert_eq!(b2.spent.0, 500);
        assert_eq!(b2.remaining.0, 500);
        // NEAR budget reflects the 0.001 NEAR spend
        assert_eq!(b2.near_spent.unwrap().0, 1_000_000_000_000_000_000_000);
        assert_eq!(
            b2.near_remaining.unwrap().0,
            4_999_000_000_000_000_000_000_000
        );
    }

    #[test]
    fn test_repro_contract_call_deposits_bypass_controls() {
        let now = 1_000_000_000u64;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        let target_contract: AccountId = "dex.near".parse().unwrap();
        let mut p = sample_policy();
        p.targets.insert(target_contract.clone(), vec!["storage_deposit".to_string()]);
        // 5 NEAR daily cap, 1 NEAR timelock threshold
        p.near_daily_cap = Some(5_000_000_000_000_000_000_000_000);
        p.near_high_value_threshold = Some(1_000_000_000_000_000_000_000_000); // 1 NEAR
        p.high_value_delay_seconds = 3600;
        contract.register_agent(agent(), p);

        // Owner funds NEAR vault with 10 NEAR
        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(10_000_000_000_000_000_000_000_000));
        testing_env!(builder.build());
        contract.deposit_near(agent());
        assert_eq!(contract.get_near_vault_balance(agent()).0, 10_000_000_000_000_000_000_000_000);

        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        // Call 1: 0.5 NEAR deposit (below 1 NEAR timelock threshold) -> immediate ALLOWED
        let cc_small = GuardAction::ContractCall {
            target: target_contract.clone(),
            method: "storage_deposit".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(500_000_000_000_000_000_000_000)), // 0.5 NEAR
        };
        let out1 = contract.execute(cc_small);
        assert_eq!(out1.status, "ALLOWED");
        // Vault debited by 0.5 NEAR
        assert_eq!(contract.get_near_vault_balance(agent()).0, 9_500_000_000_000_000_000_000_000);
        // NEAR budget spent recorded
        let b1 = contract.get_budget(agent()).unwrap();
        assert_eq!(b1.near_spent.unwrap().0, 500_000_000_000_000_000_000_000);

        // Call 2: 2 NEAR deposit (at or above 1 NEAR timelock threshold) -> must NOT execute immediately, must be PENDING
        let cc_big = GuardAction::ContractCall {
            target: target_contract.clone(),
            method: "storage_deposit".to_string(),
            args: "{}".to_string(),
            deposit: Some(U128(2_000_000_000_000_000_000_000_000)), // 2 NEAR
        };
        let out2 = contract.execute(cc_big);
        assert_eq!(out2.status, "PENDING");
        let id2 = out2.pending_id.unwrap();
        // Crucial invariant: Vault balance must NOT be debited while quarantined in timelock
        assert_eq!(contract.get_near_vault_balance(agent()).0, 9_500_000_000_000_000_000_000_000);

        // Advance past delay
        builder.predecessor_account_id(owner());
        builder.block_timestamp(now + 3601 * 1_000_000_000);
        testing_env!(builder.build());

        // Owner settles the pending 2 NEAR deposit
        let settle_res = contract.settle_pending(Some(agent()), None, id2);
        assert_eq!(settle_res.status, "SETTLED");
        // Now debited exactly once at settlement
        assert_eq!(contract.get_near_vault_balance(agent()).0, 7_500_000_000_000_000_000_000_000);
        let b2 = contract.get_budget(agent()).unwrap();
        assert_eq!(b2.near_spent.unwrap().0, 2_500_000_000_000_000_000_000_000);
    }

    #[test]
    fn test_rolling_window_liveness_full_budget_restored() {
        let now = 1_000_000_000u64; // hour 0
        let (mut contract, mut builder) = setup_contract(now);

        // Deposit 2000 tokens and 2000 NEAR
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(2000), agent().to_string());

        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(2000));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        // Spend entire 1000 token cap and 1000 NEAR cap in hour 0
        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        let out_tok = contract.execute(swap_action(1000));
        assert_eq!(out_tok.status, "ALLOWED");

        let out_near = contract.execute(GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(1000),
        });
        assert_eq!(out_near.status, "ALLOWED");

        // Both caps are exhausted
        assert_eq!(contract.get_budget(agent()).unwrap().remaining.0, 0);
        assert_eq!(contract.get_budget(agent()).unwrap().near_remaining.unwrap().0, 0);

        // At hour 10: still inside lookback, attempts must be rejected
        let t_h10 = now + 10 * HOUR_NS;
        builder.block_timestamp(t_h10);
        testing_env!(builder.build());
        let rej_tok = contract.execute(swap_action(1));
        assert_eq!(rej_tok.status, "REJECTED");
        assert_eq!(rej_tok.reason.as_deref(), Some(REASON_CAP));

        // Advance to hour 26 (> 25 hours): rolling window has fully moved past hour 0
        let t_h26 = now + 26 * HOUR_NS;
        builder.block_timestamp(t_h26);
        testing_env!(builder.build());

        let b_liveness = contract.get_budget(agent()).unwrap();
        assert_eq!(b_liveness.spent.0, 0);
        assert_eq!(b_liveness.remaining.0, 1000);
        assert_eq!(b_liveness.near_spent.unwrap().0, 0);
        assert_eq!(b_liveness.near_remaining.unwrap().0, 1000);

        // Spend is allowed again
        let ok_again = contract.execute(swap_action(1000));
        assert_eq!(ok_again.status, "ALLOWED");
    }

    #[test]
    fn test_near_and_token_budgets_are_independent() {
        let now = 1_000_000_000u64;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(now);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        let mut p = sample_policy();
        p.max_actions_per_10min = 20;
        contract.register_agent(agent(), p);

        // Deposit 2000 tokens and 2000 NEAR
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(2000), agent().to_string());

        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(2000));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        builder.predecessor_account_id(agent());
        builder.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());

        // Exhaust token cap completely (1000)
        let tok1 = contract.execute(swap_action(1000));
        assert_eq!(tok1.status, "ALLOWED");

        // Next token spend rejected
        let tok_rej = contract.execute(swap_action(1));
        assert_eq!(tok_rej.status, "REJECTED");
        assert_eq!(tok_rej.reason.as_deref(), Some(REASON_CAP));

        // But NEAR spend is fully available and succeeds!
        let near_ok = contract.execute(GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(500),
        });
        assert_eq!(near_ok.status, "ALLOWED");

        // Now exhaust NEAR cap (another 500 = 1000 total)
        let near_ok2 = contract.execute(GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(500),
        });
        assert_eq!(near_ok2.status, "ALLOWED");

        // Further NEAR spend rejected
        let near_rej = contract.execute(GuardAction::NearTransfer {
            to: recipient(),
            amount: U128(1),
        });
        assert_eq!(near_rej.status, "REJECTED");
        assert_eq!(near_rej.reason.as_deref(), Some(REASON_CAP));
    }

    #[test]
    fn test_refund_lands_in_original_bucket() {
        let now = 1_000_000_000u64;
        let (mut contract, mut builder) = setup_contract(now);

        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(1000), agent().to_string());

        // Hour 0: spend 400 tokens
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o = contract.execute(transfer_action(400, recipient()));
        assert_eq!(o.status, "ALLOWED");
        assert_eq!(contract.get_budget(agent()).unwrap().spent.0, 400);

        let orig_bucket = now / HOUR_NS;

        // Advance to hour 5 (bucket 5)
        let t_h5 = now + 5 * HOUR_NS;
        builder.block_timestamp(t_h5);
        testing_env!(builder.build());

        // External failure callback arrives in hour 5 with spend_bucket = Some(orig_bucket)
        builder.predecessor_account_id("guard.near".parse().unwrap());
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::default(),
            vec![near_sdk::PromiseResult::Failed],
        );
        let handled = contract.on_action_resolved(agent(), U128(400), true, None, Some(true), Some(orig_bucket));
        assert!(!handled);

        // Refund landed in original bucket 0, so rolling spend is back to 0!
        assert_eq!(contract.get_budget(agent()).unwrap().spent.0, 0);
        assert_eq!(contract.get_budget(agent()).unwrap().vault_balance.0, 1000);

        // Now spend 300 again at hour 5
        builder.predecessor_account_id(agent());
        testing_env!(builder.build());
        let o2 = contract.execute(transfer_action(300, recipient()));
        assert_eq!(o2.status, "ALLOWED");

        let orig_bucket5 = t_h5 / HOUR_NS;

        // Advance past 26 hours (hour 32). Hour 5 bucket has expired.
        let t_h32 = t_h5 + 26 * HOUR_NS;
        builder.block_timestamp(t_h32);
        testing_env!(builder.build());

        // A late failure callback for the expired bucket arrives
        builder.predecessor_account_id("guard.near".parse().unwrap());
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::default(),
            vec![near_sdk::PromiseResult::Failed],
        );
        let handled_late = contract.on_action_resolved(agent(), U128(300), true, None, Some(true), Some(orig_bucket5));
        assert!(!handled_late);

        // Refund into expired bucket is a no-op (spent remains 0, does not create negative phantom credit)
        assert_eq!(contract.get_budget(agent()).unwrap().spent.0, 0);
    }

    #[test]
    fn test_contract_call_denylist_value_moving_methods() {
        let now = 1_000_000_000u64;
        let (mut contract, mut builder) = setup_fresh_contract(now);

        let target_contract: AccountId = "target.near".parse().unwrap();
        let mut p = sample_policy();
        p.auto_pause_rejects = 100;
        // Allow all denylisted methods in target policy to verify denylist rejection overrides allowlist
        let mut all_methods: Vec<String> = VALUE_MOVING_DENYLIST.iter().map(|s| s.to_string()).collect();
        all_methods.push("safe_query".to_string());
        p.targets.insert(target_contract.clone(), all_methods);
        contract.register_agent(agent(), p);

        builder.predecessor_account_id(agent());
        testing_env!(builder.build());

        for &denied in VALUE_MOVING_DENYLIST {
            let act = GuardAction::ContractCall {
                target: target_contract.clone(),
                method: denied.to_string(),
                args: "{}".to_string(),
                deposit: None,
            };
            let pf = contract.preflight(agent(), act.clone());
            assert_eq!(pf.status, "REJECTED", "preflight must reject denied method: {}", denied);
            assert_eq!(pf.reason.as_deref(), Some(REASON_METHOD), "preflight reason: {}", denied);

            let res = contract.execute(act);
            assert_eq!(res.status, "REJECTED", "execute must reject denied method: {}", denied);
            assert_eq!(res.reason.as_deref(), Some(REASON_METHOD), "execute reason: {}", denied);
        }

        // Safe query method must be ALLOWED
        let safe_act = GuardAction::ContractCall {
            target: target_contract,
            method: "safe_query".to_string(),
            args: "{}".to_string(),
            deposit: None,
        };
        let pf_safe = contract.preflight(agent(), safe_act.clone());
        assert_eq!(pf_safe.status, "ALLOWED");
        let res_safe = contract.execute(safe_act);
        assert_eq!(res_safe.status, "ALLOWED");
    }

    #[test]
    fn test_seeded_property_rolling_cap() {
        // Simple Xorshift64 PRNG: no external crates needed
        struct SimpleRng {
            state: u64,
        }
        impl SimpleRng {
            fn next(&mut self) -> u64 {
                let mut x = self.state;
                x ^= x << 13;
                x ^= x >> 7;
                x ^= x << 17;
                self.state = x;
                x
            }
            fn range(&mut self, low: u64, high: u64) -> u64 {
                low + (self.next() % (high - low + 1))
            }
        }

        let seed: u64 = 0xdeadbeefc0ffee11;
        let mut rng = SimpleRng { state: seed };

        let token_cap: u128 = 1000;
        let near_cap: u128 = 5_000_000; // 5M yocto for easy property testing

        let mut rec = AgentRecord {
            owner: owner(),
            policy: Policy {
                token: "token.near".parse().unwrap(),
                targets: HashMap::new(),
                daily_cap: token_cap,
                recipients: vec![recipient()],
                max_actions_per_10min: 1000,
                auto_pause_rejects: 1000,
                auto_pause_window_minutes: 60,
                high_value_threshold: 0,
                high_value_delay_seconds: 0,
                policy_change_delay_seconds: 0,
                max_drawdown_bps: None,
                lease_expires_at: None,
                intent_recipients: Vec::new(),
                canary_methods: Vec::new(),
                near_daily_cap: Some(near_cap),
                near_high_value_threshold: None,
            },
            paused: false,
            day_window_start: 0,
            spent_in_window: 0,
            velocity_window_start: 0,
            actions_in_window: 0,
            reject_times: Vec::new(),
            pending_actions: Vec::new(),
            staged_policy: None,
            next_pending_id: 1,
            vault_balance: 100_000_000,
            unconfirmed_recipients: Vec::new(),
            high_water_mark: U128(100_000_000),
            near_vault_balance: 100_000_000,
            near_high_water_mark: U128(100_000_000),
            spend_buckets: Vec::new(),
            near_spend_buckets: Vec::new(),
        };

        let mut current_ns: u64 = 1_000_000_000;

        for step in 0..500 {
            // Advance time between 0 and 3 hours
            let advance_hours = rng.range(0, 3);
            current_ns += advance_hours * HOUR_NS;

            // Roll for token or near action
            let is_token = (rng.next() % 2) == 0;
            let req_amount = rng.range(1, 400) as u128;

            if is_token {
                let current_spent = rec.rolling_spend(current_ns);
                if current_spent.checked_add(req_amount).map_or(false, |s| s <= token_cap) {
                    rec.record_spend(current_ns, req_amount);
                }
            } else {
                let current_near_spent = rec.rolling_near_spend(current_ns);
                if current_near_spent.checked_add(req_amount).map_or(false, |s| s <= near_cap) {
                    rec.record_near_spend(current_ns, req_amount);
                }
            }

            // Invariant assertion: rolling spend in any 24h window NEVER exceeds cap
            let rolling_tok = rec.rolling_spend(current_ns);
            assert!(
                rolling_tok <= token_cap,
                "Seed: {}. Step {}: rolling token spend {} exceeded cap {}",
                seed, step, rolling_tok, token_cap
            );

            let rolling_nr = rec.rolling_near_spend(current_ns);
            assert!(
                rolling_nr <= near_cap,
                "Seed: {}. Step {}: rolling NEAR spend {} exceeded cap {}",
                seed, step, rolling_nr, near_cap
            );
        }
    }
}


