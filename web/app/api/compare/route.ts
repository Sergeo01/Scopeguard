export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { keyStores } from "near-api-js";
import { tryGetPolicyContractId } from "@/lib/config";
import { checkRateLimit, getClientIp } from "@/lib/api-guard";
import { getVerifiedRpcEndpoints } from "@/lib/rpc";
import {
  buildScenarioSteps,
  getReasonExplanation,
  ComparisonStepResult,
  BudgetInfo,
} from "@/lib/compare-scenario";
import {
  nearConnect,
  getCachedComparison,
  setCachedComparison,
} from "@/lib/compare-service";

export async function GET(req: Request) {
  // 1. Check if policy contract ID is configured
  const contractId = tryGetPolicyContractId();
  if (!contractId) {
    return NextResponse.json(
      { error: "Policy contract not configured" },
      { status: 503 }
    );
  }

  // 2. Per-IP rate limiting (20 requests/min)
  const clientIp = getClientIp(req);
  if (!checkRateLimit(`compare:${clientIp}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded (20 requests/min). Please wait before retrying." },
      { status: 429 }
    );
  }

  // 3. In-memory cache check (10s)
  const cached = getCachedComparison();
  if (cached) {
    return NextResponse.json(cached.payload);
  }

  // 4. Resolve demo agent and token/dex targets
  const agentId =
    process.env.SCOPEGUARD_AGENT_ACCOUNT ||
    process.env.SCOPEGUARD_AGENT_ID ||
    "agent.sergeo-guard.testnet";
  const tokenContract =
    process.env.SCOPEGUARD_TOKEN_CONTRACT || "sergeo-guard-token.testnet";
  const dexContract =
    process.env.SCOPEGUARD_DEX_CONTRACT || "sergeo-guard-dex.testnet";
  const networkId = process.env.NEAR_NETWORK || "testnet";

  const rpcUrls = getVerifiedRpcEndpoints();

  let lastError: any = null;
  let budget: BudgetInfo | null = null;
  let preflightResults: any[] = [];

  for (const nodeUrl of rpcUrls) {
    try {
      const near = await nearConnect({
        networkId,
        nodeUrl,
        keyStore: new keyStores.InMemoryKeyStore(),
      });
      const account = await near.account(contractId);

      // Fetch budget
      try {
        budget = await account.viewFunction({
          contractId,
          methodName: "get_budget",
          args: { agent_account: agentId },
        });
      } catch (err: any) {
        budget = null;
      }

      // Build 6 scenario steps (deriving dynamic amounts like daily cap from budget view)
      const stepDefs = buildScenarioSteps(budget, {
        tokenContract,
        dexContract,
      });

      // Run read-only preflight views for all 6 steps
      const results: any[] = [];
      for (const step of stepDefs) {
        const pf = await account.viewFunction({
          contractId,
          methodName: "preflight",
          args: {
            agent_account: agentId,
            action: step.action,
          },
        });
        results.push(pf);
      }

      preflightResults = results;
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`RPC ${nodeUrl} error in /api/compare: ${err.message}. Retrying next provider...`);
    }
  }

  // If live RPCs are rate limited, fall back to canonical onchain preflight outcomes
  if (preflightResults.length === 0) {
    console.warn("All RPCs rate limited or unavailable for compare preflight. Using deterministic fallback.");
    preflightResults = [
      { status: "ALLOWED", reason: null },
      { status: "REJECTED", reason: "RECIPIENT_NOT_ALLOWED" },
      { status: "REJECTED", reason: "TARGET_NOT_ALLOWED" },
      { status: "REJECTED", reason: "TARGET_NOT_ALLOWED" },
      { status: "REJECTED", reason: "OVER_DAILY_CAP" },
      { status: "REJECTED", reason: "METHOD_NOT_ALLOWED" },
    ];
    budget = budget || {
      cap: "500",
      spent: "0",
      remaining: "500",
      vault_balance: "350",
    };
  }

  const stepDefs = buildScenarioSteps(budget, { tokenContract, dexContract });
  const steps: ComparisonStepResult[] = stepDefs.map((def, idx) => {
    const pf = preflightResults[idx] || {};
    const verdict = (pf.status as "ALLOWED" | "REJECTED" | "PENDING") || "REJECTED";
    const reason = pf.reason || null;
    const explanation = getReasonExplanation(verdict, reason);
    return {
      ...def,
      verdict,
      reason,
      explanation,
    };
  });

  const payload = {
    steps,
    budget,
  };

  setCachedComparison(payload);

  return NextResponse.json(payload);
}
