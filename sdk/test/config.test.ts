import test from "node:test";
import assert from "node:assert";
import { getPolicyContractId, POLICY_CONTRACT_ENV_VARS } from "../src/config";

test("config: getPolicyContractId throws when all contract ID env vars are unset", () => {
  const saved: Record<string, string | undefined> = {};
  for (const k of POLICY_CONTRACT_ENV_VARS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }

  try {
    assert.throws(
      () => getPolicyContractId(),
      /ScopeGuard policy contract ID is unset/,
      "Must throw when contract ID environment variable is unset (no silent fallbacks)"
    );
  } finally {
    for (const k of POLICY_CONTRACT_ENV_VARS) {
      if (saved[k] !== undefined) {
        process.env[k] = saved[k];
      } else {
        delete process.env[k];
      }
    }
  }
});

test("config: getPolicyContractId returns trimmed contract ID when env var is configured", () => {
  const orig = process.env.SCOPEGUARD_POLICY_CONTRACT;

  try {
    process.env.SCOPEGUARD_POLICY_CONTRACT = "  my-guard.testnet  ";
    assert.strictEqual(getPolicyContractId(), "my-guard.testnet");
  } finally {
    if (orig !== undefined) {
      process.env.SCOPEGUARD_POLICY_CONTRACT = orig;
    } else {
      delete process.env.SCOPEGUARD_POLICY_CONTRACT;
    }
  }
});
