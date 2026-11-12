const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { KeyPair, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const ACCOUNT_ID = "scopeguard.testnet";
const NETWORK_ID = "testnet";
const CRED_DIR = path.join(os.homedir(), ".near-credentials", NETWORK_ID);
const CRED_PATH = path.join(CRED_DIR, `${ACCOUNT_ID}.json`);
const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

async function viewAccount(accountId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      jsonrpc: "2.0",
      id: "view-" + accountId,
      method: "query",
      params: { request_type: "view_account", finality: "final", account_id: accountId },
    });
    const u = new URL(RPC_URL);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            resolve({ error: e.message, raw: b });
          }
        });
      }
    );
    req.on("error", (e) => resolve({ error: e.message }));
    req.write(data);
    req.end();
  });
}

async function requestFaucet(accountId, publicKey) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      newAccountId: accountId,
      newAccountPublicKey: publicKey,
    });
    const req = https.request(
      {
        hostname: "helper.testnet.near.org",
        path: "/account",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => {
          resolve({ status: res.statusCode, body: b });
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`Checking if ${ACCOUNT_ID} already exists...`);
  const initialCheck = await viewAccount(ACCOUNT_ID);
  if (initialCheck.result) {
    console.log(`Account ${ACCOUNT_ID} already exists! Balance:`, initialCheck.result.amount);
    return;
  }

  let keyPair;
  if (fs.existsSync(CRED_PATH)) {
    console.log(`Found existing local credentials for ${ACCOUNT_ID} at ${CRED_PATH}`);
    const existing = JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
    keyPair = KeyPair.fromString(existing.private_key || existing.secret_key);
  } else {
    console.log(`Generating fresh ed25519 keypair for ${ACCOUNT_ID}...`);
    keyPair = KeyPair.fromRandom("ed25519");
    fs.mkdirSync(CRED_DIR, { recursive: true });
    fs.writeFileSync(
      CRED_PATH,
      JSON.stringify(
        {
          account_id: ACCOUNT_ID,
          public_key: keyPair.getPublicKey().toString(),
          private_key: keyPair.toString(),
        },
        null,
        2
      )
    );
    console.log(`Saved credentials to ${CRED_PATH}`);
  }

  const publicKey = keyPair.getPublicKey().toString();
  console.log(`Public key: ${publicKey}`);
  console.log(`Calling official testnet faucet at helper.testnet.near.org...`);

  try {
    const faucetRes = await requestFaucet(ACCOUNT_ID, publicKey);
    console.log(`Faucet HTTP Status: ${faucetRes.status}`);
    console.log(`Faucet Response: ${faucetRes.body}`);
  } catch (err) {
    console.error(`Faucet request failed: ${err.message}`);
  }

  // Poll for account existence
  console.log(`Verifying account onchain...`);
  for (let attempt = 1; attempt <= 10; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    const check = await viewAccount(ACCOUNT_ID);
    if (check.result) {
      console.log(`SUCCESS: ${ACCOUNT_ID} exists on testnet!`);
      console.log(`Block Height: ${check.result.block_height}`);
      console.log(`Amount: ${check.result.amount} yoctoNEAR`);
      console.log(`Code Hash: ${check.result.code_hash}`);
      return;
    }
    console.log(`Attempt ${attempt}/10: Account not yet indexed, waiting...`);
  }

  console.error(`ERROR: ${ACCOUNT_ID} was not confirmed onchain after faucet request.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
