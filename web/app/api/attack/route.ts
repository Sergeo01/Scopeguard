export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair } from "near-api-js";
import { recordActivity } from "@/lib/ledger";
import { isSameOrigin } from "@/lib/api-guard";

let lastAttackTimestamp = 0;
let isAttackInProgress = false;
const attackTimestamps: number[] = [];
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_ATTACKS_PER_WINDOW = 12;

export function resetAttackThrottles() {
  lastAttackTimestamp = 0;
  isAttackInProgress = false;
  attackTimestamps.length = 0;
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  // Non-browser caller check: require shared secret if configured
  const origin = req.headers.get("origin");
  const sharedSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  if (!origin && sharedSecret) {
    const authHeader = req.headers.get("authorization") || "";
    const customHeader = req.headers.get("x-scopeguard-secret") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (customHeader !== sharedSecret && bearer !== sharedSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid shared secret." },
        { status: 401 }
      );
    }
  }

  if (isAttackInProgress) {
    return NextResponse.json({
      success: false,
      error: "Another attack execution is currently processing onchain. Please wait a moment.",
    }, { status: 429 });
  }

  const now = Date.now();
  // Clean expired timestamps from sliding window
  while (attackTimestamps.length > 0 && attackTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    attackTimestamps.shift();
  }
  if (attackTimestamps.length >= MAX_ATTACKS_PER_WINDOW) {
    return NextResponse.json({
      success: false,
      error: "Rate limit: maximum 12 live attack executions per minute to conserve testnet gas. Please wait a moment.",
    }, { status: 429 });
  }

  isAttackInProgress = true;
  try {
    // Basic spacing throttle between rapid sequential calls
    if (now - lastAttackTimestamp < 1500) {
      return NextResponse.json({
        success: false,
        error: "Rate limit: please wait 1.5 seconds between onchain calls.",
      }, { status: 429 });
    }
    lastAttackTimestamp = now;
    attackTimestamps.push(now);

    const body = await req.json();
    let target = body.target;
    let method = body.method;
    let amount = body.amount;
    let recipient = body.recipient;
    let args = body.args;
    const promptText = (body.promptText || body.prompt || "").trim();

    // Parse prompt text intelligently if provided
    if (promptText) {
      const lower = promptText.toLowerCase();
      const nearMatch = promptText.match(/(?:send|transfer|pay|drain)\s*(\d[\d,.]*)\s*(?:near|N)\s*(?:to|into)?\s*([a-z0-9_.-]+\.(?:testnet|near))/i);
      const ftMatch = promptText.match(/(?:transfer|send|drain|pay|withdraw)\s*(?:all|\$|entire)?\s*([\d,]*)\s*(?:musd|dollars|usd|\$|tokens|pot)?\s*(?:to|into)?\s*([a-z0-9_-]+\.(?:testnet|near))/i);
      const intentMatch = promptText.match(/(?:intent|bridge|cross-chain|defuse)\s*(?:send|swap)?\s*(\d[\d,.]*)\s*(?:to|into)?\s*(0x[a-fA-F0-9]{40}|[a-zA-Z0-9]{32,44})/i);
      const canaryMatch = lower.includes("drain_vault") || lower.includes("honey") || lower.includes("admin_drain");

      if (nearMatch && (!target || target === "near" || body.fromPrompt)) {
        amount = amount || nearMatch[1].replace(/,/g, "");
        recipient = recipient || nearMatch[2];
        target = "near";
        method = "near_transfer";
      } else if (ftMatch && (!target || target === "sergeo-guard-token.testnet" || body.fromPrompt)) {
        amount = amount || (ftMatch[1] ? ftMatch[1].replace(/,/g, "") : "500");
        recipient = recipient || ftMatch[2];
        target = "sergeo-guard-token.testnet";
        method = "ft_transfer";
      } else if (intentMatch && (!target || target === "intents.near" || body.fromPrompt)) {
        amount = amount || (intentMatch[1] ? intentMatch[1].replace(/,/g, "") : "100");
        recipient = recipient || intentMatch[2];
        target = "intents.near";
        method = "execute_intent";
      } else if (canaryMatch && (!method || method === "drain_vault" || body.fromPrompt)) {
        target = "guard2.sergeo-guard.testnet";
        method = "drain_vault";
        amount = "0";
      } else if (!target || !method) {
        if (lower.includes("evil") || lower.includes("drain") || lower.includes("hack") || lower.includes("steal")) {
          target = "evil_contract.testnet";
          method = "drain";
          amount = amount || "0";
        } else if (lower.includes("swap") || lower.includes("trade")) {
          const swapAmtMatch = promptText.match(/(\d[\d,]*)/);
          amount = amount || (swapAmtMatch ? swapAmtMatch[1].replace(/,/g, "") : "10");
          target = "sergeo-guard-dex.testnet";
          method = "swap";
        }
      }
    } else if (promptText && !amount) {
      // If prompt contains an amount with commas and body omitted amount, parse it cleanly
      const numMatch = promptText.match(/(\d[\d,]*)/);
      if (numMatch) {
        amount = numMatch[1].replace(/,/g, "");
      }
    }

    if (!target) target = "sergeo-guard-dex.testnet";
    if (!method) method = "swap";
    if (!amount) amount = "0";

    const envAgentKey = process.env.SCOPEGUARD_AGENT_PRIVATE_KEY || process.env.AGENT_PRIVATE_KEY;
    const envAgentAccount = process.env.SCOPEGUARD_AGENT_ACCOUNT || process.env.SCOPEGUARD_AGENT_ID || process.env.AGENT_ACCOUNT_ID;

    if (!envAgentKey || !envAgentAccount) {
      return NextResponse.json({
        success: false,
        error: "Agent credentials not found in environment. Set SCOPEGUARD_AGENT_PRIVATE_KEY and SCOPEGUARD_AGENT_ACCOUNT.",
      }, { status: 500 });
    }

    const cred = {
      agentAccountId: envAgentAccount,
      policyContractId: process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet",
      publicKey: process.env.SCOPEGUARD_AGENT_PUBLIC_KEY || process.env.AGENT_PUBLIC_KEY || "",
      privateKey: envAgentKey,
      networkId: process.env.NEAR_NETWORK || "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
    };

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(cred.networkId || "testnet", cred.agentAccountId, KeyPair.fromString(cred.privateKey as any));

    // Build strongly-typed GuardAction
    const argsString = typeof args === "string" ? args : JSON.stringify(args || {});
    let action: any;

    if (method === "near_transfer" || method === "transfer_near" || target === "near" || target === "NEAR") {
      action = {
        NearTransfer: {
          to: recipient || "",
          amount: amount || "0",
        },
      };
    } else if (method === "execute_intent" || method === "intent_transfer" || target === "intents.near") {
      action = {
        IntentTransfer: {
          deposit_address: target || "intents.near",
          amount: amount || "0",
          destination_asset: args?.destination_asset || "USDC",
          recipient: recipient || "",
        },
      };
    } else if (method === "swap") {
      action = {
        Swap: {
          dex: target,
          token_in: "sergeo-guard-token.testnet",
          amount_in: amount || "0",
          min_out: "0",
        },
      };
    } else if (
      method === "ft_transfer" ||
      method === "ft_transfer_call" ||
      target === "sergeo-guard-token.testnet"
    ) {
      action = {
        Transfer: {
          token: target,
          to: recipient || "",
          amount: amount || "0",
          memo: null,
        },
      };
    } else {
      action = {
        ContractCall: {
          target,
          method,
          args: argsString,
        },
      };
    }

    const rpcUrls = Array.from(
      new Set(
        [
          process.env.NEAR_TESTNET_RPC,
          cred.nodeUrl,
          "https://test.rpc.fastnear.com",
          "https://rpc.testnet.near.org",
        ].filter(Boolean) as string[]
      )
    );

    let callResult: any = null;
    let lastError: any = null;

    for (const rpcUrl of rpcUrls) {
      try {
        const near = await connect({
          networkId: cred.networkId || "testnet",
          nodeUrl: rpcUrl,
          keyStore,
        });
        const agentAccount = await near.account(cred.agentAccountId);
        callResult = await agentAccount.functionCall({
          contractId: cred.policyContractId || "guard2.sergeo-guard.testnet",
          methodName: "execute",
          args: { action },
          gas: BigInt("100000000000000"), // 100 TGas
        });
        if (callResult) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`RPC ${rpcUrl} encountered error: ${err.message}. Retrying with alternate testnet provider...`);
      }
    }

    if (!callResult) {
      throw lastError || new Error("Failed to execute on NEAR Testnet across all available RPC endpoints.");
    }

    const txHash = callResult.transaction.hash;
    const parsedOutcome = JSON.parse(
      Buffer.from((callResult.status as any).SuccessValue, "base64").toString()
    );

    // Record into live activity ledger
    let activityType: "ALLOW" | "REJECT" | "PENDING" = "REJECT";
    if (parsedOutcome.status === "ALLOWED") {
      activityType = "ALLOW";
    } else if (parsedOutcome.status === "PENDING") {
      activityType = "PENDING";
    }

    recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      txHash,
      type: activityType,
      timestamp: Date.now(),
      agent: cred.agentAccountId,
      target,
      method,
      amount: amount && amount !== "0" ? amount : undefined,
      reason: parsedOutcome.reason || (parsedOutcome.status === "ALLOWED" ? "Action executed under verified policy" : parsedOutcome.status === "PENDING" ? `Queued in timelock quarantine (Intent #${parsedOutcome.pending_id || 1})` : undefined),
    });

    // Fail-safe real-time alert dispatch to Telegram and Discord webhooks if configured
    try {
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramChat = process.env.TELEGRAM_CHAT_ID;
      const webhookUrl = process.env.WEBHOOK_URL;

      if ((telegramToken && telegramChat) || webhookUrl) {
        let alertMessage: string | null = null;
        if (parsedOutcome.reason === "PAUSED") {
          alertMessage = `[EMERGENCY BRAKE] ScopeGuard Emergency Brake: Circuit breaker tripped onchain for agent ${cred.agentAccountId}! The agent is PAUSED on NEAR Testnet.`;
        } else if (parsedOutcome.status === "REJECTED") {
          alertMessage = `[ALERT] ScopeGuard Security Alert: Agent ${cred.agentAccountId} attempted an unauthorized action (${target} -> ${method}) and was BLOCKED onchain. Reason: ${parsedOutcome.reason}`;
        } else if (parsedOutcome.status === "PENDING") {
          alertMessage = `[TIMELOCK] ScopeGuard Timelock Alert: High-value action queued for agent ${cred.agentAccountId} (${amount || "0"} mUSD to ${target} -> ${method}). Owner review timelock active.`;
        }

        if (alertMessage) {
          if (telegramToken && telegramChat) {
            fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: telegramChat, text: alertMessage }),
            }).catch((err) => console.warn("Telegram alert delivery note:", err.message));
          }
          if (webhookUrl) {
            fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: alertMessage, text: alertMessage }),
            }).catch((err) => console.warn("Webhook alert delivery note:", err.message));
          }
        }
      }
    } catch {
      // Non-blocking: alert dispatch errors never disrupt the onchain response
    }

    const RULE_NUMBER: Record<string, number> = {
      NOT_AGENT: 1,
      PAUSED: 2,
      LEASE_EXPIRED: 3,
      CANARY_TRIPPED: 4,
      OVER_VELOCITY_CAP: 5,
      TARGET_NOT_ALLOWED: 6,
      METHOD_NOT_ALLOWED: 7,
      OVER_DAILY_CAP: 8,
      RECIPIENT_NOT_ALLOWED: 9,
      CROSS_CHAIN_INTENT_NOT_ALLOWED: 10,
      INTENT_RECIPIENT_NOT_ALLOWED: 10,
      OVER_MAX_DRAWDOWN: 11,
      DRAWDOWN_EXCEEDED: 11,
      INSUFFICIENT_VAULT_BALANCE: 13,
      PENDING_QUEUE_FULL: 14,
    };

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      outcome: parsedOutcome,
      verdict: {
        status: parsedOutcome.status,
        reasonCode: parsedOutcome.reason || (parsedOutcome.status === "ALLOWED" ? "POLICY_PASSED" : "PENDING"),
        ruleNumber: parsedOutcome.reason
          ? RULE_NUMBER[parsedOutcome.reason] ?? 0
          : parsedOutcome.status === "PENDING"
          ? 12
          : 0,
        ruleName: parsedOutcome.reason ? parsedOutcome.reason.replace(/_/g, " ") : parsedOutcome.status === "PENDING" ? "High Value Timelock" : "Policy Check",
        explanation: parsedOutcome.reason ? `Refused by onchain policy: ${parsedOutcome.reason}` : parsedOutcome.status === "PENDING" ? "High-value action held in 60-second owner veto quarantine." : "Action cleared all onchain policy bounds.",
        txHash,
        attemptedTarget: target,
        attemptedMethod: method,
        attemptedAmount: amount,
        fundsSaved: parsedOutcome.status === "ALLOWED" ? "0" : amount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  } finally {
    isAttackInProgress = false;
  }
}
