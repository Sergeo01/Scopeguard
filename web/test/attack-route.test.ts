import test from "node:test";
import assert from "node:assert";
import { POST } from "../app/api/attack/route";
import { resetAttackThrottles } from "../lib/api-guard";

function restoreEnv(key: string, val: string | undefined) {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

test("attack route: rejects cross-origin requests with 403", async () => {
  resetAttackThrottles();
  const req = new Request("https://scopeguard.blockframe.cloud/api/attack", {
    method: "POST",
    headers: {
      origin: "https://evil.site",
      host: "scopeguard.blockframe.cloud",
    },
    body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
  });

  const res = await POST(req);
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error, "Cross-origin request rejected.");
});

test("attack route: requires shared secret when configured regardless of origin", async () => {
  resetAttackThrottles();
  const origSecret = process.env.SCOPEGUARD_SHARED_SECRET;

  try {
    process.env.SCOPEGUARD_SHARED_SECRET = "attack-route-secret";

    // Request without secret receives 401
    const noSecretReq = new Request("https://scopeguard.blockframe.cloud/api/attack", {
      method: "POST",
      headers: { host: "scopeguard.blockframe.cloud" },
      body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
    });
    const res = await POST(noSecretReq);
    assert.strictEqual(res.status, 401);

    // Request with forged Origin header but no secret receives 401
    const forgedReq = new Request("https://scopeguard.blockframe.cloud/api/attack", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
      },
      body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
    });
    const forgedRes = await POST(forgedReq);
    assert.strictEqual(forgedRes.status, 401);

    // Caller with wrong secret receives 401
    const badSecretReq = new Request("https://scopeguard.blockframe.cloud/api/attack", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "wrong-secret",
      },
      body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
    });
    const badRes = await POST(badSecretReq);
    assert.strictEqual(badRes.status, 401);

    // Caller with valid secret passes authentication guard
    const withSecretReq = new Request("https://scopeguard.blockframe.cloud/api/attack", {
      method: "POST",
      headers: {
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "attack-route-secret",
      },
      body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
    });
    const authedRes = await POST(withSecretReq);
    assert.notStrictEqual(authedRes.status, 401);
  } finally {
    restoreEnv("SCOPEGUARD_SHARED_SECRET", origSecret);
  }
});

test("attack route: fails gracefully with 500 when agent credentials are not in environment", async () => {
  resetAttackThrottles();
  const origKey = process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;
  const origAccount = process.env.SCOPEGUARD_AGENT_ACCOUNT;
  const origAgentKey = process.env.AGENT_PRIVATE_KEY;
  const origAgentAccount = process.env.AGENT_ACCOUNT_ID;

  try {
    delete process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;
    delete process.env.SCOPEGUARD_AGENT_ACCOUNT;
    delete process.env.AGENT_PRIVATE_KEY;
    delete process.env.AGENT_ACCOUNT_ID;

    const req = new Request("https://scopeguard.blockframe.cloud/api/attack", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
      },
      body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 500);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes("Agent credentials not found in environment"));
  } finally {
    if (origKey) process.env.SCOPEGUARD_AGENT_PRIVATE_KEY = origKey;
    if (origAccount) process.env.SCOPEGUARD_AGENT_ACCOUNT = origAccount;
    if (origAgentKey) process.env.AGENT_PRIVATE_KEY = origAgentKey;
    if (origAgentAccount) process.env.AGENT_ACCOUNT_ID = origAgentAccount;
  }
});

test("attack route: rejects rapid sequential requests with 429", async () => {
  resetAttackThrottles();

  const req1 = new Request("https://scopeguard.blockframe.cloud/api/attack", {
    method: "POST",
    headers: {
      origin: "https://scopeguard.blockframe.cloud",
      host: "scopeguard.blockframe.cloud",
    },
    body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
  });

  const req2 = new Request("https://scopeguard.blockframe.cloud/api/attack", {
    method: "POST",
    headers: {
      origin: "https://scopeguard.blockframe.cloud",
      host: "scopeguard.blockframe.cloud",
    },
    body: JSON.stringify({ target: "dex.testnet", method: "swap" }),
  });

  // First call runs (or fails on credentials)
  await POST(req1);

  // Immediate second call within 1.5 seconds triggers 429
  const res2 = await POST(req2);
  assert.strictEqual(res2.status, 429);
  const body2 = await res2.json();
  assert.strictEqual(body2.success, false);
  assert.ok(body2.error.includes("Rate limit: please wait 1.5 seconds"));
});
