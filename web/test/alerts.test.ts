import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { POST } from "../app/api/alerts/test/route";

describe("Alerts API Route (/api/alerts/test)", () => {
  it("rejects cross-origin requests with 403", async () => {
    const req = new Request("http://localhost:3000/api/alerts/test", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil-attacker.site",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "discord" }),
    });

    const res = await POST(req);
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Cross-origin/);
  });

  it("rejects invalid alert types with 400", async () => {
    const req = new Request("http://localhost:3000/api/alerts/test", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "sms" }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Invalid alert type/);
  });

  it("validates Discord webhook URL format", async () => {
    const req = new Request("http://localhost:3000/api/alerts/test", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "discord",
        webhookUrl: "ftp://invalid-url.com",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Invalid webhook URL/);
  });

  it("validates Telegram bot token and chat ID presence", async () => {
    const req = new Request("http://localhost:3000/api/alerts/test", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "telegram",
        botToken: "",
        chatId: "12345",
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /Both Telegram Bot Token and Chat ID are required/);
  });

  it("dispatches Discord webhook test alert when valid", async () => {
    const originalFetch = globalThis.fetch;
    let dispatchedBody: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      dispatchedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
      } as Response;
    }) as any;

    try {
      const req = new Request("http://localhost:3000/api/alerts/test", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "discord",
          webhookUrl: "https://discord.com/api/webhooks/123/abc",
          agentName: "agent.sergeo-guard.testnet",
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.match(data.message, /Discord webhook test alert delivered/);
      assert.match(dispatchedBody.content, /agent\.sergeo-guard\.testnet/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("dispatches Telegram test alert when valid", async () => {
    const originalFetch = globalThis.fetch;
    let targetUrl = "";
    let dispatchedBody: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      targetUrl = String(url);
      dispatchedBody = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
      } as Response;
    }) as any;

    try {
      const req = new Request("http://localhost:3000/api/alerts/test", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "telegram",
          botToken: "123456:ABC-DEF",
          chatId: "987654",
          agentName: "agent.sergeo-guard.testnet",
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.match(data.message, /Telegram test alert delivered/);
      assert.match(targetUrl, /api\.telegram\.org\/bot123456:ABC-DEF\/sendMessage/);
      assert.equal(dispatchedBody.chat_id, "987654");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
