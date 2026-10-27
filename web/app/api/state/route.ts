import { NextResponse } from "next/server";
import { connect, keyStores } from "near-api-js";

export async function GET() {
  try {
    const near = await connect({
      networkId: "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
      keyStore: new keyStores.InMemoryKeyStore(),
    });

    const account = await near.account("sergeo-guard.testnet");
    const guardId = "guard.sergeo-guard.testnet";
    const agentId = "trader.sergeo-guard.testnet";

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
