"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Send,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  Terminal,
  Save,
  MessageSquare,
  Bot,
  RefreshCw,
} from "lucide-react";

interface WebhookAlertSettingsProps {
  agentId: string;
}

export function WebhookAlertSettings({ agentId }: WebhookAlertSettingsProps) {
  const [activeTab, setActiveTab] = useState<"discord" | "telegram">("discord");
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");

  const [alertOnAutoPause, setAlertOnAutoPause] = useState(true);
  const [alertOnReject, setAlertOnReject] = useState(true);
  const [alertOnPending, setAlertOnPending] = useState(true);
  const [alertOnCanary, setAlertOnCanary] = useState(true);

  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storageKey = `scopeguard_notifications_${agentId}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.discordWebhookUrl) setDiscordWebhookUrl(parsed.discordWebhookUrl);
        if (parsed.telegramBotToken) setTelegramBotToken(parsed.telegramBotToken);
        if (parsed.telegramChatId) setTelegramChatId(parsed.telegramChatId);
        if (typeof parsed.alertOnAutoPause === "boolean") setAlertOnAutoPause(parsed.alertOnAutoPause);
        if (typeof parsed.alertOnReject === "boolean") setAlertOnReject(parsed.alertOnReject);
        if (typeof parsed.alertOnPending === "boolean") setAlertOnPending(parsed.alertOnPending);
        if (typeof parsed.alertOnCanary === "boolean") setAlertOnCanary(parsed.alertOnCanary);
      }
    } catch {
      // ignore JSON parse error
    }
  }, [agentId]);

  const handleSave = () => {
    if (typeof window === "undefined") return;
    try {
      const storageKey = `scopeguard_notifications_${agentId}`;
      const payload = {
        discordWebhookUrl,
        telegramBotToken,
        telegramChatId,
        alertOnAutoPause,
        alertOnReject,
        alertOnPending,
        alertOnCanary,
        updatedAt: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const body: Record<string, string> = {
        type: activeTab,
        agentName: agentId,
      };

      if (activeTab === "discord") {
        if (!discordWebhookUrl || !discordWebhookUrl.startsWith("https://")) {
          setTestResult({
            ok: false,
            message: "Please enter a valid HTTPS Discord or Slack webhook URL.",
          });
          setIsSendingTest(false);
          return;
        }
        body.webhookUrl = discordWebhookUrl;
      } else {
        if (!telegramBotToken || !telegramChatId) {
          setTestResult({
            ok: false,
            message: "Both Telegram Bot Token and Chat ID are required.",
          });
          setIsSendingTest(false);
          return;
        }
        body.botToken = telegramBotToken;
        body.chatId = telegramChatId;
      }

      const res = await fetch("/api/alerts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          ok: true,
          message: data.message || "Test alert delivered successfully.",
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error || "Failed to dispatch alert.",
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || "Network error while sending test alert.",
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const isConfigured =
    activeTab === "discord"
      ? Boolean(discordWebhookUrl && discordWebhookUrl.startsWith("https://"))
      : Boolean(telegramBotToken && telegramChatId);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-obsidian-800 bg-white dark:bg-obsidian-900 p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-obsidian-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Real-Time Alert Dispatcher
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Emergency Webhooks & Mobile Alerts
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Connect the onchain emergency brake to your phone or team channel. Get instant pings when circuit breakers trip, actions are blocked, or honeypots are touched.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium font-mono ${
              isConfigured
                ? "bg-mint-green/10 text-mint-greenDark dark:text-mint-green border border-mint-green/20"
                : "bg-slate-100 dark:bg-obsidian-800 text-slate-500 border border-slate-200 dark:border-obsidian-700"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConfigured ? "bg-mint-green" : "bg-slate-400"
              }`}
            />
            <span>{isConfigured ? "Channel Active" : "Not Configured"}</span>
          </span>
        </div>
      </div>

      {/* Channel Switcher */}
      <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-xs max-w-sm">
        <button
          type="button"
          onClick={() => {
            setActiveTab("discord");
            setTestResult(null);
          }}
          className={`flex-1 py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 font-medium cursor-pointer ${
            activeTab === "discord"
              ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white shadow-sm font-semibold"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
          <span>Discord Webhook</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("telegram");
            setTestResult(null);
          }}
          className={`flex-1 py-1.5 px-3 rounded-md transition flex items-center justify-center gap-1.5 font-medium cursor-pointer ${
            activeTab === "telegram"
              ? "bg-white dark:bg-obsidian-850 text-slate-900 dark:text-white shadow-sm font-semibold"
              : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Bot className="w-3.5 h-3.5 text-sky-500" />
          <span>Telegram Bot</span>
        </button>
      </div>

      {/* Form Fields */}
      {activeTab === "discord" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Discord / Slack Webhook URL</span>
              <a
                href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brand-blue hover:underline inline-flex items-center gap-0.5"
              >
                <span>How to get webhook</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/1234567890/abcdefg..."
              value={discordWebhookUrl}
              onChange={(e) => setDiscordWebhookUrl(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue transition"
            />
            <p className="text-[11px] text-slate-500">
              Paste the Incoming Webhook URL from your Discord channel integration or Slack workflow.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Telegram Bot Token</span>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brand-blue hover:underline inline-flex items-center gap-0.5"
              >
                <span>Create with @BotFather</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <input
              type="text"
              placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Chat ID / Group ID</span>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brand-blue hover:underline inline-flex items-center gap-0.5"
              >
                <span>Find via @userinfobot</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </label>
            <input
              type="text"
              placeholder="987654321 or -100123456789"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-brand-blue transition"
            />
          </div>
        </div>
      )}

      {/* Trigger Event Checkboxes */}
      <div className="pt-2 border-t border-slate-100 dark:border-obsidian-800 space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
          Dispatch Triggers
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-obsidian-850 transition">
            <input
              type="checkbox"
              checked={alertOnAutoPause}
              onChange={(e) => setAlertOnAutoPause(e.target.checked)}
              className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Circuit Breaker (AUTO_PAUSE)
            </span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-obsidian-850 transition">
            <input
              type="checkbox"
              checked={alertOnReject}
              onChange={(e) => setAlertOnReject(e.target.checked)}
              className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Refused Action (REJECT)
            </span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-obsidian-850 transition">
            <input
              type="checkbox"
              checked={alertOnPending}
              onChange={(e) => setAlertOnPending(e.target.checked)}
              className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Timelock Queue (PENDING)
            </span>
          </label>

          <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-obsidian-950 border border-slate-200 dark:border-obsidian-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-obsidian-850 transition">
            <input
              type="checkbox"
              checked={alertOnCanary}
              onChange={(e) => setAlertOnCanary(e.target.checked)}
              className="rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            <span className="font-medium text-slate-800 dark:text-slate-200">
              Honeypot Trap (CANARY)
            </span>
          </label>
        </div>
      </div>

      {/* Result feedback */}
      {testResult && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            testResult.ok
              ? "bg-mint-green/10 border-mint-green/30 text-mint-greenDark dark:text-mint-green font-medium"
              : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
          }`}
        >
          {testResult.ok ? (
            <Check className="w-4 h-4 shrink-0 text-mint-green" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="py-2 px-3.5 rounded-lg bg-brand-blue hover:bg-brand-blueHover text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSendingTest ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{isSendingTest ? "Sending Test Alert..." : "Send Test Alert"}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="py-2 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-obsidian-800 dark:hover:bg-obsidian-750 text-slate-900 dark:text-white text-xs font-semibold border border-slate-200 dark:border-obsidian-700 transition flex items-center gap-1.5 cursor-pointer"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-mint-green" />
                <span className="text-mint-greenDark dark:text-mint-green">Saved Locally</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Configuration</span>
              </>
            )}
          </button>
        </div>

        {/* Watcher Service Terminal Snippet */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span>Daemon: node watcher/dist/index.js</span>
        </div>
      </div>
    </div>
  );
}
