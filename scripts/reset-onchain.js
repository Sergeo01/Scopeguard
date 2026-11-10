const fs = require("fs");
const path = require("path");
const os = require("os");

let nearApi;
try {
  nearApi = require(path.join(__dirname, "..", "web", "node_modules", "near-api-js"));
} catch {
  nearApi = require("/var/www/scopeguard/web/node_modules/near-api-js");
}
const { connect, keyStores, KeyPair } = nearApi;

async function reset() {
  const credPath = path.join(os.homedir(), ".near-credentials", "testnet", "sergeo-guard.testnet.json");
  const cred = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", "sergeo-guard.testnet", KeyPair.fromString(cred.private_key || cred.secret_key));

  const near = await connect({
    networkId: "testnet",
    nodeUrl: "https://test.rpc.fastnear.com",
    keyStore,
  });

  const owner = await near.account("sergeo-guard.testnet");
  const guardId = "scopeguard.testnet";
  const agentId = "agent.sergeo-guard.testnet";

  console.log("Unpausing agent...");
  try {
    const res1 = await owner.functionCall({
      contractId: guardId,
      methodName: "unpause",
      args: { agent_account: agentId },
      gas: BigInt("30000000000000"),
    });
    console.log("Unpause tx:", res1.transaction.hash);
  } catch (e) {
    console.log("Unpause result:", e.message);
  }

  console.log("Resetting windows...");
  try {
    const res2 = await owner.functionCall({
      contractId: guardId,
      methodName: "reset_windows",
      args: { agent_account: agentId },
      gas: BigInt("30000000000000"),
    });
    console.log("Reset windows tx:", res2.transaction.hash);
  } catch (e) {
    console.log("Reset windows result:", e.message);
  }

  const budget = await owner.viewFunction({
    contractId: guardId,
    methodName: "get_budget",
    args: { agent_account: agentId },
  });
  console.log("Current onchain state:", JSON.stringify(budget, null, 2));
}

reset().catch(console.error);
