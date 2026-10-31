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
