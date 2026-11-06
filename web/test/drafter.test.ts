import test from "node:test";
import assert from "node:assert";
import {
  validatePolicyShape,
  lintPolicy,
  getSafeDefaultPolicy,
  generatePlainEnglish,
  draftPolicyFromText,
  DrafterPolicy,
} from "../lib/drafter.ts";

test("drafter: validatePolicyShape accepts valid policies and rejects malformed ones", () => {
  const validPolicy: DrafterPolicy = {
    token: "sergeo-guard-token.testnet",
    targets: {
      "sergeo-guard-dex.testnet": ["swap"],
      "ref-finance.testnet": ["swap", "deposit"],
    },
    daily_cap: 100,
    recipients: [],
    max_actions_per_10min: 5,
    auto_pause_rejects: 3,
    auto_pause_window_minutes: 10,
    high_value_threshold: 50,
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 600,
  };

  const validErrors = validatePolicyShape(validPolicy);
  assert.deepStrictEqual(validErrors, []);

  // Reject null or non-object
  assert.ok(validatePolicyShape(null).length > 0);
  assert.ok(validatePolicyShape("string").length > 0);

  // Reject invalid token account id
  const badToken = { ...validPolicy, token: "invalidtoken" };
  const tokenErrors = validatePolicyShape(badToken);
  assert.ok(tokenErrors.some((e) => e.includes("token must be a contract account id")));

  // Reject empty targets or invalid target format
  const noTargets = { ...validPolicy, targets: {} };
  assert.ok(validatePolicyShape(noTargets).some((e) => e.includes("targets must name at least one contract")));

  const nonArrayMethods = { ...validPolicy, targets: { "sergeo-guard-dex.testnet": "swap" as any } };
  assert.ok(validatePolicyShape(nonArrayMethods).some((e) => e.includes("must list at least one method")));

  // Reject negative or invalid daily cap
  const badCap = { ...validPolicy, daily_cap: -50 };
  assert.ok(validatePolicyShape(badCap).some((e) => e.includes("daily_cap must be a positive integer")));

  // Autonomous risk safeguards: test valid and invalid shapes
  const validSafeguardsPolicy: DrafterPolicy = {
    ...validPolicy,
    max_drawdown_bps: 1500,
    lease_expires_at: (Date.now() + 86400 * 1000) * 1_000_000, // nanosecond timestamp
    intent_recipients: ["0x71C8363837381F025701262B4527964b071661A4"],
    canary_methods: ["emergency_withdraw_all", "drain_vault"],
  };
  assert.deepStrictEqual(validatePolicyShape(validSafeguardsPolicy), []);

  // String timestamp format
  const validStringTimestampPolicy = {
    ...validPolicy,
    lease_expires_at: "1793742193647000000" as any,
  };
  assert.deepStrictEqual(validatePolicyShape(validStringTimestampPolicy), []);

  // Invalid max_drawdown_bps > 10000
  const badDrawdown = { ...validPolicy, max_drawdown_bps: 12000 };
  assert.ok(validatePolicyShape(badDrawdown).some((e) => e.includes("max_drawdown_bps must be an integer between 0 and 10000")));

  // Invalid canary_methods containing non-string
  const badCanary = { ...validPolicy, canary_methods: [123 as any] };
  assert.ok(validatePolicyShape(badCanary).some((e) => e.includes("canary_methods must be an array of method name strings")));

  // Invalid intent_recipients containing non-string
  const badIntent = { ...validPolicy, intent_recipients: [true as any] };
  assert.ok(validatePolicyShape(badIntent).some((e) => e.includes("intent_recipients must be an array of strings")));
});

test("drafter: lintPolicy flags dangerous administrative methods, open recipients, and velocity anomalies", () => {
  const dangerousPolicy: DrafterPolicy = {
    token: "sergeo-guard-token.testnet",
    targets: {
      "sergeo-guard-dex.testnet": ["swap", "upgrade_contract"], // dangerous method
    },
    daily_cap: 5000,
    recipients: ["external-recipient.testnet"], // open recipient with large daily cap
    max_actions_per_10min: 50, // velocity > 30
    auto_pause_rejects: 3,
    auto_pause_window_minutes: 10,
    high_value_threshold: 10000, // threshold > daily cap
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 600,
  };

  const warnings = lintPolicy(dangerousPolicy);
  assert.ok(warnings.length >= 4);
  assert.ok(warnings.some((w) => w.field === "targets" && w.severity === "danger"));
  assert.ok(warnings.some((w) => w.field === "recipients"));
  assert.ok(warnings.some((w) => w.field === "max_actions_per_10min"));
  assert.ok(warnings.some((w) => w.field === "high_value_threshold"));
});

test("drafter: lintPolicy flags value-moving denylist methods and validatePolicyShape validates near fields", () => {
  const denylistPolicy: DrafterPolicy = {
    token: "sergeo-guard-token.testnet",
    targets: {
      "sergeo-guard-dex.testnet": ["swap", "ft_transfer", "near_withdraw", "storage_withdraw"],
    },
    daily_cap: 100,
    recipients: [],
    max_actions_per_10min: 5,
    auto_pause_rejects: 5,
    auto_pause_window_minutes: 10,
    high_value_threshold: 50,
    high_value_delay_seconds: 3600,
    policy_change_delay_seconds: 600,
    near_daily_cap: 1000,
    near_high_value_threshold: 500,
  };

  const warnings = lintPolicy(denylistPolicy);
  const targetWarnings = warnings.filter((w) => w.field === "targets" && w.severity === "danger");
  assert.ok(targetWarnings.length >= 3);
  assert.ok(targetWarnings.some((w) => w.message.includes("ft_transfer")));
  assert.ok(targetWarnings.some((w) => w.message.includes("near_withdraw")));
  assert.ok(targetWarnings.some((w) => w.message.includes("storage_withdraw")));

  assert.deepStrictEqual(validatePolicyShape(denylistPolicy), []);

  const invalidNear = { ...denylistPolicy, near_daily_cap: -5 };
  assert.ok(validatePolicyShape(invalidNear).some((e) => e.includes("near_daily_cap")));
});

test("drafter: getSafeDefaultPolicy returns least-privilege baseline", () => {
  const def = getSafeDefaultPolicy(150);
  assert.strictEqual(def.daily_cap, 150);
  assert.strictEqual(def.high_value_threshold, 75);
  assert.deepStrictEqual(def.recipients, []); // empty = external payouts blocked
  assert.deepStrictEqual(validatePolicyShape(def), []);
});

test("drafter: generatePlainEnglish renders clear human explanations", () => {
  const policy = getSafeDefaultPolicy(100);
  const text = generatePlainEnglish(policy);
  assert.ok(text.includes("100 mUSD"));
  assert.ok(text.includes("sergeo-guard-dex.testnet"));
  assert.ok(text.includes("Direct transfers to outside recipients are completely forbidden."));
});

test("drafter: draftPolicyFromText extracts parameters and falls back gracefully", async () => {
  const prompt = "Trade up to 250 mUSD per day on DEX, max 10 actions per 10 minutes";
  const result = await draftPolicyFromText(prompt);

  assert.strictEqual(result.policy.daily_cap, 250);
  assert.strictEqual(result.policy.max_actions_per_10min, 10);
  assert.strictEqual(result.schemaValidated, true);
  assert.deepStrictEqual(result.validationErrors, []);
  assert.ok(result.plainEnglish.includes("250 mUSD"));
});

test("drafter: word boundary target matching avoids false positives", async () => {
  // 'refresh' should NOT trigger ref finance target
  const nonRefPrompt = "Refresh my token balance and do swaps up to 100 mUSD";
  const nonRefResult = await draftPolicyFromText(nonRefPrompt);
  assert.strictEqual(nonRefResult.policy.targets["ref-finance-101.testnet"], undefined);
  assert.ok(nonRefResult.policy.targets["sergeo-guard-dex.testnet"] !== undefined);

  // 'ref' or 'ref finance' SHOULD trigger ref finance target
  const refPrompt = "Swap on ref finance up to 200 mUSD";
  const refResult = await draftPolicyFromText(refPrompt);
  assert.ok(refResult.policy.targets["ref-finance-101.testnet"] !== undefined);

  // 'burrow' SHOULD trigger burrow target
  const burrowPrompt = "Borrow and deposit on burrow with 300 cap";
  const burrowResult = await draftPolicyFromText(burrowPrompt);
  assert.ok(burrowResult.policy.targets["contract.burrow.testnet"] !== undefined);
});
