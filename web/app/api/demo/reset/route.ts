export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair } from "near-api-js";
import { guardSigningRequest } from "@/lib/api-guard";
import { recordActivity } from "@/lib/ledger";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const GUARD_ID = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
const AGENT_ID =
  process.env.SCOPEGUARD_AGENT_ACCOUNT ||
  process.env.SCOPEGUARD_AGENT_ID ||
  "agent.sergeo-guard.testnet";
const NETWORK_ID = process.env.NEAR_NETWORK || "testnet";
const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

/**
 * Resets the demo agent state on NEAR Testnet:
 * 1. Unpauses the agent if paused by owner or circuit breaker.
 * 2. Resets rolling spend and velocity windows to full capacity.
 * 3. Cancels any stale pending timelock actions.
 *
 * This provides reliable self-healing for evaluators and judges testing
 * multiple attacks without needing manual command-line intervention.
 */
export async function POST(req: Request) {
  const fallbackCommand = [
    `near call ${GUARD_ID} unpause '{"agent_account":"${AGENT_ID}"}' --accountId ${OWNER_ID} --gas 30000000000000`,
    `near call ${GUARD_ID} reset_windows '{"agent_account":"${AGENT_ID}"}' --accountId ${OWNER_ID} --gas 30000000000000`,
  ].join(" ; ");

  const blocked = guardSigningRequest(req, fallbackCommand);
  if (blocked) return blocked;

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

    const rpcUrls = Array.from(
      new Set(
        [
          process.env.NEAR_TESTNET_RPC,
          RPC_URL,
          "https://test.rpc.fastnear.com",
          "https://rpc.testnet.near.org",
        ].filter(Boolean) as string[]
      )
    );

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

    // 2. Unpause if paused
    if (budget?.paused) {
      const unpauseRes = await ownerAccount.functionCall({
        contractId: GUARD_ID,
        methodName: "unpause",
        args: { agent_account: AGENT_ID },
        gas: BigInt("30000000000000"),
      });
      unpauseTxHash = unpauseRes.transaction.hash;
    }

    // 3. Reset rolling windows for fresh evaluation
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

    // 4. Cancel any lingering pending timelock actions
    try {
      const pendingActions = await ownerAccount.viewFunction({
        contractId: GUARD_ID,
        methodName: "get_pending_actions",
        args: { agent_account: AGENT_ID },
      });
      if (Array.isArray(pendingActions)) {
        for (const action of pendingActions) {
          await ownerAccount.functionCall({
            contractId: GUARD_ID,
            methodName: "cancel_pending",
            args: { agent_account: AGENT_ID, id: action.id },
            gas: BigInt("30000000000000"),
          });
        }
      }
    } catch {
      // Non-blocking
    }

    // 5. Query updated budget
    const finalBudget = await ownerAccount.viewFunction({
      contractId: GUARD_ID,
      methodName: "get_budget",
      args: { agent_account: AGENT_ID },
    });

    if (unpauseTxHash) {
      recordActivity({
        id: `act-${Date.now()}-reset`,
        txHash: unpauseTxHash,
        type: "UNPAUSE",
        timestamp: Date.now(),
        agent: AGENT_ID,
        target: GUARD_ID,
        method: "unpause",
        reason: "Demo agent unpaused and velocity windows reset for evaluation replay",
      });
    }

    return NextResponse.json({
      success: true,
      message: `Demo agent ${AGENT_ID} is now active and reset on NEAR Testnet.`,
      unpaused: Boolean(budget?.paused),
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
