    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;
    use std::collections::HashMap;

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
        // Regression test: ContractCall cannot bypass transfer controls:
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
        // Verifies ft_transfer is rejected when called via ContractCall:
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
        // Verifies generic ContractCall cannot target custody token contract:
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

        let live_timestamp = rec.day_window_start;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id("guard.near".parse().unwrap())
            .block_timestamp(live_timestamp);
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
        let near_cap: u128 = 5_000_000;

        let mut current_ns: u64 = 1_000_000_000;
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id("guard.near".parse().unwrap())
            .predecessor_account_id(owner())
            .block_timestamp(current_ns);
        testing_env!(builder.build());

        let mut contract = Contract::new();
        let mut policy = sample_policy();
        policy.daily_cap = token_cap;
        policy.near_daily_cap = Some(near_cap);
        policy.max_actions_per_10min = 10_000;
        contract.register_agent(agent(), policy);

        // Fund token vault with 10M tokens and native NEAR vault with 50M yocto
        builder.predecessor_account_id("token.near".parse().unwrap());
        testing_env!(builder.build());
        let _ = contract.ft_on_transfer(owner(), U128(10_000_000), agent().to_string());

        builder.predecessor_account_id(owner());
        builder.attached_deposit(NearToken::from_yoctonear(50_000_000));
        testing_env!(builder.build());
        contract.deposit_near(agent());

        for step in 0..500 {
            let advance_hours = rng.range(0, 3);
            current_ns += advance_hours * HOUR_NS;

            builder.predecessor_account_id(agent());
            builder.block_timestamp(current_ns);
            builder.attached_deposit(NearToken::from_yoctonear(0));
            testing_env!(builder.build());

            let is_token = (rng.next() % 2) == 0;
            let req_amount = rng.range(1, 400) as u128;

            if is_token {
                let act = transfer_action(req_amount, recipient());
                let res = contract.execute(act);
                if res.status == "REJECTED" {
                    assert_eq!(res.reason.as_deref(), Some(REASON_CAP), "Seed: {}. Step: {}", seed, step);
                }
            } else {
                let act = GuardAction::NearTransfer {
                    to: recipient(),
                    amount: U128(req_amount),
                };
                let res = contract.execute(act);
                if res.status == "REJECTED" {
                    assert_eq!(res.reason.as_deref(), Some(REASON_CAP), "Seed: {}. Step: {}", seed, step);
                }
            }

            // Real contract state assertion: rolling spend in any 24h window NEVER exceeds cap
            let b = contract.get_budget(agent()).expect("Agent budget must exist");
            assert!(
                b.spent.0 <= token_cap,
                "Seed: {}. Step {}: rolling token spend {} exceeded cap {}",
                seed, step, b.spent.0, token_cap
            );
            if let Some(near_spent) = b.near_spent {
                assert!(
                    near_spent.0 <= near_cap,
                    "Seed: {}. Step {}: rolling NEAR spend {} exceeded cap {}",
                    seed, step, near_spent.0, near_cap
                );
            }
        }
    }

    #[test]
    fn test_rolling_spend_ignores_future_buckets() {
        let rec = AgentRecord {
            owner: owner(),
            policy: sample_policy(),
            paused: false,
            day_window_start: 0,
            spent_in_window: 0,
            velocity_window_start: 0,
            actions_in_window: 0,
            reject_times: Vec::new(),
            pending_actions: Vec::new(),
            staged_policy: None,
            next_pending_id: 1,
            vault_balance: 1000,
            unconfirmed_recipients: Vec::new(),
            high_water_mark: U128(1000),
            near_vault_balance: 1000,
            near_high_water_mark: U128(1000),
            spend_buckets: vec![
                SpendBucket { bucket: 10, amount: 100 }, // past
                SpendBucket { bucket: 20, amount: 200 }, // future relative to now=15
            ],
            near_spend_buckets: vec![
                SpendBucket { bucket: 10, amount: 150 },
                SpendBucket { bucket: 25, amount: 300 }, // future relative to now=15
            ],
        };

        // At t = 15 hours, bucket 20 and 25 must NOT be counted as rolling spend
        let now = 15 * HOUR_NS;
        assert_eq!(rec.rolling_spend(now), 100);
        assert_eq!(rec.rolling_near_spend(now), 150);
    }