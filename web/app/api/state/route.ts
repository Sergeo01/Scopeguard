export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { connect, keyStores, utils } from "near-api-js";
import { getRecentActivities, getMergedActivities } from "@/lib/ledger";
import { getPolicyContractId } from "@/lib/config";
import { getVerifiedRpcEndpoints, markRpcFailed } from "@/lib/rpc";

const cacheMap = new Map<string, { state: any; timestamp: number }>();
const CACHE_TTL_MS = 15000;

interface KeyCacheEntry {
  timestamp: number;
  agentPublicKey: string | null;
  gasAllowanceNear: string | null;
  isScopedKeyConfigured: boolean | null;
}
const keyCacheMap = new Map<string, KeyCacheEntry>();
const KEY_CACHE_TTL_MS = 60000;

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
    if (!hasCacheBuster && cached && cached.state.isScopedKeyConfigured !== null && now - cached.timestamp < CACHE_TTL_MS) {
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

        const guardAccount = await near.account(guardId);

        const [budgetRes, policyRes] = await Promise.all([
          guardAccount.viewFunction({
            contractId: guardId,
            methodName: "get_budget",
            args: { agent_account: effectiveAgentId },
          }),
          guardAccount.viewFunction({
            contractId: guardId,
            methodName: "get_policy",
            args: { agent_account: effectiveAgentId },
          }).catch(() => null),
        ]);

        if (budgetRes) {
          budget = budgetRes;

          try {
            const rawPending = await guardAccount.viewFunction({
              contractId: guardId,
              methodName: "get_pending_actions",
              args: { agent_account: effectiveAgentId },
            });
            if (Array.isArray(rawPending)) {
              pendingActions = rawPending.map((item: any) => {
                let amount = "0";
                let target = "";
                let method = "";
                let recipient: string | null = null;

                if (item.action?.Transfer) {
                  amount = item.action.Transfer.amount || "0";
                  target = item.action.Transfer.token || guardId;
                  method = "ft_transfer";
                  recipient = item.action.Transfer.to || null;
                } else if (item.action?.Swap) {
                  amount = item.action.Swap.amount_in || "0";
                  target = item.action.Swap.dex || "";
                  method = "swap";
                } else if (item.action?.ContractCall) {
                  amount = item.action.ContractCall.deposit || "0";
                  target = item.action.ContractCall.target || "";
                  method = item.action.ContractCall.method || "";
                }

                return {
                  id: item.id,
                  target,
                  method,
                  amount,
                  recipient,
                  executable_at: item.executable_at,
                };
              });
            }
          } catch {
            pendingActions = [];
          }

          try {
            stagedPolicy = await guardAccount.viewFunction({
              contractId: guardId,
              methodName: "get_staged_policy",
              args: { agent_account: effectiveAgentId },
            });
          } catch {
            stagedPolicy = null;
          }

          policy = policyRes;
          activeNear = near;
          break;
        }
      } catch (err: any) {
        lastError = err;
        markRpcFailed(nodeUrl);
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
    let isScopedKeyConfigured: boolean | null = null;
    let keyLookupSucceeded = false;

    // Check key cache to minimize redundant RPC bursts
    const cachedKey = keyCacheMap.get(effectiveAgentId);
    if (!hasCacheBuster && cachedKey && cachedKey.isScopedKeyConfigured !== null && now - cachedKey.timestamp < KEY_CACHE_TTL_MS) {
      agentPublicKey = cachedKey.agentPublicKey;
      gasAllowanceNear = cachedKey.gasAllowanceNear;
      isScopedKeyConfigured = cachedKey.isScopedKeyConfigured;
      keyLookupSucceeded = true;
    } else {
      // Failover loop for access key inspection
      for (const nodeUrl of rpcUrls) {
        try {
          const near = await connect({
            networkId: process.env.NEAR_NETWORK || "testnet",
            nodeUrl,
            keyStore: new keyStores.InMemoryKeyStore(),
          });

          const agentAccount = await near.account(effectiveAgentId);
          const accessKeys = await agentAccount.getAccessKeys();
          if (Array.isArray(accessKeys)) {
            keyLookupSucceeded = true;
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
              const perm = scopedKey.access_key?.permission as any;
              if (perm?.FunctionCall?.allowance) {
                gasAllowanceNear = utils.format.formatNearAmount(
                  perm.FunctionCall.allowance
                );
              }
            } else {
              agentPublicKey = null;
              isScopedKeyConfigured = false;
              gasAllowanceNear = null;
            }

            keyCacheMap.set(effectiveAgentId, {
              timestamp: Date.now(),
              agentPublicKey,
              gasAllowanceNear,
              isScopedKeyConfigured,
            });
            break;
          }
        } catch (err: any) {
          markRpcFailed(nodeUrl);
          console.warn(`RPC ${nodeUrl} error in getAccessKeys: ${err.message}. Retrying key lookup...`);
        }
      }
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

    if (keyLookupSucceeded) {
      const cacheTimestamp = Date.now();
      cacheMap.set(cacheKey, { state: statePayload, timestamp: cacheTimestamp });
      cacheMap.set(`${guardId}:${effectiveAgentId}:${ownerId}`, { state: statePayload, timestamp: cacheTimestamp });
    }

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
