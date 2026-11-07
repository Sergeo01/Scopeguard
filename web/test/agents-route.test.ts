import test from "node:test";
import assert from "node:assert";
import { GET as agentsHandler } from "../app/api/agents/route";
import { NextRequest } from "next/server";

test("agents-route: returns 500 with error JSON when policy contract ID is unset", async () => {
  const origServer = process.env.SCOPEGUARD_POLICY_CONTRACT;
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  delete process.env.SCOPEGUARD_POLICY_CONTRACT;
  delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;

  try {
    const req = new NextRequest("https://scopeguard.blockframe.cloud/api/agents?owner=sergeo-guard.testnet");
    const res = await agentsHandler(req);
    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.ok(data.error, "Response must contain error message");
    assert.match(data.error, /ScopeGuard policy contract ID is unset/);
  } finally {
    if (origServer !== undefined) process.env.SCOPEGUARD_POLICY_CONTRACT = origServer;
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
  }
});
