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

    // Naive Agent Prompt Interpreter: turns plain text instructions into action parameters
    let target = task.target;
    let method = task.method;
    let amount = task.amount;
    let recipient = task.recipient;

    if (task.instruction) {
      const lower = task.instruction.toLowerCase();
      const transferMatch = task.instruction.match(/(?:transfer|send|drain|pay|withdraw)\s*(?:all|\$|entire)?\s*(\d*)\s*(?:musd|dollars|usd|\$|tokens|pot)?\s*(?:to|into)?\s*([a-z0-9_-]+\.(?:testnet|near))/i);
      if (transferMatch) {
        amount = amount || transferMatch[1] || "500";
        recipient = recipient || transferMatch[2];
        target = target || "sergeo-guard-token.testnet";
        method = method || "ft_transfer";
      } else if (lower.includes("evil") || lower.includes("drain") || lower.includes("hack") || lower.includes("steal")) {
        target = target || "evil_contract.testnet";
        method = method || "drain";
        amount = amount || "0";
      } else if (lower.includes("swap") || lower.includes("trade")) {
        const swapAmtMatch = task.instruction.match(/(\d+)/);
        amount = amount || (swapAmtMatch ? swapAmtMatch[1] : "10");
        target = target || "sergeo-guard-dex.testnet";
        method = method || "swap";
      }
    }

    // Default to the legitimate MockDEX target if not specified
    target = target || "sergeo-guard-dex.testnet";
    method = method || "swap";
    amount = amount || "0";
    const args = task.args || { amount };

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
