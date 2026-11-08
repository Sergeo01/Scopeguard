import { NextRequest, NextResponse } from "next/server";
import { getPolicyContractId } from "@/lib/config";

const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";
const FALLBACK_RPC = "https://test.rpc.fastnear.com";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get("hash");
  const accountId = searchParams.get("account") || "agent.sergeo-guard.testnet";
  const ownerId = searchParams.get("owner") || "sergeo-guard.testnet";

  if (!hash) {
    return NextResponse.json({ success: false, error: "Missing hash parameter" }, { status: 400 });
  }

  // 1. Try primary RPC, then fallback, testing accountId then ownerId
  let rpcResult: any = null;
  const urls = [RPC_URL, FALLBACK_RPC];
  const candidateSigners = [accountId];
  if (ownerId && ownerId !== accountId) {
    candidateSigners.push(ownerId);
  }

  for (const signer of candidateSigners) {
    if (rpcResult) break;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "scopeguard-tx-query",
            method: "tx",
            params: {
              tx_hash: hash,
              sender_account_id: signer,
              wait_until: "NONE",
            },
          }),
          signal: AbortSignal.timeout(4000),
          cache: "no-store",
        });

        const data = await res.json();
        if (data && data.result) {
          rpcResult = data.result;
          break;
        }
      } catch {
        // Continue to fallback
      }
    }
  }

  if (rpcResult) {
    // Collect all logs from transaction outcomes and receipts
    const allLogs: string[] = [];
    if (rpcResult.transaction_outcome?.outcome?.logs) {
      allLogs.push(...rpcResult.transaction_outcome.outcome.logs);
    }
    if (Array.isArray(rpcResult.receipts_outcome)) {
      for (const ro of rpcResult.receipts_outcome) {
        if (ro.outcome?.logs) {
          allLogs.push(...ro.outcome.logs);
        }
      }
    }

    // Parse EVENT_JSON if present
    let eventData: any = null;
    for (const log of allLogs) {
      if (log.startsWith("EVENT_JSON:")) {
        try {
          eventData = JSON.parse(log.slice("EVENT_JSON:".length));
        } catch {
          // ignore parse error
        }
      }
    }

    const gasBurnt =
      (rpcResult.transaction_outcome?.outcome?.gas_burnt || 0) +
      (Array.isArray(rpcResult.receipts_outcome)
        ? rpcResult.receipts_outcome.reduce(
            (acc: number, ro: any) => acc + (ro.outcome?.gas_burnt || 0),
            0
          )
        : 0);

    const tokensBurnt =
      rpcResult.transaction_outcome?.outcome?.tokens_burnt || "0";

    const statusObj = rpcResult.status || {};
    const isSuccess = Boolean(
      statusObj.SuccessValue !== undefined || statusObj.SuccessReceiptId !== undefined
    );
    const isFailure = Boolean(statusObj.Failure !== undefined);

    return NextResponse.json({
      success: true,
      found: true,
      hash,
      blockHash: rpcResult.transaction_outcome?.block_hash,
      signerId: rpcResult.transaction?.signer_id || accountId,
      receiverId: rpcResult.transaction?.receiver_id || getPolicyContractId(),
      status: isSuccess ? "SUCCESS" : isFailure ? "FAILED" : "UNKNOWN",
      gasBurnt: `${(gasBurnt / 1e12).toFixed(3)} Tgas`,
      tokensBurnt,
      logs: allLogs,
      event: eventData,
      raw: rpcResult,
    });
  }

  // The RPC could not index this hash yet (or it does not exist). Return an
  // honest not-found response: never invent logs, gas or a success verdict.
  return NextResponse.json({
    success: true,
    found: false,
    hash,
    signerId: accountId,
    status: "UNVERIFIED",
    logs: [],
    note: "Transaction not indexed by this RPC yet (or the hash is unknown). Open NearBlocks or retry after a few blocks. No claim is made about the outcome.",
  });
}
