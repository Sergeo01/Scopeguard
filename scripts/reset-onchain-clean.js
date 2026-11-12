process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const GUARD_ID = "scopeguard.testnet";
const OWNER_ID = "sergeo-guard.testnet";
const AGENT_ID = "agent2.sergeo-guard.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = "https://rpc.testnet.near.org";

async function main() {
  const ownerCredPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  const ownerCred = JSON.parse(fs.readFileSync(ownerCredPath, "utf-8"));
  const ownerKeyPair = KeyPair.fromString(ownerCred.private_key || ownerCred.secret_key);

  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKeyPair);

  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
  const ownerAccount = await near.account(OWNER_ID);

  console.log("1. Calling unpause...");
  const unpTx = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "unpause",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("unpause Tx:", unpTx.transaction.hash);

  console.log("2. Calling reset_windows...");
  const resTx = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "reset_windows",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("reset_windows Tx:", resTx.transaction.hash);

  console.log("3. Querying clean budget...");
  const budget = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: AGENT_ID },
  });
  console.log("Budget after reset:", JSON.stringify(budget, null, 2));
}

main().catch(console.error);
