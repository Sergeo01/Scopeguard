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
      };
    }
  | {
      IntentTransfer: {
        deposit_address: string;
        amount: string;
        destination_asset: string;
        recipient: string;
      };
    };

export interface ActParams {
  target: string;
  method: string;
  args?: Record<string, any> | string;
  amount?: string;
  recipient?: string;
  token?: string;
  min_out?: string;
  memo?: string | null;
  deposit_address?: string;
  destination_asset?: string;
}

export interface Outcome {
  status: "ALLOWED" | "REJECTED" | "PENDING" | "SETTLED";
  reason?: string;
  pending_id?: number;
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
}

export function toGuardAction(paramsOrAction: ActParams | GuardAction): GuardAction {
  if (
    "Transfer" in paramsOrAction ||
    "Swap" in paramsOrAction ||
    "ContractCall" in paramsOrAction ||
    "IntentTransfer" in paramsOrAction
  ) {
    return paramsOrAction;
  }
  const p = paramsOrAction as ActParams;
  const argsString = typeof p.args === "string" ? p.args : JSON.stringify(p.args || {});

  if (p.method === "execute_intent" || p.destination_asset) {
    return {
      IntentTransfer: {
        deposit_address: p.deposit_address || p.target,
        amount: p.amount || "0",
        destination_asset: p.destination_asset || "USDC",
        recipient: p.recipient || "",
      },
    };
  } else if (p.method === "swap") {
    return {
      Swap: {
        dex: p.target,
        token_in: p.token || process.env.SCOPEGUARD_VAULT_TOKEN || "sergeo-guard-token.testnet",
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
        token: p.token || p.target,
        to: p.recipient,
        amount: p.amount || "0",
        memo: p.memo || null,
      },
    };
  } else {
    return {
      ContractCall: {
        target: p.target,
        method: p.method,
        args: argsString,
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
    const action = toGuardAction(paramsOrAction);

    const outcome = await account.functionCall({
      contractId: this.credential.policyContractId,
      methodName: "execute",
      args: { action },
      gas: BigInt("50000000000000"), // 50 TGas
      attachedDeposit: BigInt(0),
    });

    const parsed = JSON.parse(
      Buffer.from((outcome.status as any).SuccessValue, "base64").toString()
    ) as Outcome;
    return parsed;
  }

  async preflight(paramsOrAction: ActParams | GuardAction): Promise<PreflightResult> {
    const account = await this.getAccount();
    const action = toGuardAction(paramsOrAction);

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

  async preflight(agentAccount: string, paramsOrAction: ActParams | GuardAction): Promise<PreflightResult> {
    const account = await this.getAccount();
    const action = toGuardAction(paramsOrAction);

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
