const dns = require("dns");
const path = require("path");

const origLookup = dns.lookup;
const STATIC_HOSTS = {
  "test.rpc.fastnear.com": "104.18.31.232",
  "archival-rpc.testnet.near.org": "34.68.239.227"
};
dns.lookup = function(hostname, options, callback) {
  if (typeof options === "function") { callback = options; options = {}; }
  if (STATIC_HOSTS[hostname]) {
    const ip = STATIC_HOSTS[hostname];
    if (options && options.all) return callback(null, [{ address: ip, family: 4 }]);
    return callback(null, ip, 4);
  }
  return origLookup.call(dns, hostname, options, callback);
};

const nearApi = require(path.join(__dirname, "..", "web", "node_modules", "near-api-js"));
const EXPECTED_PUBKEY = "ed25519:A7vUfC7JppnquiWa9gzETePkq16ucVBR4NSXnVtAP9CJ";
const RPC_URL = "https://test.rpc.fastnear.com";

async function retryOp(fn, maxRetries = 5, delayMs = 1500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function verifyAll() {
  const near = await nearApi.connect({
    networkId: "testnet",
    nodeUrl: RPC_URL
  });

  const results = require(path.join(__dirname, "demo-run-results.json"));
  console.log("==================================================================");
  console.log(" ONCHAIN RPC VERIFICATION FOR ALL NEW DEMO HASHES");
  console.log("==================================================================");

  for (const row of results) {
    if (row.step >= 1 && row.step <= 5) {
      const txRes = await retryOp(async () => {
        return await near.connection.provider.txStatus(row.hash, "agent2.sergeo-guard.testnet");
      });
      const tx = txRes.transaction;
      const keyMatch = tx.public_key === EXPECTED_PUBKEY;
      console.log(`Step ${row.step}: ${row.name}`);
      console.log(`  Hash:              ${row.hash}`);
      console.log(`  Signer:            ${tx.signer_id}`);
      console.log(`  Receiver:          ${tx.receiver_id}`);
      console.log(`  Signer Public Key: ${tx.public_key}`);
      console.log(`  Scoped Key Match:  ${keyMatch ? "VERIFIED (TRUE)" : "FAILED (FALSE)"}`);
      console.log(`  Execution Status:  ${JSON.stringify(txRes.status)}`);
      console.log("------------------------------------------------------------------");
      if (!keyMatch || tx.signer_id !== "agent2.sergeo-guard.testnet") {
        throw new Error("Key mismatch on step " + row.step);
      }
    }
  }

  console.log("\n[VERIFICATION] Querying agent2 budget onchain after settlement:");
  const budget = await retryOp(async () => {
    return await near.connection.provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: "scopeguard.testnet",
      method_name: "get_budget",
      args_base64: Buffer.from(JSON.stringify({ agent_account: "agent2.sergeo-guard.testnet" })).toString("base64")
    });
  });
  const bData = JSON.parse(Buffer.from(budget.result).toString());
  console.log("  Budget:", JSON.stringify(bData, null, 2));

  console.log("\n[VERIFICATION] Querying agent2 pending actions onchain:");
  const pending = await retryOp(async () => {
    return await near.connection.provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: "scopeguard.testnet",
      method_name: "get_pending_actions",
      args_base64: Buffer.from(JSON.stringify({ agent_account: "agent2.sergeo-guard.testnet" })).toString("base64")
    });
  });
  const pData = JSON.parse(Buffer.from(pending.result).toString());
  console.log("  Pending Count:", pData.length);

  console.log("\n[VERIFICATION] Querying agent2 onchain access keys:");
  const keyList = await retryOp(async () => {
    return await near.connection.provider.query({
      request_type: "view_access_key_list",
      finality: "final",
      account_id: "agent2.sergeo-guard.testnet"
    });
  });
  console.log("  Key Count:", keyList.keys.length);
  for (const k of keyList.keys) {
    console.log("  Public Key:", k.public_key);
    console.log("  Permission:", JSON.stringify(k.access_key.permission, null, 2));
    console.log("  Nonce:     ", k.access_key.nonce);
  }
}

verifyAll().catch(err => {
  console.error("FATAL VERIFICATION ERROR:", err);
  process.exit(1);
});
