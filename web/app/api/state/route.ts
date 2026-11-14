export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { connect, keyStores, utils } from "near-api-js";
import { getRecentActivities, getMergedActivities } from "@/lib/ledger";
import { getPolicyContractId } from "@/lib/config";
import { getVerifiedRpcEndpoints } from "@/lib/rpc";

const cacheMap = new Map<string, { state: any; timestamp: number }>();
const CACHE_TTL_MS = 5000;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const queryAgent = searchParams.get("agent");
  const queryOwner = searchParams.get("owner");
  const queryGuard = searchParams.get("guard");

  let guardId: string;
  try {
    guardId = queryGuard || getPolicyContractId();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  const defaultAgent = process.env.SCOPEGUARD_AGENT_ACCOUNT || process.env.SCOPEGUARD_AGENT_ID || process.env.AGENT_ACCOUNT_ID || "agent2.sergeo-guard.testnet";
  const ownerId = queryOwner || process.env.SCOPEGUARD_OWNER_ACCOUNT || process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";

  try {
    let effectiveAgentId = queryAgent || (queryOwner ? `agent.${queryOwner}` : defaultAgent);

    const initialKey = queryAgent || `auto:${ownerId}`;
    const cacheKey = `${guardId}:${initialKey}:${ownerId}`;
    const now = Date.now();
    const hasCacheBuster = searchParams.has("v") || searchParams.has("fresh") || searchParams.has("t");
    const cached = cacheMap.get(cacheKey) || cacheMap.get(`${guardId}:${effectiveAgentId}:${ownerId}`);
    if (!hasCacheBuster && cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.state,
        cached: true,
        activities: cached.state.activities || await getMergedActivities(effectiveAgentId),
      }, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const rpcUrls = getVerifiedRpcEndpoints();

    let budget: any = null;
    let pendingActions: any[] = [];
    let stagedPolicy: any = null;
    let policy: any = null;
    let activeNear: any = null;
    let lastError: any = null;

    for (const nodeUrl of rpcUrls) {
      try {
        const near = await connect({
          networkId: process.env.NEAR_NETWORK || "testnet",
          nodeUrl,
          keyStore: new keyStores.InMemoryKeyStore(),
        });

        const account = await near.account(ownerId);

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

        budget = await account.viewFunction({
          contractId: guardId,
          methodName: "get_budget",
          args: { agent_account: effectiveAgentId },
        });

        pendingActions = await account.viewFunction({
          contractId: guardId,
          methodName: "get_pending_actions",
          args: { agent_account: effectiveAgentId },
        });

        stagedPolicy = await account.viewFunction({
          contractId: guardId,
          methodName: "get_staged_policy",
          args: { agent_account: effectiveAgentId },
        });

        try {
          policy = await account.viewFunction({
            contractId: guardId,
            methodName: "get_policy",
            args: { agent_account: effectiveAgentId },
          });
        } catch {
          // Non-blocking
        }

        if (budget) {
          activeNear = near;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`RPC ${nodeUrl} error in /api/state: ${err.message}. Retrying with alternate provider...`);
      }
    }

    if (!budget) {
      throw lastError || new Error("Failed to query onchain state across all RPC providers");
    }

    // Derived from chain first. The env override exists for tests, and there is
    // deliberately no hardcoded key here: after a rotation a stale literal would
    // display a key that no longer controls anything.
    let agentPublicKey: string | null = null;
    let gasAllowanceNear: string | null = null;
    let isScopedKeyConfigured = false;

    try {
      if (activeNear) {
        const agentAccount = await activeNear.account(effectiveAgentId);
        const accessKeys = await agentAccount.getAccessKeys();
        if (accessKeys && accessKeys.length > 0) {
          const scopedKey = accessKeys.find((k: any) => {
            const perm = k.access_key?.permission;
            return (
              typeof perm === "object" &&
              perm?.FunctionCall?.receiver_id === guardId &&
              Array.isArray(perm?.FunctionCall?.method_names) &&
              perm.FunctionCall.method_names.includes("execute")
            );
          });
          if (scopedKey) {
            agentPublicKey = scopedKey.public_key;
            isScopedKeyConfigured = true;
            if (scopedKey.access_key?.permission?.FunctionCall?.allowance) {
              gasAllowanceNear = utils.format.formatNearAmount(
                scopedKey.access_key.permission.FunctionCall.allowance
              );
            }
          } else {
            agentPublicKey = null;
            isScopedKeyConfigured = false;
          }
        }
      }
    } catch {
      // Leave null if lookup fails
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
      gasAllowanceNear,
      isScopedKeyConfigured,
      activities: await getMergedActivities(effectiveAgentId),
    };

    cacheMap.set(cacheKey, { state: statePayload, timestamp: now });
    cacheMap.set(`${guardId}:${effectiveAgentId}:${ownerId}`, { state: statePayload, timestamp: now });

    return NextResponse.json(statePayload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
