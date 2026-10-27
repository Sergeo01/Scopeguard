export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connect, keyStores, KeyPair } from "near-api-js";

let lastAttackTimestamp = 0;

export async function POST(req: Request) {
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
    const { target = "sergeo-guard-dex.testnet", method = "swap", args, amount = "0", recipient } = body;

    let cred: any = null;
    const rootPath = fs.existsSync(path.join(process.cwd(), "demo-agent"))
      ? process.cwd()
      : path.join(process.cwd(), "..");
    const credPath = path.join(rootPath, "demo-agent", "credentials", "agent.json");

    if (fs.existsSync(credPath)) {
      cred = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    } else if (process.env.AGENT_PRIVATE_KEY && process.env.AGENT_ACCOUNT_ID) {
      cred = {
        agentAccountId: process.env.AGENT_ACCOUNT_ID,
        policyContractId: process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet",
        publicKey: process.env.AGENT_PUBLIC_KEY || "",
        privateKey: process.env.AGENT_PRIVATE_KEY,
        networkId: "testnet",
        nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
      };
    } else {
      return NextResponse.json({
        success: false,
        error: "Agent credentials not found on server. Ensure demo-agent/credentials/agent.json exists.",
      }, { status: 500 });
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(cred.networkId || "testnet", cred.agentAccountId, KeyPair.fromString(cred.privateKey));

    const near = await connect({
      networkId: cred.networkId || "testnet",
      nodeUrl: cred.nodeUrl || "https://test.rpc.fastnear.com",
      keyStore,
    });

    const agentAccount = await near.account(cred.agentAccountId);

    // Build strongly-typed GuardAction
    const argsString = typeof args === "string" ? args : JSON.stringify(args || {});
    let action: any;

    if (method === "swap") {
      action = {
        Swap: {
          dex: target,
          token_in: "token.near",
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
  }
}
