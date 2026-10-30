const { connect, keyStores, utils } = require("../sdk/node_modules/near-api-js");

async function check() {
  const near = await connect({ networkId: "testnet", nodeUrl: "https://test.rpc.fastnear.com", keyStore: new keyStores.InMemoryKeyStore() });
  for (const accId of ["sergeo-guard.testnet", "guard.sergeo-guard.testnet", "agent.sergeo-guard.testnet", "sergeo-guard-dex.testnet", "sergeo-guard-token.testnet"]) {
    try {
      const a = await near.account(accId);
      const b = await a.getAccountBalance();
      console.log(accId, "total:", utils.format.formatNearAmount(b.total), "available:", utils.format.formatNearAmount(b.available));
    } catch(e) { console.log(accId, "error:", e.message); }
  }
}
check();
