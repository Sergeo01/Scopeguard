#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  ScopeGuardAgentClient,
  ScopeGuardCredential,
  ActParams,
  GuardAction,
  resolveContractAlias,
  formatPendingEscalationMessage,
  getEscalationGuidance,
  Policy,
  BudgetView,
  PendingAction,
} from "@scopeguard/sdk";

// ---------------------------------------------------------------------------
// Credential Loader
// ---------------------------------------------------------------------------
export function resolveCredential(): ScopeGuardCredential {
  const args = process.argv.slice(2);
  let credPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--credential" && args[i + 1]) {
      credPath = args[i + 1];
      break;
    }
  }

  if (!credPath && process.env.SCOPEGUARD_CREDENTIAL_PATH) {
    credPath = process.env.SCOPEGUARD_CREDENTIAL_PATH;
  }

  if (process.env.SCOPEGUARD_CREDENTIAL_JSON) {
    try {
      return JSON.parse(process.env.SCOPEGUARD_CREDENTIAL_JSON) as ScopeGuardCredential;
    } catch (e: any) {
      throw new Error(`Invalid SCOPEGUARD_CREDENTIAL_JSON: ${e.message}`);
    }
  }

  const candidatePaths = [
    credPath,
    path.join(process.cwd(), "agent.json"),
    path.join(process.cwd(), "credentials", "agent.json"),
    path.join(process.cwd(), "demo-agent", "credentials", "agent.json"),
    path.join(__dirname, "..", "..", "..", "demo-agent", "credentials", "agent.json"),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      return JSON.parse(raw) as ScopeGuardCredential;
    }
  }

  throw new Error(
    "ScopeGuard credential not found. Pass --credential <path>, set SCOPEGUARD_CREDENTIAL_PATH, or place agent.json in working directory."
  );
}

// ---------------------------------------------------------------------------
// Rejection Tracking and Diagnostics
// ---------------------------------------------------------------------------
export interface LastDeclineRecord {
  reason: string;
  timestamp: number;
  action?: any;
  explanation: string;
  suggested_fix: string;
}

let lastDecline: LastDeclineRecord | null = null;

export function getLastDecline(): LastDeclineRecord | null {
  return lastDecline;
}

export function resetLastDecline(): void {
  lastDecline = null;
}

export function getDeclineDetails(
  reason: string,
  action?: any
): { explanation: string; suggested_fix: string } {
  switch (reason) {
    case "NOT_AGENT":
      return {
        explanation: "Caller account does not match the registered agent account ID for this policy.",
        suggested_fix: "Check that your passkey credentials match the agent account registered onchain.",
      };
    case "PAUSED":
      return {
        explanation: "Agent spending is paused by owner or circuit breaker tripped.",
        suggested_fix: "Wait for the owner to unpause the agent in the ScopeGuard dashboard.",
      };
    case "LEASE_EXPIRED":
      return {
        explanation: "Agent session key lease has expired.",
        suggested_fix: "Owner must renew the lease in the ScopeGuard dashboard.",
      };
    case "CANARY_TRIPPED":
      return {
        explanation: "Canary trap method was invoked, freezing the agent.",
        suggested_fix: "A security canary method was hit. Owner must review security alerts and reset policy.",
      };
    case "OVER_VELOCITY_CAP":
      return {
        explanation: "Too many actions executed within the 10 minute velocity window.",
        suggested_fix: "Slow down transaction frequency. Wait for velocity window to roll over.",
      };
    case "TARGET_NOT_ALLOWED":
      return {
        explanation: "The target smart contract is not in the owner allowlist.",
        suggested_fix: "Only whitelisted contracts can be interacted with. Ask owner to allowlist the target contract.",
      };
    case "METHOD_NOT_ALLOWED":
      return {
        explanation: "The method name is not approved for this target contract.",
        suggested_fix: "Verify method name or ask owner to allowlist this method.",
      };
    case "OVER_DAILY_CAP":
      return {
        explanation: "Transaction amount exceeds the 24 hour spending budget.",
        suggested_fix: "Wait for the 24 hour rolling window to recover budget or ask owner to increase daily cap.",
      };
    case "RECIPIENT_NOT_ALLOWED":
      return {
        explanation: "Recipient account is not on the owner receiving allowlist.",
        suggested_fix: "Direct transfers can only be sent to pre-approved addresses. Ask owner to add recipient to allowlist.",
      };
    case "DRAWDOWN_EXCEEDED":
      return {
        explanation: "Transaction amount exceeds maximum per-transaction drawdown limit.",
        suggested_fix: "Split the action or ask owner to raise max drawdown threshold.",
      };
    case "INSUFFICIENT_VAULT_BALANCE":
      return {
        explanation: "Vault balance has insufficient funds for this transfer.",
        suggested_fix: "Deposit funds into the agent vault balance before initiating transfer.",
      };
    case "STORAGE_DEPOSIT_EXCEEDED":
      return {
        explanation: "Attached deposit exceeds the safe storage deposit ceiling (2 NEAR).",
        suggested_fix: "Lower the attached deposit to 2 NEAR or less.",
      };
    case "PENDING_QUEUE_FULL":
      return {
        explanation: "Quarantine review queue is full.",
        suggested_fix: "Wait for owner to settle pending actions in dashboard.",
      };
    default:
      return {
        explanation: `Action was rejected by ScopeGuard policy (${reason}).`,
        suggested_fix: "Check active policy rules using scopeguard_get_rules.",
      };
  }
}

export function recordDecline(reason: string, action?: any): LastDeclineRecord {
  const details = getDeclineDetails(reason, action);
  lastDecline = {
    reason,
    timestamp: Date.now(),
    action,
    explanation: details.explanation,
    suggested_fix: details.suggested_fix,
  };
  return lastDecline;
}

// ---------------------------------------------------------------------------
// Parameter Normalization & Alias Resolver
// ---------------------------------------------------------------------------
export function normalizeParams(args: Record<string, any>, networkId: string = "testnet"): ActParams {
  const normalized: ActParams = { ...args };
  if ((args as any).dex && !normalized.target) {
    normalized.target = (args as any).dex;
  }
  if (normalized.to && !normalized.recipient) {
    normalized.recipient = normalized.to;
  }
  if (normalized.recipient && !normalized.to) {
    normalized.to = normalized.recipient;
  }
  if (normalized.target) {
    normalized.target = resolveContractAlias(normalized.target, networkId);
  }
  if (normalized.token) {
    normalized.token = resolveContractAlias(normalized.token, networkId);
  }
  if (normalized.recipient) {
    normalized.recipient = resolveContractAlias(normalized.recipient, networkId);
  }
  if (normalized.to) {
    normalized.to = resolveContractAlias(normalized.to, networkId);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Tool Definitions (Agent Tools Only - No Owner Privileges)
// ---------------------------------------------------------------------------
export const TOOLS = [
  {
    name: "scopeguard_budget",
    description:
      "Query current onchain spending allowance, remaining daily budget, vault balance, velocity counters, and circuit breaker status for this agent.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "scopeguard_get_rules",
    description:
      "Inspect this agent active onchain policy rules, allowed target contracts and whitelisted methods, daily spend limit, remaining budget, lease expiry countdown, max drawdown, and canary trip methods.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "scopeguard_get_last_decline",
    description:
      "Retrieve the most recent policy rejection or refusal reason, timestamp, human-readable explanation, and suggested corrective action.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "scopeguard_get_pending",
    description:
      "Query actions currently held in ScopeGuard review quarantine awaiting owner approval or timelock release.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "scopeguard_preflight",
    description:
      "Read-only simulation of an action against ScopeGuard policy. Returns ALLOWED, PENDING with timelock delay, or REJECTED with the exact policy failure reason code. Never mutates state or increments strikes.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target smart contract account ID or alias (e.g. sergeo-guard-dex.testnet, REF, USDC)",
        },
        method: {
          type: "string",
          description: "Method name to call (e.g. swap, ft_transfer, near_transfer)",
        },
        amount: {
          type: "string",
          description: "Token amount in atomic units or yoctoNEAR for transfers (optional)",
        },
        recipient: {
          type: "string",
          description: "Recipient account ID for transfers (optional)",
        },
        to: {
          type: "string",
          description: "Recipient account ID for native NEAR transfers (optional, synonym for recipient)",
        },
        token: {
          type: "string",
          description: "Vault token account ID or alias (optional)",
        },
        deposit: {
          type: "string",
          description: "Attached yoctoNEAR deposit for contract call, e.g. storage deposit up to 2 NEAR (optional)",
        },
        min_out: {
          type: "string",
          description: "Minimum output amount for swaps (optional)",
        },
        memo: {
          type: "string",
          description: "Transfer memo (optional)",
        },
        args: {
          type: "object",
          description: "Method arguments object (optional)",
        },
      },
      required: ["method"],
    },
  },
  {
    name: "scopeguard_act",
    description:
      "Execute an authorized onchain action through ScopeGuard using the agent scoped passkey. Verifies all 10 policy checks on consensus before execution.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target smart contract account ID or alias (e.g. sergeo-guard-dex.testnet, REF, USDC)",
        },
        method: {
          type: "string",
          description: "Method name to call (e.g. swap, ft_transfer, near_transfer)",
        },
        amount: {
          type: "string",
          description: "Token amount in atomic units or yoctoNEAR for transfers (optional)",
        },
        recipient: {
          type: "string",
          description: "Recipient account ID for transfers (optional)",
        },
        to: {
          type: "string",
          description: "Recipient account ID for native NEAR transfers (optional, synonym for recipient)",
        },
        token: {
          type: "string",
          description: "Vault token account ID or alias (optional)",
        },
        deposit: {
          type: "string",
          description: "Attached yoctoNEAR deposit for contract call, e.g. storage deposit up to 2 NEAR (optional)",
        },
        min_out: {
          type: "string",
          description: "Minimum output amount for swaps (optional)",
        },
        memo: {
          type: "string",
          description: "Transfer memo (optional)",
        },
        args: {
          type: "object",
          description: "Method arguments object (optional)",
        },
      },
      required: ["method"],
    },
  },
];

// ---------------------------------------------------------------------------
// MCP Request Dispatcher
// ---------------------------------------------------------------------------
export async function handleMcpRequest(
  request: any,
  client: any,
  cred: ScopeGuardCredential
): Promise<any> {
  const { id, method, params } = request;
  const networkId = cred.networkId || "testnet";

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "scopeguard-ironclaw-mcp",
            version: "0.4.0",
          },
          capabilities: {
            tools: {},
          },
        },
      };

    case "ping":
      return {
        jsonrpc: "2.0",
        id,
        result: {},
      };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: TOOLS,
        },
      };

    case "tools/call": {
      const toolName = params?.name;
      const rawArgs = params?.arguments || {};

      switch (toolName) {
        case "scopeguard_budget": {
          const budget = await client.budget();
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(budget, null, 2),
                },
              ],
            },
          };
        }

        case "scopeguard_get_rules": {
          const [policy, budget] = await Promise.all([
            client.getPolicy().catch(() => null),
            client.budget().catch(() => null),
          ]);

          if (!policy) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        status: "UNREGISTERED",
                        message: "No active ScopeGuard policy found for this agent account.",
                        agent_account: cred.agentAccountId,
                        guard_contract: cred.policyContractId,
                      },
                      null,
                      2
                    ),
                  },
                ],
              },
            };
          }

          let leaseCountdownSeconds: number | null = null;
          if (policy.lease_expires_at) {
            const rawExpires = Number(policy.lease_expires_at);
            const nowMs = Date.now();
            let expiryMs: number;
            if (rawExpires > 1e16) {
              expiryMs = Math.floor(rawExpires / 1e6);
            } else if (rawExpires > 1e11) {
              expiryMs = rawExpires;
            } else {
              expiryMs = rawExpires * 1000;
            }
            leaseCountdownSeconds = Math.max(0, Math.floor((expiryMs - nowMs) / 1000));
          }

          const rulesPayload = {
            agent_account: cred.agentAccountId,
            guard_contract: cred.policyContractId,
            daily_cap: policy.daily_cap,
            spent: budget?.spent ?? "0",
            remaining_budget: budget?.remaining ?? String(policy.daily_cap),
            allowed_targets: policy.targets,
            allowed_methods: policy.targets,
            lease_expiry_countdown: leaseCountdownSeconds,
            lease_countdown_seconds: leaseCountdownSeconds,
            max_drawdown_bps: policy.max_drawdown_bps ?? null,
            canary_methods: policy.canary_methods ?? [],
            policy: {
              token: policy.token,
              allowed_targets: policy.targets,
              daily_cap: policy.daily_cap,
              receiving_allowlist: policy.recipients,
              velocity_limit_per_10min: policy.max_actions_per_10min,
              auto_pause_strikes: policy.auto_pause_rejects,
              auto_pause_window_minutes: policy.auto_pause_window_minutes,
              high_value_threshold: policy.high_value_threshold,
              high_value_delay_seconds: policy.high_value_delay_seconds,
              max_drawdown_bps: policy.max_drawdown_bps ?? null,
              lease_expires_at: policy.lease_expires_at ?? null,
              lease_countdown_seconds: leaseCountdownSeconds,
              canary_methods: policy.canary_methods ?? [],
            },
            current_budget: budget
              ? {
                  daily_cap: budget.cap,
                  spent_24h: budget.spent,
                  remaining_budget: budget.remaining,
                  actions_in_10m_window: budget.actions_in_window,
                  is_paused: budget.paused,
                  vault_balance: budget.vault_balance,
                  near_vault_balance: budget.near_vault_balance ?? "0",
                }
              : null,
            self_check_summary: `Agent is operating with remaining budget ${
              budget?.remaining ?? "unknown"
            }. Target allowlist has ${
              Object.keys(policy.targets || {}).length
            } contracts. Recipient allowlist has ${(policy.recipients || []).length} accounts.`,
          };

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(rulesPayload, null, 2),
                },
              ],
            },
          };
        }

        case "scopeguard_get_last_decline": {
          if (lastDecline) {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        has_decline: true,
                        ...lastDecline,
                      },
                      null,
                      2
                    ),
                  },
                ],
              },
            };
          }

          const rejectTimes = await client.getRejectTimes().catch(() => []);
          if (rejectTimes && rejectTimes.length > 0) {
            const latestNs = rejectTimes[rejectTimes.length - 1];
            const latestMs = Math.floor(Number(latestNs) / 1e6);
            return {
              jsonrpc: "2.0",
              id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(
                      {
                        has_decline: true,
                        reason: "ONCHAIN_REJECT",
                        timestamp: latestMs,
                        explanation:
                          "Most recent rejection recorded onchain within rolling auto-pause window.",
                        suggested_fix:
                          "Check active policy rules via scopeguard_get_rules or preflight the intended action.",
                        total_rejects_in_window: rejectTimes.length,
                      },
                      null,
                      2
                    ),
                  },
                ],
              },
            };
          }

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      has_decline: false,
                      message:
                        "No policy rejections recorded in this session or onchain auto-pause window.",
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        case "scopeguard_get_pending": {
          const pendingList: PendingAction[] = await client.getPendingActions();
          const nowSec = Math.floor(Date.now() / 1000);
          const formatted = (pendingList || []).map((p: any) => {
            const executableAtSec = Number(
              p.executable_at ?? (p.created_at ? p.created_at + 3600 : nowSec)
            );
            const secondsRemaining = Math.max(0, executableAtSec - nowSec);
            const ready = secondsRemaining === 0;
            return {
              id: p.id,
              target: p.target,
              method: p.method,
              amount: p.amount,
              recipient: p.recipient,
              created_at: p.created_at,
              executable_at: executableAtSec,
              seconds_remaining: secondsRemaining,
              ready_for_settlement: ready,
              action: p.action,
              escalation_message: formatPendingEscalationMessage(
                { status: "PENDING", pending_id: p.id },
                secondsRemaining
              ),
            };
          });

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      pending_count: formatted.length,
                      pending_actions: formatted,
                      guidance:
                        formatted.length > 0
                          ? "Actions listed above are currently held in ScopeGuard review quarantine. If seconds_remaining is 0, they can be settled or cancelled by the owner in the ScopeGuard dashboard."
                          : "No actions currently queued in review quarantine.",
                    },
                    null,
                    2
                  ),
                },
              ],
            },
          };
        }

        case "scopeguard_preflight": {
          const normalized = normalizeParams(rawArgs, networkId);
          const preflightRes = await client.preflight(normalized);
          if (preflightRes.status === "REJECTED" && preflightRes.reason) {
            recordDecline(preflightRes.reason, normalized);
          }

          let preflightPayload: any = { ...preflightRes };
          if (preflightRes.status === "PENDING") {
            const guidance = getEscalationGuidance(
              { status: "PENDING", pending_id: undefined },
              preflightRes.delay_seconds || 3600
            );
            preflightPayload = {
              ...preflightRes,
              escalation_guidance: guidance,
            };
          }

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(preflightPayload, null, 2),
                },
              ],
            },
          };
        }

        case "scopeguard_act": {
          const normalized = normalizeParams(rawArgs, networkId);
          const actRes = await client.act(normalized);
          if (actRes.status === "REJECTED" && actRes.reason) {
            recordDecline(actRes.reason, normalized);
          }

          let actPayload: any = { ...actRes };
          if (actRes.status === "PENDING") {
            const guidance = getEscalationGuidance(actRes, 3600);
            actPayload = {
              ...actRes,
              escalation_guidance: guidance,
            };
          }

          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(actPayload, null, 2),
                },
              ],
            },
          };
        }

        default:
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Method or tool not found: ${toolName}`,
            },
          };
      }
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

// ---------------------------------------------------------------------------
// MCP Server Runner (Standard JSON-RPC 2.0 over stdio)
// ---------------------------------------------------------------------------
async function main() {
  const cred = resolveCredential();
  const client = new ScopeGuardAgentClient(cred);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const sendResponse = (msgObj: any) => {
    process.stdout.write(JSON.stringify(msgObj) + "\n");
  };

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request: any;
    try {
      request = JSON.parse(trimmed);
    } catch (e: any) {
      sendResponse({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON" },
      });
      return;
    }

    const { id, method } = request;
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        // Notification ack
      }
      return;
    }

    try {
      const resp = await handleMcpRequest(request, client, cred);
      sendResponse(resp);
    } catch (handlerErr: any) {
      sendResponse({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: handlerErr.message || "Internal server error",
        },
      });
    }
  });

  process.stderr.write(
    `[ScopeGuard MCP] Initialized for agent: ${cred.agentAccountId} via Guard: ${cred.policyContractId}\n`
  );
}

if (require.main === module) {
  main().catch((fatal: any) => {
    process.stderr.write(`[ScopeGuard MCP Fatal] ${fatal.message}\n`);
    process.exit(1);
  });
}
