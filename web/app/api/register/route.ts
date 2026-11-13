export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair, transactions, utils } from "near-api-js";
import { guardSigningRequest } from "@/lib/api-guard";
import { getPolicyContractId } from "@/lib/config";
import { suggestNextAgentName, parseRegistrationError } from "@/lib/registration";

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
  let agentAccountId = "";
  let ownerId = DEFAULT_OWNER;
  try {
    const body = await req.json().catch(() => ({}));
    agentAccountId = String(body?.agentAccountId || "").trim();
    const policy = body?.policy;
    const publicKey = body?.publicKey || null;

    if (!agentAccountId || !policy) {
      return NextResponse.json(
        { success: false, error: "agentAccountId and policy are required." },
        { status: 400 }
      );
    }

    let guardId = "<policy_contract_id>";
    try {
      guardId = getPolicyContractId();
    } catch {}

    ownerId = process.env.OWNER_ACCOUNT_ID || DEFAULT_OWNER;
    const networkId = process.env.NEAR_NETWORK || "testnet";
    const nodeUrl = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

    // Validate subaccount ownership invariant before taking onchain actions
    if (!agentAccountId.endsWith(`.${ownerId}`) && agentAccountId !== ownerId) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent sub-account "${agentAccountId}" must be a sub-account of owner "${ownerId}" (e.g. agent.${ownerId}).`,
          code: "SUBACCOUNT_OWNER_MISMATCH",
        },
        { status: 400 }
      );
    }

    const command = `near call ${guardId} register_agent '${JSON.stringify({
      agent_account: agentAccountId,
      policy,
    })}' --accountId ${ownerId} --gas 100000000000000`;

    const blocked = guardSigningRequest(req, command);
    if (blocked) return blocked;

    const effectiveGuardId = getPolicyContractId();
    guardId = effectiveGuardId;

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

    const ownerKeyPair = KeyPair.fromString(ownerPrivateKey as any);
    const ownerPublicKey = ownerKeyPair.getPublicKey();

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(networkId, ownerId, ownerKeyPair);

    const near = await connect({ networkId, nodeUrl, keyStore });
    const ownerAccount = await near.account(ownerId);

    // If a public key was provided and the agent account is a sub-account of the owner,
    // ensure the sub-account exists on NEAR consensus with the function-call access key attached.
    let subAccountCreated = false;
    if (publicKey && agentAccountId.endsWith(`.${ownerId}`)) {
      let accountExists = false;
      try {
        await near.connection.provider.query({
          request_type: "view_account",
          finality: "final",
          account_id: agentAccountId,
        });
        accountExists = true;
      } catch {
        accountExists = false;
      }

      if (!accountExists) {
        // Account does not exist yet: create subaccount with:
        // 1. Storage deposit (0.1 NEAR)
        // 2. Owner full-access recovery key (stored securely in owner's wallet)
        // 3. Agent function-call access key scoped strictly to Guard execute()
        try {
          const createActions = [
            transactions.createAccount(),
            transactions.transfer(BigInt("250000000000000000000000")), // 0.25 NEAR for storage deposit and keys
            transactions.addKey(ownerPublicKey, transactions.fullAccessKey()), // Owner recovery key
            transactions.addKey(
              utils.PublicKey.from(publicKey),
              transactions.functionCallAccessKey(
                guardId,
                ["execute"],
                BigInt("250000000000000000000000") // 0.25 NEAR allowance for gas
              )
            ),
          ];
          await ownerAccount.signAndSendTransaction({
            receiverId: agentAccountId,
            actions: createActions,
          });
          subAccountCreated = true;
        } catch (err: any) {
          const parsed = parseRegistrationError(err, agentAccountId, ownerId);
          return NextResponse.json(
            {
              success: false,
              error: parsed.message || `Failed to provision subaccount ${agentAccountId} on NEAR consensus: ${err.message}`,
              parsedError: parsed,
            },
            { status: 500 }
          );
        }
      } else {
        // Account already exists: verify if passkey is already attached
        try {
          await keyStore.setKey(networkId, agentAccountId, ownerKeyPair);
          const keyList = await near.connection.provider.query<any>({
            request_type: "view_access_key_list",
            finality: "final",
            account_id: agentAccountId,
          });
          const hasKey = keyList.keys.some((k: any) => k.public_key === publicKey);
          if (!hasKey) {
            const subAccount = await near.account(agentAccountId);
            await subAccount.addKey(
              publicKey,
              guardId,
              ["execute"],
              BigInt("250000000000000000000000")
            );
          }
        } catch (kErr: any) {
          console.warn("Could not check/attach key to existing subaccount:", kErr.message);
        }
      }
    }

    // Preflight onchain check: verify agent is not already registered on this Guard
    try {
      const policyRes = await near.connection.provider.query<any>({
        request_type: "call_function",
        finality: "final",
        account_id: guardId,
        method_name: "get_policy",
        args_base64: Buffer.from(JSON.stringify({ agent_account: agentAccountId })).toString("base64"),
      });
      if (policyRes && policyRes.result && Array.isArray(policyRes.result)) {
        const existing = JSON.parse(Buffer.from(policyRes.result).toString("utf-8"));
        if (existing !== null && typeof existing === "object") {
          const nextAccount = suggestNextAgentName(agentAccountId, ownerId);
          return NextResponse.json(
            {
              success: false,
              error: `Agent sub-account "${agentAccountId}" is already registered on Guard contract ${guardId}. Please select a unique sub-account name (such as ${nextAccount}).`,
              code: "AGENT_ALREADY_REGISTERED",
              suggestedAccount: nextAccount,
            },
            { status: 400 }
          );
        }
      }
    } catch {
      // Non-blocking if view query fails
    }

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
    const parsed = parseRegistrationError(err, agentAccountId, ownerId);
    return NextResponse.json(
      {
        success: false,
        error: parsed.message || err.message || "Failed to broadcast registration transaction",
        parsedError: parsed,
      },
      { status: 500 }
    );
  }
}
