export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { connect, keyStores } from "near-api-js";
import { getRecentActivities } from "@/lib/ledger";

const cacheMap = new Map<string, { state: any; timestamp: number }>();
const CACHE_TTL_MS = 5000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const queryAgent = searchParams.get("agent");
  const queryOwner = searchParams.get("owner");
  const queryGuard = searchParams.get("guard");

  const guardId = queryGuard || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
  const defaultAgent = process.env.SCOPEGUARD_AGENT_ACCOUNT || process.env.SCOPEGUARD_AGENT_ID || process.env.AGENT_ACCOUNT_ID || "agent.sergeo-guard.testnet";
  const ownerId = queryOwner || process.env.SCOPEGUARD_OWNER_ACCOUNT || process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";

  try {
    const near = await connect({
      networkId: process.env.NEAR_NETWORK || "testnet",
      nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
      keyStore: new keyStores.InMemoryKeyStore(),
    });

    const account = await near.account(ownerId);

    let effectiveAgentId = queryAgent || defaultAgent;
    if (!queryAgent && queryOwner) {
      try {
        const ownerAgents = await account.viewFunction({
          contractId: guardId,
          methodName: "get_agents",
          args: { owner: ownerId },
        });
        if (Array.isArray(ownerAgents) && ownerAgents.length > 0) {
          effectiveAgentId = ownerAgents[0];
        }
      } catch {
        // Fall back to default
      }
    }

    const cacheKey = `${guardId}:${effectiveAgentId}:${ownerId}`;
    const now = Date.now();
    const cached = cacheMap.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.state,
        cached: true,
        activities: getRecentActivities(),
      });
    }

    const budget = await account.viewFunction({
      contractId: guardId,
      methodName: "get_budget",
      args: { agent_account: effectiveAgentId },
    });

    const pendingActions = await account.viewFunction({
      contractId: guardId,
      methodName: "get_pending_actions",
      args: { agent_account: effectiveAgentId },
    });

    const stagedPolicy = await account.viewFunction({
      contractId: guardId,
      methodName: "get_staged_policy",
      args: { agent_account: effectiveAgentId },
    });

    let policy = null;
    try {
      policy = await account.viewFunction({
        contractId: guardId,
        methodName: "get_policy",
        args: { agent_account: effectiveAgentId },
      });
    } catch {
      // Policy view query fallback
    }

    // Derived from chain first. The env override exists for tests, and there is
    // deliberately no hardcoded key here: after a rotation a stale literal would
    // display a key that no longer controls anything.
    let agentPublicKey: string | null =
      process.env.SCOPEGUARD_AGENT_PUBLIC_KEY || process.env.AGENT_PUBLIC_KEY || null;
    try {
      const agentAccount = await near.account(effectiveAgentId);
      const accessKeys = await agentAccount.getAccessKeys();
      if (accessKeys && accessKeys.length > 0) {
        const scopedKey = accessKeys.find((k: any) => {
          const perm = k.access_key?.permission;
          return (
            typeof perm === "object" &&
            perm?.FunctionCall?.receiver_id === guardId
          );
        });
        agentPublicKey = scopedKey ? scopedKey.public_key : accessKeys[0].public_key;
      }
    } catch {
      // Leave the configured key (or null) in place
    }

    const statePayload = {
      success: true,
      budget,
      policy,
      pendingActions,
      stagedPolicy,
      guardId,
      agentId: effectiveAgentId,
      ownerId,
      agentPublicKey,
      activities: getRecentActivities(),
    };

    cacheMap.set(cacheKey, { state: statePayload, timestamp: now });

    return NextResponse.json(statePayload);
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
