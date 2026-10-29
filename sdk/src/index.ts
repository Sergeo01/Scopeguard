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
}

export interface Outcome {
  status: "ALLOWED" | "REJECTED" | "PENDING" | "SETTLED";
  reason?: string;
  pending_id?: number;
}

export interface BudgetView {
  cap: string;
  spent: string;
  remaining: string;
  actions_in_window: number;
  paused: boolean;
  vault_balance: string;
}

export interface PendingAction {
  id: number;
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
        nodeUrl: this.credential.nodeUrl || process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org",
        keyStore,
      });

      return near.account(this.credential.agentAccountId);
    })();

    return this.accountPromise;
  }

  async act(paramsOrAction: ActParams | GuardAction): Promise<Outcome> {
    const account = await this.getAccount();
    let action: GuardAction;

    if ("Transfer" in paramsOrAction || "Swap" in paramsOrAction || "ContractCall" in paramsOrAction) {
      action = paramsOrAction;
    } else {
      const p = paramsOrAction as ActParams;
      const argsString =
        typeof p.args === "string" ? p.args : JSON.stringify(p.args || {});

      if (p.method === "swap") {
        action = {
          Swap: {
            dex: p.target,
            token_in: p.token || process.env.SCOPEGUARD_VAULT_TOKEN || "sergeo-guard-token.testnet",
            amount_in: p.amount || "0",
            min_out: p.min_out || "0",
          },
        };
      } else if (p.method === "ft_transfer" || p.method === "ft_transfer_call") {
        action = {
          Transfer: {
            token: p.token || p.target,
            to: p.recipient || "",
            amount: p.amount || "0",
            memo: p.memo || null,
          },
        };
      } else {
        action = {
          ContractCall: {
            target: p.target,
            method: p.method,
            args: argsString,
          },
        };
      }
    }

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
    this.nodeUrl = config.nodeUrl || process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org";
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
    await account.functionCall({
      contractId: this.policyContractId,
      methodName: "pause",
      args: { agent_account: agentAccount },
      gas: BigInt("30000000000000"),
    });
  }

  async unpause(agentAccount: string): Promise<void> {
    const account = await this.getAccount();
    await account.functionCall({
      contractId: this.policyContractId,
      methodName: "unpause",
      args: { agent_account: agentAccount },
      gas: BigInt("30000000000000"),
    });
  }

  async settlePending(agentAccount: string, id: number): Promise<Outcome> {
    const account = await this.getAccount();
    const outcome = await account.functionCall({
      contractId: this.policyContractId,
      methodName: "settle_pending",
      args: { agent: agentAccount, id },
      gas: BigInt("40000000000000"),
    });
    return JSON.parse(
      Buffer.from((outcome.status as any).SuccessValue, "base64").toString()
    ) as Outcome;
  }

  async cancelPending(agentAccount: string, id: number): Promise<void> {
    const account = await this.getAccount();
    await account.functionCall({
      contractId: this.policyContractId,
      methodName: "cancel_pending",
      args: { agent_account: agentAccount, id },
      gas: BigInt("20000000000000"),
    });
  }

  async cancelPolicyChange(agentAccount: string): Promise<void> {
    const account = await this.getAccount();
    await account.functionCall({
      contractId: this.policyContractId,
      methodName: "cancel_policy_change",
      args: { agent_account: agentAccount },
      gas: BigInt("20000000000000"),
    });
  }

  async withdraw(agentAccount: string, amount: string): Promise<void> {
    const account = await this.getAccount();
    await account.functionCall({
      contractId: this.policyContractId,
      methodName: "withdraw",
      args: { agent_account: agentAccount, amount },
      gas: BigInt("50000000000000"),
    });
  }
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
