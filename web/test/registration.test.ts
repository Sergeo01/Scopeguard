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

test("parseRegistrationError: handles raw object from Wallet Selector / RPC without stringification", () => {
  const rawObj = {
    index: 0,
    kind: {
      index: 0,
      kind: {
        FunctionCallError: {
          ExecutionError: "WebAssembly trap: An `unreachable` opcode was executed.",
        },
      },
    },
  };

  const parsed = parseRegistrationError(
    rawObj,
    "agent2.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Agent Sub-Account Already In Use");
  assert.ok(parsed.message.includes("already registered"));
  assert.strictEqual(parsed.suggestedAccount, "agent3.sergeo-guard.testnet");
  assert.strictEqual(parsed.quickFixLabel, "⚡ Switch to agent3.sergeo-guard.testnet (1-Click Fix)");
});

test("parseRegistrationError: handles WasmTrap(Unreachable) RPC response", () => {
  const rpcError = "wasm execution failed with error: WasmTrap(Unreachable)";
  const parsed = parseRegistrationError(
    rpcError,
    "agent.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Agent Sub-Account Already In Use");
  assert.ok(parsed.message.includes("already registered"));
  assert.strictEqual(parsed.suggestedAccount, "agent2.sergeo-guard.testnet");
});

test("parseRegistrationError: handles insufficient storage balance during subaccount creation", () => {
  const balanceError = "Sender does not have enough balance 0.1 for operation costing 0.1009 NEAR";
  const parsed = parseRegistrationError(
    balanceError,
    "agent4.sergeo-guard.testnet",
    "sergeo-guard.testnet"
  );

  assert.strictEqual(parsed.title, "Insufficient Storage Balance");
  assert.ok(parsed.message.includes("minimum balance of 0.25 NEAR"));
});

test("handoff card: provides dedicated passkey and prompt for strict trading bot without tab clutter", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const cardPath = path.resolve(__dirname, "../components/AgentHandoffCard.tsx");
  const content = fs.readFileSync(cardPath, "utf8");

  // Must feature two handoff paths: direct passkey and agent system prompt
  assert.ok(content.includes("Scoped Protocol Passkey"), "Must feature Scoped Protocol Passkey section");
  assert.ok(content.includes("AI Agent System Prompt"), "Must feature AI Agent System Prompt section");
  assert.ok(content.includes("Copy Key"), "Must have Copy Key action");
  assert.ok(content.includes("Copy Bot Prompt"), "Must have Copy Bot Prompt action");

  // Must not contain any occurrence of Telegram
  assert.ok(!content.includes("Telegram"), "Card source must contain no occurrence of the word Telegram");

  // Must avoid extraneous tab navigation buttons
  assert.ok(!content.includes('setActiveTab("cli")'), "Must avoid CLI tab");
  assert.ok(!content.includes('setActiveTab("json")'), "Must avoid JSON tab");
  assert.ok(!content.includes('setActiveTab("near")'), "Must avoid NEAR tab");
});
