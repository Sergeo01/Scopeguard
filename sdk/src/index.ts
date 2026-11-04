import * as fs from "fs";
import { connect, keyStores, KeyPair, Account } from "near-api-js";

export interface ScopeGuardCredential {
  agentAccountId: string;
  policyContractId: string;
  publicKey: string;
  privateKey: string;
  networkId?: string;
  nodeUrl?: string;
}

export type GuardAction =
  | {
      Transfer: {
        token: string;
        to: string;
        amount: string;
        memo?: string | null;
      };
    }
  | {
      Swap: {
        dex: string;
        token_in: string;
        amount_in: string;
        min_out: string;
      };
    }
  | {
      ContractCall: {
        target: string;
        method: string;
        args: string;
        deposit?: string | null;
      };
    }
  | {
      IntentTransfer: {
        deposit_address: string;
        amount: string;
        destination_asset: string;
        recipient: string;
      };
    }
  | {
      NearTransfer: {
        to: string;
        amount: string;
      };
    };

export interface ActParams {
  target?: string;
  method?: string;
  args?: Record<string, any> | string;
  amount?: string;
  recipient?: string;
  token?: string;
  min_out?: string;
  memo?: string | null;
  deposit_address?: string;
  destination_asset?: string;
  deposit?: string | null;
  to?: string;
}

export interface Outcome {
  status: "ALLOWED" | "REJECTED" | "PENDING" | "SETTLED";
  reason?: string;
  pending_id?: number;
  escalation_message?: string;
}

export interface PreflightResult {
  status: "ALLOWED" | "REJECTED" | "PENDING";
  reason?: string | null;
  delay_seconds?: number | null;
  budget?: BudgetView | null;
  velocity_used: number;
  velocity_max: number;
  velocity_remaining: number;
  vault_balance: string;
  near_vault_balance?: string | null;
}

export const CONTRACT_ALIASES: Record<string, { mainnet: string; testnet: string }> = {
  USDC: {
    mainnet: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    testnet: "sergeo-guard-token.testnet",
  },
  REF: {
    mainnet: "v2.ref-finance.near",
    testnet: "sergeo-guard-dex.testnet",
  },
  REF_FINANCE: {
    mainnet: "v2.ref-finance.near",
    testnet: "sergeo-guard-dex.testnet",
  },
  INTENTS: {
    mainnet: "intents.near",
    testnet: "intents.near",
  },
  DEFUSE: {
    mainnet: "intents.near",
    testnet: "intents.near",
  },
  WRAP_NEAR: {
    mainnet: "wrap.near",
    testnet: "wrap.testnet",
  },
  WNEAR: {
    mainnet: "wrap.near",
    testnet: "wrap.testnet",
  },
};

export function resolveContractAlias(
  nameOrAddress: string | undefined | null,
  networkId: string = "testnet"
): string {
  if (!nameOrAddress) return "";
  const trimmed = nameOrAddress.trim();
  const normalizedKey = trimmed.toUpperCase().replace(/[-\s]/g, "_");
  const match = CONTRACT_ALIASES[normalizedKey];
  if (match) {
    return networkId === "mainnet" ? match.mainnet : match.testnet;
  }
  return trimmed;
}

export function formatPendingEscalationMessage(outcome: Outcome, delaySeconds?: number): string {
  const pendingId = outcome.pending_id !== undefined ? `#${outcome.pending_id}` : "#pending";
  const delay = delaySeconds !== undefined ? delaySeconds : 3600;
  return `Action queued in ScopeGuard review quarantine (Pending ID: ${pendingId}). Estimated review delay: ${delay} seconds. The owner must approve this in the ScopeGuard dashboard before funds move.`;
}

export function getEscalationGuidance(
  outcome: Outcome,
  delaySeconds?: number
): {
  message: string;
  requires_owner_approval: boolean;
  pending_id?: number;
  instructions: string;
} {
  const isPending = outcome.status === "PENDING";
  return {
    message: isPending
      ? formatPendingEscalationMessage(outcome, delaySeconds)
      : `Action ${outcome.status.toLowerCase()}${outcome.reason ? `: ${outcome.reason}` : ""}`,
    requires_owner_approval: isPending,
    pending_id: outcome.pending_id,
    instructions: isPending
      ? "Please inform the user that their request exceeds the agent's autonomous limits or is subject to timelock security quarantine. The owner must log in to the ScopeGuard dashboard to review and approve this action before any funds will move."
      : "No owner escalation required.",
  };
}

export function toGuardAction(
  paramsOrAction: ActParams | GuardAction,
  networkId: string = "testnet"
): GuardAction {
  if (
    "Transfer" in paramsOrAction ||
    "Swap" in paramsOrAction ||
    "ContractCall" in paramsOrAction ||
    "IntentTransfer" in paramsOrAction ||
    "NearTransfer" in paramsOrAction
  ) {
    if ("Transfer" in paramsOrAction) {
      paramsOrAction.Transfer.token = resolveContractAlias(paramsOrAction.Transfer.token, networkId);
      paramsOrAction.Transfer.to = resolveContractAlias(paramsOrAction.Transfer.to, networkId);
    } else if ("Swap" in paramsOrAction) {
      paramsOrAction.Swap.dex = resolveContractAlias(paramsOrAction.Swap.dex, networkId);
      paramsOrAction.Swap.token_in = resolveContractAlias(paramsOrAction.Swap.token_in, networkId);
    } else if ("ContractCall" in paramsOrAction) {
      paramsOrAction.ContractCall.target = resolveContractAlias(paramsOrAction.ContractCall.target, networkId);
    } else if ("IntentTransfer" in paramsOrAction) {
      paramsOrAction.IntentTransfer.deposit_address = resolveContractAlias(paramsOrAction.IntentTransfer.deposit_address, networkId);
    } else if ("NearTransfer" in paramsOrAction) {
      paramsOrAction.NearTransfer.to = resolveContractAlias(paramsOrAction.NearTransfer.to, networkId);
    }
    return paramsOrAction;
  }
  const p = paramsOrAction as ActParams;
  const target = resolveContractAlias(p.target || (p as any).dex, networkId);
  const token = p.token ? resolveContractAlias(p.token, networkId) : undefined;
  const depositAddress = p.deposit_address ? resolveContractAlias(p.deposit_address, networkId) : undefined;
  const argsString = typeof p.args === "string" ? p.args : JSON.stringify(p.args || {});

  if (p.method === "near_transfer" || p.method === "transfer_near" || (p.token === "NEAR" && (p.recipient || p.to))) {
    const rawDest = p.recipient || p.to || target;
    if (!rawDest) {
      throw new Error("NearTransfer requires a destination recipient account id");
    }
    const destination = resolveContractAlias(rawDest, networkId);
    return {
      NearTransfer: {
        to: destination,
        amount: p.amount || "0",
      },
    };
  } else if (p.method === "execute_intent" || p.destination_asset) {
    return {
      IntentTransfer: {
        deposit_address: depositAddress || target,
        amount: p.amount || "0",
        destination_asset: p.destination_asset || "USDC",
        recipient: p.recipient || "",
      },
    };
  } else if (p.method === "swap") {
    return {
      Swap: {
        dex: target,
        token_in: token || process.env.SCOPEGUARD_VAULT_TOKEN || "sergeo-guard-token.testnet",
        amount_in: p.amount || "0",
        min_out: p.min_out || "0",
      },
    };
  } else if (p.method === "ft_transfer" || p.method === "ft_transfer_call") {
    if (!p.recipient) {
      throw new Error(
        `${p.method} requires a recipient account id; refusing to build a transfer without one`
      );
    }
    return {
      Transfer: {
        token: token || target,
        to: resolveContractAlias(p.recipient, networkId),
        amount: p.amount || "0",
        memo: p.memo || null,
      },
    };
  } else {
    return {
      ContractCall: {
        target,
        method: p.method || "",
        args: argsString,
        deposit: p.deposit || null,
      },
    };
  }
}

export interface BudgetView {
  cap: string;
  spent: string;
  remaining: string;
  actions_in_window: number;
  paused: boolean;
  revoked?: boolean;
  vault_balance: string;
  high_water_mark?: string;
  max_drawdown_bps?: number | null;
  near_vault_balance?: string;
}

export interface Policy {
  token: string;
  targets: Record<string, string[]>;
  daily_cap: number | string;
  recipients: string[];
  max_actions_per_10min: number;
  auto_pause_rejects: number;
  auto_pause_window_minutes: number;
  high_value_threshold: number | string;
  high_value_delay_seconds: number;
  policy_change_delay_seconds: number;
  max_drawdown_bps?: number | null;
  lease_expires_at?: number | string | null;
  intent_recipients?: string[];
  canary_methods?: string[];
}

export interface PendingAction {
  id: number;
  action?: GuardAction;
  target: string;
  method: string;
  args: string;
  amount: string;
  recipient: string | null;
  created_at: number;
  executable_at: number;
}

export interface StagedPolicy {
  policy: any;
  effective_at: number;
}

/**
 * Agent Client: Strictly for agents operating under restricted function-call passkeys.
 * Enforces protocol-level least privilege: can only call execute and query public state.
 */
export class ScopeGuardAgentClient {
  protected credential: ScopeGuardCredential;
  protected accountPromise: Promise<Account> | null = null;

  constructor(credential: ScopeGuardCredential) {
    this.credential = credential;
  }

  protected async getAccount(): Promise<Account> {
    if (this.accountPromise) {
      return this.accountPromise;
    }

    this.accountPromise = (async () => {
      const keyStore = new keyStores.InMemoryKeyStore();
      const networkId = this.credential.networkId || "testnet";
      const keyPair = KeyPair.fromString(this.credential.privateKey as any);
      await keyStore.setKey(networkId, this.credential.agentAccountId, keyPair);

      const near = await connect({
        networkId,
        // An explicit environment override wins over the nodeUrl recorded in a
        // credential file. Stale credentials otherwise pin a dead or
        // rate-limited RPC with no visible cause.
        nodeUrl:
          process.env.NEAR_TESTNET_RPC ||
          this.credential.nodeUrl ||
          "https://test.rpc.fastnear.com",
        keyStore,
      });

      return near.account(this.credential.agentAccountId);
    })();

    return this.accountPromise;
  }

  async act(paramsOrAction: ActParams | GuardAction): Promise<Outcome> {
    const account = await this.getAccount();
    const action = toGuardAction(paramsOrAction, this.credential.networkId || "testnet");

    const outcome = await account.functionCall({
      contractId: this.credential.policyContractId,
      methodName: "execute",
      args: { action },
      gas: BigInt("100000000000000"), // 100 TGas
      attachedDeposit: BigInt(0),
    });

    const parsed = JSON.parse(
      Buffer.from((outcome.status as any).SuccessValue, "base64").toString()
    ) as Outcome;
    if (parsed.status === "PENDING") {
      parsed.escalation_message = formatPendingEscalationMessage(parsed);
    }
    return parsed;
  }

  async preflight(paramsOrAction: ActParams | GuardAction): Promise<PreflightResult> {
    const account = await this.getAccount();
    const action = toGuardAction(paramsOrAction, this.credential.networkId || "testnet");

    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "preflight",
      args: {
        agent_account: this.credential.agentAccountId,
        action,
      },
    });
  }

  async budget(): Promise<BudgetView | null> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_budget",
      args: { agent_account: this.credential.agentAccountId },
    });
  }

  async getPolicy(): Promise<Policy | null> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_policy",
      args: { agent_account: this.credential.agentAccountId },
    });
  }

  async getRejectTimes(): Promise<number[]> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_reject_times",
      args: { agent_account: this.credential.agentAccountId },
    });
  }

  async getNearVaultBalance(): Promise<string> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_near_vault_balance",
      args: { agent_account: this.credential.agentAccountId },
    });
  }

  async getPendingActions(): Promise<PendingAction[]> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_pending_actions",
      args: { agent_account: this.credential.agentAccountId },
    });
  }

  async getStagedPolicy(): Promise<StagedPolicy | null> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_staged_policy",
      args: { agent_account: this.credential.agentAccountId },
    });
  }

  async getUnconfirmedRecipients(): Promise<string[]> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.credential.policyContractId,
      methodName: "get_unconfirmed_recipients",
      args: { agent_account: this.credential.agentAccountId },
    });
  }
}

/**
 * Owner Client: Strictly for owner accounts managing agent policies and emergency controls.
 * Uses owner master keys to sign administrative operations.
 */
export class ScopeGuardOwnerClient {
  private ownerAccountId: string;
  private policyContractId: string;
  private privateKey: string;
  private networkId: string;
  private nodeUrl: string;
  private accountPromise: Promise<Account> | null = null;

  constructor(config: {
    ownerAccountId: string;
    policyContractId: string;
    privateKey: string;
    networkId?: string;
    nodeUrl?: string;
  }) {
    this.ownerAccountId = config.ownerAccountId;
    this.policyContractId = config.policyContractId;
    this.privateKey = config.privateKey;
    this.networkId = config.networkId || "testnet";
    this.nodeUrl = config.nodeUrl || process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
  }

  private async getAccount(): Promise<Account> {
    if (this.accountPromise) {
      return this.accountPromise;
    }

    this.accountPromise = (async () => {
      const keyStore = new keyStores.InMemoryKeyStore();
      const keyPair = KeyPair.fromString(this.privateKey as any);
      await keyStore.setKey(this.networkId, this.ownerAccountId, keyPair);

      const near = await connect({
        networkId: this.networkId,
        nodeUrl: this.nodeUrl,
        keyStore,
      });

      return near.account(this.ownerAccountId);
    })();

    return this.accountPromise;
  }

  async pause(agentAccount: string): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "pause",
        args: { agent_account: agentAccount },
        gas: BigInt("30000000000000"),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async unpause(agentAccount: string): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "unpause",
        args: { agent_account: agentAccount },
        gas: BigInt("30000000000000"),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async settlePending(agentAccount: string, id: number): Promise<Outcome> {
    const account = await this.getAccount();
    try {
      const outcome = await account.functionCall({
        contractId: this.policyContractId,
        methodName: "settle_pending",
        args: { agent: agentAccount, id },
        gas: BigInt("40000000000000"),
      });
      return JSON.parse(
        Buffer.from((outcome.status as any).SuccessValue, "base64").toString()
      ) as Outcome;
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async cancelPending(agentAccount: string, id: number): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "cancel_pending",
        args: { agent_account: agentAccount, id },
        gas: BigInt("20000000000000"),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async cancelPolicyChange(agentAccount: string): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "cancel_policy_change",
        args: { agent_account: agentAccount },
        gas: BigInt("20000000000000"),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async withdraw(agentAccount: string, amount: string): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "withdraw",
        args: { agent_account: agentAccount, amount },
        gas: BigInt("50000000000000"),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async depositNear(agentAccount: string, amountYocto: string): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "deposit_near",
        args: { agent_account: agentAccount },
        gas: BigInt("30000000000000"),
        attachedDeposit: BigInt(amountYocto),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async withdrawNear(agentAccount: string, amount: string): Promise<void> {
    const account = await this.getAccount();
    try {
      await account.functionCall({
        contractId: this.policyContractId,
        methodName: "withdraw_near",
        args: { agent_account: agentAccount, amount },
        gas: BigInt("30000000000000"),
      });
    } catch (err) {
      throw new Error(formatNearError(err));
    }
  }

  async getNearVaultBalance(agentAccount: string): Promise<string> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.policyContractId,
      methodName: "get_near_vault_balance",
      args: { agent_account: agentAccount },
    });
  }

  async preflight(agentAccount: string, paramsOrAction: ActParams | GuardAction): Promise<PreflightResult> {
    const account = await this.getAccount();
    const action = toGuardAction(paramsOrAction, this.networkId);

    return account.viewFunction({
      contractId: this.policyContractId,
      methodName: "preflight",
      args: {
        agent_account: agentAccount,
        action,
      },
    });
  }

  async getUnconfirmedRecipients(agentAccount: string): Promise<string[]> {
    const account = await this.getAccount();
    return account.viewFunction({
      contractId: this.policyContractId,
      methodName: "get_unconfirmed_recipients",
      args: { agent_account: agentAccount },
    });
  }
}

/**
 * Maps raw RPC errors and Wasm panic traces to human-readable explanations.
 */
export function formatNearError(err: any): string {
  if (!err) return "Unknown transaction error";
  const msg = typeof err === "string" ? err : err.message || err.toString();

  if (msg.includes("Only the owner can settle") || msg.includes("Only owner")) {
    return "Owner only: caller is not the registered owner of this agent";
  }
  if (msg.includes("action not executable yet")) {
    return "Not executable yet: timelock veto delay has not expired";
  }
  if (msg.includes("pending action not found")) {
    return "Pending intent not found or already settled";
  }
  if (msg.includes("insufficient vault balance")) {
    return "Insufficient vault balance: requested transfer exceeds internal custody";
  }
  if (msg.includes("agent is revoked")) {
    return "Agent is revoked: allowlist is empty and actions are permanently blocked";
  }
  if (msg.includes("DRAWDOWN_EXCEEDED")) {
    return "Net drawdown cap exceeded: action would drop balance below safety threshold";
  }
  if (msg.includes("LEASE_EXPIRED")) {
    return "Task lease expired: execution window for this agent has passed";
  }
  if (msg.includes("CANARY_TRIPPED")) {
    return "Canary decoy method called: emergency circuit breaker activated";
  }
  if (msg.includes("INTENT_RECIPIENT_NOT_ALLOWED")) {
    return "Intent recipient blocked: destination address not allowlisted onchain";
  }
  if (msg.includes("Smart contract panicked: ")) {
    const match = msg.match(/Smart contract panicked:\s*([^,\n\r]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  if (msg.includes("Guest panic: ")) {
    const match = msg.match(/Guest panic:\s*([^,\n\r]+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return msg;
}

/**
 * ScopeGuardClient alias for ScopeGuardAgentClient (backward compatibility).
 * Exposes strictly agent execution methods (act, budget, getPendingActions, getStagedPolicy).
 */
export const ScopeGuardClient = ScopeGuardAgentClient;
export type ScopeGuardClient = ScopeGuardAgentClient;

export function loadCredential(path: string): ScopeGuardAgentClient {
  const content = fs.readFileSync(path, "utf-8");
  const cred = JSON.parse(content) as ScopeGuardCredential;
  return new ScopeGuardAgentClient(cred);
}

/**
 * Generic AI Agent Tool definitions compatible with LangChain, LlamaIndex, and OpenAI tool calling.
 */
export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  call: (args: any) => Promise<any>;
}

export function createScopeGuardTools(client: ScopeGuardAgentClient): AgentToolDefinition[] {
  return [
    {
      name: "scopeguard_execute",
      description:
        "Executes an onchain action strictly scoped through the ScopeGuard passkey on NEAR. Verifies spending limits, allowlists, and timelocks.",
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: "Target contract account ID or contract alias (e.g. 'wrap.near', 'ref-finance.near').",
          },
          method: { type: "string", description: "Method name to invoke on the target contract." },
          args: { type: "object", description: "JSON arguments for the method call." },
          amount: { type: "string", description: "Token amount or yoctoNEAR value." },
          recipient: { type: "string", description: "Recipient account ID for transfers." },
        },
        required: ["amount"],
      },
      call: async (args: ActParams) => client.act(args),
    },
    {
      name: "scopeguard_get_budget",
      description:
        "Checks the agent's current spending allowance, remaining daily budget, vault balance, and circuit breaker health.",
      parameters: {
        type: "object",
        properties: {},
      },
      call: async () => client.budget(),
    },
    {
      name: "scopeguard_preflight",
      description:
        "Simulates an onchain action against ScopeGuard rules without broadcasting to the chain, returning whether it will be allowed, quarantined, or rejected.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", description: "Target contract account ID or alias." },
          method: { type: "string", description: "Method name." },
          args: { type: "object", description: "Arguments object." },
          amount: { type: "string", description: "Amount value." },
          recipient: { type: "string", description: "Recipient account ID." },
        },
        required: ["amount"],
      },
      call: async (args: ActParams) => client.preflight(args),
    },
  ];
}
