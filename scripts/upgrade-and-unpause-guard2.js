const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
const NETWORK_ID = "testnet";

const OWNER_ID = "sergeo-guard.testnet";
const GUARD_ID = "guard2.sergeo-guard.testnet";
const TRADER_ID = "agent.sergeo-guard.testnet";

async function loadKey(accountId) {
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${accountId}.json`);
  if (!fs.existsSync(credPath)) {
    throw new Error(`Credential file not found at ${credPath}`);
  }
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return KeyPair.fromString(data.private_key || data.secret_key);
}

async function main() {
  console.log("==================================================================");
  console.log(" ScopeGuard: Upgrading Wasm & Unpausing Agent on guard2");
  console.log("==================================================================");
  console.log(`RPC: ${RPC_URL}`);

  const keyStore = new keyStores.InMemoryKeyStore();
  const guardKey = await loadKey(GUARD_ID);
  const ownerKey = await loadKey(OWNER_ID);

  await keyStore.setKey(NETWORK_ID, GUARD_ID, guardKey);
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKey);

  const near = await connect({
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    keyStore,
  });

  // 1. Redeploy updated Wasm to guard2.sergeo-guard.testnet
  const wasmPath = path.join(__dirname, "..", "contracts", "target", "wasm32-unknown-unknown", "release", "policy_contract.wasm");
  console.log(`Reading Wasm from: ${wasmPath}`);
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`Wasm size: ${wasmBytes.length} bytes`);

  const guardAccount = await near.account(GUARD_ID);
  const ownerAccount = await near.account(OWNER_ID);

  console.log(`Deploying updated contract to ${GUARD_ID}...`);
  const deployRes = await guardAccount.deployContract(wasmBytes);
  console.log(`--> Deployed successfully! Tx: ${deployRes.transaction.hash}`);

  // 1b. Call upgrade_v3 to migrate v0.2.0 agent state to v0.3.0
  console.log(`Calling upgrade_v3 for ${TRADER_ID} on ${GUARD_ID}...`);
  const upgradeRes = await guardAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "upgrade_v3",
    args: { agent_accounts: [TRADER_ID] },
    gas: BigInt("100000000000000"), // 100 TGas
  });
  console.log(`--> upgrade_v3 executed successfully! Tx: ${upgradeRes.transaction.hash}`);

  // 2. Unpause agent.sergeo-guard.testnet from sergeo-guard.testnet (owner)
  console.log(`Unpausing ${TRADER_ID} on ${GUARD_ID} from owner ${OWNER_ID}...`);
  const unpauseRes = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "unpause",
    args: { agent_account: TRADER_ID },
    gas: BigInt("30000000000000"),
  });
  console.log(`--> Unpaused successfully! Tx: ${unpauseRes.transaction.hash}`);

  // 3. Query get_budget on guard2
  const budget = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: TRADER_ID },
  });
  console.log("\n--> Live get_budget after upgrade & unpause:");
  console.log(JSON.stringify(budget, null, 2));

  console.log("\n==================================================================");
  console.log(" Upgrade and unpause complete! Agent is ready for demo replay.");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
