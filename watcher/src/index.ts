import * as fs from "fs";
import * as path from "path";

export interface WatcherConfig {
  rpcUrl: string;
  policyContractId: string;
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  pollIntervalMs?: number;
}

export interface ScopeGuardEvent {
  event:
    | "REGISTER"
    | "POLICY_SET"
    | "PAUSE"
    | "UNPAUSE"
    | "ALLOW"
    | "REJECT"
    | "AUTO_PAUSE"
    | "PENDING"
    | "SETTLED"
    | "CANCELLED"
    | "POLICY_STAGED"
    | "POLICY_APPLIED"
    | "POLICY_CHANGE_CANCELLED";
  agent: string;
  id?: number;
  reason?: string;
  rejects?: number;
  window_minutes?: number;
  target?: string;
  method?: string;
  amount?: string;
  owner?: string;
  executable_at?: number;
  effective_at?: number;
}

export function parseEventFromLog(logLine: string): ScopeGuardEvent | null {
  if (!logLine.startsWith("EVENT_JSON:")) {
    return null;
  }
  try {
    const raw = logLine.substring("EVENT_JSON:".length);
    return JSON.parse(raw) as ScopeGuardEvent;
  } catch {
    return null;
  }
}

export function formatAlertMessage(event: ScopeGuardEvent): string | null {
  if (event.event === "REJECT") {
    return `🚨 ScopeGuard Security Alert: Agent ${event.agent} attempted an unauthorized action and was BLOCKED. Reason: ${event.reason}`;
  }
  if (event.event === "AUTO_PAUSE") {
    return `🛑 ScopeGuard Emergency Brake: Circuit breaker tripped for agent ${event.agent}! ${event.rejects} rejections within ${event.window_minutes} minutes. The agent is now PAUSED onchain.`;
  }
  if (event.event === "PENDING") {
    return `⏳ ScopeGuard Timelock Alert: High-value action queued for agent ${event.agent} (ID: ${event.id}, Amount: ${event.amount} mUSD). Executable at timestamp ${event.executable_at}. Owner veto is available.`;
  }
  if (event.event === "SETTLED") {
    return `✅ ScopeGuard Notice: High-value action ${event.id} settled for agent ${event.agent} (${event.amount} mUSD).`;
  }
  if (event.event === "CANCELLED") {
    return `🚫 ScopeGuard Notice: Pending action ${event.id} cancelled by owner for agent ${event.agent}.`;
  }
  if (event.event === "POLICY_STAGED") {
    return `⚠️ ScopeGuard Notice: Policy change staged for agent ${event.agent}. Effective at timestamp ${event.effective_at}.`;
  }
  if (event.event === "POLICY_APPLIED") {
    return `📋 ScopeGuard Notice: Staged policy applied onchain for agent ${event.agent}.`;
  }
  if (event.event === "POLICY_CHANGE_CANCELLED") {
    return `↩️ ScopeGuard Notice: Staged policy change cancelled by owner for agent ${event.agent}.`;
  }
  if (event.event === "PAUSE") {
    return `⏸ ScopeGuard Notice: Agent ${event.agent} has been paused by the owner.`;
  }
  if (event.event === "UNPAUSE") {
    return `▶ ScopeGuard Notice: Agent ${event.agent} has been unpaused. Normal operations resumed.`;
  }
  return null;
}

export async function sendWebhookAlert(webhookUrl: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,
        text: message,
        allowed_mentions: { parse: [] },
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to deliver alert to webhook:", err);
    return false;
  }
}

export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to deliver alert to Telegram:", err);
    return false;
  }
}

export class ScopeGuardWatcher {
  private config: WatcherConfig;
  private running = false;
  private lastBlockHeight = 0;

  constructor(config: WatcherConfig) {
    this.config = config;
  }

  async fetchLatestBlock(): Promise<any> {
    const res = await fetch(this.config.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "block_poll",
        method: "block",
        params: { finality: "final" },
      }),
    });
    const data = await res.json();
    return data.result;
  }

  async checkBlock(blockHeight: number): Promise<ScopeGuardEvent[]> {
    const events: ScopeGuardEvent[] = [];
    try {
      const res = await fetch(this.config.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `block_${blockHeight}`,
          method: "block",
          params: { block_id: blockHeight },
        }),
      });
      const data = await res.json();
      const chunks = data.result?.chunks || [];

      for (const chunk of chunks) {
        if (!chunk.chunk_hash) continue;
        const chunkRes = await fetch(this.config.rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `chunk_${chunk.chunk_hash}`,
            method: "chunk",
            params: { chunk_id: chunk.chunk_hash },
          }),
        });
        const chunkData = await chunkRes.json();
        const receipts = chunkData.result?.receipt_execution_outcomes || [];

        for (const outcome of receipts) {
          if (outcome.outcome?.executor_id === this.config.policyContractId) {
            for (const logLine of outcome.outcome.logs || []) {
              const parsed = parseEventFromLog(logLine);
              if (parsed) {
                events.push(parsed);
              }
            }
          }
        }
      }
    } catch {
      // transient RPC skip
    }
    return events;
  }

  async poll(): Promise<ScopeGuardEvent[]> {
    try {
      const block = await this.fetchLatestBlock();
      const currentHeight = block?.header?.height;
      if (!currentHeight) return [];

      if (this.lastBlockHeight === 0) {
        this.lastBlockHeight = currentHeight;
        console.log(`[Watcher] Synced to latest block height: ${this.lastBlockHeight}`);
        return [];
      }

      if (currentHeight <= this.lastBlockHeight) {
        return []; // Head did not advance, do not regress cursor
      }

      const foundEvents: ScopeGuardEvent[] = [];
      const start = this.lastBlockHeight + 1;
      const end = Math.min(currentHeight, start + 3); // process max 3 blocks per tick to reduce RPC load
      let lastProcessed = this.lastBlockHeight;

      for (let h = start; h <= end; h++) {
        try {
          const events = await this.checkBlock(h);
          for (const ev of events) {
            foundEvents.push(ev);
            const alert = formatAlertMessage(ev);
            if (alert) {
              console.log("\n" + alert);
              if (this.config.webhookUrl) {
                await sendWebhookAlert(this.config.webhookUrl, alert);
              }
              if (this.config.telegramBotToken && this.config.telegramChatId) {
                await sendTelegramAlert(
                  this.config.telegramBotToken,
                  this.config.telegramChatId,
                  alert
                );
              }
            }
          }
          lastProcessed = h;
        } catch (err: any) {
          console.warn(`[Watcher] Error checking block ${h}, pausing to retry:`, err.message);
          break; // Halt batch to retry from lastProcessed on next tick
        }
      }

      this.lastBlockHeight = lastProcessed;
      return foundEvents;
    } catch (err: any) {
      console.error("[Watcher] Poll error:", err.message);
      return [];
    }
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`[Watcher] Started tailing events for contract: ${this.config.policyContractId}`);
    const interval = this.config.pollIntervalMs || 3000;

    while (this.running) {
      await this.poll();
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  stop(): void {
    this.running = false;
  }
}

// Runnable standalone entry point
if (require.main === module) {
  const rpcUrl = process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org";
  const policyContractId = process.env.POLICY_CONTRACT_ID || "guard2.sergeo-guard.testnet";
  const webhookUrl = process.env.WEBHOOK_URL;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  console.log("=== ScopeGuard Event Watcher ===");
  console.log("RPC:", rpcUrl);
  console.log("Contract:", policyContractId);
  if (webhookUrl) console.log("Webhook configured:", webhookUrl);
  if (telegramBotToken && telegramChatId) {
    console.log("Telegram alerts configured for chat ID:", telegramChatId);
  }

  const watcher = new ScopeGuardWatcher({
    rpcUrl,
    policyContractId,
    webhookUrl,
    telegramBotToken,
    telegramChatId,
    pollIntervalMs: 2500,
  });

  watcher.start();
}
