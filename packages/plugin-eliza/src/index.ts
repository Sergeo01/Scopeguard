import * as fs from "fs";
import * as path from "path";
import {
  ScopeGuardAgentClient,
  ScopeGuardCredential,
  ActParams,
  GuardAction,
  Outcome,
  PreflightResult,
  BudgetView,
  resolveContractAlias,
  formatPendingEscalationMessage,
  getEscalationGuidance,
} from "@scopeguard/sdk";

// ---------------------------------------------------------------------------
// ElizaOS Core Interface Definitions (Compatible with @elizaos/core)
// ---------------------------------------------------------------------------

export interface Memory {
  id?: string;
  userId?: string;
  agentId?: string;
  createdAt?: number;
  content: {
    text: string;
    action?: string;
    source?: string;
    url?: string;
    inReplyTo?: string;
    attachments?: any[];
    [key: string]: any;
  };
  embedding?: number[];
  roomId?: string;
  unique?: boolean;
}

export interface State {
  bio?: string;
  lore?: string;
  messageDirections?: string;
  postDirections?: string;
  roomId?: string;
  actors?: string;
  recentMessages?: string;
  recentMessagesData?: Memory[];
  actionNames?: string;
  actions?: string;
  providers?: string;
  [key: string]: any;
}

export interface IAgentRuntime {
  agentId: string;
  serverUrl?: string;
  getSetting(key: string): string | undefined;
  [key: string]: any;
}

export type HandlerCallback = (response: {
  text: string;
  action?: string;
  content?: Record<string, any>;
}) => Promise<any> | any;

export interface ActionExample {
  user: string;
  content: {
    text: string;
    action?: string;
    [key: string]: any;
  };
}

export interface Action {
  name: string;
  similes: string[];
  description: string;
  validate: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<boolean>;
  handler: (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: any,
    callback?: HandlerCallback
  ) => Promise<unknown>;
  examples: ActionExample[][];
}

export interface Provider {
  name?: string;
  get: (runtime: IAgentRuntime, message: Memory, state?: State) => Promise<string | null>;
}

export interface Plugin {
  name: string;
  description: string;
  actions: Action[];
  providers: Provider[];
  evaluators?: any[];
  services?: any[];
}

// ---------------------------------------------------------------------------
// ScopeGuard Credential & Client Resolution
// ---------------------------------------------------------------------------

let cachedContext: { client: ScopeGuardAgentClient; cred: ScopeGuardCredential } | null = null;

export function resolveScopeGuardCredential(runtime?: IAgentRuntime): ScopeGuardCredential {
  const envPath =
    runtime?.getSetting("SCOPEGUARD_CREDENTIAL_PATH") ||
    process.env.SCOPEGUARD_CREDENTIAL_PATH;

  const envJson =
    runtime?.getSetting("SCOPEGUARD_CREDENTIAL_JSON") ||
    process.env.SCOPEGUARD_CREDENTIAL_JSON;

  if (envJson) {
    try {
      return JSON.parse(envJson) as ScopeGuardCredential;
    } catch (e: any) {
      throw new Error(`Invalid SCOPEGUARD_CREDENTIAL_JSON: ${e.message}`);
    }
  }

  const candidatePaths = [
    envPath,
    path.join(process.cwd(), "agent.json"),
    path.join(process.cwd(), "credentials", "agent.json"),
    path.join(process.cwd(), "demo-agent", "credentials", "agent.json"),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw) as ScopeGuardCredential;
    }
  }

  throw new Error(
    "ScopeGuard credential not found. Set SCOPEGUARD_CREDENTIAL_PATH or place agent.json in the working directory."
  );
}

export function getScopeGuardContext(runtime?: IAgentRuntime): {
  client: ScopeGuardAgentClient;
  cred: ScopeGuardCredential;
} {
  if (cachedContext) {
    return cachedContext;
  }
  const cred = resolveScopeGuardCredential(runtime);
  const client = new ScopeGuardAgentClient(cred);
  cachedContext = { client, cred };
  return cachedContext;
}

export function getScopeGuardClient(runtime?: IAgentRuntime): ScopeGuardAgentClient {
  return getScopeGuardContext(runtime).client;
}

export function resetScopeGuardClientCache(): void {
  cachedContext = null;
}

// ---------------------------------------------------------------------------
// ScopeGuard Provider: Context Injection for LLM Prompts
// ---------------------------------------------------------------------------

export const scopeGuardProvider: Provider = {
  name: "SCOPEGUARD_POLICY_PROVIDER",
  get: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<string | null> => {
    try {
      const { client, cred } = getScopeGuardContext(runtime);
      const budget = await client.budget();
      if (!budget) {
        return null;
      }

      const agentId = cred.agentAccountId;
      const guardId = cred.policyContractId;
      const remainingNear = (BigInt(budget.near_vault_balance || "0") / BigInt(1e24)).toString();

      return [
        "### ScopeGuard Onchain Policy Context",
        `- Agent Account: ${agentId}`,
        `- Policy Contract: ${guardId}`,
        `- Operating Status: ${budget.paused ? "PAUSED (Circuit Breaker Tripped)" : "ACTIVE"}`,
        `- Revoked: ${budget.revoked ? "YES (All Permissions Wiped)" : "NO"}`,
        `- Daily Cap: ${budget.cap} tokens (Spent Today: ${budget.spent}, Remaining: ${budget.remaining})`,
        `- Actions In 10m Window: ${budget.actions_in_window}`,
        `- Vault Balances: ${budget.vault_balance} tokens | ${remainingNear} NEAR`,
        budget.max_drawdown_bps ? `- Net Drawdown Protection: ${budget.max_drawdown_bps / 100}% max floor` : null,
        "",
        "CRITICAL POLICY RULES FOR THIS AGENT:",
        "1. Every action moves through the ScopeGuard passkey on NEAR.",
        "2. Do not attempt unapproved transfers or unallowlisted targets.",
        "3. Actions exceeding high-value thresholds are quarantined into review for owner approval.",
        "4. If an action is declined, explain the refusal code to the user honestly instead of hallucinating success.",
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      return null;
    }
  },
};

// ---------------------------------------------------------------------------
// ScopeGuard Action: EXECUTE_ONCHAIN_ACTION
// ---------------------------------------------------------------------------

export const scopeGuardExecuteAction: Action = {
  name: "EXECUTE_ONCHAIN_ACTION",
  similes: [
    "CALL_CONTRACT",
    "TRANSFER_FUNDS",
    "SWAP_TOKENS",
    "NEAR_TRANSFER",
    "EXECUTE_TRANSACTION",
  ],
  description:
    "Executes an onchain action strictly scoped through the ScopeGuard passkey on NEAR Protocol. Verifies spending limits, allowlists, and timelocks.",
  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    try {
      resolveScopeGuardCredential(runtime);
      return true;
    } catch {
      return false;
    }
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<Outcome> => {
    const client = getScopeGuardClient(runtime);
    const content = message.content || {};

    const target = content.target || options?.target;
    const method = content.method || options?.method;
    const args = content.args || options?.args || {};
    const amount = content.amount || options?.amount || "0";
    const recipient = content.recipient || content.to || options?.recipient || options?.to;
    const memo = content.memo || options?.memo;

    if (!target && !method && !recipient) {
      const errOutcome: Outcome = {
        status: "REJECTED",
        reason: "INVALID_PARAMETERS: Target contract or recipient is required.",
      };
      if (callback) {
        await callback({
          text: "Action rejected locally: missing required target contract or recipient parameter.",
          action: "EXECUTE_ONCHAIN_ACTION",
          content: errOutcome,
        });
      }
      return errOutcome;
    }

    try {
      const actParams: ActParams = {
        target: target || recipient,
        method: method || (recipient && !target ? "near_transfer" : "ft_transfer"),
        args: typeof args === "string" ? JSON.parse(args) : args,
        amount: amount.toString(),
        recipient,
        memo,
      };

      const outcome = await client.act(actParams);

      if (outcome.status === "ALLOWED") {
        const text = `Transaction successfully authorized and executed by ScopeGuard onchain.`;
        if (callback) {
          await callback({ text, action: "EXECUTE_ONCHAIN_ACTION", content: outcome });
        }
        return outcome;
      }

      if (outcome.status === "PENDING") {
        const guidance = getEscalationGuidance(outcome);
        const text = outcome.escalation_message || guidance.message;
        if (callback) {
          await callback({ text, action: "EXECUTE_ONCHAIN_ACTION", content: outcome });
        }
        return outcome;
      }

      const text = `ScopeGuard refused this action onchain: ${outcome.reason}. The funds were not moved.`;
      if (callback) {
        await callback({ text, action: "EXECUTE_ONCHAIN_ACTION", content: outcome });
      }
      return outcome;
    } catch (err: any) {
      const failOutcome: Outcome = {
        status: "REJECTED",
        reason: err.message || "Execution failed at protocol layer.",
      };
      if (callback) {
        await callback({
          text: `Transaction failed: ${failOutcome.reason}`,
          action: "EXECUTE_ONCHAIN_ACTION",
          content: failOutcome,
        });
      }
      return failOutcome;
    }
  },
  examples: [
    [
      {
        user: "owner",
        content: {
          text: "Swap 25 mUSD on DEX",
          action: "EXECUTE_ONCHAIN_ACTION",
          target: "ref-finance.near",
          method: "swap",
          amount: "25",
        },
      },
    ],
    [
      {
        user: "owner",
        content: {
          text: "Send 10 NEAR to alice.near",
          action: "EXECUTE_ONCHAIN_ACTION",
          method: "near_transfer",
          to: "alice.near",
          amount: "10000000000000000000000000",
        },
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// ScopeGuard Action: GET_WALLET_BUDGET
// ---------------------------------------------------------------------------

export const scopeGuardGetBudgetAction: Action = {
  name: "GET_WALLET_BUDGET",
  similes: [
    "CHECK_BUDGET",
    "CHECK_ALLOWANCE",
    "CHECK_VAULT_BALANCE",
    "GET_POLICY_RULES",
  ],
  description:
    "Checks the agent's current spending allowance, remaining daily budget, vault balance, and circuit breaker health.",
  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    try {
      resolveScopeGuardCredential(runtime);
      return true;
    } catch {
      return false;
    }
  },
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback
  ): Promise<BudgetView | null> => {
    const client = getScopeGuardClient(runtime);
    const budget = await client.budget();

    if (!budget) {
      if (callback) {
        await callback({
          text: "Unable to retrieve ScopeGuard budget for this agent account.",
          action: "GET_WALLET_BUDGET",
        });
      }
      return null;
    }

    const text = [
      `ScopeGuard Wallet Budget Status:`,
      `- Operating Status: ${budget.paused ? "PAUSED (Circuit Breaker Tripped)" : "ACTIVE"}`,
      `- Daily Cap: ${budget.cap} tokens`,
      `- Spent Today: ${budget.spent} tokens`,
      `- Remaining Today: ${budget.remaining} tokens`,
      `- Actions in 10m Window: ${budget.actions_in_window}`,
      `- Vault Balance: ${budget.vault_balance} tokens`,
      `- Native NEAR Vault: ${budget.near_vault_balance || "0"} yoctoNEAR`,
    ].join("\n");

    if (callback) {
      await callback({ text, action: "GET_WALLET_BUDGET", content: budget });
    }
    return budget;
  },
  examples: [
    [
      {
        user: "owner",
        content: {
          text: "What is my remaining daily allowance?",
          action: "GET_WALLET_BUDGET",
        },
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// ScopeGuard Action: SIMULATE_ONCHAIN_ACTION (Preflight)
// ---------------------------------------------------------------------------

export const scopeGuardPreflightAction: Action = {
  name: "SIMULATE_ONCHAIN_ACTION",
  similes: [
    "CHECK_ACTION",
    "PREFLIGHT_TRANSACTION",
    "DRY_RUN_ACTION",
  ],
  description:
    "Simulates an onchain action against ScopeGuard rules without broadcasting to the chain, returning whether it will be allowed, quarantined, or rejected.",
  validate: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<boolean> => {
    try {
      resolveScopeGuardCredential(runtime);
      return true;
    } catch {
      return false;
    }
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    options?: any,
    callback?: HandlerCallback
  ): Promise<PreflightResult> => {
    const client = getScopeGuardClient(runtime);
    const content = message.content || {};

    const target = content.target || options?.target;
    const method = content.method || options?.method;
    const args = content.args || options?.args || {};
    const amount = content.amount || options?.amount || "0";
    const recipient = content.recipient || content.to || options?.recipient || options?.to;
    const memo = content.memo || options?.memo;

    const actParams: ActParams = {
      target: target || recipient,
      method: method || (recipient && !target ? "near_transfer" : "ft_transfer"),
      args: typeof args === "string" ? JSON.parse(args) : args,
      amount: amount.toString(),
      recipient,
      memo,
    };

    const result = await client.preflight(actParams);

    const text = [
      `ScopeGuard Preflight Simulation:`,
      `- Result: ${result.status}`,
      result.reason ? `- Reason: ${result.reason}` : null,
      result.delay_seconds ? `- Review Delay: ${result.delay_seconds} seconds` : null,
      `- Velocity: ${result.velocity_used}/${result.velocity_max} (Remaining: ${result.velocity_remaining})`,
    ]
      .filter(Boolean)
      .join("\n");

    if (callback) {
      await callback({ text, action: "SIMULATE_ONCHAIN_ACTION", content: result });
    }
    return result;
  },
  examples: [
    [
      {
        user: "owner",
        content: {
          text: "Will a 100 mUSD transfer to alice.near pass the policy?",
          action: "SIMULATE_ONCHAIN_ACTION",
          to: "alice.near",
          amount: "100",
        },
      },
    ],
  ],
};

// ---------------------------------------------------------------------------
// ElizaOS ScopeGuard Plugin Definition
// ---------------------------------------------------------------------------

export const scopeGuardPlugin: Plugin = {
  name: "@scopeguard/plugin-eliza",
  description:
    "ScopeGuard security plugin for ElizaOS: scoped onchain passkeys, daily spending caps, circuit breakers, and timelocked quarantine queues for autonomous AI agents on NEAR Protocol.",
  actions: [
    scopeGuardExecuteAction,
    scopeGuardGetBudgetAction,
    scopeGuardPreflightAction,
  ],
  providers: [
    scopeGuardProvider,
  ],
};

export default scopeGuardPlugin;
