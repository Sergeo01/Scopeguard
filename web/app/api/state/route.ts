export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores } from "near-api-js";

export async function GET() {
  try {
    const near = await connect({
      networkId: "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
      keyStore: new keyStores.InMemoryKeyStore(),
    });

    const guardId = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
    const agentId = process.env.SCOPEGUARD_AGENT_ID || "trader.sergeo-guard.testnet";
    const ownerId = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
    const account = await near.account(ownerId);

    const budget = await account.viewFunction({
      contractId: guardId,
      methodName: "get_budget",
      args: { agent_account: agentId },
    });

    const pendingActions = await account.viewFunction({
      contractId: guardId,
      methodName: "get_pending_actions",
      args: { agent_account: agentId },
    });

    const stagedPolicy = await account.viewFunction({
      contractId: guardId,
      methodName: "get_staged_policy",
      args: { agent_account: agentId },
    });

    return NextResponse.json({
      success: true,
      budget,
      pendingActions,
      stagedPolicy,
      guardId,
      agentId,
      ownerId: "sergeo-guard.testnet",
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
