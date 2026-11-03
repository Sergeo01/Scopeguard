const { spawn } = require("child_process");
const path = require("path");
const readline = require("readline");

async function runMcpTest() {
  console.log("==================================================================");
  console.log(" ScopeGuard: Testing IronClaw MCP Server via stdio JSON-RPC");
  console.log("==================================================================");

  const serverScript = path.join(__dirname, "..", "packages", "ironclaw-mcp", "dist", "index.js");
  const credPath = path.join(__dirname, "..", "demo-agent", "credentials", "agent.json");

  const child = spawn("node", [serverScript, "--credential", credPath], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  const rl = readline.createInterface({
    input: child.stdout,
    terminal: false,
  });

  let msgId = 1;
  const pendingRequests = new Map();

  rl.on("line", (line) => {
    try {
      const resp = JSON.parse(line.trim());
      if (resp.id && pendingRequests.has(resp.id)) {
        const { resolve } = pendingRequests.get(resp.id);
        pendingRequests.delete(resp.id);
        resolve(resp);
      }
    } catch (e) {
      console.error("Non-JSON stdout:", line);
    }
  });

  function request(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  // 1. Initialize
  console.log("[1/5] Testing initialize...");
  const initRes = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "ironclaw-test", version: "1.0.0" },
  });
  console.log("      Initialize result:", JSON.stringify(initRes.result));
  if (initRes.result.serverInfo.name !== "scopeguard-ironclaw-mcp") {
    throw new Error(`Unexpected server name: ${initRes.result.serverInfo.name}`);
  }

  // 2. Tools list
  console.log("[2/5] Testing tools/list...");
  const toolsRes = await request("tools/list", {});
  const toolNames = toolsRes.result.tools.map((t) => t.name);
  console.log("      Exposed MCP tools:", toolNames);

  // Strict agent-only assertion: no owner tools
  const forbiddenOwnerTools = ["pause", "unpause", "withdraw", "revoke", "settle", "settle_pending", "cancel"];
  for (const f of forbiddenOwnerTools) {
    if (toolNames.some((n) => n.toLowerCase().includes(f))) {
      throw new Error(`CRITICAL: Owner tool leaked into agent MCP tools: ${f}`);
    }
  }
  if (!toolNames.includes("scopeguard_budget") || !toolNames.includes("scopeguard_preflight") || !toolNames.includes("scopeguard_act")) {
    throw new Error("Missing required agent MCP tools");
  }
  console.log("      PASS: Agent-only tools verified (Zero owner tools exposed)");

  // 3. Test scopeguard_budget
  console.log("[3/5] Testing tools/call: scopeguard_budget...");
  const budgetCall = await request("tools/call", {
    name: "scopeguard_budget",
    arguments: {},
  });
  const budget = JSON.parse(budgetCall.result.content[0].text);
  console.log(`      Live Budget: Vault=${budget.vault_balance} mUSD, Remaining=${budget.remaining}/${budget.cap}, Paused=${budget.paused}`);

  // 4. Test scopeguard_preflight on legitimate swap
  console.log("[4/5] Testing tools/call: scopeguard_preflight (legitimate swap)...");
  const preflightSwap = await request("tools/call", {
    name: "scopeguard_preflight",
    arguments: {
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "25",
      token: "sergeo-guard-token.testnet",
      min_out: "20",
    },
  });
  const pfAllowed = JSON.parse(preflightSwap.result.content[0].text);
  console.log(`      Preflight swap status: ${pfAllowed.status}`);
  if (pfAllowed.status !== "ALLOWED") {
    throw new Error(`Expected ALLOWED, got: ${pfAllowed.status}`);
  }

  // 5. Test scopeguard_preflight on malicious transfer
  console.log("[5/5] Testing tools/call: scopeguard_preflight (blocked transfer to hacker)...");
  const preflightMalicious = await request("tools/call", {
    name: "scopeguard_preflight",
    arguments: {
      target: "sergeo-guard-token.testnet",
      method: "ft_transfer",
      amount: "100",
      recipient: "hacker.testnet",
    },
  });
  const pfRejected = JSON.parse(preflightMalicious.result.content[0].text);
  console.log(`      Preflight malicious status: ${pfRejected.status}, reason: ${pfRejected.reason}`);
  if (pfRejected.status !== "REJECTED" || pfRejected.reason !== "RECIPIENT_NOT_ALLOWED") {
    throw new Error(`Expected REJECTED (RECIPIENT_NOT_ALLOWED), got: ${JSON.stringify(pfRejected)}`);
  }

  child.kill();
  console.log("\n==================================================================");
  console.log(" SUCCESS: IronClaw MCP stdio server passed all verification tests!");
  console.log(" Registration syntax: ironclaw mcp add scopeguard node <path-to-index.js>");
  console.log("==================================================================");
}

runMcpTest().catch((err) => {
  console.error("MCP TEST FAILED:", err);
  process.exit(1);
});
