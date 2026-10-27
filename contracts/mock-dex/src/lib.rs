use near_sdk::json_types::U128;
use near_sdk::{env, near, PanicOnDefault};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockDexContract {
    pub rate_numerator: u128,
    pub rate_denominator: u128,
}

#[near]
impl MockDexContract {
    #[init]
    pub fn new() -> Self {
        Self {
            rate_numerator: 1,
            rate_denominator: 2000, // 2000 mUSD = 1 mETH
        }
    }

    /// Swap method called by the agent during legit work.
    /// Returns the received amount.
    pub fn swap(&mut self, amount: U128) -> U128 {
        let caller = env::predecessor_account_id();
        let received = amount.0 * self.rate_numerator / self.rate_denominator;
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"SWAP\",\"caller\":\"{}\",\"in\":\"{}\",\"out\":\"{}\"}}",
            caller, amount.0, received
        ));
        U128(received)
    }
}
