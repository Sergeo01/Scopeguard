import test from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { draftPolicyFromText, validatePolicyShape, lintPolicy } from "../lib/drafter";
import { isAgentSubaccountOwnerValid, suggestNextAgentName } from "../lib/registration";

export interface FormInputs {
  agentName: string;
  dailyCapInput: string;
  platforms: { contract: string; methods: string }[];
  allowExternalTransfers: boolean;
  externalRecipient: string;
  autoPauseAfter: number;
  speedLimit: number;
  autoPauseWindowMinutes: number;
  connectedWalletId?: string;
  isAgentNameRegistered?: boolean;
}

export function computeButtonBlockers(inputs: FormInputs) {
  const blockers: { id: string; field: string; message: string; fix: string }[] = [];

  const isAgentNameValid =
    inputs.agentName.trim().length >= 2 &&
    inputs.agentName.trim().length <= 64 &&
    /^[a-z0-9._-]+$/.test(inputs.agentName.trim());
  const numericDailyCap = Number(inputs.dailyCapInput);
  const isDailyCapValid =
    inputs.dailyCapInput.trim().length > 0 &&
    !isNaN(numericDailyCap) &&
    numericDailyCap > 0 &&
    Number.isInteger(numericDailyCap);

  const compiledTargets: Record<string, string[]> = {};
  inputs.platforms.forEach((p) => {
    if (p.contract.trim()) {
      const methods = p.methods
        .split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0);
      compiledTargets[p.contract.trim()] = methods.length > 0 ? methods : ["swap"];
    }
  });

  const hasValidPlatforms = inputs.platforms.length > 0 && Object.keys(compiledTargets).length > 0;
  const isAutoPauseValid = Number.isInteger(inputs.autoPauseAfter) && inputs.autoPauseAfter >= 1 && inputs.autoPauseAfter <= 50;
  const isSpeedLimitValid = Number.isInteger(inputs.speedLimit) && inputs.speedLimit >= 1 && inputs.speedLimit <= 100;
  const isAutoPauseWindowValid =
    Number.isInteger(inputs.autoPauseWindowMinutes) && inputs.autoPauseWindowMinutes >= 1 && inputs.autoPauseWindowMinutes <= 1440;

  if (!inputs.agentName.trim()) {
    blockers.push({
      id: "missing-agent-name",
      field: "Agent Sub-Account",
      message: "Agent Sub-Account ID is required.",
      fix: "Enter a valid NEAR account name (e.g. agent.sergeo-guard.testnet) in the Agent Sub-Account field.",
    });
  } else if (inputs.agentName.trim().length < 2 || inputs.agentName.trim().length > 64) {
    blockers.push({
      id: "invalid-agent-name-length",
      field: "Agent Sub-Account",
      message: "Agent Sub-Account length must be between 2 and 64 characters.",
      fix: "Provide an account identifier between 2 and 64 characters to satisfy NEAR standards.",
    });
  } else if (!/^[a-z0-9._-]+$/.test(inputs.agentName.trim())) {
    blockers.push({
      id: "invalid-agent-name",
      field: "Agent Sub-Account",
      message: "Agent Sub-Account contains invalid characters or spaces.",
      fix: "Use only lowercase alphanumeric characters, dots, hyphens, and underscores (e.g. agent.alice.testnet).",
    });
  } else if (inputs.connectedWalletId && !isAgentSubaccountOwnerValid(inputs.agentName, inputs.connectedWalletId)) {
    blockers.push({
      id: "subaccount-owner-mismatch",
      field: "Agent Sub-Account",
      message: `Account "${inputs.agentName}" must be a sub-account of your connected wallet (${inputs.connectedWalletId}).`,
      fix: `Change your agent sub-account to end with .${inputs.connectedWalletId}.`,
    });
  } else if (inputs.isAgentNameRegistered) {
    const next = suggestNextAgentName(inputs.agentName, inputs.connectedWalletId);
    blockers.push({
      id: "agent-already-registered",
      field: "Agent Sub-Account",
      message: `Sub-account "${inputs.agentName}" is already registered on this Guard.`,
      fix: `Every agent must have a unique sub-account. Use ${next} instead.`,
    });
  }

  if (!isDailyCapValid) {
    blockers.push({
      id: "invalid-daily-cap",
      field: "Daily Spending Cap",
      message: "Daily Spending Cap must be a positive whole number greater than $0.",
      fix: "Type an integer dollar figure greater than 0 (e.g. 100) or click one of the quick preset chips.",
    });
  }

  if (!hasValidPlatforms) {
    blockers.push({
      id: "missing-platforms",
      field: "Approved Platforms",
      message: "At least one target platform contract with callable methods is required.",
      fix: "Select a pre-vetted platform (e.g. Testnet DEX) or add a custom contract with at least one callable method.",
    });
  }

  if (inputs.allowExternalTransfers && !inputs.externalRecipient.trim()) {
    blockers.push({
      id: "missing-recipient",
      field: "Designated Recipient",
      message: "Direct cash transfers are enabled but no recipient account is specified.",
      fix: "Enter a destination NEAR account (e.g. sergeo-guard.testnet) or turn off the external transfers toggle.",
    });
  } else if (inputs.allowExternalTransfers && inputs.externalRecipient.trim() && (inputs.externalRecipient.trim().length < 2 || inputs.externalRecipient.trim().length > 64 || !/^[a-z0-9._-]+$/.test(inputs.externalRecipient.trim()))) {
    blockers.push({
      id: "invalid-recipient",
      field: "Designated Recipient",
      message: "Recipient account address contains invalid characters or length.",
      fix: "Enter a valid NEAR account ID between 2 and 64 characters (lowercase letters, numbers, hyphens, dots).",
    });
  }

  if (!isAutoPauseValid) {
    blockers.push({
      id: "invalid-auto-pause",
      field: "Auto-Brake Strikes",
      message: "Auto-brake strikes must be an integer between 1 and 50.",
      fix: "Set a strike count between 1 and 50 rejections.",
    });
  }

  if (!isSpeedLimitValid) {
    blockers.push({
      id: "invalid-speed-limit",
      field: "Speed Throttle",
      message: "Speed limit must be between 1 and 100 calls per 10 minutes.",
      fix: "Set the speed limit between 1 and 100.",
    });
  }

  if (!isAutoPauseWindowValid) {
    blockers.push({
      id: "invalid-auto-pause-window",
      field: "Check Window",
      message: "Check window must be between 1 and 1440 minutes.",
      fix: "Set rolling minutes between 1 and 1440.",
    });
  }

  const dummyPolicy = {
    token: "sergeo-guard-token.testnet",
    targets: compiledTargets,
    daily_cap: Number(inputs.dailyCapInput) || 0,
    recipients: inputs.allowExternalTransfers && inputs.externalRecipient.trim() ? [inputs.externalRecipient.trim()] : [],
    max_actions_per_10min: inputs.speedLimit,
    auto_pause_rejects: inputs.autoPauseAfter,
    auto_pause_window_minutes: inputs.autoPauseWindowMinutes,
    high_value_threshold: Math.max(1, Math.floor((Number(inputs.dailyCapInput) || 100) / 2)),
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 60,
  };

  const schemaErrors = validatePolicyShape(dummyPolicy);
  schemaErrors.forEach((err, idx) => {
    if (err.includes("daily_cap") && blockers.some((b) => b.id === "invalid-daily-cap")) return;
    if (err.includes("targets") && blockers.some((b) => b.id === "missing-platforms")) return;
    blockers.push({
      id: `schema-err-${idx}`,
      field: "Policy Schema",
      message: err,
      fix: "Update policy inputs to satisfy onchain schema requirements.",
    });
  });

  return blockers;
}

test("button-blockers: detects missing agent sub-account name and yields actionable fix", () => {
  const validBaseline: FormInputs = {
    agentName: "agent.alice.testnet",
    dailyCapInput: "150",
    platforms: [{ contract: "sergeo-guard-dex.testnet", methods: "swap" }],
    allowExternalTransfers: false,
    externalRecipient: "",
    autoPauseAfter: 3,
    speedLimit: 5,
    autoPauseWindowMinutes: 10,
  };

  // Valid baseline produces zero blockers
  const baselineBlockers = computeButtonBlockers(validBaseline);
  assert.strictEqual(baselineBlockers.length, 0);

  // Missing agent name
  const emptyNameBlockers = computeButtonBlockers({ ...validBaseline, agentName: "   " });
  assert.strictEqual(emptyNameBlockers.length >= 1, true);
  const nameBlocker = emptyNameBlockers.find((b) => b.field === "Agent Sub-Account");
  assert.ok(nameBlocker);
  assert.strictEqual(nameBlocker.id, "missing-agent-name");
  assert.strictEqual(nameBlocker.message, "Agent Sub-Account ID is required.");
  assert.ok(nameBlocker.fix.includes("Enter a valid NEAR account name"));

  // Invalid characters with spaces or uppercase
  const invalidNameBlockers = computeButtonBlockers({ ...validBaseline, agentName: "Agent Alice! Testnet" });
  const invalidBlocker = invalidNameBlockers.find((b) => b.field === "Agent Sub-Account");
  assert.ok(invalidBlocker);
  assert.strictEqual(invalidBlocker.id, "invalid-agent-name");

  // Single character length boundary (< 2 chars)
  const shortNameBlockers = computeButtonBlockers({ ...validBaseline, agentName: "a" });
  const shortBlocker = shortNameBlockers.find((b) => b.id === "invalid-agent-name-length");
  assert.ok(shortBlocker);
  assert.strictEqual(shortBlocker.field, "Agent Sub-Account");

  // Ownership mismatch against connected wallet
  const mismatchBlockers = computeButtonBlockers({
    ...validBaseline,
    agentName: "agent.sergeo-guard.testnet",
    connectedWalletId: "blckfme.testnet",
  });
  const mismatch = mismatchBlockers.find((b) => b.id === "subaccount-owner-mismatch");
  assert.ok(mismatch);
  assert.ok(mismatch.message.includes("must be a sub-account of your connected wallet (blckfme.testnet)"));

  // Duplicate registration detection
  const duplicateBlockers = computeButtonBlockers({
    ...validBaseline,
    agentName: "agent.alice.testnet",
    connectedWalletId: "alice.testnet",
    isAgentNameRegistered: true,
  });
  const dup = duplicateBlockers.find((b) => b.id === "agent-already-registered");
  assert.ok(dup);
  assert.ok(dup.message.includes("is already registered on this Guard"));
  assert.ok(dup.fix.includes("agent2.alice.testnet"));
});

test("button-blockers: detects zero or invalid daily spending cap and yields actionable fix", () => {
  const validBaseline: FormInputs = {
    agentName: "agent.alice.testnet",
    dailyCapInput: "150",
    platforms: [{ contract: "sergeo-guard-dex.testnet", methods: "swap" }],
    allowExternalTransfers: false,
    externalRecipient: "",
    autoPauseAfter: 3,
    speedLimit: 5,
    autoPauseWindowMinutes: 10,
  };

  const zeroCapBlockers = computeButtonBlockers({ ...validBaseline, dailyCapInput: "0" });
  const zeroCap = zeroCapBlockers.find((b) => b.field === "Daily Spending Cap");
  assert.ok(zeroCap);
  assert.strictEqual(zeroCap.id, "invalid-daily-cap");
  assert.ok(zeroCap.fix.includes("Type an integer dollar figure"));

  const emptyCapBlockers = computeButtonBlockers({ ...validBaseline, dailyCapInput: "" });
  assert.ok(emptyCapBlockers.some((b) => b.id === "invalid-daily-cap"));

  const decimalCapBlockers = computeButtonBlockers({ ...validBaseline, dailyCapInput: "12.5" });
  assert.ok(decimalCapBlockers.some((b) => b.id === "invalid-daily-cap"));
});

test("button-blockers: detects empty platform targets and missing recipient when transfer toggle is active", () => {
  const validBaseline: FormInputs = {
    agentName: "agent.alice.testnet",
    dailyCapInput: "150",
    platforms: [{ contract: "sergeo-guard-dex.testnet", methods: "swap" }],
    allowExternalTransfers: false,
    externalRecipient: "",
    autoPauseAfter: 3,
    speedLimit: 5,
    autoPauseWindowMinutes: 10,
  };

  // No platforms
  const noPlatforms = computeButtonBlockers({ ...validBaseline, platforms: [] });
  assert.ok(noPlatforms.some((b) => b.id === "missing-platforms"));

  // External transfer toggle ON but recipient empty
  const missingRecipient = computeButtonBlockers({
    ...validBaseline,
    allowExternalTransfers: true,
    externalRecipient: "",
  });
  assert.ok(missingRecipient.some((b) => b.id === "missing-recipient"));
});

test("chat-assistant: natural language drafting generates valid policy specification with plain English", async () => {
  const result = await draftPolicyFromText(
    "Create an autonomous trading policy for sergeo-guard-dex.testnet allowing swap with a $250 daily cap and 5 actions per 10 minutes"
  );

  assert.strictEqual(result.schemaValidated, true);
  assert.strictEqual(result.validationErrors.length, 0);
  assert.strictEqual(result.policy.daily_cap, 250);
  assert.strictEqual(result.policy.max_actions_per_10min, 5);
  assert.ok(result.policy.targets["sergeo-guard-dex.testnet"]);
  assert.ok(result.plainEnglish.length > 10);
});

test("dash-invariant: ensures zero em dashes and zero en dashes exist in web source files", () => {
  const webDir = path.resolve(__dirname, "..");
  let violations = 0;

  function scan(dir: string) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        if (f !== "node_modules" && f !== ".next" && f !== ".git") scan(p);
      } else if (f.endsWith(".tsx") || f.endsWith(".ts")) {
        const content = fs.readFileSync(p, "utf-8");
        if (content.includes("\u2014") || content.includes("\u2013")) {
          violations++;
        }
      }
    }
  }

  scan(webDir);
  assert.strictEqual(violations, 0, "No em dashes or en dashes permitted in web source files");
});
