import test from "node:test";
import assert from "node:assert";

process.env.SCOPEGUARD_POLICY_CONTRACT = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";

import { POST } from "../app/api/demo/reset/route";
import { resetRateLimits } from "../lib/api-guard";
import { recordActivity, getRecentActivities, ActivityItem } from "../lib/ledger";

function restoreEnv(key: string, val: string | undefined) {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

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

test("demo-reset route: requires shared secret on signing route when configured regardless of origin", async () => {
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

    // Browser request with forged origin but no secret also receives 401
    const forgedOriginReq = new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
      },
    });
    const forgedRes = await POST(forgedOriginReq);
    assert.strictEqual(forgedRes.status, 401);

    // With valid secret header, passes authentication guard
    const withSecretReq = new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "super-secret-token",
      },
    });
    const authedRes = await POST(withSecretReq);
    assert.notStrictEqual(authedRes.status, 401);
  } finally {
    restoreEnv("SCOPEGUARD_SHARED_SECRET", origSecret);
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
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
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
  }
});

test("demo-reset route: rate limits repeated burst requests with 429", async () => {
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  const origSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  resetRateLimits();

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    process.env.SCOPEGUARD_SHARED_SECRET = "demo-reset-secret";

    const makeReq = () =>
      new Request("https://scopeguard.blockframe.cloud/api/demo/reset", {
        method: "POST",
        headers: {
          origin: "https://scopeguard.blockframe.cloud",
          host: "scopeguard.blockframe.cloud",
          "x-forwarded-for": "203.0.113.88",
          "x-scopeguard-secret": "demo-reset-secret",
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
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
    restoreEnv("SCOPEGUARD_SHARED_SECRET", origSecret);
    resetRateLimits();
  }
});

test("demo-reset route: recordActivity logs reset operations to the activity ledger", () => {
  const os = require("os");
  const path = require("path");
  const fs = require("fs");
  const tempLedger = path.join(os.tmpdir(), `test-ledger-${Date.now()}.json`);
  const trackedLedgerPath = path.join(process.cwd(), "data", "activity-ledger.json");
  const initialTrackedContent = fs.existsSync(trackedLedgerPath)
    ? fs.readFileSync(trackedLedgerPath, "utf-8")
    : "";

  const origLedgerPath = process.env.LEDGER_PATH;
  process.env.LEDGER_PATH = tempLedger;

  try {
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

    // Verify temp file was written to and tracked ledger was never touched
    assert.ok(fs.existsSync(tempLedger));
    const currentTrackedContent = fs.existsSync(trackedLedgerPath)
      ? fs.readFileSync(trackedLedgerPath, "utf-8")
      : "";
    assert.strictEqual(currentTrackedContent, initialTrackedContent, "Tracked activity-ledger.json must never be modified by tests");
  } finally {
    restoreEnv("LEDGER_PATH", origLedgerPath);
    if (fs.existsSync(tempLedger)) {
      try { fs.unlinkSync(tempLedger); } catch {}
    }
  }
});

