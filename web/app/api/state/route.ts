export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { connect, keyStores } from "near-api-js";
import { getRecentActivities } from "@/lib/ledger";

let cachedState: any = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

export async function GET() {
  const now = Date.now();
  if (cachedState && now - lastCacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cachedState,
      cached: true,
      activities: getRecentActivities(),
    });
  }

  try {
    const near = await connect({
      networkId: process.env.NEAR_NETWORK || "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org",
      keyStore: new keyStores.InMemoryKeyStore(),
    });

    const guardId = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
    const agentId = process.env.SCOPEGUARD_AGENT_ACCOUNT || process.env.SCOPEGUARD_AGENT_ID || process.env.AGENT_ACCOUNT_ID || "trader.sergeo-guard.testnet";
    const ownerId = process.env.SCOPEGUARD_OWNER_ACCOUNT || process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
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

    let policy = null;
    try {
      policy = await account.viewFunction({
        contractId: guardId,
        methodName: "get_policy",
        args: { agent_account: agentId },
      });
    } catch {
      // Policy view query fallback
    }

    let agentPublicKey = process.env.SCOPEGUARD_AGENT_PUBLIC_KEY || process.env.AGENT_PUBLIC_KEY || "ed25519:13Xi8UoLpX7hgPd6u8W4JRMsxtzHHkMd8RZpdhqppSvm";
    try {
      const agentAccount = await near.account(agentId);
      const accessKeys = await agentAccount.getAccessKeys();
      if (accessKeys && accessKeys.length > 0) {
        agentPublicKey = accessKeys[0].public_key;
      }
    } catch {
      // Fallback to configured key
    }

    const statePayload = {
      success: true,
      budget,
      policy,
      pendingActions,
      stagedPolicy,
      guardId,
      agentId,
      ownerId,
      agentPublicKey,
      activities: getRecentActivities(),
    };

    cachedState = statePayload;
    lastCacheTimestamp = now;

    return NextResponse.json(statePayload);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
