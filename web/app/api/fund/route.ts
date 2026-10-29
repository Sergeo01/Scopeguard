export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { connect, keyStores, KeyPair, utils } from "near-api-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { recordActivity } from "@/lib/ledger";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const GUARD_ID = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
const TOKEN_ID = process.env.SCOPEGUARD_TOKEN_ID || "sergeo-guard-token.testnet";
const NETWORK_ID = process.env.NEAR_NETWORK || "testnet";
const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org";

function loadOwnerKey(): KeyPair | null {
  if (process.env.OWNER_PRIVATE_KEY) {
    return KeyPair.fromString(process.env.OWNER_PRIVATE_KEY as any);
  }
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  if (fs.existsSync(credPath)) {
    const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    return KeyPair.fromString((data.private_key || data.secret_key) as any);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const agentId = body.agentId || process.env.SCOPEGUARD_AGENT_ACCOUNT || "trader.sergeo-guard.testnet";
    const amount = String(body.amount || "100");

    const ownerKey = loadOwnerKey();
    if (!ownerKey) {
      return NextResponse.json({
        success: false,
        error: "Owner credentials not configured on server. Use CLI commands to fund manually.",
      }, { status: 400 });
    }

    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKey);

    const near = await connect({
      networkId: NETWORK_ID,
      nodeUrl: RPC_URL,
      keyStore,
    });

    const ownerAccount = await near.account(OWNER_ID);

    // 1. Ensure storage is registered for Guard on token contract
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

    // 2. Mint test tokens to owner from faucet
    try {
      await ownerAccount.functionCall({
        contractId: TOKEN_ID,
        methodName: "mint_faucet",
        args: { amount },
        gas: BigInt("30000000000000"),
      });
    } catch {
      // Faucet call note
    }

    // 3. Deposit tokens into Guard vault for agent
    const depositTx = await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "ft_transfer_call",
      args: {
        receiver_id: GUARD_ID,
        amount,
        msg: agentId,
      },
      attachedDeposit: BigInt(1),
      gas: BigInt("60000000000000"),
    });

    const txHash = depositTx.transaction.hash;

    // 4. Query updated budget
    let newVaultBalance = amount;
    try {
      const budget = await ownerAccount.viewFunction({
        contractId: GUARD_ID,
        methodName: "get_budget",
        args: { agent_account: agentId },
      });
      if (budget && budget.vault_balance) {
        newVaultBalance = budget.vault_balance;
      }
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
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
