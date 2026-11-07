import test from "node:test";
import assert from "node:assert";

import { GET, clearCompareCache, setNearConnectForTest } from "../app/api/compare/route";
import { resetRateLimits } from "../lib/api-guard";
import { computeComparisonSummary } from "../lib/compare-scenario";

test("compare-route: returns 503 JSON when policy contract ID is unset", async () => {
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  const origServer = process.env.SCOPEGUARD_POLICY_CONTRACT;
  delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  delete process.env.SCOPEGUARD_POLICY_CONTRACT;

  try {
    clearCompareCache();
    const req = new Request("https://scopeguard.blockframe.cloud/api/compare", {
      method: "GET",
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.ok(body.error.includes("not configured"));
  } finally {
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
    if (origServer !== undefined) process.env.SCOPEGUARD_POLICY_CONTRACT = origServer;
  }
});

test("compare-route: runs 6 preflight view calls with mocked RPC (1 ALLOWED, 5 REJECTED with expected reason codes)", async () => {
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;

  process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = "test-guard-contract.testnet";
  clearCompareCache();
  resetRateLimits();

  const mockCalls: { methodName: string; args: any }[] = [];

  setNearConnectForTest(async () => ({
    account: async () => ({
      viewFunction: async ({ methodName, args }: { methodName: string; args: any }) => {
        mockCalls.push({ methodName, args });
        if (methodName === "get_budget") {
          return {
            cap: "500",
            spent: "0",
            remaining: "500",
            vault_balance: "100",
            near_cap: "5000000000000000000000000",
            near_vault_balance: "2000000000000000000000000",
          };
        }
        if (methodName === "preflight") {
          const action = args.action;
          if ("Swap" in action) {
            if (Number(action.Swap.amount_in) <= 500) {
              return { status: "ALLOWED", reason: null };
            } else {
              return { status: "REJECTED", reason: "OVER_DAILY_CAP" };
            }
          }
          if ("Transfer" in action) {
            if (action.Transfer.to !== "sergeo-guard.testnet") {
              return { status: "REJECTED", reason: "RECIPIENT_NOT_ALLOWED" };
            }
            return { status: "ALLOWED", reason: null };
          }
          if ("ContractCall" in action) {
            return { status: "REJECTED", reason: "TARGET_NOT_ALLOWED" };
          }
          if ("NearTransfer" in action) {
            if (action.NearTransfer.to !== "sergeo-guard.testnet") {
              return { status: "REJECTED", reason: "RECIPIENT_NOT_ALLOWED" };
            }
            return { status: "ALLOWED", reason: null };
          }
          return { status: "REJECTED", reason: "METHOD_NOT_ALLOWED" };
        }
        throw new Error(`Unexpected view method: ${methodName}`);
      },
    }),
  }));

  try {
    const req = new Request("https://scopeguard.blockframe.cloud/api/compare", {
      method: "GET",
      headers: { "x-real-ip": "10.0.0.1" },
    });
    const res = await GET(req);
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    assert.ok(Array.isArray(body.steps), "Response must contain steps array");
    assert.strictEqual(body.steps.length, 6, "Must contain exactly 6 steps");

    // Exactly one ALLOWED, five REJECTED
    const allowed = body.steps.filter((s: any) => s.verdict === "ALLOWED");
    const rejected = body.steps.filter((s: any) => s.verdict === "REJECTED");
    assert.strictEqual(allowed.length, 1, "Exactly one step must be ALLOWED");
    assert.strictEqual(rejected.length, 5, "Exactly five steps must be REJECTED");

    // Step 1: Legitimate swap
    assert.strictEqual(body.steps[0].id, 1);
    assert.strictEqual(body.steps[0].verdict, "ALLOWED");
    assert.strictEqual(body.steps[0].reason, null);
    assert.ok(body.steps[0].explanation.length > 0);

    // Step 2: Injected transfer to attacker
    assert.strictEqual(body.steps[1].id, 2);
    assert.strictEqual(body.steps[1].verdict, "REJECTED");
    assert.strictEqual(body.steps[1].reason, "RECIPIENT_NOT_ALLOWED");

    // Step 3: Injected ContractCall to unknown contract
    assert.strictEqual(body.steps[2].id, 3);
    assert.strictEqual(body.steps[2].verdict, "REJECTED");
    assert.strictEqual(body.steps[2].reason, "TARGET_NOT_ALLOWED");

    // Step 4: Injected ContractCall ft_transfer on custody token
    assert.strictEqual(body.steps[3].id, 4);
    assert.strictEqual(body.steps[3].verdict, "REJECTED");
    assert.strictEqual(body.steps[3].reason, "TARGET_NOT_ALLOWED");

    // Step 5: Injected swap above daily cap
    assert.strictEqual(body.steps[4].id, 5);
    assert.strictEqual(body.steps[4].verdict, "REJECTED");
    assert.strictEqual(body.steps[4].reason, "OVER_DAILY_CAP");

    // Step 6: Injected NearTransfer to attacker
    assert.strictEqual(body.steps[5].id, 6);
    assert.strictEqual(body.steps[5].verdict, "REJECTED");
    assert.strictEqual(body.steps[5].reason, "RECIPIENT_NOT_ALLOWED");

    // Budget present
    assert.strictEqual(body.budget.cap, "500");
    assert.strictEqual(body.budget.vault_balance, "100");

    // Verify summary is computed from data
    const summary = computeComparisonSummary(body.steps, body.budget);
    assert.ok(summary.bannerText.includes("Unprotected agent: lost 1150 mUSD and 5 NEAR of 100 mUSD and 2 NEAR."));
    assert.ok(summary.bannerText.includes("ScopeGuard agent: moved 10 mUSD (rolling 24h cap: 500 mUSD)."));
  } finally {
    setNearConnectForTest(null);
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
    else delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  }
});

test("compare-route: applies per-IP rate limit of 20 requests/min", async () => {
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;

  process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = "test-guard-contract.testnet";
  resetRateLimits();

  setNearConnectForTest(async () => ({
    account: async () => ({
      viewFunction: async () => ({ status: "ALLOWED" }),
    }),
  }));

  try {
    const ip = "192.168.1.99";
    let lastStatus = 200;

    for (let i = 0; i < 22; i++) {
      clearCompareCache(); // bypass 10s response cache to test rate limit bucket
      const req = new Request("https://scopeguard.blockframe.cloud/api/compare", {
        method: "GET",
        headers: { "x-real-ip": ip },
      });
      const res = await GET(req);
      lastStatus = res.status;
    }

    assert.strictEqual(lastStatus, 429, "Must return 429 after exceeding 20 requests/minute");
  } finally {
    setNearConnectForTest(null);
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
    else delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  }
});
