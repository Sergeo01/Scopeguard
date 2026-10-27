const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, utils } = require("../sdk/node_modules/near-api-js");

async function transfer() {
  const credPath = path.join(os.homedir(), ".near-credentials", "testnet", "sergeo-guard-dex.testnet.json");
  const cred = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey("testnet", "sergeo-guard-dex.testnet", KeyPair.fromString(cred.private_key || cred.secret_key));
  const near = await connect({ networkId: "testnet", nodeUrl: "https://test.rpc.fastnear.com", keyStore });
  const dex = await near.account("sergeo-guard-dex.testnet");
  console.log("Transferring 5 NEAR from DEX to sergeo-guard.testnet...");
  const tx = await dex.sendMoney("sergeo-guard.testnet", utils.format.parseNearAmount("5"));
  console.log("Transferred! Tx:", tx.transaction.hash);
}
transfer().catch(console.error);
