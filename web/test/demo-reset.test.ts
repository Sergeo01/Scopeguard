import test from "node:test";
import assert from "node:assert";
import { POST } from "../app/api/demo/reset/route";
import { resetRateLimits } from "../lib/api-guard";
import { recordActivity, getRecentActivities, ActivityItem } from "../lib/ledger";

test("demo-reset route: rejects cross-origin requests with 403", async () => {
  const req = new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
    method: "POST",
    headers: {
      origin: "https://attacker.site",
      host: "scopeguard.blockframe.cloud",
    },
  });

  const res = await POST(req);
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.error, "Cross-origin signing request rejected.");
});

test("demo-reset route: requires shared secret for non-browser callers when configured", async () => {
  const origSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    process.env.SCOPEGUARD_SHARED_SECRET = "super-secret-token";

    // Non-browser caller without secret receives 401
    const noSecretReq = new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
      method: "POST",
      headers: { host: "scopeguard.blockframe.cloud" },
    });
    const res = await POST(noSecretReq);
    assert.strictEqual(res.status, 401);

    // With valid secret header, passes authentication guard
    const withSecretReq = new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
      method: "POST",
      headers: {
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "super-secret-token",
      },
    });
    // This will proceed past api-guard to private key check
    const authedRes = await POST(withSecretReq);
    assert.notStrictEqual(authedRes.status, 401);
  } finally {
    process.env.SCOPEGUARD_SHARED_SECRET = origSecret;
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origServerFlag;
  }
});

test("demo-reset route: returns copy-paste CLI command when server signing is disabled", async () => {
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "false";

    const req = new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
      },
    });

    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.requiresOwnerSignature, true);
    assert.ok(body.command.includes("unpause"));
    assert.ok(body.command.includes("reset_windows"));
  } finally {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origServerFlag;
  }
});

test("demo-reset route: rate limits repeated burst requests with 429", async () => {
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  resetRateLimits();

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";

    const makeReq = () =>
      new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
        method: "POST",
        headers: {
          origin: "https://scopeguard.blockframe.cloud",
          host: "scopeguard.blockframe.cloud",
          "x-forwarded-for": "203.0.113.88",
        },
      });

    // Send 10 requests to reach threshold
    for (let i = 0; i < 10; i++) {
      await POST(makeReq());
    }

    // 11th request triggers rate limit 429
    const blockedRes = await POST(makeReq());
    assert.strictEqual(blockedRes.status, 429);
    const body = await blockedRes.json();
    assert.strictEqual(body.error, "Rate limit exceeded. Please wait before retrying.");
  } finally {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origServerFlag;
    resetRateLimits();
  }
});

test("demo-reset route: recordActivity logs reset operations to the activity ledger", () => {
  const initial = getRecentActivities();
  const testId = "test-reset-act-" + Date.now();
  recordActivity({
    id: testId,
    timestamp: Date.now(),
    agent: "agent.sergeo-guard.testnet",
    target: "guard2.sergeo-guard.testnet",
    method: "reset_windows",
    type: "RESET",
    reason: "Self-healing circuit breaker reset",
  });
  const updated = getRecentActivities();
  assert.strictEqual(updated.length, initial.length + 1);
  assert.strictEqual(updated[0].method, "reset_windows");
});

