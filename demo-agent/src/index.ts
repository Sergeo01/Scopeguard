import * as fs from "fs";
import * as path from "path";
import { ScopeGuardClient, loadCredential, Outcome, PendingAction } from "@scopeguard/sdk";

export interface InboxTask {
  id: string;
  instruction: string;
  target?: string;
  method?: string;
  args?: Record<string, any>;
  amount?: string;
  recipient?: string;
  timestamp: number;
}

export class NaiveAgent {
  private client: ScopeGuardClient;
  private inboxPath: string;

  constructor(credentialPath: string, inboxPath: string) {
    this.client = loadCredential(credentialPath);
    this.inboxPath = inboxPath;
  }

  /**
   * Naive decision loop: intentionally obedient.
   * If the instruction contains specific targets/methods or an attack prompt,
   * the agent blindly attempts to execute what the user asked.
   */
  async processInstruction(task: InboxTask): Promise<Outcome> {
    console.log(`[Agent] Received task ${task.id}: "${task.instruction}"`);

    // Parse parameters directly from task (defaults to the legitimate MockDEX target)
    const target = task.target || "sergeo-guard-dex.testnet";
    const method = task.method || "swap";
    const args = task.args || { amount: task.amount || "10" };
    const amount = task.amount || "0";
    const recipient = task.recipient;

    console.log(`[Agent] Attempting onchain action through ScopeGuard:`, {
      target,
      method,
      amount,
      recipient,
    });

    try {
      const outcome = await this.client.act({
        target,
        method,
        args,
        amount,
        recipient,
      });

      console.log(`[Agent] Execution outcome:`, outcome);
      return outcome;
    } catch (err: any) {
      console.error(`[Agent] Call failed at protocol layer:`, err.message);
      return {
        status: "REJECTED",
        reason: err.message,
      };
    }
  }

  readInbox(): InboxTask[] {
    if (!fs.existsSync(this.inboxPath)) {
      return [];
    }
    const content = fs.readFileSync(this.inboxPath, "utf-8");
    try {
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  clearInbox(): void {
    if (fs.existsSync(this.inboxPath)) {
      fs.writeFileSync(this.inboxPath, JSON.stringify([], null, 2));
    }
  }

  async runOnce(): Promise<{ executed: Outcome[] }> {
    console.log("[Agent] Running cycle: reading inbox tasks...");
    const tasks = this.readInbox();
    const executed: Outcome[] = [];

    for (const task of tasks) {
      const outcome = await this.processInstruction(task);
      executed.push(outcome);
    }

    if (tasks.length > 0) {
      this.clearInbox();
    }

    return { executed };
  }
}

// Runnable standalone entry point
if (require.main === module) {
  const credPath = process.env.AGENT_CRED_PATH || path.join(__dirname, "..", "credentials", "agent.json");
  const inboxPath = process.env.INBOX_PATH || path.join(__dirname, "..", "inbox.json");

  console.log("Starting Naive Agent...");
  console.log("Credential Path:", credPath);
  console.log("Inbox Path:", inboxPath);

  const agent = new NaiveAgent(credPath, inboxPath);
  agent.runOnce().then((res) => {
    console.log("[Agent] Cycle finished:", res);
  }).catch((err) => {
    console.error("[Agent] Fatal error:", err);
    process.exit(1);
  });
}
