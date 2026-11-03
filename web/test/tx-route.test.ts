import test from "node:test";
import assert from "node:assert";
import { GET as txHandler } from "../app/api/tx/route.ts";
import { NextRequest } from "next/server";

test("tx-route: rejects missing hash parameter with 400", async () => {
  const req = new NextRequest("https://scopeguard.blockframe.cloud/api/tx");
  const res = await txHandler(req);
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.error, "Missing hash parameter");
});

test("tx-route: returns structured receipt when indexed, or an honest unverified response otherwise", async () => {
  // This is not a promise about current indexer state. Live testnet RPC and
  // nearblocks no longer serve receipts for these hashes as of 2026-11-03, so
  // the endpoint must fail honestly with UNVERIFIED instead of inventing one.
  const id = "EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ";
  const req = new NextRequest(
    `https://scopeguard.blockframe.cloud/api/tx?hash=${id}&account=agent.sergeo-guard.testnet`
  );
  const res = await txHandler(req);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.hash, id);
  assert.strictEqual(data.signerId, "agent.sergeo-guard.testnet");
  assert.ok(data.found === true || data.found === false, "found must be a boolean");
  assert.ok(
    ["SUCCESS", "FAILED", "UNKNOWN", "UNVERIFIED"].includes(data.status),
    `unexpected status: ${data.status}`
  );
  assert.ok(Array.isArray(data.logs));
});
