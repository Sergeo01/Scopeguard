export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair } from "near-api-js";
import { guardSigningRequest } from "@/lib/api-guard";

const DEFAULT_GUARD = "guard2.sergeo-guard.testnet";
const DEFAULT_OWNER = "sergeo-guard.testnet";

/**
 * Owner-authority endpoint.
 *
 * Registers an agent policy onchain, which requires the owner's full-access
 * key. That is a privileged operation, so this route is:
 *   1. same-origin only,
 *   2. disabled unless SCOPEGUARD_ALLOW_SERVER_SIGNING=true,
 *   3. only ever able to read the key from the environment.
 *
 * It never reads ~/.near-credentials. A server that can read the operator's
 * local credential store is exactly the custody problem this project exists to
 * remove.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const agentAccountId = String(body?.agentAccountId || "").trim();
    const policy = body?.policy;
    const publicKey = body?.publicKey || null;

    const guardId = process.env.SCOPEGUARD_POLICY_CONTRACT || DEFAULT_GUARD;
    const ownerId = process.env.OWNER_ACCOUNT_ID || DEFAULT_OWNER;
    const networkId = process.env.NEAR_NETWORK || "testnet";
    const nodeUrl = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

    if (!agentAccountId || !policy) {
      return NextResponse.json(
        { success: false, error: "agentAccountId and policy are required." },
        { status: 400 }
      );
    }

    const command = `near call ${guardId} register_agent '${JSON.stringify({
      agent_account: agentAccountId,
      policy,
    })}' --accountId ${ownerId} --gas 100000000000000`;

    const blocked = guardSigningRequest(req, command);
    if (blocked) return blocked;

    const ownerPrivateKey =
      process.env.SCOPEGUARD_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY;

    if (!ownerPrivateKey) {
      return NextResponse.json(
        {
          success: false,
          requiresOwnerSignature: true,
          message:
            "Server signing is enabled but no owner key is configured. Set OWNER_PRIVATE_KEY or run the command yourself.",
          command,
        },
        { status: 400 }
      );
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(networkId, ownerId, KeyPair.fromString(ownerPrivateKey as any));

    const near = await connect({ networkId, nodeUrl, keyStore });
    const ownerAccount = await near.account(ownerId);

    const callResult = await ownerAccount.functionCall({
      contractId: guardId,
      methodName: "register_agent",
      args: { agent_account: agentAccountId, policy },
      gas: BigInt("100000000000000"), // 100 TGas
    });

    const txHash = callResult.transaction.hash;

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      agentAccountId,
      guardId,
      policy,
      publicKey,
      registeredAt: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Failed to broadcast registration transaction",
      },
      { status: 500 }
    );
  }
}
