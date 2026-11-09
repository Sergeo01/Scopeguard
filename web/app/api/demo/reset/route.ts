export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair } from "near-api-js";
import { guardSigningRequest } from "@/lib/api-guard";
import { recordActivity } from "@/lib/ledger";
import { getPolicyContractId } from "@/lib/config";
import { getVerifiedRpcEndpoints } from "@/lib/rpc";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const AGENT_ID =
  process.env.SCOPEGUARD_AGENT_ACCOUNT ||
  process.env.SCOPEGUARD_AGENT_ID ||
  "agent.sergeo-guard.testnet";
const NETWORK_ID = process.env.NEAR_NETWORK || "testnet";

/**
 * Resets the demo agent state on NEAR Testnet:
 * 1. Unpauses the agent if paused by owner or circuit breaker.
 * 2. Resets rolling spend and velocity windows to full capacity.
 * 3. Cancels any stale pending timelock actions.
 *
 * This provides reliable self-healing for testing
 * multiple attacks without needing manual command-line intervention.
 */
export async function POST(req: Request) {
  let fallbackGuard = "<policy_contract_id>";
  try {
    fallbackGuard = getPolicyContractId();
  } catch {}

  const fallbackCommand = [
    `near call ${fallbackGuard} unpause '{"agent_account":"${AGENT_ID}"}' --accountId ${OWNER_ID} --gas 30000000000000`,
    `near call ${fallbackGuard} reset_windows '{"agent_account":"${AGENT_ID}"}' --accountId ${OWNER_ID} --gas 30000000000000`,
  ].join(" ; ");

  const blocked = guardSigningRequest(req, fallbackCommand);
  if (blocked) return blocked;

  let GUARD_ID: string;
  try {
    GUARD_ID = getPolicyContractId();
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }

  try {
    const ownerPrivateKey =
      process.env.SCOPEGUARD_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY;

    if (!ownerPrivateKey) {
      return NextResponse.json(
        {
          success: false,
          requiresOwnerSignature: true,
          message:
            "Server signing is enabled but no owner key is configured. Run the command yourself.",
          command: fallbackCommand,
        },
        { status: 400 }
      );
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(NETWORK_ID, OWNER_ID, KeyPair.fromString(ownerPrivateKey as any));

    const rpcUrls = getVerifiedRpcEndpoints();

    let ownerAccount: any = null;
    let budget: any = null;
    let lastError: any = null;

    for (const nodeUrl of rpcUrls) {
      try {
        const near = await connect({ networkId: NETWORK_ID, nodeUrl, keyStore });
        const acct = await near.account(OWNER_ID);
        budget = await acct.viewFunction({
          contractId: GUARD_ID,
          methodName: "get_budget",
          args: { agent_account: AGENT_ID },
        });
        ownerAccount = acct;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`RPC ${nodeUrl} error in /api/demo/reset: ${err.message}. Retrying with alternate provider...`);
      }
    }

    if (!ownerAccount) {
      throw lastError || new Error("Failed to connect to NEAR Testnet RPC endpoints");
    }

    let unpauseTxHash: string | null = null;
    let resetTxHash: string | null = null;

    // Check if anything needs resetting
    const isPaused = Boolean(budget?.paused);
    const hasSpentToken = Boolean(budget?.spent && BigInt(budget.spent) > BigInt(0));
    const hasSpentNear = Boolean(budget?.near_spent && BigInt(budget.near_spent) > BigInt(0));
    const hasStrikes = Boolean(budget?.auto_pause_strikes && Number(budget.auto_pause_strikes) > 0);
    const hasVelocity = Boolean(budget?.velocity_count && Number(budget.velocity_count) > 0);

    let pendingActions: any[] = [];
    try {
      const actions = await ownerAccount.viewFunction({
        contractId: GUARD_ID,
        methodName: "get_pending_actions",
        args: { agent_account: AGENT_ID },
      });
      if (Array.isArray(actions)) {
        pendingActions = actions;
      }
    } catch {
      // Non-blocking view query
    }

    const needsReset = isPaused || hasSpentToken || hasSpentNear || hasStrikes || hasVelocity || pendingActions.length > 0;

    if (!needsReset) {
      return NextResponse.json({
        success: true,
        message: `Agent ${AGENT_ID} is already in a clean, active state with full budget. No reset needed.`,
        resetNeeded: false,
        unpaused: false,
        budget,
      });
    }

    // 2. Unpause if paused
    if (isPaused) {
      const unpauseRes = await ownerAccount.functionCall({
        contractId: GUARD_ID,
        methodName: "unpause",
        args: { agent_account: AGENT_ID },
        gas: BigInt("30000000000000"),
      });
      unpauseTxHash = unpauseRes.transaction.hash;
    }

    // 3. Reset rolling windows if spend, strikes, or velocity counters are populated
    if (hasSpentToken || hasSpentNear || hasStrikes || hasVelocity) {
      try {
        const resetRes = await ownerAccount.functionCall({
          contractId: GUARD_ID,
          methodName: "reset_windows",
          args: { agent_account: AGENT_ID },
          gas: BigInt("30000000000000"),
        });
        resetTxHash = resetRes.transaction.hash;
      } catch (resetErr: any) {
        console.warn("reset_windows notice:", resetErr.message);
      }
    }

    // 4. Cancel any lingering pending timelock actions
    if (pendingActions.length > 0) {
      for (const action of pendingActions) {
        try {
          await ownerAccount.functionCall({
            contractId: GUARD_ID,
            methodName: "cancel_pending",
            args: { agent_account: AGENT_ID, id: action.id },
            gas: BigInt("30000000000000"),
          });
        } catch {
          // Non-blocking
        }
      }
    }

    // 5. Query updated budget
    const finalBudget = await ownerAccount.viewFunction({
      contractId: GUARD_ID,
      methodName: "get_budget",
      args: { agent_account: AGENT_ID },
    });

    recordActivity({
      id: `act-${Date.now()}-reset`,
      txHash: resetTxHash || unpauseTxHash || "onchain-reset",
      type: "RESET",
      timestamp: Date.now(),
      agent: AGENT_ID,
      target: GUARD_ID,
      method: isPaused ? "unpause" : "reset_windows",
      reason: `Agent reset: unpaused=${isPaused}, windows_reset=${Boolean(resetTxHash)}, pending_cleared=${pendingActions.length}`,
    });

    return NextResponse.json({
      success: true,
      message: `Demo agent ${AGENT_ID} is now active and reset on NEAR Testnet.`,
      resetNeeded: true,
      unpaused: isPaused,
      unpauseTxHash,
      resetTxHash,
      budget: finalBudget,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to reset demo agent onchain",
      },
      { status: 500 }
    );
  }
}
