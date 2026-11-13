import test from "node:test";
import assert from "node:assert";
import { KeyPair } from "near-api-js";

process.env.SCOPEGUARD_POLICY_CONTRACT = process.env.SCOPEGUARD_POLICY_CONTRACT || "test-policy-contract.testnet";

import { POST as registerHandler } from "../app/api/register/route";
import { POST as fundHandler } from "../app/api/fund/route";
import * as fs from "node:fs";
import * as path from "node:path";

function restoreEnv(key: string, val: string | undefined) {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

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
    const expectedContract = process.env.SCOPEGUARD_POLICY_CONTRACT || "test-policy-contract.testnet";
    assert.ok(data.command.includes(`near call ${expectedContract} register_agent`));
  } finally {
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origFlag);
  }
});

test("register-route: server-signing-enabled branch handles missing key and executes keypair loading", async () => {
  const origFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  const origSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  const origKey = process.env.OWNER_PRIVATE_KEY;
  const origScopeKey = process.env.SCOPEGUARD_OWNER_PRIVATE_KEY;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    process.env.SCOPEGUARD_SHARED_SECRET = "signing-branch-test-secret";
    delete process.env.OWNER_PRIVATE_KEY;
    delete process.env.SCOPEGUARD_OWNER_PRIVATE_KEY;

    // Sub-case A: Enabled, but key is missing from env
    const reqNoKey = new Request("https://scopeguard.blockframe.cloud/api/register", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "content-type": "application/json",
        "x-scopeguard-secret": "signing-branch-test-secret",
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
        "x-scopeguard-secret": "signing-branch-test-secret",
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

    // Sub-case C: Subaccount owner mismatch (agent.otherowner.testnet does not match ownerId)
    const reqMismatch = new Request("https://scopeguard.blockframe.cloud/api/register", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "content-type": "application/json",
        "x-scopeguard-secret": "signing-branch-test-secret",
      },
      body: JSON.stringify({
        agentAccountId: "agent.unrelated-owner.testnet",
        policy: { token: "sergeo-guard-token.testnet" },
      }),
    });
    const resMismatch = await registerHandler(reqMismatch);
    assert.strictEqual(resMismatch.status, 400);
    const dataMismatch = await resMismatch.json();
    assert.strictEqual(dataMismatch.success, false);
    assert.strictEqual(dataMismatch.code, "SUBACCOUNT_OWNER_MISMATCH");
    assert.ok(dataMismatch.error.includes("must be a sub-account of owner"));
  } finally {
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origFlag);
    restoreEnv("SCOPEGUARD_SHARED_SECRET", origSecret);
    restoreEnv("OWNER_PRIVATE_KEY", origKey);
    restoreEnv("SCOPEGUARD_OWNER_PRIVATE_KEY", origScopeKey);
  }
});

test("fund-route: cross-origin requests are blocked with 403", async () => {
  const req = new Request("https://scopeguard.blockframe.cloud/api/fund", {
    method: "POST",
    headers: {
      origin: "https://phishing-site.com",
      host: "scopeguard.blockframe.cloud",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId: "agent2.sergeo-guard.testnet",
      amount: "100",
    }),
  });

  const res = await fundHandler(req);
  assert.strictEqual(res.status, 403);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.error, "Cross-origin signing request rejected.");
});

test("fund-route: default disabled mode safely yields fallback CLI command with requiresOwnerSignature", async () => {
  const origFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "false";

    const req = new Request("https://scopeguard.blockframe.cloud/api/fund", {
      method: "POST",
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentId: "agent2.sergeo-guard.testnet",
        amount: "100",
      }),
    });

    const res = await fundHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.requiresOwnerSignature, true);
    assert.ok(data.command.includes("mint_faucet"));
    assert.ok(data.command.includes("ft_transfer_call"));
    assert.ok(data.command.includes("agent2.sergeo-guard.testnet"));
  } finally {
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origFlag);
  }
});

test("wallet-button: component handles requiresOwnerSignature, displays copyable command, and avoids silent failure", () => {
  const compPath = path.join(__dirname, "../components/WalletButton.tsx");
  const content = fs.readFileSync(compPath, "utf-8");

  assert.ok(
    content.includes("data.requiresOwnerSignature && data.command"),
    "WalletButton must explicitly detect requiresOwnerSignature and command"
  );
  assert.ok(
    content.includes("Copy CLI Command"),
    "WalletButton must provide a 1-click Copy CLI Command button"
  );
  assert.ok(
    content.includes("Owner signature required onchain"),
    "WalletButton must clearly explain owner signature requirement instead of silent failure"
  );
  assert.ok(
    content.includes("data.error || data.message || \"Failed to fund vault.\""),
    "WalletButton must surface data.message and not swallow errors"
  );
});
