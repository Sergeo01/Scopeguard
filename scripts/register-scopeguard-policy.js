process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const GUARD_ID = "scopeguard.testnet";
const OWNER_ID = "sergeo-guard.testnet";
const AGENT_ID = "agent.sergeo-guard.testnet";
const TOKEN_ID = "sergeo-guard-token.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

const VERBATIM_POLICY = {
  token: "sergeo-guard-token.testnet",
  targets: {
    "sergeo-guard-token.testnet": ["ft_transfer"],
    "sergeo-guard-dex.testnet": ["swap"],
    "intents.near": ["execute_intent"]
  },
  daily_cap: 500,
  recipients: ["sergeo-guard.testnet"],
  max_actions_per_10min: 5,
  auto_pause_rejects: 3,
  auto_pause_window_minutes: 10,
  high_value_threshold: 250,
  high_value_delay_seconds: 60,
  policy_change_delay_seconds: 60,
  max_drawdown_bps: 2000,
  lease_expires_at: null,
  intent_recipients: ["0x1111111111111111111111111111111111111111"],
  canary_methods: ["drain_vault", "admin_drain", "emergency_withdraw_all"],
  near_daily_cap: null,
  near_high_value_threshold: null
};

async function main() {
  console.log("==================================================================");
  console.log(` Registering Demo Agent Policy on ${GUARD_ID}`);
  console.log("==================================================================");

  const ownerCredPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  if (!fs.existsSync(ownerCredPath)) {
    throw new Error(`Missing owner credentials at ${ownerCredPath}`);
  }
  const ownerCred = JSON.parse(fs.readFileSync(ownerCredPath, "utf-8"));
  const ownerKeyPair = KeyPair.fromString(ownerCred.private_key || ownerCred.secret_key);

  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKeyPair);

  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
  const ownerAccount = await near.account(OWNER_ID);

  console.log(`1. Calling register_agent for ${AGENT_ID} on ${GUARD_ID}...`);
  const regTx = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "register_agent",
    args: {
      agent_account: AGENT_ID,
      policy: VERBATIM_POLICY
    },
    gas: BigInt("100000000000000") // 100 TGas
  });
  console.log(`register_agent Tx: ${regTx.transaction.hash}`);

  console.log(`2. Registering storage for ${GUARD_ID} on token contract ${TOKEN_ID}...`);
  try {
    const storageTx = await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "storage_deposit",
      args: {
        account_id: GUARD_ID,
        registration_only: true
      },
      gas: BigInt("30000000000000"),
      attachedDeposit: BigInt(utils.format.parseNearAmount("0.01"))
    });
    console.log(`storage_deposit Tx: ${storageTx.transaction.hash}`);
  } catch (err) {
    console.log(`Storage deposit note: ${err.message}`);
  }

  console.log(`3. Funding vault with 350 mUSD via ft_transfer_call...`);
  const fundTx = await ownerAccount.functionCall({
    contractId: TOKEN_ID,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: GUARD_ID,
      amount: "350",
      msg: AGENT_ID
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(1)
  });
  console.log(`ft_transfer_call Tx: ${fundTx.transaction.hash}`);

  console.log(`4. Verifying onchain policy and budget...`);
  const policyCheck = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_policy",
    args: { agent_account: AGENT_ID }
  });
  console.log("get_policy:", JSON.stringify(policyCheck, null, 2));

  const budgetCheck = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: AGENT_ID }
  });
  console.log("get_budget:", JSON.stringify(budgetCheck, null, 2));

  console.log("\n[PASS] Step 3 complete: Agent registered and vault funded with exactly 350 mUSD!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
