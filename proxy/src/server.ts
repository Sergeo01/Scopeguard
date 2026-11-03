import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { timingSafeEqual } from "crypto";
import {
  ScopeGuardAgentClient,
  ScopeGuardCredential,
  GuardAction,
  Outcome,
  toGuardAction,
} from "@scopeguard/sdk";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PROXY_PORT || "8787", 10);

// There is no default bot token. Shipping a well-known default would let any
// caller who has read the source spend the agent's spend lane. The operator
// must set PROXY_API_KEY to a unique, high-entropy value before start.
const PROXY_API_KEY = process.env.PROXY_API_KEY || "";

if (!PROXY_API_KEY || PROXY_API_KEY.length < 16) {
  console.error(
    "[Proxy] FATAL: PROXY_API_KEY is not set (or shorter than 16 characters). " +
      "Refusing to start: the proxy would otherwise accept the public default token."
  );
  process.exit(1);
}

/** Constant-time token comparison to avoid timing oracles. */
function tokenMatches(presented: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(PROXY_API_KEY);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function loadAgentCredential(): ScopeGuardCredential {
  const customPath = process.env.SCOPEGUARD_CREDENTIAL_PATH;
  const candidates = [
    customPath,
    path.join(__dirname, "..", "..", "demo-agent", "credentials", "agent.json"),
    path.join(process.cwd(), "credentials", "agent.json"),
    path.join(process.cwd(), "agent.json"),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      const data = JSON.parse(fs.readFileSync(c, "utf-8")) as ScopeGuardCredential;
      return data;
    }
  }

  throw new Error("Proxy failed to load agent scoped passkey credential.");
}

// ---------------------------------------------------------------------------
// Proxy Translation Engine
// ---------------------------------------------------------------------------
export class StrictBotProxy {
  private client: ScopeGuardAgentClient;
  private credential: ScopeGuardCredential;

  constructor() {
    this.credential = loadAgentCredential();
    this.client = new ScopeGuardAgentClient(this.credential);
  }

  public getAgentId(): string {
    return this.credential.agentAccountId;
  }

  public getGuardId(): string {
    return this.credential.policyContractId;
  }

  /**
   * Translates an unmodified direct bot request into a ScopeGuard GuardAction.
   * Translates only: NEVER widens scope.
   */
  public translateDirectBotRequest(body: any): GuardAction {
    const target = body.target || body.receiver_id;
    const method = body.method || body.method_name;
    const args = body.args || body.args_json || body.args_base64 || {};

    if (!target || !method) {
      throw new Error("Malformed bot request: missing target (or receiver_id) and method (or method_name)");
    }

    let parsedArgs = args;
    if (typeof args === "string") {
      try {
        parsedArgs = JSON.parse(args);
      } catch {
        parsedArgs = {};
      }
    }

    const sanitizeAmount = (val: any): string => {
      if (val === undefined || val === null) return "0";
      const s = String(val).trim();
      if (s.includes(".")) {
        return s.split(".")[0] || "0";
      }
      return s;
    };

    // Direct swap translation
    if (method === "swap") {
      const amount = sanitizeAmount(parsedArgs.amount || parsedArgs.amount_in || body.amount || "0");
      const min_out = sanitizeAmount(parsedArgs.min_out || body.min_out || "0");
      const token_in = parsedArgs.token_in || body.token || process.env.SCOPEGUARD_VAULT_TOKEN || "sergeo-guard-token.testnet";

      return {
        Swap: {
          dex: target,
          token_in,
          amount_in: amount,
          min_out: min_out,
        },
      };
    }

    // Direct NEP-141 transfer translation
    if (method === "ft_transfer" || method === "ft_transfer_call") {
      const recipient = parsedArgs.receiver_id || parsedArgs.to || body.recipient;
      const amount = sanitizeAmount(parsedArgs.amount || body.amount || "0");
      const memo = parsedArgs.memo || body.memo || null;

      if (!recipient) {
        throw new Error("Direct transfer request missing receiver_id/recipient");
      }

      return {
        Transfer: {
          token: target,
          to: recipient,
          amount: amount,
          memo,
        },
      };
    }

    // Generic ContractCall translation
    const argsStr = typeof args === "string" ? args : JSON.stringify(parsedArgs);
    return {
      ContractCall: {
        target,
        method,
        args: argsStr,
      },
    };
  }

  /**
   * Executes translated action through ScopeGuard.
   * The proxy holds ONLY the agent function-call key, so it can never exceed policy.
   */
  public async executeTranslatedAction(action: GuardAction): Promise<{
    outcome: Outcome;
    receiptHash?: string;
  }> {
    const outcome = await this.client.act(action);
    return { outcome };
  }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
export function createProxyServer(): http.Server {
  const proxy = new StrictBotProxy();

  const server = http.createServer(async (req, res) => {
    const sendJson = (status: number, data: any) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data, null, 2));
    };

    const url = req.url || "/";

    if (req.method === "GET" && url === "/health") {
      return sendJson(200, {
        status: "ok",
        service: "ScopeGuard Strict Bot Proxy",
        agent: proxy.getAgentId(),
        guard: proxy.getGuardId(),
        authenticated: true,
      });
    }

    // Inbound Authentication Check
    const authHeader = req.headers["authorization"] || req.headers["x-bot-key"];
    const token = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";

    if (!tokenMatches(token)) {
      console.warn(`[Proxy Warning] Unauthorized bot attempt rejected from ${req.socket.remoteAddress}`);
      return sendJson(401, {
        error: "UNAUTHORIZED_BOT_REQUEST",
        message: "Proxy requires a valid Bearer token or X-Bot-Key header to prevent unauthorized spending.",
      });
    }

    if (req.method === "POST" && (url === "/v1/trade" || url === "/v1/call" || url === "/")) {
      let bodyStr = "";
      req.on("data", (chunk) => {
        bodyStr += chunk;
      });

      req.on("end", async () => {
        try {
          const body = JSON.parse(bodyStr || "{}");
          const translatedAction = proxy.translateDirectBotRequest(body);

          const startTime = Date.now();
          const { outcome } = await proxy.executeTranslatedAction(translatedAction);
          const elapsedMs = Date.now() - startTime;

          // Translation Audit Logging
          console.log(`[Proxy Translation] Success: ${outcome.status} (${elapsedMs}ms)`);
          console.log(`  Source Request: ${JSON.stringify(body)}`);
          console.log(`  Guard Action:   ${JSON.stringify(translatedAction)}`);
          console.log(`  Onchain Outcome: status=${outcome.status}, reason=${outcome.reason || "none"}`);

          const isSuccess = outcome.status === "ALLOWED" || outcome.status === "PENDING";
          const httpStatus = isSuccess ? 200 : 403;

          sendJson(httpStatus, {
            success: outcome.status === "ALLOWED",
            status: outcome.status,
            reason: outcome.reason || null,
            pending_id: outcome.pending_id || null,
            action: translatedAction,
            agent: proxy.getAgentId(),
            guard: proxy.getGuardId(),
          });
        } catch (err: any) {
          console.error(`[Proxy Translation Error] ${err.message}`);
          sendJson(400, {
            error: "TRANSLATION_OR_EXECUTION_FAILED",
            message: err.message,
          });
        }
      });
      return;
    }

    sendJson(404, { error: "NOT_FOUND", path: url });
  });

  return server;
}

// ---------------------------------------------------------------------------
// Standalone runner
// ---------------------------------------------------------------------------
if (require.main === module) {
  const server = createProxyServer();
  server.listen(PORT, () => {
    console.log("==================================================================");
    console.log(" ScopeGuard: Strict Bot Proxy Service Started");
    console.log(` Listening on port: ${PORT}`);
    console.log(` Authentication:   Bearer token required`);
    console.log(" Key Constraint:    Proxy holds ONLY agent scoped FunctionCall key");
    console.log("==================================================================");
  });
}
