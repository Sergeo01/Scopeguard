process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const GUARD_ID = "scopeguard.testnet";
const OWNER_ID = "sergeo-guard.testnet";
const AGENT_ID = "agent.sergeo-guard.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = "https://rpc.testnet.near.org";

async function main() {
  console.log(`Withdrawing 350 mUSD from ${GUARD_ID} for agent ${AGENT_ID} back to owner ${OWNER_ID}...`);

  const ownerCredPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  const ownerCred = JSON.parse(fs.readFileSync(ownerCredPath, "utf-8"));
  const ownerKeyPair = KeyPair.fromString(ownerCred.private_key || ownerCred.secret_key);

  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKeyPair);

  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
  const ownerAccount = await near.account(OWNER_ID);

  const outcome = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "withdraw",
    args: {
      agent_account: AGENT_ID,
      amount: "350"
    },
    gas: "100000000000000", // 100 TGas
    attachedDeposit: "0"
  });

  const txHash = outcome.transaction.hash;
  console.log(`Withdrawal successful! Tx Hash: ${txHash}`);
}

main().catch(err => {
  console.error("Withdrawal error:", err);
  process.exit(1);
});
