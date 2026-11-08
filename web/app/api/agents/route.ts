export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextResponse } from "next/server";
import { connect, keyStores } from "near-api-js";
import { getPolicyContractId } from "@/lib/config";

const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

interface AgentRow {
  account: string;
  revoked: boolean;
  paused: boolean;
  cap: string;
  spent: string;
  remaining: string;
  vaultBalance: string;
  actionsInWindow: number;
  maxActionsPer10Min: number | null;
  targets: Record<string, string[]> | null;
  recipients: string[] | null;
  stagedPolicy: any | null;
  pendingActions: any[];
}

function unwrap(value: any): any {
  // near-api-js returns borsh/json values where u128 may arrive as { U128: "123" }
  if (value && typeof value === "object" && "U128" in value) return String(value.U128);
  return value;
}

/**
 * Read-only fleet view. Everything here comes from onchain view calls; there is
 * no fixture data and nothing is invented. If a field cannot be read it is
 * returned as null rather than guessed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const requested = url.searchParams.get("owner");
  const owner =
    (requested && ACCOUNT_RE.test(requested) ? requested : null) ||
    process.env.SCOPEGUARD_OWNER_ACCOUNT ||
    process.env.OWNER_ACCOUNT_ID ||
    "sergeo-guard.testnet";

  let guardId: string;
  try {
    guardId = getPolicyContractId();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  const networkId = process.env.NEAR_NETWORK || "testnet";

  const rpcUrls = Array.from(
    new Set(
      [
        process.env.NEAR_TESTNET_RPC,
        "https://test.rpc.fastnear.com",


      ].filter(Boolean) as string[]
    )
  );

  const started = Date.now();
  try {
    let accounts: string[] | null = null;
    let viewAccount: any = null;
    let usedRpcUrl = rpcUrls[0] || "https://test.rpc.fastnear.com";
    let lastError: any = null;

    for (const rpcUrl of rpcUrls) {
      try {
        const near = await connect({
          networkId,
          nodeUrl: rpcUrl,
          keyStore: new keyStores.InMemoryKeyStore(),
        });
        const account = await near.account(guardId);
        accounts = await account.viewFunction({
          contractId: guardId,
          methodName: "get_agents",
          args: { owner },
        });
        viewAccount = account;
        usedRpcUrl = rpcUrl;
        break;
      } catch (err: any) {
        lastError = err;
        console.warn(`RPC ${rpcUrl} error in /api/agents: ${err.message}. Retrying with alternate provider...`);
      }
    }

    if (!accounts || !viewAccount) {
      throw lastError || new Error("Failed to query get_agents across all RPC providers");
    }

    const view = (methodName: string, args: Record<string, unknown>) =>
      viewAccount.viewFunction({ contractId: guardId, methodName, args });

    const agents: AgentRow[] = await Promise.all(
      accounts.map(async (agent) => {
        const [budget, policy, stagedPolicy, pendingActions] = await Promise.all([
          view("get_budget", { agent_account: agent }).catch(() => null),
          view("get_policy", { agent_account: agent }).catch(() => null),
          view("get_staged_policy", { agent_account: agent }).catch(() => null),
          view("get_pending_actions", { agent_account: agent }).catch(() => []),
        ]);

        return {
          account: agent,
          revoked: Boolean(budget?.revoked),
          paused: Boolean(budget?.paused),
          cap: String(unwrap(budget?.cap) ?? "0"),
          spent: String(unwrap(budget?.spent) ?? "0"),
          remaining: String(unwrap(budget?.remaining) ?? "0"),
          vaultBalance: String(unwrap(budget?.vault_balance) ?? "0"),
          actionsInWindow: Number(budget?.actions_in_window ?? 0),
          maxActionsPer10Min: policy ? Number(policy.max_actions_per_10min) : null,
          targets: policy?.targets ?? null,
          recipients: policy?.recipients ?? null,
          stagedPolicy: stagedPolicy ?? null,
          pendingActions: Array.isArray(pendingActions) ? pendingActions : [],
        };
      })
    );

    const version = await view("get_version", {}).catch(() => null);

    const totals = agents.reduce(
      (acc, a) => {
        acc.cap += Number(a.cap) || 0;
        acc.spent += Number(a.spent) || 0;
        acc.vault += Number(a.vaultBalance) || 0;
        acc.pending += a.pendingActions.length;
        if (a.revoked) acc.revoked += 1;
        else if (a.paused) acc.paused += 1;
        else acc.active += 1;
        return acc;
      },
      { cap: 0, spent: 0, vault: 0, pending: 0, active: 0, paused: 0, revoked: 0 }
    );

    const rpcLatencyMs = Date.now() - started;

    return NextResponse.json({
      success: true,
      source: "onchain",
      owner,
      guardId,
      networkId,
      nodeUrl: usedRpcUrl,
      contractVersion: version,
      rpcLatencyMs,
      fetchedAt: new Date().toISOString(),
      agents,
      totals,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        source: "onchain",
        owner,
        guardId,
        error: err?.message || "Failed to read fleet state from chain",
      },
      { status: 502 }
    );
  }
}
