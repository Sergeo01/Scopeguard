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

export interface ActParams {
  target: string;
  method: string;
  args?: Record<string, any> | string;
  amount?: string;
  recipient?: string;
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

export class ScopeGuardClient {
  private credential: ScopeGuardCredential;
  private accountPromise: Promise<Account> | null = null;

  constructor(credential: ScopeGuardCredential) {
    this.credential = credential;
  }

  private async getAccount(): Promise<Account> {
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
        nodeUrl: this.credential.nodeUrl || process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
        keyStore,
      });

      return near.account(this.credential.agentAccountId);
    })();

    return this.accountPromise;
  }

  async act(params: ActParams): Promise<Outcome> {
    const account = await this.getAccount();
    const argsString =
      typeof params.args === "string"
        ? params.args
        : JSON.stringify(params.args || {});

    const outcome = await account.functionCall({
      contractId: this.credential.policyContractId,
      methodName: "execute",
      args: {
        target: params.target,
        method: params.method,
        args: argsString,
        amount: params.amount || "0",
        recipient: params.recipient || null,
      },
      gas: BigInt("50000000000000"), // 50 TGas
      attachedDeposit: BigInt(0),
    });

    const parsed = JSON.parse(
      Buffer.from((outcome.status as any).SuccessValue, "base64").toString()
    ) as Outcome;
    return parsed;
  }

  async settlePending(id: number): Promise<Outcome> {
    const account = await this.getAccount();
    const outcome = await account.functionCall({
      contractId: this.credential.policyContractId,
      methodName: "settle_pending",
      args: {
        agent: this.credential.agentAccountId,
        id,
      },
      gas: BigInt("40000000000000"), // 40 TGas
      attachedDeposit: BigInt(0),
    });

    const parsed = JSON.parse(
      Buffer.from((outcome.status as any).SuccessValue, "base64").toString()
    ) as Outcome;
    return parsed;
  }

  async cancelPending(id: number): Promise<void> {
    const account = await this.getAccount();
    await account.functionCall({
      contractId: this.credential.policyContractId,
      methodName: "cancel_pending",
      args: {
        agent_account: this.credential.agentAccountId,
        id,
      },
      gas: BigInt("20000000000000"), // 20 TGas
      attachedDeposit: BigInt(0),
    });
  }

  async cancelPolicyChange(): Promise<void> {
    const account = await this.getAccount();
    await account.functionCall({
      contractId: this.credential.policyContractId,
      methodName: "cancel_policy_change",
      args: {
        agent_account: this.credential.agentAccountId,
      },
      gas: BigInt("20000000000000"), // 20 TGas
      attachedDeposit: BigInt(0),
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
}

export function loadCredential(path: string): ScopeGuardClient {
  const content = fs.readFileSync(path, "utf-8");
  const cred = JSON.parse(content) as ScopeGuardCredential;
  return new ScopeGuardClient(cred);
}
