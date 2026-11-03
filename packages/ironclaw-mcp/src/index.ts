#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  ScopeGuardAgentClient,
  ScopeGuardCredential,
  ActParams,
  GuardAction,
} from "@scopeguard/sdk";

// ---------------------------------------------------------------------------
// Credential Loader
// ---------------------------------------------------------------------------
function resolveCredential(): ScopeGuardCredential {
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
// Tool Definitions (Agent Tools Only - No Owner Tools)
// ---------------------------------------------------------------------------
const TOOLS = [
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
    name: "scopeguard_preflight",
    description:
      "Read-only simulation of an action against ScopeGuard policy. Returns ALLOWED, PENDING with timelock delay, or REJECTED with the exact policy failure reason code. Never mutates state or increments strikes.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target smart contract account ID (e.g. sergeo-guard-dex.testnet)",
        },
        method: {
          type: "string",
          description: "Method name to call (e.g. swap, ft_transfer)",
        },
        amount: {
          type: "string",
          description: "Token amount in atomic units (optional)",
        },
        recipient: {
          type: "string",
          description: "Recipient account ID for transfers (optional)",
        },
        token: {
          type: "string",
          description: "Vault token account ID for transfers (optional)",
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
      required: ["target", "method"],
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
          description: "Target smart contract account ID",
        },
        method: {
          type: "string",
          description: "Method name to call",
        },
        amount: {
          type: "string",
          description: "Token amount in atomic units (optional)",
        },
        recipient: {
          type: "string",
          description: "Recipient account ID for transfers (optional)",
        },
        token: {
          type: "string",
          description: "Vault token account ID for transfers (optional)",
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
      required: ["target", "method"],
    },
  },
];

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

  const sendResponse = (id: string | number | null, result: any) => {
    const msg = JSON.stringify({
      jsonrpc: "2.0",
      id,
      result,
    });
    process.stdout.write(msg + "\n");
  };

  const sendError = (id: string | number | null, code: number, message: string, data?: any) => {
    const msg = JSON.stringify({
      jsonrpc: "2.0",
      id,
      error: { code, message, data },
    });
    process.stdout.write(msg + "\n");
  };

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let request: any;
    try {
      request = JSON.parse(trimmed);
    } catch (e: any) {
      sendError(null, -32700, "Parse error: invalid JSON");
      return;
    }

    const { id, method, params } = request;

    // Handle notifications (no id)
    if (id === undefined || id === null) {
      if (method === "notifications/initialized") {
        // Notification ack
      }
      return;
    }

    try {
      switch (method) {
        case "initialize": {
          sendResponse(id, {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: "scopeguard-ironclaw-mcp",
              version: "0.2.0",
            },
            capabilities: {
              tools: {},
            },
          });
          break;
        }

        case "ping": {
          sendResponse(id, {});
          break;
        }

        case "tools/list": {
          sendResponse(id, {
            tools: TOOLS,
          });
          break;
        }

        case "tools/call": {
          const toolName = params?.name;
          const args = params?.arguments || {};

          if (toolName === "scopeguard_budget") {
            const budget = await client.budget();
            sendResponse(id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(budget, null, 2),
                },
              ],
            });
          } else if (toolName === "scopeguard_preflight") {
            const preflightRes = await client.preflight(args as ActParams);
            sendResponse(id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(preflightRes, null, 2),
                },
              ],
            });
          } else if (toolName === "scopeguard_act") {
            const actRes = await client.act(args as ActParams);
            sendResponse(id, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(actRes, null, 2),
                },
              ],
            });
          } else {
            sendError(id, -32601, `Method or tool not found: ${toolName}`);
          }
          break;
        }

        default: {
          sendError(id, -32601, `Method not found: ${method}`);
          break;
        }
      }
    } catch (handlerErr: any) {
      sendError(id, -32000, handlerErr.message || "Internal server error");
    }
  });

  process.stderr.write(
    `[ScopeGuard MCP] Initialized for agent: ${cred.agentAccountId} via Guard: ${cred.policyContractId}\n`
  );
}

main().catch((fatal: any) => {
  process.stderr.write(`[ScopeGuard MCP Fatal] ${fatal.message}\n`);
  process.exit(1);
});
