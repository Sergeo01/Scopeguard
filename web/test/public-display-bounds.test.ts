import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { computeComparisonSummary, ComparisonStepResult } from "../lib/compare-scenario";

test("public pages: zero occurrences of demo vault figure (350) on landing and arena", () => {
  const landingPath = path.resolve(__dirname, "../app/page.tsx");
  const content = fs.readFileSync(landingPath, "utf8");

  // Must not contain 350 as a vault figure or stat
  assert.ok(!content.includes("$350"), "Landing page must not contain '$350'");
  assert.ok(!content.includes("350.00"), "Landing page must not start state at '350.00'");
  assert.ok(!content.includes("pot ($350)"), "Rule 13 description must not mention ($350)");
  assert.ok(!content.includes("Working Vault Pot:"), "Verdict panel must not display 'Working Vault Pot:'");
  assert.ok(!content.includes("$500 daily limit"), "Scenario description must not use '$500 daily limit'");
  assert.ok(!content.includes("$1,200 swap"), "Scenario description must not use '$1,200 swap'");
});

test("public pages: zero occurrences of demo vault figure on compare page and scenario lib", () => {
  const comparePath = path.resolve(__dirname, "../app/compare/page.tsx");
  const scenarioPath = path.resolve(__dirname, "../lib/compare-scenario.ts");

  const compareContent = fs.readFileSync(comparePath, "utf8");
  const scenarioContent = fs.readFileSync(scenarioPath, "utf8");

  assert.ok(!compareContent.includes("350"), "Compare page must not contain 350");
  assert.ok(!scenarioContent.includes("350"), "Compare scenario definitions must not contain 350");
});

test("compare scenario: summary never names the vault total and matches exact format", () => {
  const mockSteps: ComparisonStepResult[] = [
    {
      id: 1,
      label: "Legit swap",
      action: {},
      amount: 10,
      asset: "mUSD",
      isAttack: false,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Legit swap executed",
      verdict: "ALLOWED",
      reason: null,
      explanation: "Allowed by onchain policy.",
    },
    {
      id: 2,
      label: "Hostile sweep",
      action: {},
      amount: 100,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Direct transfer executed",
      verdict: "REJECTED",
      reason: "RECIPIENT_NOT_ALLOWED",
      explanation: "Blocked",
    },
    {
      id: 3,
      label: "Unauthorized call",
      action: {},
      amount: 0,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Unauthorized invocation",
      verdict: "REJECTED",
      reason: "TARGET_NOT_ALLOWED",
      explanation: "Blocked",
    },
    {
      id: 4,
      label: "Token transfer on custody token",
      action: {},
      amount: 50,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Raw transfer executed",
      verdict: "REJECTED",
      reason: "TARGET_NOT_ALLOWED",
      explanation: "Blocked",
    },
    {
      id: 5,
      label: "Swap exceeding daily cap",
      action: {},
      amount: 1000,
      asset: "mUSD",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Unconstrained swap executed",
      verdict: "REJECTED",
      reason: "OVER_DAILY_CAP",
      explanation: "Blocked",
    },
    {
      id: 6,
      label: "NEAR transfer to attacker",
      action: {},
      amount: 5,
      asset: "NEAR",
      isAttack: true,
      unprotectedOutcome: "EXECUTED",
      unprotectedDescription: "Transferred 5 NEAR",
      verdict: "REJECTED",
      reason: "RECIPIENT_NOT_ALLOWED",
      explanation: "Blocked",
    },
  ];

  const summary = computeComparisonSummary(mockSteps, { cap: "500", vault_balance: "350" });

  // Unprotected: percent drained + attempted amount
  assert.strictEqual(summary.unprotectedLostText, "100% drained, 1150 mUSD attempted");

  // ScopeGuard: movement against daily cap
  assert.strictEqual(summary.scopeGuardMovedText, "moved 10 of its 500 mUSD daily cap, zero unauthorized funds moved");

  // Banner text
  assert.strictEqual(
    summary.bannerText,
    "Unprotected agent: 100% drained, 1150 mUSD attempted. ScopeGuard agent: moved 10 of its 500 mUSD daily cap, zero unauthorized funds moved."
  );

  // Must never name the vault total (350)
  assert.ok(!summary.bannerText.includes("350"), "Banner text must not contain 350");
  assert.ok(!summary.unprotectedLostText.includes("350"), "Unprotected lost text must not contain 350");
});

test("dashboard console: retains real vault figure and displays demo funds label", () => {
  const dashPath = path.resolve(__dirname, "../app/dashboard/page.tsx");
  const content = fs.readFileSync(dashPath, "utf8");

  assert.ok(content.includes("Demo vault, testnet mUSD, no real value."), "Dashboard must have demo funds label");
  assert.ok(content.includes("vaultBalance"), "Dashboard retains vault balance");
});
