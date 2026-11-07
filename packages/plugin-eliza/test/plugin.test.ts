import { describe, it, beforeEach } from "node:test";
import * as assert from "node:assert/strict";
import { ScopeGuardAgentClient } from "@scopeguard/sdk";
import {
  scopeGuardPlugin,
  scopeGuardProvider,
  scopeGuardExecuteAction,
  scopeGuardGetBudgetAction,
  scopeGuardPreflightAction,
  resolveScopeGuardCredential,
  resetScopeGuardClientCache,
  IAgentRuntime,
  Memory,
} from "../src/index";

const mockCredential = {
  agentAccountId: "agent.sergeo-guard.testnet",
  policyContractId: "test-policy-contract.testnet",
  privateKey: "ed25519:3D5qZ9u8zF6G7H8J9K0L1M2N3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0G1H2J",
  publicKey: "ed25519:4w5e6r7t8y9u0i1o2p3a4s5d6f7g8h9j0k1l2z3x4c5v",
  networkId: "testnet" as const,
};

function createMockRuntime(settings: Record<string, string> = {}): IAgentRuntime {
  return {
    agentId: "mock-eliza-agent",
    getSetting: (key: string) => settings[key],
  };
}

describe("ScopeGuard ElizaOS Plugin", () => {
  beforeEach(() => {
    resetScopeGuardClientCache();
    delete process.env.SCOPEGUARD_CREDENTIAL_PATH;
    delete process.env.SCOPEGUARD_CREDENTIAL_JSON;
  });

  it("exports valid ElizaOS Plugin structure", () => {
    assert.equal(scopeGuardPlugin.name, "@scopeguard/plugin-eliza");
    assert.ok(scopeGuardPlugin.description.includes("ScopeGuard"));
    assert.equal(scopeGuardPlugin.actions.length, 3);
    assert.equal(scopeGuardPlugin.providers.length, 1);

    const actionNames = scopeGuardPlugin.actions.map((a) => a.name);
    assert.ok(actionNames.includes("EXECUTE_ONCHAIN_ACTION"));
    assert.ok(actionNames.includes("GET_WALLET_BUDGET"));
    assert.ok(actionNames.includes("SIMULATE_ONCHAIN_ACTION"));
  });

  it("resolves credential from runtime setting SCOPEGUARD_CREDENTIAL_JSON", () => {
    const runtime = createMockRuntime({
      SCOPEGUARD_CREDENTIAL_JSON: JSON.stringify(mockCredential),
    });
    const cred = resolveScopeGuardCredential(runtime);
    assert.equal(cred.agentAccountId, "agent.sergeo-guard.testnet");
    assert.equal(cred.policyContractId, "test-policy-contract.testnet");
  });

  it("throws clear error when credential is missing", () => {
    const runtime = createMockRuntime({});
    assert.throws(
      () => resolveScopeGuardCredential(runtime),
      /ScopeGuard credential not found/
    );
  });

  it("validates action availability based on credential presence", async () => {
    const unconfiguredRuntime = createMockRuntime({});
    const dummyMsg: Memory = { content: { text: "check budget" } };
    const isValidWithoutCred = await scopeGuardGetBudgetAction.validate(
      unconfiguredRuntime,
      dummyMsg
    );
    assert.equal(isValidWithoutCred, false);

    const configuredRuntime = createMockRuntime({
      SCOPEGUARD_CREDENTIAL_JSON: JSON.stringify(mockCredential),
    });
    const isValidWithCred = await scopeGuardGetBudgetAction.validate(
      configuredRuntime,
      dummyMsg
    );
    assert.equal(isValidWithCred, true);
  });

  it("scopeGuardExecuteAction rejects missing required parameters gracefully", async () => {
    const runtime = createMockRuntime({
      SCOPEGUARD_CREDENTIAL_JSON: JSON.stringify(mockCredential),
    });
    const emptyMsg: Memory = { content: { text: "do something" } };

    let callbackFired = false;
    const outcome = await scopeGuardExecuteAction.handler(
      runtime,
      emptyMsg,
      undefined,
      undefined,
      async (res) => {
        callbackFired = true;
        assert.ok(res.text.includes("missing required"));
      }
    );

    assert.equal((outcome as any).status, "REJECTED");
    assert.ok((outcome as any).reason.includes("INVALID_PARAMETERS"));
    assert.equal(callbackFired, true);
  });

  it("scopeGuardProvider returns null gracefully when credential is not configured", async () => {
    const runtime = createMockRuntime({});
    const msg: Memory = { content: { text: "status" } };
    const context = await scopeGuardProvider.get(runtime, msg);
    assert.equal(context, null);
  });

  it("scopeGuardGetBudgetAction returns formatted budget when configured", async () => {
    const runtime = createMockRuntime({
      SCOPEGUARD_CREDENTIAL_JSON: JSON.stringify(mockCredential),
    });
    const msg: Memory = { content: { text: "check budget" } };

    // Mock client budget call
    const originalAct = ScopeGuardAgentClient.prototype.budget;
    ScopeGuardAgentClient.prototype.budget = async function () {
      return {
        cap: "500",
        spent: "25",
        remaining: "475",
        actions_in_window: 1,
        paused: false,
        vault_balance: "350",
        revoked: false,
        high_water_mark: "350" as any,
        max_drawdown_bps: 1500,
        near_vault_balance: "1000000000000000000000000" as any,
      };
    };

    try {
      let callbackResult: any = null;
      const budget = await scopeGuardGetBudgetAction.handler(
        runtime,
        msg,
        undefined,
        undefined,
        async (res) => {
          callbackResult = res;
        }
      );

      assert.ok(budget);
      assert.equal((budget as any).cap, "500");
      assert.equal((budget as any).remaining, "475");
      assert.ok(callbackResult.text.includes("ACTIVE"));
      assert.ok(callbackResult.text.includes("475 tokens"));
    } finally {
      ScopeGuardAgentClient.prototype.budget = originalAct;
    }
  });

  it("scopeGuardExecuteAction formats ALLOWED, PENDING, and REJECTED outcomes accurately", async () => {
    const runtime = createMockRuntime({
      SCOPEGUARD_CREDENTIAL_JSON: JSON.stringify(mockCredential),
    });

    const originalAct = ScopeGuardAgentClient.prototype.act;

    try {
      // 1. ALLOWED outcome
      ScopeGuardAgentClient.prototype.act = async function () {
        return { status: "ALLOWED", reason: null, pending_id: null };
      };
      let allowedText = "";
      const allowedRes = await scopeGuardExecuteAction.handler(
        runtime,
        { content: { text: "swap 25", target: "dex.near", method: "swap", amount: "25" } },
        undefined,
        undefined,
        async (res) => {
          allowedText = res.text;
        }
      );
      assert.equal((allowedRes as any).status, "ALLOWED");
      assert.ok(allowedText.includes("successfully authorized and executed"));

      // 2. PENDING outcome
      ScopeGuardAgentClient.prototype.act = async function () {
        return {
          status: "PENDING",
          reason: null,
          pending_id: 3,
          escalation_message: "Action queued in ScopeGuard review quarantine (Pending ID: #3).",
        };
      };
      let pendingText = "";
      const pendingRes = await scopeGuardExecuteAction.handler(
        runtime,
        { content: { text: "swap 500", target: "dex.near", method: "swap", amount: "500" } },
        undefined,
        undefined,
        async (res) => {
          pendingText = res.text;
        }
      );
      assert.equal((pendingRes as any).status, "PENDING");
      assert.ok(pendingText.includes("Pending ID: #3"));

      // 3. REJECTED outcome
      ScopeGuardAgentClient.prototype.act = async function () {
        return { status: "REJECTED", reason: "RECIPIENT_NOT_ALLOWED", pending_id: null };
      };
      let rejectedText = "";
      const rejectedRes = await scopeGuardExecuteAction.handler(
        runtime,
        { content: { text: "send to hacker", to: "hacker.near", amount: "100" } },
        undefined,
        undefined,
        async (res) => {
          rejectedText = res.text;
        }
      );
      assert.equal((rejectedRes as any).status, "REJECTED");
      assert.ok(rejectedText.includes("RECIPIENT_NOT_ALLOWED"));
    } finally {
      ScopeGuardAgentClient.prototype.act = originalAct;
    }
  });

  it("scopeGuardPreflightAction returns simulation results without broadcasting", async () => {
    const runtime = createMockRuntime({
      SCOPEGUARD_CREDENTIAL_JSON: JSON.stringify(mockCredential),
    });

    const originalPreflight = ScopeGuardAgentClient.prototype.preflight;
    try {
      ScopeGuardAgentClient.prototype.preflight = async function () {
        return {
          status: "ALLOWED",
          reason: null,
          delay_seconds: null,
          budget: undefined,
          velocity_used: 1,
          velocity_max: 5,
          velocity_remaining: 4,
          vault_balance: "350" as any,
        };
      };

      let preflightText = "";
      const sim = await scopeGuardPreflightAction.handler(
        runtime,
        { content: { text: "check swap", target: "dex.near", method: "swap", amount: "25" } },
        undefined,
        undefined,
        async (res) => {
          preflightText = res.text;
        }
      );

      assert.equal(sim.status, "ALLOWED");
      assert.ok(preflightText.includes("Preflight Simulation"));
      assert.ok(preflightText.includes("Velocity: 1/5"));
    } finally {
      ScopeGuardAgentClient.prototype.preflight = originalPreflight;
    }
  });
});
