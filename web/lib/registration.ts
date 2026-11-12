/**
 * Agent Registration and Preflight Validation Engine
 *
 * Provides real-time verification of agent account ownership and uniqueness,
 * pre-flight onchain checking to prevent WebAssembly transaction traps,
 * and user-friendly error parsing with 1-click auto-fixes.
 */

export interface ParsedRegistrationError {
  title: string;
  message: string;
  fixGuidance: string;
  quickFixLabel?: string;
  suggestedAccount?: string;
  targetElementId?: string;
  rawError?: string;
}

/**
 * Suggests the next available sub-account name using a numbered suffix.
 * For example:
 *   agent.sergeo-guard.testnet -> agent2.sergeo-guard.testnet
 *   agent2.sergeo-guard.testnet -> agent3.sergeo-guard.testnet
 *   agent.blckfme.testnet -> agent2.blckfme.testnet
 */
export function suggestNextAgentName(name: string, ownerAccount?: string): string {
  const trimmed = (name || "").trim().toLowerCase();
  if (!trimmed) {
    return ownerAccount ? `agent2.${ownerAccount}` : "agent2.sergeo-guard.testnet";
  }

  const dotIdx = trimmed.indexOf(".");
  if (dotIdx > 0) {
    const sub = trimmed.slice(0, dotIdx);
    const rest = trimmed.slice(dotIdx + 1);
    const match = sub.match(/^([a-z_-]+?)(\d*)$/);
    if (match) {
      const prefix = match[1];
      const currentNum = match[2] ? parseInt(match[2], 10) : 1;
      const nextNum = currentNum >= 1 ? currentNum + 1 : 2;
      return `${prefix}${nextNum}.${rest}`;
    }
    return `${sub}2.${rest}`;
  }

  if (ownerAccount) {
    return `${trimmed}2.${ownerAccount}`;
  }
  return `${trimmed}2`;
}

/**
 * Checks whether an agent account satisfies NEAR smart contract sub-account ownership rules.
 * Onchain policy contract invariant:
 *   agent_account.ends_with(".{owner}") || agent_account == owner
 */
export function isAgentSubaccountOwnerValid(agentAccount: string, ownerAccount: string): boolean {
  if (!ownerAccount || !ownerAccount.trim()) return true;
  const a = agentAccount.trim().toLowerCase();
  const o = ownerAccount.trim().toLowerCase();
  if (!a || !o) return false;
  return a.endsWith(`.${o}`) || a === o;
}

/**
 * Queries the NEAR policy contract onchain via RPC to verify if an agent policy already exists.
 * Returns true if an agent is already registered, false otherwise.
 */
export async function checkAgentRegisteredOnchain(
  guardContractId: string,
  agentAccount: string,
  customRpcUrl?: string
): Promise<boolean> {
  const agent = agentAccount.trim().toLowerCase();
  const guard = guardContractId.trim().toLowerCase();
  if (!agent || !guard) return false;

  const rpcUrl = customRpcUrl || process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "check-agent-policy",
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: guard,
          method_name: "get_policy",
          args_base64: Buffer.from(JSON.stringify({ agent_account: agent })).toString("base64"),
        },
      }),
    });

    const data = await res.json();
    if (data && data.result && Array.isArray(data.result.result)) {
      const parsed = JSON.parse(Buffer.from(data.result.result).toString("utf-8"));
      return parsed !== null && typeof parsed === "object";
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Parses raw NEAR RPC and transaction execution errors into plain, actionable advice.
 * Converts WebAssembly traps and duplicate registration panics into clear instructions with 1-click fixes.
 */
export function parseRegistrationError(
  rawError: any,
  agentAccount: string,
  ownerAccount?: string | null
): ParsedRegistrationError {
  let rawStr = "";
  if (typeof rawError === "string") {
    rawStr = rawError;
  } else if (rawError && typeof rawError === "object") {
    rawStr = rawError.message || JSON.stringify(rawError);
  }

  // 1. Ownership mismatch check against connected owner
  if (ownerAccount && !isAgentSubaccountOwnerValid(agentAccount, ownerAccount)) {
    const suggested = `agent.${ownerAccount}`;
    return {
      title: "Sub-Account Owner Mismatch",
      message: `Account "${agentAccount}" must be a sub-account of your connected wallet (${ownerAccount}) or match it directly.`,
      fixGuidance: `Change the sub-account name so it ends with .${ownerAccount}.`,
      quickFixLabel: `⚡ Set to ${suggested}`,
      suggestedAccount: suggested,
      targetElementId: "agent-subaccount-input",
      rawError: rawStr,
    };
  }

  // 2. Policy validation failure check
  // Assertions for zero cap, threshold exceeding cap, or invalid delay parameters
  if (
    rawStr.includes("daily_cap") ||
    rawStr.includes("greater than zero") ||
    rawStr.includes("cannot exceed") ||
    rawStr.includes("auto_pause_rejects") ||
    rawStr.includes("auto_pause_window") ||
    rawStr.includes("high_value_delay") ||
    rawStr.includes("policy_change_delay") ||
    rawStr.includes("max_drawdown_bps")
  ) {
    return {
      title: "Policy Validation Failed",
      message: `The policy submitted to ScopeGuard failed onchain validation: ${rawStr}`,
      fixGuidance: "Verify that daily spending cap is greater than zero and timelock threshold does not exceed the daily cap.",
      targetElementId: "daily-spending-cap-input",
      rawError: rawStr,
    };
  }

  // 3. WebAssembly trap or duplicate registration error onchain
  // Only label as "already registered" when the message contains "already registered" or the duplicate trap text
  if (
    rawStr.includes("already registered") ||
    rawStr.includes("WebAssembly trap") ||
    rawStr.includes("unreachable")
  ) {
    const nextName = suggestNextAgentName(agentAccount, ownerAccount || undefined);
    return {
      title: "Agent Sub-Account Already In Use",
      message: `The agent sub-account "${agentAccount}" is already registered on this Guard contract. Each agent requires a unique sub-account name.`,
      fixGuidance: `Select a new sub-account name (for example, ${nextName}) or click the 1-click fix below.`,
      quickFixLabel: `⚡ Switch to ${nextName} (1-Click Fix)`,
      suggestedAccount: nextName,
      targetElementId: "agent-subaccount-input",
      rawError: rawStr,
    };
  }

  // 3. Non-existent account or network error
  if (rawStr.includes("doesn't exist") || rawStr.includes("does not exist")) {
    const isGuard = rawStr.includes("scopeguard.testnet") || rawStr.includes("guard");
    return {
      title: isGuard ? "Contract Not Found on Selected Network" : "Account Does Not Exist",
      message: isGuard
        ? "The Guard contract scopeguard.testnet was not found on your wallet's current network. ScopeGuard operates on NEAR Testnet."
        : `Cannot complete registration because the target account does not exist on NEAR testnet.`,
      fixGuidance: isGuard
        ? "Switch your wallet network from Mainnet to NEAR Testnet and reconnect."
        : "Verify the account identifier or connect an active NEAR testnet wallet.",
      targetElementId: "agent-subaccount-input",
      rawError: rawStr,
    };
  }

  // 4. User cancelled in wallet modal
  if (
    rawStr.toLowerCase().includes("user rejected") ||
    rawStr.toLowerCase().includes("cancelled") ||
    rawStr.toLowerCase().includes("canceled")
  ) {
    return {
      title: "Transaction Cancelled",
      message: "The registration transaction was cancelled in your NEAR wallet.",
      fixGuidance: "Click Preview Scope & Generate Handoff again whenever you are ready to approve.",
      rawError: rawStr,
    };
  }

  // 5. Default friendly fallback
  return {
    title: "Registration Assistance",
    message: "The registration request could not be completed on NEAR testnet.",
    fixGuidance: "Please review your agent sub-account settings or retry the request.",
    targetElementId: "agent-subaccount-input",
    rawError: rawStr,
  };
}
