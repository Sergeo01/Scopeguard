process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, transactions, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const OWNER_ID = "sergeo-guard.testnet";
const AGENT2_ID = "agent2.sergeo-guard.testnet";
const GUARD_ID = "scopeguard.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = "https://rpc.testnet.near.org";

async function main() {
  console.log(`Creating subaccount ${AGENT2_ID} under ${OWNER_ID}...`);

  // Generate fresh random ED25519 key for agent2
  const agent2KeyPair = KeyPair.fromRandom("ed25519");
  const agent2PubKey = agent2KeyPair.getPublicKey().toString();
  const agent2PrivKey = agent2KeyPair.toString();

  console.log(`Generated Agent2 Public Key: ${agent2PubKey}`);

  // Load owner key
  const ownerCredPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  const ownerCred = JSON.parse(fs.readFileSync(ownerCredPath, "utf-8"));
  const ownerKeyPair = KeyPair.fromString(ownerCred.private_key || ownerCred.secret_key);

  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKeyPair);

  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
  const ownerAccount = await near.account(OWNER_ID);

  // Allowance: 0.25 NEAR = 250000000000000000000000 yoctoNEAR
  const allowance = BigInt("250000000000000000000000");

  const functionCallPerm = transactions.functionCallAccessKey(
    GUARD_ID,
    ["execute"],
    allowance
  );

  const actions = [
    transactions.createAccount(),
    transactions.transfer(BigInt("200000000000000000000000")), // 0.2 NEAR storage
    transactions.addKey(utils.PublicKey.from(agent2PubKey), functionCallPerm)
  ];

  console.log(`Broadcasting createAccount + addKey for ${AGENT2_ID}...`);
  const outcome = await ownerAccount.signAndSendTransaction({
    receiverId: AGENT2_ID,
    actions
  });

  const txHash = outcome.transaction.hash;
  console.log(`Agent2 created successfully! Tx Hash: ${txHash}`);

  // Save agent2 credentials locally in demo-agent/credentials/agent2.json and update agent.json
  const creds = {
    agentAccountId: AGENT2_ID,
    policyContractId: GUARD_ID,
    publicKey: agent2PubKey,
    privateKey: agent2PrivKey,
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    created_at: new Date().toISOString()
  };

  const agent2CredPath = path.join(__dirname, "..", "demo-agent", "credentials", "agent2.json");
  const agentCredPath = path.join(__dirname, "..", "demo-agent", "credentials", "agent.json");
  fs.writeFileSync(agent2CredPath, JSON.stringify(creds, null, 2), "utf-8");
  fs.writeFileSync(agentCredPath, JSON.stringify(creds, null, 2), "utf-8");

  console.log(`Saved credentials to ${agent2CredPath} and ${agentCredPath}`);

  // Also print private key to stdout so we can configure .env.local
  console.log(`AGENT2_PUBLIC_KEY=${agent2PubKey}`);
  console.log(`AGENT2_PRIVATE_KEY=${agent2PrivKey}`);
}

main().catch(err => {
  console.error("Account creation error:", err);
  process.exit(1);
});
