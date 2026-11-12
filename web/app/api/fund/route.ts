export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair, utils } from "near-api-js";
import { recordActivity } from "@/lib/ledger";
import { guardSigningRequest } from "@/lib/api-guard";
import { getPolicyContractId } from "@/lib/config";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const TOKEN_ID =
  process.env.SCOPEGUARD_TOKEN_CONTRACT || process.env.SCOPEGUARD_TOKEN_ID || "sergeo-guard-token.testnet";
const NETWORK_ID = process.env.NEAR_NETWORK || "testnet";
const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

/**
 * Owner-authority endpoint: mints test tokens and deposits them into an agent
 * vault. It signs with the owner's full-access key, and it also calls the
 * token's `mint_faucet`, so it is gated exactly like /api/register:
 * same-origin only, opt-in via SCOPEGUARD_ALLOW_SERVER_SIGNING, env-only key.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const agentId = String(body?.agentId || process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent2.sergeo-guard.testnet");
  const amount = String(body?.amount || "100");

  let fallbackGuard = "<policy_contract_id>";
  try {
    fallbackGuard = getPolicyContractId();
  } catch {}

  const command = [
    `near call ${TOKEN_ID} mint_faucet '{"amount":"${amount}"}' --accountId ${OWNER_ID} --gas 30000000000000`,
    `near call ${TOKEN_ID} ft_transfer_call '{"receiver_id":"${fallbackGuard}","amount":"${amount}","msg":"${agentId}"}' --accountId ${OWNER_ID} --depositYocto 1 --gas 60000000000000`,
  ].join(" && ");

  const blocked = guardSigningRequest(req, command);
  if (blocked) return blocked;

  const GUARD_ID = getPolicyContractId();

  try {
    const ownerPrivateKey =
      process.env.SCOPEGUARD_OWNER_PRIVATE_KEY || process.env.OWNER_PRIVATE_KEY;

    if (!ownerPrivateKey) {
      return NextResponse.json(
        {
          success: false,
          requiresOwnerSignature: true,
          message:
            "Server signing is enabled but no owner key is configured. Set OWNER_PRIVATE_KEY or run the commands yourself.",
          command,
        },
        { status: 400 }
      );
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(NETWORK_ID, OWNER_ID, KeyPair.fromString(ownerPrivateKey as any));

    const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
    const ownerAccount = await near.account(OWNER_ID);

    // 1. Ensure storage is registered for Guard on the token contract
    try {
      await ownerAccount.functionCall({
        contractId: TOKEN_ID,
        methodName: "storage_deposit",
        args: { account_id: GUARD_ID },
        attachedDeposit: BigInt(utils.format.parseNearAmount("0.00125") || "1250000000000000000000"),
        gas: BigInt("30000000000000"),
      });
    } catch {
      // Storage already paid
    }

    // 2. Mint test tokens to owner from the faucet
    try {
      await ownerAccount.functionCall({
        contractId: TOKEN_ID,
        methodName: "mint_faucet",
        args: { amount },
        gas: BigInt("30000000000000"),
      });
    } catch {
      // Faucet is advisory; the deposit below is the operation that matters
    }

    // 3. Deposit tokens into the Guard vault for the agent
    const depositTx = await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "ft_transfer_call",
      args: { receiver_id: GUARD_ID, amount, msg: agentId },
      attachedDeposit: BigInt(1),
      gas: BigInt("60000000000000"),
    });

    const txHash = depositTx.transaction.hash;

    // 4. Query the updated budget
    let newVaultBalance = amount;
    try {
      const budget = await ownerAccount.viewFunction({
        contractId: GUARD_ID,
        methodName: "get_budget",
        args: { agent_account: agentId },
      });
      if (budget && budget.vault_balance) newVaultBalance = budget.vault_balance;
    } catch {
      // Keep optimistic
    }

    recordActivity({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      txHash,
      type: "ALLOW",
      timestamp: Date.now(),
      agent: agentId,
      target: TOKEN_ID,
      method: "ft_transfer_call",
      amount,
      reason: `Funded agent vault with ${amount} mUSD via testnet token faucet`,
    });

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      amount,
      agentId,
      vaultBalance: newVaultBalance,
      message: `Successfully funded ${agentId} vault with ${amount} mUSD!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
