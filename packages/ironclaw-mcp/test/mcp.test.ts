import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  TOOLS,
  normalizeParams,
  getDeclineDetails,
  recordDecline,
  getLastDecline,
  resetLastDecline,
  handleMcpRequest,
} from "../src/index";
import { ScopeGuardCredential } from "@scopeguard/sdk";

const mockCred: ScopeGuardCredential = {
  agentAccountId: "trader.owner.testnet",
  policyContractId: "guard.testnet",
  publicKey: "ed25519:mockPublicKey123",
  privateKey: "ed25519:mockPrivateKey123",
  networkId: "testnet",
};

describe("IronClaw MCP Server Unit Tests", () => {
  beforeEach(() => {
    resetLastDecline();
  });

  test("TOOLS array registers all six required tools with valid schemas", () => {
    const toolNames = TOOLS.map((t) => t.name);
    assert.ok(toolNames.includes("scopeguard_budget"));
    assert.ok(toolNames.includes("scopeguard_get_rules"));
    assert.ok(toolNames.includes("scopeguard_get_last_decline"));
    assert.ok(toolNames.includes("scopeguard_get_pending"));
    assert.ok(toolNames.includes("scopeguard_preflight"));
    assert.ok(toolNames.includes("scopeguard_act"));
    assert.equal(TOOLS.length, 6);
  });

  test("normalizeParams resolves contract aliases and normalizes to/recipient", () => {
    const testnetParams = normalizeParams(
      {
        target: "REF",
        token: "USDC",
        to: "alice.testnet",
        method: "swap",
      },
      "testnet"
    );

    assert.equal(testnetParams.target, "sergeo-guard-dex.testnet");
    assert.equal(testnetParams.token, "sergeo-guard-token.testnet");
    assert.equal(testnetParams.recipient, "alice.testnet");
    assert.equal(testnetParams.to, "alice.testnet");

    const mainnetParams = normalizeParams(
      {
        target: "REF_FINANCE",
        token: "USDC",
        recipient: "bob.near",
        method: "ft_transfer",
      },
      "mainnet"
    );

    assert.equal(mainnetParams.target, "v2.ref-finance.near");
    assert.equal(
      mainnetParams.token,
      "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
    );
    assert.equal(mainnetParams.to, "bob.near");
  });

  test("getDeclineDetails returns informative guidance for each failure reason", () => {
    const dailyCapDecline = getDeclineDetails("OVER_DAILY_CAP");
    assert.ok(dailyCapDecline.explanation.includes("24 hour"));
    assert.ok(dailyCapDecline.suggested_fix.includes("daily cap"));

    const recipientDecline = getDeclineDetails("RECIPIENT_NOT_ALLOWED");
    assert.ok(recipientDecline.explanation.includes("allowlist"));
    assert.ok(recipientDecline.suggested_fix.includes("allowlist"));

    const storageDecline = getDeclineDetails("STORAGE_DEPOSIT_EXCEEDED");
    assert.ok(storageDecline.explanation.includes("2 NEAR"));
    assert.ok(storageDecline.suggested_fix.includes("2 NEAR"));

    const canaryDecline = getDeclineDetails("CANARY_TRIPPED");
    assert.ok(canaryDecline.explanation.toLowerCase().includes("canary"));
  });

  test("recordDecline stores decline in memory and getLastDecline retrieves it", () => {
    assert.equal(getLastDecline(), null);
    const recorded = recordDecline("OVER_DAILY_CAP", { amount: "1000" });
    assert.equal(recorded.reason, "OVER_DAILY_CAP");
    assert.equal(getLastDecline()?.reason, "OVER_DAILY_CAP");
    resetLastDecline();
    assert.equal(getLastDecline(), null);
  });

  test("handleMcpRequest responds to initialize, ping, and tools/list", async () => {
    const initResp = await handleMcpRequest(
      { id: 1, method: "initialize", params: {} },
      {},
      mockCred
    );
    assert.equal(initResp.id, 1);
    assert.equal(initResp.result.serverInfo.name, "scopeguard-ironclaw-mcp");

    const pingResp = await handleMcpRequest(
      { id: 2, method: "ping" },
      {},
      mockCred
    );
    assert.equal(pingResp.id, 2);
    assert.deepEqual(pingResp.result, {});

    const listResp = await handleMcpRequest(
      { id: 3, method: "tools/list" },
      {},
      mockCred
    );
    assert.equal(listResp.id, 3);
    assert.equal(listResp.result.tools.length, 6);
  });

  test("handleMcpRequest executes scopeguard_get_rules with lease countdown and limits", async () => {
    const mockClient = {
      getPolicy: async () => ({
        token: "sergeo-guard-token.testnet",
        targets: {
          "sergeo-guard-dex.testnet": ["swap"],
        },
        daily_cap: "50000000",
        recipients: ["allowed-friend.testnet"],
        max_actions_per_10min: 10,
        auto_pause_rejects: 3,
        auto_pause_window_minutes: 5,
        high_value_threshold: "10000000",
        high_value_delay_seconds: 3600,
        max_drawdown_bps: 2000,
        lease_expires_at: (Date.now() + 60000) * 1000000,
        canary_methods: ["emergency_drain"],
      }),
      budget: async () => ({
        cap: "50000000",
        spent: "10000000",
        remaining: "40000000",
        actions_in_window: 2,
        paused: false,
        vault_balance: "100000000",
        near_vault_balance: "5000000000000000000000000",
      }),
    };

    const resp = await handleMcpRequest(
      {
        id: 4,
        method: "tools/call",
        params: {
          name: "scopeguard_get_rules",
          arguments: {},
        },
      },
      mockClient,
      mockCred
    );

    assert.equal(resp.id, 4);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.equal(parsed.policy.daily_cap, "50000000");
    assert.equal(parsed.current_budget.remaining_budget, "40000000");
    assert.ok(parsed.policy.lease_countdown_seconds > 0);
    assert.equal(parsed.policy.canary_methods[0], "emergency_drain");
    assert.equal(parsed.current_budget.near_vault_balance, "5000000000000000000000000");
  });

  test("handleMcpRequest executes scopeguard_get_last_decline when memory decline exists", async () => {
    recordDecline("RECIPIENT_NOT_ALLOWED", { recipient: "stranger.testnet" });

    const resp = await handleMcpRequest(
      {
        id: 5,
        method: "tools/call",
        params: {
          name: "scopeguard_get_last_decline",
          arguments: {},
        },
      },
      {},
      mockCred
    );

    assert.equal(resp.id, 5);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.equal(parsed.has_decline, true);
    assert.equal(parsed.reason, "RECIPIENT_NOT_ALLOWED");
    assert.ok(parsed.suggested_fix.includes("allowlist"));
  });

  test("handleMcpRequest executes scopeguard_get_last_decline fallback to onchain rejects", async () => {
    const mockClient = {
      getRejectTimes: async () => [Date.now() * 1000000],
    };

    const resp = await handleMcpRequest(
      {
        id: 6,
        method: "tools/call",
        params: {
          name: "scopeguard_get_last_decline",
          arguments: {},
        },
      },
      mockClient,
      mockCred
    );

    assert.equal(resp.id, 6);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.equal(parsed.has_decline, true);
    assert.equal(parsed.reason, "ONCHAIN_REJECT");
  });

  test("handleMcpRequest executes scopeguard_get_pending with countdown and escalation formatting", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const mockClient = {
      getPendingActions: async () => [
        {
          id: 42,
          target: "sergeo-guard-dex.testnet",
          method: "swap",
          amount: "99000000",
          recipient: null,
          created_at: nowSec - 100,
          executable_at: nowSec + 3500,
        },
      ],
    };

    const resp = await handleMcpRequest(
      {
        id: 7,
        method: "tools/call",
        params: {
          name: "scopeguard_get_pending",
          arguments: {},
        },
      },
      mockClient,
      mockCred
    );

    assert.equal(resp.id, 7);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.equal(parsed.pending_count, 1);
    assert.equal(parsed.pending_actions[0].id, 42);
    assert.ok(parsed.pending_actions[0].seconds_remaining > 0);
    assert.equal(parsed.pending_actions[0].ready_for_settlement, false);
    assert.ok(parsed.pending_actions[0].escalation_message.includes("Pending ID: #42"));
  });

  test("handleMcpRequest scopeguard_act formats escalation guidance on PENDING", async () => {
    const mockClient = {
      act: async () => ({
        status: "PENDING",
        pending_id: 101,
      }),
    };

    const resp = await handleMcpRequest(
      {
        id: 8,
        method: "tools/call",
        params: {
          name: "scopeguard_act",
          arguments: {
            target: "REF",
            method: "swap",
            amount: "100000000",
          },
        },
      },
      mockClient,
      mockCred
    );

    assert.equal(resp.id, 8);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.equal(parsed.status, "PENDING");
    assert.equal(parsed.pending_id, 101);
    assert.ok(parsed.escalation_guidance);
    assert.equal(parsed.escalation_guidance.requires_owner_approval, true);
    assert.ok(parsed.escalation_guidance.message.includes("Pending ID: #101"));
  });

  test("handleMcpRequest scopeguard_act records decline on REJECTED", async () => {
    const mockClient = {
      act: async () => ({
        status: "REJECTED",
        reason: "OVER_DAILY_CAP",
      }),
    };

    const resp = await handleMcpRequest(
      {
        id: 9,
        method: "tools/call",
        params: {
          name: "scopeguard_act",
          arguments: {
            target: "REF",
            method: "swap",
            amount: "999999999",
          },
        },
      },
      mockClient,
      mockCred
    );

    assert.equal(resp.id, 9);
    const parsed = JSON.parse(resp.result.content[0].text);
    assert.equal(parsed.status, "REJECTED");
    assert.equal(parsed.reason, "OVER_DAILY_CAP");

    const last = getLastDecline();
    assert.ok(last);
    assert.equal(last?.reason, "OVER_DAILY_CAP");
  });
});
