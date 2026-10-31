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

test("tx-route: returns structured verification receipt for valid hash", async () => {
  const req = new NextRequest("https://scopeguard.blockframe.cloud/api/tx?hash=EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ&account=agent.sergeo-guard.testnet");
  const res = await txHandler(req);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.hash, "EDwEhWuBTLZTwzfwKu8sJRg2a927CcJLsCqY4tAxvZDZ");
  assert.strictEqual(data.signerId, "agent.sergeo-guard.testnet");
  assert.strictEqual(data.receiverId, "guard2.sergeo-guard.testnet");
  assert.ok(data.status === "SUCCESS" || data.status === "FINALIZED");
  assert.ok(Array.isArray(data.logs));
});
