import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { lintPolicy, DrafterPolicy } from "../lib/drafter";

test("handoff card: prompt opens as autonomous agent and provides swap and transfer examples", () => {
  const cardPath = path.resolve(__dirname, "../components/AgentHandoffCard.tsx");
  const content = fs.readFileSync(cardPath, "utf8");

  // Must open as autonomous agent, not autonomous trading agent
  assert.ok(
    content.includes("You are my autonomous agent on NEAR Testnet protected by ScopeGuard."),
    "Prompt must open as autonomous agent, not trading agent"
  );
  assert.ok(
    !content.includes("You are my autonomous trading agent on NEAR Testnet"),
    "Prompt must not restrict agent to 'trading agent'"
  );

  // Must include transfer path documentation
  assert.ok(content.includes("Direct Payments (Transfers):"), "Prompt must document direct payments");
  assert.ok(content.includes("ft_transfer"), "Prompt must document ft_transfer action");
  assert.ok(content.includes("--recipient"), "Prompt must include --recipient flag documentation");
  assert.ok(content.includes("REASON_RECIPIENT"), "Prompt must mention REASON_RECIPIENT");

  // Must include worked examples for both swap and transfer
  assert.ok(content.includes("1. Swap Example:"), "Prompt must include Swap Example");
  assert.ok(content.includes("2. Transfer / Payment Example:"), "Prompt must include Transfer / Payment Example");
});

test("handoff card: near add-key command targets agent sub-account, not owner", () => {
  const cardPath = path.resolve(__dirname, "../components/AgentHandoffCard.tsx");
  const content = fs.readFileSync(cardPath, "utf8");

  assert.ok(
    content.includes("--accountId ${agentName}"),
    "near add-key command must use --accountId ${agentName} so agent authorizes its own key"
  );
  assert.ok(
    !content.includes("--methodNames execute --allowance 0.25 --accountId ${ownerName}"),
    "near add-key must not use --accountId ${ownerName}"
  );
});

test("create page: auto-adds ft_transfer target on token contract when transfers are enabled", () => {
  const createPath = path.resolve(__dirname, "../app/create/page.tsx");
  const content = fs.readFileSync(createPath, "utf8");

  assert.ok(
    content.includes('compiledTargets[tokenContract] = [...existingMethods, "ft_transfer"]'),
    "Create page must auto-add ft_transfer target when transfers are enabled"
  );
  assert.ok(
    content.includes("sergeo-guard-token.testnet"),
    "Create page must reference policy token contract"
  );
  assert.ok(
    !content.includes("${dailyCap} mUSD"),
    "Create page preview must not prefix dailyCap with a dollar sign"
  );
});

test("drafter: permits ft_transfer on policy token when recipients are defined", () => {
  const policyWithTransfers: DrafterPolicy = {
    token: "sergeo-guard-token.testnet",
    targets: {
      "sergeo-guard-dex.testnet": ["swap"],
      "sergeo-guard-token.testnet": ["ft_transfer"],
    },
    daily_cap: 500,
    recipients: ["sergeo-guard.testnet"],
    max_actions_per_10min: 5,
    auto_pause_rejects: 3,
    auto_pause_window_minutes: 10,
    high_value_threshold: 250,
  };

  const lints = lintPolicy(policyWithTransfers);
  const dangerLints = lints.filter((l) => l.severity === "danger");
  assert.strictEqual(
    dangerLints.length,
    0,
    "Policy with (token, ft_transfer) and recipients must not produce danger lints"
  );
});
