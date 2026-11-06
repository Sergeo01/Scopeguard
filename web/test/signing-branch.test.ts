import test from "node:test";
import assert from "node:assert";
import { KeyPair } from "near-api-js";
import { POST as registerHandler } from "../app/api/register/route";

test("register-route: input validation rejects missing parameters", async () => {
  const req = new Request("https://scopeguard.blockframe.cloud/api/register", {
    method: "POST",
    headers: {
      origin: "https://scopeguard.blockframe.cloud",
      host: "scopeguard.blockframe.cloud",
      "content-type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const res = await registerHandler(req);
  assert.strictEqual(res.status, 400);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.ok(data.error.includes("agentAccountId and policy are required"));
});

test("register-route: cross-origin requests are blocked with 403", async () => {
  const req = new Request("https://scopeguard.blockframe.cloud/api/register", {
    method: "POST",
    headers: {
      origin: "https://phishing-site.com",
      host: "scopeguard.blockframe.cloud",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentAccountId: "test.sergeo-guard.testnet",
      policy: { token: "token.testnet" },
    }),
  });

  const res = await registerHandler(req);
  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.error, "Cross-origin signing request rejected.");
});

test("register-route: default disabled mode safely yields fallback CLI command", async () => {
  const origFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "false";

    const req = new Request("https://scopeguard.blockframe.cloud/api/register", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentAccountId: "test.sergeo-guard.testnet",
        policy: { token: "sergeo-guard-token.testnet" },
      }),
    });

    const res = await registerHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.requiresOwnerSignature, true);
    assert.ok(data.command.includes("near call guard2.sergeo-guard.testnet register_agent"));
  } finally {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origFlag;
  }
});

test("register-route: server-signing-enabled branch handles missing key and executes keypair loading", async () => {
  const origFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  const origKey = process.env.OWNER_PRIVATE_KEY;
  const origScopeKey = process.env.SCOPEGUARD_OWNER_PRIVATE_KEY;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    delete process.env.OWNER_PRIVATE_KEY;
    delete process.env.SCOPEGUARD_OWNER_PRIVATE_KEY;

    // Sub-case A: Enabled, but key is missing from env
    const reqNoKey = new Request("https://scopeguard.blockframe.cloud/api/register", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentAccountId: "test.sergeo-guard.testnet",
        policy: { token: "sergeo-guard-token.testnet" },
      }),
    });

    const resNoKey = await registerHandler(reqNoKey);
    assert.strictEqual(resNoKey.status, 400);
    const dataNoKey = await resNoKey.json();
    assert.strictEqual(dataNoKey.success, false);
    assert.ok(dataNoKey.message.includes("Server signing is enabled but no owner key is configured"));

    // Sub-case B: Enabled with a throwaway test key (exercises KeyPair loading and functionCall path)
    const throwawayKeyPair = KeyPair.fromRandom("ed25519");
    process.env.OWNER_PRIVATE_KEY = throwawayKeyPair.toString();

    const reqWithKey = new Request("https://scopeguard.blockframe.cloud/api/register", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentAccountId: "test-signing.sergeo-guard.testnet",
        policy: { token: "sergeo-guard-token.testnet" },
      }),
    });

    const resWithKey = await registerHandler(reqWithKey);
    // The call executes through key loading, connects to testnet RPC, and attempts functionCall.
    // Because the throwaway key is not an authorized onchain account key, NEAR RPC safely rejects it.
    // The route must catch the error cleanly and return 500 with a structured error, without crashing!
    assert.strictEqual(resWithKey.status, 500);
    const dataWithKey = await resWithKey.json();
    assert.strictEqual(dataWithKey.success, false);
    assert.ok(dataWithKey.error);
  } finally {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origFlag;
    process.env.OWNER_PRIVATE_KEY = origKey;
    process.env.SCOPEGUARD_OWNER_PRIVATE_KEY = origScopeKey;
  }
});
