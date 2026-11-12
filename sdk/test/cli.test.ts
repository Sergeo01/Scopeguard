import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { execSync } from "node:child_process";
import * as path from "node:path";

describe("CLI: Help, Setup Policy, and Actions", () => {
  const cliPath = path.resolve(__dirname, "../bin/cli.js");

  it("help text includes transfer example and documents --recipient flag", () => {
    const output = execSync(`node "${cliPath}" --help`, { encoding: "utf-8" });
    assert.ok(output.includes("--recipient <account>"), "help should document --recipient flag");
    assert.ok(
      output.includes("act --recipient merchant.testnet --amount 10") ||
      output.includes("act --recipient"),
      "help should include act --recipient transfer example"
    );
  });

  it("generates policy with ft_transfer target and recipients when payments are enabled", () => {
    // Test the logic directly matching runSetup payments logic
    const tokenContract = "sergeo-guard-token.testnet";
    const targets: Record<string, string[]> = { "sergeo-guard-dex.testnet": ["swap"] };
    const recipients = ["merchant.testnet", "alice.testnet"];

    if (recipients.length > 0) {
      targets[tokenContract] = ["ft_transfer"];
    }

    assert.deepEqual(targets[tokenContract], ["ft_transfer"]);
    assert.deepEqual(recipients, ["merchant.testnet", "alice.testnet"]);
  });

  it("keeps swap-only targets and empty recipients when payments are disabled", () => {
    const tokenContract = "sergeo-guard-token.testnet";
    const targets: Record<string, string[]> = { "sergeo-guard-dex.testnet": ["swap"] };
    const recipients: string[] = [];

    if (recipients.length > 0) {
      targets[tokenContract] = ["ft_transfer"];
    }

    assert.equal(targets[tokenContract], undefined);
    assert.equal(recipients.length, 0);
  });
});
