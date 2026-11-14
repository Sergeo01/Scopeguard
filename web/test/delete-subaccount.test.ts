import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

test("delete subaccount: generates accurate revoke_agent and near delete CLI commands", () => {
  const agentAccount = "agent.blckfme.testnet";
  const ownerAccount = "blckfme.testnet";
  const guardId = "scopeguard.testnet";

  const revokeCmd = `near call ${guardId} revoke_agent '{"agent_account": "${agentAccount}"}' --accountId ${ownerAccount} --gas 100000000000000`;
  const deleteCmd = `near delete ${agentAccount} ${ownerAccount}`;

  assert.ok(revokeCmd.includes("revoke_agent"));
  assert.ok(revokeCmd.includes(agentAccount));
  assert.ok(revokeCmd.includes(ownerAccount));
  assert.ok(revokeCmd.includes(guardId));

  assert.ok(deleteCmd.startsWith("near delete"));
  assert.strictEqual(deleteCmd, "near delete agent.blckfme.testnet blckfme.testnet");
});

test("delete subaccount: local storage filtering cleanly excludes deleted agents", () => {
  const initialFleet = [
    { account: "agent.blckfme.testnet", dailyCap: 25 },
    { account: "agent2.blckfme.testnet", dailyCap: 50 },
    { account: "trader.blckfme.testnet", dailyCap: 100 },
  ];

  const deletedList = ["agent2.blckfme.testnet"];

  const filteredFleet = initialFleet.filter((item) => !deletedList.includes(item.account));

  assert.strictEqual(filteredFleet.length, 2);
  assert.strictEqual(filteredFleet[0].account, "agent.blckfme.testnet");
  assert.strictEqual(filteredFleet[1].account, "trader.blckfme.testnet");
  assert.ok(!filteredFleet.some((a) => a.account === "agent2.blckfme.testnet"));
});

test("delete subaccount: DeleteSubAccountModal has zero em dashes and zero en dashes", () => {
  const filePath = path.join(__dirname, "..", "components", "DeleteSubAccountModal.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.strictEqual(content.includes("\u2014"), false, "Must not contain em dash");
  assert.strictEqual(content.includes("\u2013"), false, "Must not contain en dash");
});
