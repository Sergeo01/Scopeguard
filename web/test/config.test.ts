import test from "node:test";
import assert from "node:assert";
import { getPolicyContractId, tryGetPolicyContractId } from "../lib/config";

test("config: tryGetPolicyContractId returns null and getPolicyContractId throws when env vars are unset", () => {
  const origServer = process.env.SCOPEGUARD_POLICY_CONTRACT;
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  delete process.env.SCOPEGUARD_POLICY_CONTRACT;
  delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;

  try {
    assert.strictEqual(tryGetPolicyContractId(), null);
    assert.throws(
      () => getPolicyContractId(),
      /ScopeGuard policy contract ID is unset/,
      "Must throw when contract ID environment variable is unset"
    );
  } finally {
    if (origServer !== undefined) process.env.SCOPEGUARD_POLICY_CONTRACT = origServer;
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
  }
});

test("config: returns trimmed contract ID when NEXT_PUBLIC_POLICY_CONTRACT_ID is configured", () => {
  const origServer = process.env.SCOPEGUARD_POLICY_CONTRACT;
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  delete process.env.SCOPEGUARD_POLICY_CONTRACT;

  try {
    process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = "  my-custom-guard.testnet  ";
    assert.strictEqual(tryGetPolicyContractId(), "my-custom-guard.testnet");
    assert.strictEqual(getPolicyContractId(), "my-custom-guard.testnet");
  } finally {
    if (origServer !== undefined) process.env.SCOPEGUARD_POLICY_CONTRACT = origServer;
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
    else delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  }
});

test("config: returns trimmed contract ID when SCOPEGUARD_POLICY_CONTRACT is configured", () => {
  const origServer = process.env.SCOPEGUARD_POLICY_CONTRACT;
  const origPublic = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;
  delete process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID;

  try {
    process.env.SCOPEGUARD_POLICY_CONTRACT = "  server-guard.testnet  ";
    assert.strictEqual(tryGetPolicyContractId(), "server-guard.testnet");
    assert.strictEqual(getPolicyContractId(), "server-guard.testnet");
  } finally {
    if (origServer !== undefined) process.env.SCOPEGUARD_POLICY_CONTRACT = origServer;
    else delete process.env.SCOPEGUARD_POLICY_CONTRACT;
    if (origPublic !== undefined) process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID = origPublic;
  }
});
