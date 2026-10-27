import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { connect, keyStores, KeyPair } from "near-api-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, target, method, args, amount, recipient } = body;

    const rootPath = fs.existsSync(path.join(process.cwd(), "demo-agent"))
      ? process.cwd()
      : path.join(process.cwd(), "..");
    const credPath = path.join(rootPath, "demo-agent", "credentials", "agent.json");
    if (!fs.existsSync(credPath)) {
      return NextResponse.json({
        success: false,
        error: "Agent credentials not found on server",
      }, { status: 500 });
    }

    const cred = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    const keyStore = new keyStores.InMemoryKeyStore();
    await keyStore.setKey(cred.networkId || "testnet", cred.agentAccountId, KeyPair.fromString(cred.privateKey));

    const near = await connect({
      networkId: cred.networkId || "testnet",
      nodeUrl: cred.nodeUrl || "https://test.rpc.fastnear.com",
      keyStore,
    });

    const agentAccount = await near.account(cred.agentAccountId);

    const callResult = await agentAccount.functionCall({
      contractId: cred.policyContractId,
      methodName: "execute",
      args: {
        target: target || "sergeo-guard-dex.testnet",
        method: method || "swap",
        args: typeof args === "string" ? args : JSON.stringify(args || {}),
        amount: amount || "0",
        recipient: recipient || null,
      },
      gas: BigInt("50000000000000"), // 50 TGas
    });

    const txHash = callResult.transaction.hash;
    const parsedOutcome = JSON.parse(
      Buffer.from((callResult.status as any).SuccessValue, "base64").toString()
    );

    return NextResponse.json({
      success: true,
      txHash,
      explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
      outcome: parsedOutcome,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
