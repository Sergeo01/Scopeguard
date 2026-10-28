export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connect, keyStores, KeyPair } from "near-api-js";
import { recordActivity } from "@/lib/ledger";

let lastAttackTimestamp = 0;
let isAttackInProgress = false;

export async function POST(req: Request) {
  if (isAttackInProgress) {
    return NextResponse.json({
      success: false,
      error: "Another attack execution is currently processing onchain. Please wait a moment.",
    }, { status: 429 });
  }

  isAttackInProgress = true;
  try {
    // Basic throttle to prevent gas draining and DDoS
    const now = Date.now();
    if (now - lastAttackTimestamp < 2000) {
      return NextResponse.json({
        success: false,
        error: "Rate limit: please wait 2 seconds between live simulation attacks.",
      }, { status: 429 });
    }
    lastAttackTimestamp = now;

    const body = await req.json();
    let target = body.target;
    let method = body.method;
    let amount = body.amount;
    let recipient = body.recipient;
    let args = body.args;
    const promptText = (body.promptText || body.prompt || "").trim();

    // Naive Agent Prompt Interpreter: turns natural language attack prompts into actions
    if (promptText) {
      const lower = promptText.toLowerCase();
      const transferMatch = promptText.match(/(?:transfer|send|drain|pay|withdraw)\s*(?:all|\$|entire)?\s*(\d*)\s*(?:musd|dollars|usd|\$|tokens|pot)?\s*(?:to|into)?\s*([a-z0-9_-]+\.(?:testnet|near))/i);
      if (transferMatch) {
        amount = transferMatch[1] || "500";
        recipient = transferMatch[2];
        target = "sergeo-guard-token.testnet";
        method = "ft_transfer";
      } else if (lower.includes("evil") || lower.includes("drain") || lower.includes("hack") || lower.includes("steal")) {
        target = "evil_contract.testnet";
        method = "drain";
        amount = "0";
      } else if (lower.includes("swap") || lower.includes("trade")) {
        const swapAmtMatch = promptText.match(/(\d+)/);
        amount = swapAmtMatch ? swapAmtMatch[1] : "10";
        target = "sergeo-guard-dex.testnet";
        method = "swap";
      }
    }

    if (!target) target = "sergeo-guard-dex.testnet";
    if (!method) method = "swap";
    if (!amount) amount = "0";

    let cred: any = null;
    const rootPath = fs.existsSync(path.join(process.cwd(), "demo-agent"))
      ? process.cwd()
      : path.join(process.cwd(), "..");
    const credPath = path.join(rootPath, "demo-agent", "credentials", "agent.json");

    // Standardized environment variables with seamless fallbacks
    const envAgentKey = process.env.SCOPEGUARD_AGENT_PRIVATE_KEY || process.env.AGENT_PRIVATE_KEY;
    const envAgentAccount = process.env.SCOPEGUARD_AGENT_ACCOUNT || process.env.SCOPEGUARD_AGENT_ID || process.env.AGENT_ACCOUNT_ID;

    if (envAgentKey && envAgentAccount) {
      cred = {
        agentAccountId: envAgentAccount,
        policyContractId: process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet",
        publicKey: process.env.SCOPEGUARD_AGENT_PUBLIC_KEY || process.env.AGENT_PUBLIC_KEY || "",
        privateKey: envAgentKey,
        networkId: process.env.NEAR_NETWORK || "testnet",
        nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
      };
    } else if (fs.existsSync(credPath)) {
      cred = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    } else {
      return NextResponse.json({
        success: false,
        error: "Agent credentials not found on server. Set SCOPEGUARD_AGENT_PRIVATE_KEY and SCOPEGUARD_AGENT_ACCOUNT.",
      }, { status: 500 });
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(cred.networkId || "testnet", cred.agentAccountId, KeyPair.fromString(cred.privateKey));

    const near = await connect({
      networkId: cred.networkId || "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || cred.nodeUrl || "https://rpc.testnet.near.org",
      keyStore,
    });

    const agentAccount = await near.account(cred.agentAccountId);

    // Fast pre-check: if agent is currently PAUSED onchain, return PAUSED outcome immediately
    try {
      const budget = await agentAccount.viewFunction({
        contractId: cred.policyContractId || "guard2.sergeo-guard.testnet",
        methodName: "get_budget",
        args: { agent_account: cred.agentAccountId },
      });

      if (budget && budget.paused) {
        return NextResponse.json({
          success: true,
          outcome: {
            status: "REJECTED",
            reason: "PAUSED",
            pending_id: null,
          },
          note: "Agent is currently in PAUSED state. Enforcement check rejected without gas expenditure.",
        });
      }
    } catch {
      // Continue to function call if view query fails
    }

    // Build strongly-typed GuardAction
    const argsString = typeof args === "string" ? args : JSON.stringify(args || {});
    let action: any;

    if (method === "swap") {
      action = {
        Swap: {
          dex: target,
          token_in: "sergeo-guard-token.testnet",
          amount_in: amount || "0",
          min_out: "0",
        },
      };
    } else if (recipient) {
      action = {
        Transfer: {
          token: target,
          to: recipient,
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

    const callResult = await agentAccount.functionCall({
      contractId: cred.policyContractId || "guard2.sergeo-guard.testnet",
      methodName: "execute",
      args: { action },
      gas: BigInt("50000000000000"), // 50 TGas
    });

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

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      outcome: parsedOutcome,
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
