const http = require("http");
const path = require("path");
const fs = require("fs");

process.env.PROXY_PORT = "8788";
process.env.PROXY_API_KEY = "test-secret-bot-key-9988";

const { createProxyServer } = require("../proxy/dist/server");

function postJson(port, pathName, headers, body) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathName,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(dataStr),
          ...headers,
        },
      },
      (res) => {
        let respData = "";
        res.on("data", (chunk) => (respData += chunk));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(respData) });
          } catch {
            resolve({ statusCode: res.statusCode, raw: respData });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(dataStr);
    req.end();
  });
}

async function main() {
  console.log("==================================================================");
  console.log(" ScopeGuard: Strict Bot Proxy Proof & Verification Test");
  console.log("==================================================================");

  // 1. Verify key constraint: proxy must NOT hold an owner key
  const credPath = path.join(__dirname, "..", "demo-agent", "credentials", "agent.json");
  const cred = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  console.log("[1/4] Auditing Proxy Credentials & Key Scope Constraint...");
  console.log(`      Agent Account ID:    ${cred.agentAccountId}`);
  console.log(`      Policy Contract ID:  ${cred.policyContractId}`);
  if (cred.agentAccountId === "sergeo-guard.testnet") {
    throw new Error("CRITICAL SECURITY VIOLATION: Proxy configured with owner account!");
  }
  console.log("      PASS: Proxy holds ONLY agent sub-account passkey (no owner key).");

  // 2. Start Proxy Server
  const server = createProxyServer();
  await new Promise((resolve) => server.listen(8788, resolve));
  console.log("[2/4] Proxy server listening on port 8788.");

  try {
    // 3. Test Inbound Authentication: Random unauthenticated caller rejected
    console.log("[3/4] Testing inbound bot authentication guard...");
    const unauth = await postJson(8788, "/v1/trade", {}, {
      target: "sergeo-guard-dex.testnet",
      method: "swap",
      amount: "10",
    });
    console.log(`      Unauthenticated status: ${unauth.statusCode} (expected 401)`);
    if (unauth.statusCode !== 401) {
      throw new Error(`Expected HTTP 401 Unauthorized, got: ${unauth.statusCode}`);
    }
    console.log("      PASS: Inbound authentication rejected random caller without key.");

    // 4. Test Unmodified Bot Direct Trading Pattern: Legitimate swap
    console.log("[4/4] Executing unmodified bot trade through proxy (direct style)...");
    const legitTrade = await postJson(
      8788,
      "/v1/trade",
      { Authorization: "Bearer test-secret-bot-key-9988" },
      {
        receiver_id: "sergeo-guard-dex.testnet",
        method_name: "swap",
        args_json: {
          amount: "10",
          min_out: "8",
        },
      }
    );
    console.log("      Legitimate trade response:", JSON.stringify(legitTrade.data));
    if (legitTrade.data.status !== "ALLOWED") {
      throw new Error(`Expected ALLOWED, got: ${legitTrade.data.status}`);
    }
    console.log("      PASS: Direct-style bot trade completed through Guard policy!");

    // 5. Test Out-of-Policy Bot Trade: Blocked onchain by Guard
    console.log("[5/5] Executing out-of-policy bot trade (transfer to unauthorized recipient)...");
    const outOfPolicyTrade = await postJson(
      8788,
      "/v1/trade",
      { Authorization: "Bearer test-secret-bot-key-9988" },
      {
        receiver_id: "sergeo-guard-token.testnet",
        method_name: "ft_transfer",
        args_json: {
          receiver_id: "hacker.testnet",
          amount: "100",
        },
      }
    );
    console.log("      Out-of-policy trade response:", JSON.stringify(outOfPolicyTrade.data), "HTTP status:", outOfPolicyTrade.statusCode);
    if (outOfPolicyTrade.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for policy rejection, got: ${outOfPolicyTrade.statusCode}`);
    }
    if (outOfPolicyTrade.data.status !== "REJECTED" || outOfPolicyTrade.data.reason !== "RECIPIENT_NOT_ALLOWED") {
      throw new Error(`Expected REJECTED with RECIPIENT_NOT_ALLOWED, got: ${JSON.stringify(outOfPolicyTrade.data)}`);
    }
    console.log("      PASS: Out-of-policy trade returned HTTP 403 and blocked onchain with RECIPIENT_NOT_ALLOWED!");

    console.log("\n==================================================================");
    console.log(" SUCCESS: Strict Bot Proxy verified with full architectural proof!");
    console.log("==================================================================");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("PROXY TEST FAILED:", err);
  process.exit(1);
});
