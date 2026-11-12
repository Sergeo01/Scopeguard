import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/api-guard";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin alert request rejected." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { type, webhookUrl, botToken, chatId, agentName = "agent2.sergeo-guard.testnet" } = body;

    if (type === "discord") {
      if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://")) {
        return NextResponse.json(
          { success: false, error: "Invalid webhook URL. Must be an HTTPS Discord or Slack webhook URL." },
          { status: 400 }
        );
      }

      const payload = {
        content: `[ALERT] **ScopeGuard Security Alert Test** for \`${agentName}\``,
        embeds: [
          {
            title: "ScopeGuard Emergency Channel Connected",
            description: "Your agent emergency brake notification channel is live. You will receive instant notifications whenever an unauthorized transaction is blocked or the onchain circuit breaker trips.",
            color: 16738657, // amber/red
            fields: [
              { name: "Monitored Agent", value: agentName, inline: true },
              { name: "Circuit Breaker", value: "3 Strikes / 10 Min", inline: true },
              { name: "Protection Level", value: "Onchain Hard Stop", inline: true },
            ],
            footer: { text: "ScopeGuard Security Runtime on NEAR Protocol" },
          },
        ],
      };

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          { success: false, error: `Webhook returned HTTP ${res.status}: ${errText.slice(0, 120)}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Discord webhook test alert delivered successfully.",
      });
    }

    if (type === "telegram") {
      if (!botToken || typeof botToken !== "string" || !chatId || typeof chatId !== "string") {
        return NextResponse.json(
          { success: false, error: "Both Telegram Bot Token and Chat ID are required." },
          { status: 400 }
        );
      }

      const telegramUrl = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
      const messageText = `[ALERT] ScopeGuard Security Alert Test\n\nAgent: ${agentName}\nStatus: Armed and Connected\n\nYour emergency brake notification channel is live. You will receive immediate alerts whenever the onchain circuit breaker trips or unauthorized transactions are blocked on NEAR.`;

      const res = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: messageText,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return NextResponse.json(
          { success: false, error: `Telegram API error (${res.status}): ${errText.slice(0, 120)}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Telegram test alert delivered successfully.",
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid alert type. Supported types: 'discord', 'telegram'." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process alert test request." },
      { status: 500 }
    );
  }
}
