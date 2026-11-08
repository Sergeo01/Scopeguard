export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair, providers } from "near-api-js";
import { recordActivity } from "@/lib/ledger";
import { isSameOrigin, checkAttackThrottle, setAttackInProgress, safeCompare } from "@/lib/api-guard";
import { getPolicyContractId } from "@/lib/config";

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
  PENDING: 12,
  INSUFFICIENT_VAULT_BALANCE: 13,
  PENDING_QUEUE_FULL: 14,
};

export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  // Require shared secret when configured regardless of origin
  const sharedSecret = process.env.SCOPEGUARD_SHARED_SECRET;
  if (sharedSecret && sharedSecret.trim().length > 0 && sharedSecret !== "undefined") {
    const authHeader = req.headers.get("authorization") || "";
    const customHeader = req.headers.get("x-scopeguard-secret") || "";
    const token = customHeader || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "");
    if (!token || !safeCompare(token, sharedSecret)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid shared secret." },
        { status: 401 }
      );
    }
  }

  const throttle = checkAttackThrottle();
  if (!throttle.allowed) {
    return NextResponse.json({
      success: false,
      error: throttle.error,
    }, { status: throttle.status || 429 });
  }

  setAttackInProgress(true);
  try {
    const body = await req.json();
    let target = body.target;
    let method = body.method;
    let amount = body.amount;
    let recipient = body.recipient;
    let args = body.args;
    const isDryRun = Boolean(body.dryRun);
    const promptText = (body.promptText || body.prompt || "").trim();

    // Parse prompt text intelligently if provided
    if (promptText) {
      const lower = promptText.toLowerCase();
      const ftMatch = promptText.match(/(?:transfer|send|drain|pay|withdraw)\s*(?:all|\$|entire)?\s*([\d,]*)\s*(?:musd|dollars|usd|\$|tokens|pot)?\s*(?:to|into)?\s*([a-z0-9_-]+\.(?:testnet|near))/i);
      const intentMatch = promptText.match(/(?:intent|bridge|cross-chain|defuse)\s*(?:send|swap)?\s*(\d[\d,.]*)\s*(?:to|into)?\s*(0x[a-fA-F0-9]{40}|[a-zA-Z0-9]{32,44})/i);
      const canaryMatch = lower.includes("drain_vault") || lower.includes("honey") || lower.includes("admin_drain");

      if (ftMatch && (!target || target === "sergeo-guard-token.testnet" || body.fromPrompt)) {
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
        target = process.env.NEXT_PUBLIC_POLICY_CONTRACT_ID || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
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
      const numMatch = promptText.match(/(\d[\d,]*)/);
      if (numMatch) {
        amount = numMatch[1].replace(/,/g, "");
      }
    }

    if (!target) target = "sergeo-guard-dex.testnet";
    if (!method) method = "swap";
    if (!amount) amount = "0";

    // Path B: Native NEAR agent transfers are disabled
    if (method === "near_transfer" || method === "transfer_near" || target === "near" || target === "NEAR") {
      return NextResponse.json(
        {
          success: false,
          error: "Agent NEAR transfer is disabled. Native NEAR is held in vault custody and moves exclusively via owner withdrawal.",
        },
        { status: 400 }
      );
    }

    const envAgentKey = process.env.SCOPEGUARD_AGENT_PRIVATE_KEY || process.env.AGENT_PRIVATE_KEY;
    const rawAgentAccount =
      process.env.SCOPEGUARD_AGENT_ACCOUNT ||
      process.env.SCOPEGUARD_AGENT_ID ||
      process.env.AGENT_ACCOUNT_ID;

    if (!isDryRun && (!envAgentKey || !rawAgentAccount)) {
      return NextResponse.json({
        success: false,
        error: "Agent credentials not found in environment. Set SCOPEGUARD_AGENT_PRIVATE_KEY and SCOPEGUARD_AGENT_ACCOUNT.",
      }, { status: 500 });
    }

    const guardContractId = getPolicyContractId();
    const envAgentAccount = rawAgentAccount || "agent.sergeo-guard.testnet";

    // Build strongly-typed GuardAction
    const argsString = typeof args === "string" ? args : JSON.stringify(args || {});
    let action: any;

    if (method === "execute_intent" || method === "intent_transfer" || target === "intents.near") {
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
          "https://test.rpc.fastnear.com",
        ].filter(Boolean) as string[]
      )
    );

    // If dry run requested: call preflight view function without signing
    if (isDryRun) {
      let pfResult: any = null;
      let lastErr: any = null;
      for (const rpcUrl of rpcUrls) {
        try {
          const provider = new providers.JsonRpcProvider({ url: rpcUrl });
          const raw = await provider.query({
            request_type: "call_function",
            account_id: guardContractId,
            method_name: "preflight",
            args_base64: Buffer.from(
              JSON.stringify({
                agent_account: envAgentAccount,
                action,
              })
            ).toString("base64"),
            finality: "optimistic",
          });
          pfResult = JSON.parse(Buffer.from((raw as any).result).toString());
          if (pfResult) break;
        } catch (err: any) {
          lastErr = err;
          console.warn(`RPC ${rpcUrl} preflight error: ${err.message}. Retrying next...`);
        }
      }

      if (!pfResult) {
        throw lastErr || new Error("Failed to execute preflight on NEAR Testnet across available RPC endpoints.");
      }

      const ruleNum = pfResult.reason
        ? (RULE_NUMBER[pfResult.reason] ?? 0)
        : pfResult.status === "PENDING"
        ? 12
        : 0;

      return NextResponse.json({
        success: true,
        dryRun: true,
        txHash: null,
        explorerUrl: null,
        outcome: pfResult,
        verdict: {
          status: pfResult.status,
          reasonCode: pfResult.reason || (pfResult.status === "ALLOWED" ? "POLICY_PASSED" : "PENDING"),
          ruleNumber: ruleNum,
          ruleName: pfResult.reason ? pfResult.reason.replace(/_/g, " ") : pfResult.status === "PENDING" ? "High Value Timelock" : "Policy Check",
          explanation: pfResult.reason
            ? `Refused by onchain policy: ${pfResult.reason}`
            : pfResult.status === "PENDING"
            ? "High-value action held in 60-second owner veto quarantine."
            : "Action cleared all onchain policy bounds in preflight verification.",
          txHash: null,
          attemptedTarget: target,
          attemptedMethod: method,
          attemptedAmount: amount,
          fundsSaved: pfResult.status === "ALLOWED" ? "0" : amount,
        },
      });
    }

    // Full execution requires agent key
    const cred = {
      agentAccountId: envAgentAccount,
      policyContractId: guardContractId,
      publicKey: process.env.SCOPEGUARD_AGENT_PUBLIC_KEY || process.env.AGENT_PUBLIC_KEY || "",
      privateKey: envAgentKey!,
      networkId: process.env.NEAR_NETWORK || "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
    };

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(cred.networkId || "testnet", cred.agentAccountId, KeyPair.fromString(cred.privateKey as any));

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
          contractId: cred.policyContractId,
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

    // Alert dispatch
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
      // Non-blocking
    }

    const ruleNumber = parsedOutcome.reason
      ? (RULE_NUMBER[parsedOutcome.reason] ?? 0)
      : parsedOutcome.status === "PENDING"
      ? 12
      : 0;

    return NextResponse.json({
      success: true,
      dryRun: false,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      outcome: parsedOutcome,
      verdict: {
        status: parsedOutcome.status,
        reasonCode: parsedOutcome.reason || (parsedOutcome.status === "ALLOWED" ? "POLICY_PASSED" : "PENDING"),
        ruleNumber,
        ruleName: parsedOutcome.reason ? parsedOutcome.reason.replace(/_/g, " ") : parsedOutcome.status === "PENDING" ? "High Value Timelock" : "Policy Check",
        explanation: parsedOutcome.reason
          ? `Refused by onchain policy: ${parsedOutcome.reason}`
          : parsedOutcome.status === "PENDING"
          ? "High-value action held in 60-second owner veto quarantine."
          : "Action cleared all onchain policy bounds and executed on NEAR Testnet.",
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
    setAttackInProgress(false);
  }
}
