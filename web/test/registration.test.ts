import test from "node:test";
import assert from "node:assert";
import {
  suggestNextAgentName,
  isAgentSubaccountOwnerValid,
  parseRegistrationError,
} from "../lib/registration";

test("suggestNextAgentName: generates sequential sub-account numbers properly", () => {
  assert.strictEqual(
    suggestNextAgentName("agent.sergeo-guard.testnet"),
    "agent2.sergeo-guard.testnet"
  );
  assert.strictEqual(
    suggestNextAgentName("agent2.sergeo-guard.testnet"),
    "agent3.sergeo-guard.testnet"
  );
  assert.strictEqual(
    suggestNextAgentName("agent9.sergeo-guard.testnet"),
    "agent10.sergeo-guard.testnet"
  );
  assert.strictEqual(
    suggestNextAgentName("trader.blckfme.testnet"),
    "trader2.blckfme.testnet"
  );
  assert.strictEqual(
    suggestNextAgentName("", "alice.testnet"),
    "agent2.alice.testnet"
  );
  assert.strictEqual(
    suggestNextAgentName("myagent", "bob.testnet"),
    "myagent2.bob.testnet"
  );
});

test("isAgentSubaccountOwnerValid: validates NEAR sub-account ownership invariant", () => {
  // Matching sub-accounts
  assert.strictEqual(
    isAgentSubaccountOwnerValid("agent.alice.testnet", "alice.testnet"),
    true
  );
  assert.strictEqual(
    isAgentSubaccountOwnerValid("agent2.alice.testnet", "alice.testnet"),
    true
  );
  assert.strictEqual(
    isAgentSubaccountOwnerValid("alice.testnet", "alice.testnet"),
    true
  );

  // Mismatched sub-accounts
  assert.strictEqual(
    isAgentSubaccountOwnerValid("agent.sergeo-guard.testnet", "blckfme.testnet"),
    false
  );
  assert.strictEqual(
    isAgentSubaccountOwnerValid("agent.bob.testnet", "alice.testnet"),
    false
  );

  // Empty owner allows passing
  assert.strictEqual(
    isAgentSubaccountOwnerValid("agent.sergeo-guard.testnet", ""),
    true
  );
});

test("parseRegistrationError: transforms WebAssembly trap into friendly guidance with 1-click fix", () => {
  const rawWasmTrap = JSON.stringify({
    index: 0,
    kind: {
      index: 0,
      kind: {
        FunctionCallError: {
          ExecutionError: "WebAssembly trap: An `unreachable` opcode was executed.",
        },
      },
    },
  });

  const parsed = parseRegistrationError(
    rawWasmTrap,
    "agent.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Agent Sub-Account Already In Use");
  assert.ok(parsed.message.includes("already registered"));
  assert.ok(parsed.fixGuidance.includes("agent2.sergeo-guard.testnet"));
  assert.strictEqual(parsed.quickFixLabel, "⚡ Switch to agent2.sergeo-guard.testnet (1-Click Fix)");
  assert.strictEqual(parsed.suggestedAccount, "agent2.sergeo-guard.testnet");
  assert.strictEqual(parsed.targetElementId, "agent-subaccount-input");
});

test("parseRegistrationError: transforms ownership mismatch into clear guidance with 1-click fix", () => {
  const rawWasmTrap = "WebAssembly trap: An `unreachable` opcode was executed.";
  const parsed = parseRegistrationError(
    rawWasmTrap,
    "agent.sergeo-guard.testnet",
    "blckfme.testnet"
  );

  assert.strictEqual(parsed.title, "Sub-Account Owner Mismatch");
  assert.ok(parsed.message.includes("must be a sub-account of your connected wallet (blckfme.testnet)"));
  assert.strictEqual(parsed.quickFixLabel, "⚡ Set to agent.blckfme.testnet");
  assert.strictEqual(parsed.suggestedAccount, "agent.blckfme.testnet");
  assert.strictEqual(parsed.targetElementId, "agent-subaccount-input");
});

test("parseRegistrationError: handles user cancellations gracefully", () => {
  const parsed = parseRegistrationError(
    "User rejected transaction in wallet",
    "agent2.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Transaction Cancelled");
  assert.ok(parsed.message.includes("cancelled in your NEAR wallet"));
});

test("parseRegistrationError: handles missing contract / network mismatch gracefully", () => {
  const rawMissingContract = "Can't complete the action because account scopeguard.testnet doesn't exist";
  const parsed = parseRegistrationError(
    rawMissingContract,
    "agent3.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Contract Not Found on Selected Network");
  assert.ok(parsed.message.includes("scopeguard.testnet was not found"));
  assert.ok(parsed.fixGuidance.includes("Testnet"));
});

test("parseRegistrationError: handles policy validation failure without falsely claiming duplicate", () => {
  const rawPolicyError = "ExecutionError: 'Smart contract panicked: daily_cap must be greater than zero'";
  const parsed = parseRegistrationError(
    rawPolicyError,
    "agent3.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Policy Validation Failed");
  assert.ok(parsed.message.includes("failed onchain validation"));
  assert.ok(parsed.fixGuidance.includes("daily spending cap is greater than zero"));
});
