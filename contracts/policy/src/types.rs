use near_sdk::json_types::U128;
use near_sdk::serde_json;
use near_sdk::{near, AccountId, Timestamp};
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
    "mt_batch_transfer",
    "mt_batch_transfer_call",
    "storage_unregister",
    "storage_withdraw",
    "near_withdraw",
    "withdraw",
];

#[allow(dead_code)]
pub const DAY_NS: u64 = 24 * 60 * 60 * 1_000_000_000;
pub const HOUR_NS: u64 = 3_600 * 1_000_000_000;
pub const TEN_MIN_NS: u64 = 10 * 60 * 1_000_000_000;
pub const MAX_REJECT_TIMES_KEPT: usize = 64;
pub const MAX_PENDING_ACTIONS: usize = 8;

/// Accepts both `500` and `"500"` for u128 policy fields.
pub fn de_u128_flexible<'de, D>(deserializer: D) -> Result<u128, D::Error>
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

/// Accepts null, omitted, numeric integers or numeric strings for lease expiration timestamps.
pub fn de_u64_opt_flexible<'de, D>(deserializer: D) -> Result<Option<u64>, D::Error>
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

/// Accepts null, omitted, numeric integers or numeric strings for optional u128 policy fields.
pub fn de_u128_opt_flexible<'de, D>(deserializer: D) -> Result<Option<u128>, D::Error>
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
pub fn compute_drawdown_floor(hwm: u128, max_drawdown_bps: u16) -> u128 {
    let mult = 10000u128.saturating_sub(max_drawdown_bps as u128);
    let q = hwm / 10000;
    let r = hwm % 10000;
    q.saturating_mul(mult).saturating_add((r * mult) / 10000)
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Policy {
    pub token: AccountId,
    pub targets: HashMap<AccountId, Vec<String>>,
    #[serde(deserialize_with = "de_u128_flexible")]
    pub daily_cap: u128,
    pub recipients: Vec<AccountId>,
    pub max_actions_per_10min: u32,
    pub auto_pause_rejects: u32,
    pub auto_pause_window_minutes: u64,
    #[serde(deserialize_with = "de_u128_flexible")]
    pub high_value_threshold: u128,
    pub high_value_delay_seconds: u64,
    pub policy_change_delay_seconds: u64,
    #[serde(default)]
    pub max_drawdown_bps: Option<u16>,
    #[serde(default, deserialize_with = "de_u64_opt_flexible")]
    pub lease_expires_at: Option<u64>,
    #[serde(default)]
    pub intent_recipients: Vec<String>,
    #[serde(default)]
    pub canary_methods: Vec<String>,
    #[serde(default, deserialize_with = "de_u128_opt_flexible")]
    pub near_daily_cap: Option<u128>,
    #[serde(default, deserialize_with = "de_u128_opt_flexible")]
    pub near_high_value_threshold: Option<u128>,
}

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

#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AgentRecord {
    pub owner: AccountId,
    pub policy: Policy,
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
    pub near_high_water_mark: U128,
    pub spend_buckets: Vec<SpendBucket>,
    pub near_spend_buckets: Vec<SpendBucket>,
}

impl AgentRecord {
    pub fn rolling_spend(&self, now: Timestamp) -> u128 {
        let current_bucket = now / HOUR_NS;
        self.spend_buckets
            .iter()
            .filter(|b| b.bucket <= current_bucket && current_bucket - b.bucket <= 24)
            .fold(0u128, |acc, b| acc.saturating_add(b.amount))
    }

    pub fn rolling_near_spend(&self, now: Timestamp) -> u128 {
        let current_bucket = now / HOUR_NS;
        self.near_spend_buckets
            .iter()
            .filter(|b| b.bucket <= current_bucket && current_bucket - b.bucket <= 24)
            .fold(0u128, |acc, b| acc.saturating_add(b.amount))
    }

    pub fn record_spend(&mut self, now: Timestamp, amount: u128) {
        let current_bucket = now / HOUR_NS;
        self.spend_buckets.retain(|b| b.bucket <= current_bucket && current_bucket - b.bucket <= 24);
        if let Some(b) = self.spend_buckets.iter_mut().find(|b| b.bucket == current_bucket) {
            b.amount = b.amount.saturating_add(amount);
        } else {
            self.spend_buckets.push(SpendBucket { bucket: current_bucket, amount });
        }
        self.spent_in_window = self.rolling_spend(now);
    }

    pub fn record_near_spend(&mut self, now: Timestamp, amount: u128) {
        let current_bucket = now / HOUR_NS;
        self.near_spend_buckets.retain(|b| b.bucket <= current_bucket && current_bucket - b.bucket <= 24);
        if let Some(b) = self.near_spend_buckets.iter_mut().find(|b| b.bucket == current_bucket) {
            b.amount = b.amount.saturating_add(amount);
        } else {
            self.near_spend_buckets.push(SpendBucket { bucket: current_bucket, amount });
        }
    }

    pub fn refund_spend(&mut self, now: Timestamp, original_bucket: u64, amount: u128) {
        let current_bucket = now / HOUR_NS;
        if original_bucket <= current_bucket && current_bucket - original_bucket <= 24 {
            if let Some(b) = self.spend_buckets.iter_mut().find(|b| b.bucket == original_bucket) {
                b.amount = b.amount.saturating_sub(amount);
            }
        }
        self.spend_buckets.retain(|b| b.bucket <= current_bucket && current_bucket - b.bucket <= 24);
        self.spent_in_window = self.rolling_spend(now);
    }

    pub fn refund_near_spend(&mut self, now: Timestamp, original_bucket: u64, amount: u128) {
        let current_bucket = now / HOUR_NS;
        if original_bucket <= current_bucket && current_bucket - original_bucket <= 24 {
            if let Some(b) = self.near_spend_buckets.iter_mut().find(|b| b.bucket == original_bucket) {
                b.amount = b.amount.saturating_sub(amount);
            }
        }
        self.near_spend_buckets.retain(|b| b.bucket <= current_bucket && current_bucket - b.bucket <= 24);
    }
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PreflightResult {
    pub status: String,
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
    pub status: String,
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
