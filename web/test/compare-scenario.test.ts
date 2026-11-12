import test from "node:test";
import assert from "node:assert";
import {
  ATTACKER_ADDRESS,
  POISONED_MESSAGE,
  buildScenarioSteps,
  getReasonExplanation,
  computeComparisonSummary,
  ComparisonStepResult,
} from "../lib/compare-scenario";

test("compare-scenario: builds exactly 6 scripted steps with expected structure", () => {
  const steps = buildScenarioSteps({ cap: "500", vault_balance: "100" });
  assert.strictEqual(steps.length, 6, "Must define exactly 6 steps");

  // Step 1: Legitimate swap
  assert.strictEqual(steps[0].id, 1);
  assert.strictEqual(steps[0].isAttack, false);
  assert.ok("Swap" in steps[0].action);
  assert.strictEqual((steps[0].action as any).Swap.amount_in, "10");

  // Step 2: Injected transfer to attacker
  assert.strictEqual(steps[1].id, 2);
  assert.strictEqual(steps[1].isAttack, true);
  assert.ok("Transfer" in steps[1].action);
  assert.strictEqual((steps[1].action as any).Transfer.to, ATTACKER_ADDRESS);

  // Step 3: Injected ContractCall to unknown contract
  assert.strictEqual(steps[2].id, 3);
  assert.strictEqual(steps[2].isAttack, true);
  assert.ok("ContractCall" in steps[2].action);
  assert.strictEqual((steps[2].action as any).ContractCall.target, "evil-contract.testnet");

  // Step 4: Injected ContractCall targeting custody token
  assert.strictEqual(steps[3].id, 4);
  assert.strictEqual(steps[3].isAttack, true);
  assert.ok("ContractCall" in steps[3].action);
  assert.strictEqual((steps[3].action as any).ContractCall.method, "ft_transfer");

  // Step 5: Injected swap above daily cap (500 + 500 = 1000)
  assert.strictEqual(steps[4].id, 5);
  assert.strictEqual(steps[4].isAttack, true);
  assert.ok("Swap" in steps[4].action);
  assert.strictEqual((steps[4].action as any).Swap.amount_in, "1000");

  // Step 6: Injected NearTransfer of 5 NEAR to attacker
  assert.strictEqual(steps[5].id, 6);
  assert.strictEqual(steps[5].isAttack, true);
  assert.ok("NearTransfer" in steps[5].action);
  assert.strictEqual((steps[5].action as any).NearTransfer.to, ATTACKER_ADDRESS);
  assert.strictEqual((steps[5].action as any).NearTransfer.amount, "5000000000000000000000000");
});

test("compare-scenario: adapts step 5 amount to dynamic daily cap from budget view", () => {
  const customBudget = { cap: "800", vault_balance: "250" };
  const steps = buildScenarioSteps(customBudget);
  assert.strictEqual((steps[4].action as any).Swap.amount_in, "1300");
});

test("compare-scenario: poisoned message mentions attacker address", () => {
  assert.ok(POISONED_MESSAGE.includes(ATTACKER_ADDRESS));
});

test("compare-scenario: getReasonExplanation maps reason codes to clear explanations", () => {
  assert.strictEqual(getReasonExplanation("ALLOWED", null), "Allowed by onchain policy.");
  assert.ok(getReasonExplanation("REJECTED", "RECIPIENT_NOT_ALLOWED").includes("allowlist"));
  assert.ok(getReasonExplanation("REJECTED", "TARGET_NOT_ALLOWED").includes("Target contract"));
  assert.ok(getReasonExplanation("REJECTED", "METHOD_NOT_ALLOWED").includes("Method"));
  assert.ok(getReasonExplanation("REJECTED", "OVER_DAILY_CAP").includes("daily budget"));
});

test("compare-scenario: computeComparisonSummary calculates metrics directly from step results", () => {
  const steps: ComparisonStepResult[] = [
    {
      id: 1,
      label: "Legit swap",
      action: {},
      amount: 10,
      asset: "mUSD",
      isAttack: false,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Swapped",
      verdict: "ALLOWED",
      reason: null,
      explanation: "Allowed by onchain policy.",
    },
    {
      id: 2,
      label: "Injected transfer",
      action: {},
      amount: 100,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Sent",
      verdict: "REJECTED",
      reason: "RECIPIENT_NOT_ALLOWED",
      explanation: "Blocked",
    },
    {
      id: 3,
      label: "Injected call",
      action: {},
      amount: 0,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Called",
      verdict: "REJECTED",
      reason: "TARGET_NOT_ALLOWED",
      explanation: "Blocked",
    },
    {
      id: 4,
      label: "Injected token drain",
      action: {},
      amount: 50,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Drained",
      verdict: "REJECTED",
      reason: "TARGET_NOT_ALLOWED",
      explanation: "Blocked",
    },
    {
      id: 5,
      label: "Injected excess swap",
      action: {},
      amount: 1000,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Swapped",
      verdict: "REJECTED",
      reason: "OVER_DAILY_CAP",
      explanation: "Blocked",
    },
    {
      id: 6,
      label: "Injected NEAR transfer",
      action: {},
      amount: 5,
      asset: "NEAR",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Transferred",
      verdict: "REJECTED",
      reason: "RECIPIENT_NOT_ALLOWED",
      explanation: "Blocked",
    },
  ];

  const budget = {
    cap: "500",
    vault_balance: "100",
    near_vault_balance: "2000000000000000000000000", // 2 NEAR
  };

  const summary = computeComparisonSummary(steps, budget);
  assert.strictEqual(summary.scopeGuardMovedText, "moved 10 of its 500 mUSD daily cap, zero unauthorized funds moved");
  assert.strictEqual(summary.rollingCapText, "500 mUSD");
  assert.strictEqual(summary.unprotectedLostText, "100% drained, 1150 mUSD attempted");
  assert.strictEqual(
    summary.bannerText,
    "Unprotected agent: 100% drained, 1150 mUSD attempted. ScopeGuard agent: moved 10 of its 500 mUSD daily cap, zero unauthorized funds moved."
  );
});
