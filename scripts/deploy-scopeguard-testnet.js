process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const ACCOUNT_ID = "scopeguard.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
const CRED_PATH = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${ACCOUNT_ID}.json`);
const WASM_PATH = path.join(__dirname, "..", "contracts", "target", "wasm32-unknown-unknown", "release", "policy_contract.wasm");

async function main() {
  console.log("==================================================================");
  console.log(` Deploying Policy Contract to ${ACCOUNT_ID}`);
  console.log("==================================================================");

  if (!fs.existsSync(CRED_PATH)) {
    throw new Error(`Missing credential file for ${ACCOUNT_ID} at ${CRED_PATH}`);
  }
  if (!fs.existsSync(WASM_PATH)) {
    throw new Error(`Missing wasm at ${WASM_PATH}`);
  }

  const cred = JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
  const keyPair = KeyPair.fromString(cred.private_key || cred.secret_key);

  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, ACCOUNT_ID, keyPair);

  const near = await connect({
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    keyStore,
  });

  const account = await near.account(ACCOUNT_ID);
  const wasmBytes = fs.readFileSync(WASM_PATH);
  console.log(`Deploying wasm (${wasmBytes.length} bytes) to ${ACCOUNT_ID}...`);

  const deployRes = await account.deployContract(wasmBytes);
  console.log(`Deploy Tx: ${deployRes.transaction.hash}`);

  console.log(`Calling new() on ${ACCOUNT_ID}...`);
  try {
    const initRes = await account.functionCall({
      contractId: ACCOUNT_ID,
      methodName: "new",
      args: {},
      gas: BigInt("30000000000000"), // 30 TGas
    });
    console.log(`Initialized (new()) Tx: ${initRes.transaction.hash}`);
  } catch (err) {
    console.log(`Note on new(): ${err.message}`);
  }

  // Verify get_version
  console.log(`Verifying get_version onchain...`);
  const versionRes = await account.viewFunction({
    contractId: ACCOUNT_ID,
    methodName: "get_version",
    args: {},
  });
  console.log(`get_version result: "${versionRes}"`);

  if (versionRes !== "0.4.0") {
    throw new Error(`Expected version 0.4.0 but got "${versionRes}"`);
  }
  console.log(`[PASS] Step 2 complete: Contract deployed and initialized as v0.4.0 on ${ACCOUNT_ID}!`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
