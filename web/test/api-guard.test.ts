import test from "node:test";
import assert from "node:assert";
import { isSameOrigin, serverSigningEnabled, agentSigningEnabled, guardSigningRequest } from "../lib/api-guard.ts";

test("api-guard: isSameOrigin validates origin and host headers", () => {
  // Same origin passes
  const sameReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
    headers: {
      origin: "https://scopeguard.blockframe.cloud",
      host: "scopeguard.blockframe.cloud",
    },
  });
  assert.strictEqual(isSameOrigin(sameReq), true);

  // Cross origin fails
  const crossReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
    headers: {
      origin: "https://evil-phishing-site.com",
      host: "scopeguard.blockframe.cloud",
    },
  });
  assert.strictEqual(isSameOrigin(crossReq), false);

  // Missing origin (e.g. curl or internal call) passes through to signing flag check
  const curlReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
    headers: {
      host: "scopeguard.blockframe.cloud",
    },
  });
  assert.strictEqual(isSameOrigin(curlReq), true);

  // Malformed origin fails
  const malformedReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
    headers: {
      origin: "not-a-valid-url",
      host: "scopeguard.blockframe.cloud",
    },
  });
  assert.strictEqual(isSameOrigin(malformedReq), false);
});

test("api-guard: serverSigningEnabled and agentSigningEnabled reflect environment flags", () => {
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  const origAgentKey = process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;

  try {
    delete process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
    assert.strictEqual(serverSigningEnabled(), false);

    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "false";
    assert.strictEqual(serverSigningEnabled(), false);

    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    assert.strictEqual(serverSigningEnabled(), true);

    delete process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;
    assert.strictEqual(agentSigningEnabled(), false);

    process.env.SCOPEGUARD_AGENT_PRIVATE_KEY = "ed25519:testkey123";
    assert.strictEqual(agentSigningEnabled(), true);
  } finally {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origServerFlag;
    process.env.SCOPEGUARD_AGENT_PRIVATE_KEY = origAgentKey;
  }
});

test("api-guard: guardSigningRequest blocks cross-origin and disables signing safely", async () => {
  const fallbackCommand = "near call guard2 register_agent ...";
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;

  try {
    // 1. Cross-origin request rejected with 403
    const crossReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        origin: "https://malicious.com",
        host: "scopeguard.blockframe.cloud",
      },
    });
    const crossResponse = guardSigningRequest(crossReq, fallbackCommand);
    assert.ok(crossResponse !== null);
    assert.strictEqual(crossResponse.status, 403);
    const crossBody = await crossResponse.json();
    assert.strictEqual(crossBody.success, false);
    assert.strictEqual(crossBody.error, "Cross-origin signing request rejected.");

    // 2. Safe fallback when server signing is disabled (default)
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "false";
    const sameReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
      },
    });
    const disabledResponse = guardSigningRequest(sameReq, fallbackCommand);
    assert.ok(disabledResponse !== null);
    assert.strictEqual(disabledResponse.status, 200);
    const disabledBody = await disabledResponse.json();
    assert.strictEqual(disabledBody.success, false);
    assert.strictEqual(disabledBody.requiresOwnerSignature, true);
    assert.strictEqual(disabledBody.command, fallbackCommand);

    // 3. When server signing is explicitly enabled, guardSigningRequest returns null to permit execution
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    const allowedResponse = guardSigningRequest(sameReq, fallbackCommand);
    assert.strictEqual(allowedResponse, null);
  } finally {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = origServerFlag;
  }
});
