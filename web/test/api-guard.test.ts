import test from "node:test";
import assert from "node:assert";
import { isSameOrigin, serverSigningEnabled, agentSigningEnabled, guardSigningRequest, resetRateLimits } from "../lib/api-guard";

function restoreEnv(key: string, val: string | undefined) {
  if (val === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = val;
  }
}

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
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
    restoreEnv("SCOPEGUARD_AGENT_PRIVATE_KEY", origAgentKey);
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
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
  }
});

test("api-guard: requires shared secret for non-browser callers when configured", async () => {
  const fallbackCommand = "near call guard2 register_agent ...";
  const origSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    process.env.SCOPEGUARD_SHARED_SECRET = "super-secret-token-123";

    // Non-browser caller without secret is rejected with 401
    const noSecretReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: { host: "scopeguard.blockframe.cloud" },
    });
    const noSecretRes = guardSigningRequest(noSecretReq, fallbackCommand);
    assert.ok(noSecretRes !== null);
    assert.strictEqual(noSecretRes.status, 401);

    // Non-browser caller with wrong secret is rejected with 401
    const wrongSecretReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "wrong-secret",
      },
    });
    const wrongSecretRes = guardSigningRequest(wrongSecretReq, fallbackCommand);
    assert.ok(wrongSecretRes !== null);
    assert.strictEqual(wrongSecretRes.status, 401);

    // Non-browser caller with valid custom header passes
    const validHeaderReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "super-secret-token-123",
      },
    });
    const validHeaderRes = guardSigningRequest(validHeaderReq, fallbackCommand);
    assert.strictEqual(validHeaderRes, null);

    // Non-browser caller with valid Bearer token passes
    const validBearerReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        host: "scopeguard.blockframe.cloud",
        authorization: "Bearer super-secret-token-123",
      },
    });
    const validBearerRes = guardSigningRequest(validBearerReq, fallbackCommand);
    assert.strictEqual(validBearerRes, null);
  } finally {
    restoreEnv("SCOPEGUARD_SHARED_SECRET", origSecret);
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
  }
});

test("api-guard: rate limiting rejects burst requests with 429", () => {
  const fallbackCommand = "near call guard2 register_agent ...";
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";

    const makeReq = () =>
      new Request("https://scopeguard.blockframe.cloud/api/register", {
        headers: {
          origin: "https://scopeguard.blockframe.cloud",
          host: "scopeguard.blockframe.cloud",
          "x-forwarded-for": "198.51.100.42",
        },
      });

    // Send requests up to rate limit (10)
    for (let i = 0; i < 10; i++) {
      const res = guardSigningRequest(makeReq(), fallbackCommand);
      assert.strictEqual(res, null);
    }

    // 11th request exceeds limit and receives 429
    const blockedRes = guardSigningRequest(makeReq(), fallbackCommand);
    assert.ok(blockedRes !== null);
    assert.strictEqual(blockedRes.status, 429);
  } finally {
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
  }
});

test("api-guard: requires shared secret even with valid or forged Origin header", () => {
  const fallbackCommand = "near call guard2 register_agent ...";
  const origSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";
    process.env.SCOPEGUARD_SHARED_SECRET = "production-vault-secret";

    // Forged Origin matching host without shared secret is rejected with 401
    const forgedOriginReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
      },
    });
    const res = guardSigningRequest(forgedOriginReq, fallbackCommand);
    assert.ok(res !== null);
    assert.strictEqual(res.status, 401);

    // Forged Origin with wrong secret is rejected with 401
    const wrongSecretReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "bad-secret",
      },
    });
    const wrongRes = guardSigningRequest(wrongSecretReq, fallbackCommand);
    assert.ok(wrongRes !== null);
    assert.strictEqual(wrongRes.status, 401);

    // Valid secret passes
    const validReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "x-scopeguard-secret": "production-vault-secret",
      },
    });
    const validRes = guardSigningRequest(validReq, fallbackCommand);
    assert.strictEqual(validRes, null);
  } finally {
    restoreEnv("SCOPEGUARD_SHARED_SECRET", origSecret);
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
  }
});

test("api-guard: rate limits on last proxy hop, ignoring forged rotating first hops", () => {
  const fallbackCommand = "near call guard2 register_agent ...";
  const origServerFlag = process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING;
  resetRateLimits();

  try {
    process.env.SCOPEGUARD_ALLOW_SERVER_SIGNING = "true";

    // Attacker rotates the client-provided first hop, but the trusted edge proxy
    // appends the real last hop (203.0.113.195)
    for (let i = 0; i < 10; i++) {
      const req = new Request("https://scopeguard.blockframe.cloud/api/register", {
        headers: {
          origin: "https://scopeguard.blockframe.cloud",
          host: "scopeguard.blockframe.cloud",
          "x-forwarded-for": `10.0.0.${i}, 203.0.113.195`,
        },
      });
      const res = guardSigningRequest(req, fallbackCommand);
      assert.strictEqual(res, null);
    }

    // 11th request with yet another forged first hop is still rate-limited on 203.0.113.195
    const blockedReq = new Request("https://scopeguard.blockframe.cloud/api/register", {
      headers: {
        origin: "https://scopeguard.blockframe.cloud",
        host: "scopeguard.blockframe.cloud",
        "x-forwarded-for": "10.0.0.99, 203.0.113.195",
      },
    });
    const blockedRes = guardSigningRequest(blockedReq, fallbackCommand);
    assert.ok(blockedRes !== null);
    assert.strictEqual(blockedRes.status, 429);
  } finally {
    restoreEnv("SCOPEGUARD_ALLOW_SERVER_SIGNING", origServerFlag);
    resetRateLimits();
  }
});
