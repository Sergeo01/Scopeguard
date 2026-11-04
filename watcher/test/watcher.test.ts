import { describe, it, mock } from "node:test";
import * as assert from "node:assert/strict";
import {
  parseEventFromLog,
  formatAlertMessage,
  sendWebhookAlert,
  sendTelegramAlert,
  ScopeGuardWatcher,
  ScopeGuardEvent,
} from "../src/index";

describe("ScopeGuard Watcher: Event Log Parser", () => {
  it("ignores non-event log lines", () => {
    assert.equal(parseEventFromLog("Executing action onchain"), null);
    assert.equal(parseEventFromLog("DEBUG: balance checked"), null);
    assert.equal(parseEventFromLog(""), null);
  });

  it("handles malformed JSON gracefully", () => {
    assert.equal(parseEventFromLog("EVENT_JSON:{invalid json"), null);
  });

  it("parses valid REJECT event", () => {
    const raw = 'EVENT_JSON:{"event":"REJECT","agent":"agent.testnet","reason":"TARGET_NOT_ALLOWED"}';
    const parsed = parseEventFromLog(raw);
    assert.ok(parsed);
    assert.equal(parsed.event, "REJECT");
    assert.equal(parsed.agent, "agent.testnet");
    assert.equal(parsed.reason, "TARGET_NOT_ALLOWED");
  });

  it("parses valid AUTO_PAUSE event", () => {
    const raw = 'EVENT_JSON:{"event":"AUTO_PAUSE","agent":"agent.testnet","rejects":3,"window_minutes":5}';
    const parsed = parseEventFromLog(raw);
    assert.ok(parsed);
    assert.equal(parsed.event, "AUTO_PAUSE");
    assert.equal(parsed.rejects, 3);
    assert.equal(parsed.window_minutes, 5);
  });

  it("parses valid PENDING timelock event", () => {
    const raw = 'EVENT_JSON:{"event":"PENDING","agent":"agent.testnet","id":4,"amount":"500","executable_at":1780000000}';
    const parsed = parseEventFromLog(raw);
    assert.ok(parsed);
    assert.equal(parsed.event, "PENDING");
    assert.equal(parsed.id, 4);
    assert.equal(parsed.amount, "500");
  });
});

describe("ScopeGuard Watcher: Alert Formatter", () => {
  it("formats REJECT events with exact failure reason", () => {
    const ev: ScopeGuardEvent = {
      event: "REJECT",
      agent: "trader.owner.testnet",
      reason: "RECIPIENT_NOT_ALLOWED",
    };
    const alert = formatAlertMessage(ev);
    assert.ok(alert);
    assert.match(alert, /BLOCKED/);
    assert.match(alert, /trader\.owner\.testnet/);
    assert.match(alert, /RECIPIENT_NOT_ALLOWED/);
  });

  it("formats AUTO_PAUSE emergency brake events", () => {
    const ev: ScopeGuardEvent = {
      event: "AUTO_PAUSE",
      agent: "trader.owner.testnet",
      rejects: 3,
      window_minutes: 5,
    };
    const alert = formatAlertMessage(ev);
    assert.ok(alert);
    assert.match(alert, /Emergency Brake/);
    assert.match(alert, /3 rejections within 5 minutes/);
    assert.match(alert, /PAUSED onchain/);
  });

  it("formats PENDING timelock quarantine events", () => {
    const ev: ScopeGuardEvent = {
      event: "PENDING",
      agent: "trader.owner.testnet",
      id: 7,
      amount: "250",
      executable_at: 1800000000,
    };
    const alert = formatAlertMessage(ev);
    assert.ok(alert);
    assert.match(alert, /Timelock Alert/);
    assert.match(alert, /ID: 7/);
    assert.match(alert, /250 mUSD/);
    assert.match(alert, /Owner veto is available/);
  });

  it("formats CANARY_TRIPPED honeypot events", () => {
    const ev: ScopeGuardEvent = {
      event: "CANARY_TRIPPED",
      agent: "trader.owner.testnet",
    };
    const alert = formatAlertMessage(ev);
    assert.ok(alert);
    assert.match(alert, /Trap Alert/);
    assert.match(alert, /Honeypot decoy method tripped/);
  });

  it("returns null for non-alerting events like ALLOW", () => {
    const ev: ScopeGuardEvent = {
      event: "ALLOW",
      agent: "trader.owner.testnet",
      target: "dex.testnet",
      method: "swap",
    };
    assert.equal(formatAlertMessage(ev), null);
  });
});

describe("ScopeGuard Watcher: Dispatch Delivery", () => {
  it("sendWebhookAlert handles delivery and payload structure", async () => {
    // Mock global fetch
    const originalFetch = globalThis.fetch;
    let postedBody: any = null;
    let targetUrl: string = "";

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      targetUrl = String(url);
      postedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
      } as Response;
    }) as any;

    try {
      const success = await sendWebhookAlert("https://discord.com/api/webhooks/test/123", "Alert test");
      assert.equal(success, true);
      assert.equal(targetUrl, "https://discord.com/api/webhooks/test/123");
      assert.equal(postedBody.content, "Alert test");
      assert.equal(postedBody.text, "Alert test");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sendWebhookAlert catches network failures gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("Connection refused");
    }) as any;

    try {
      const success = await sendWebhookAlert("https://broken.endpoint.local", "Alert test");
      assert.equal(success, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sendTelegramAlert formats Telegram sendMessage endpoint correctly", async () => {
    const originalFetch = globalThis.fetch;
    let targetUrl: string = "";
    let postedBody: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      targetUrl = String(url);
      postedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
      } as Response;
    }) as any;

    try {
      const success = await sendTelegramAlert("bot123456:ABC-DEF", "987654321", "Telegram alert test");
      assert.equal(success, true);
      assert.equal(targetUrl, "https://api.telegram.org/botbot123456:ABC-DEF/sendMessage");
      assert.equal(postedBody.chat_id, "987654321");
      assert.equal(postedBody.text, "Telegram alert test");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ScopeGuard Watcher: Lifecycle", () => {
  it("initializes with valid config and controls running flag", () => {
    const watcher = new ScopeGuardWatcher({
      rpcUrl: "https://test.rpc.fastnear.com",
      policyContractId: "guard2.sergeo-guard.testnet",
      pollIntervalMs: 1000,
    });
    assert.ok(watcher);
    watcher.stop();
  });
});
