import test from "node:test";
import assert from "node:assert";
import { getPolicyContractId, POLICY_CONTRACT_ENV_VARS } from "../lib/config";

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
  const orig = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;

  try {
    process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = "  my-custom-guard.testnet  ";
    assert.strictEqual(getPolicyContractId(), "my-custom-guard.testnet");
  } finally {
    if (orig !== undefined) {
      process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = orig;
    } else {
      delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
    }
  }
});
