const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
const NETWORK_ID = "testnet";

const OWNER_ID = "sergeo-guard.testnet";
const NEW_GUARD_ID = "guard2.sergeo-guard.testnet";
const DEX_ID = "sergeo-guard-dex.testnet";
const TOKEN_ID = "sergeo-guard-token.testnet";
const TRADER_ID = "agent.sergeo-guard.testnet";

async function loadKey(accountId) {
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${accountId}.json`);
  if (!fs.existsSync(credPath)) {
    return null;
  }
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return KeyPair.fromString(data.private_key || data.secret_key);
}

function saveKey(accountId, keyPair) {
  const credDir = path.join(os.homedir(), ".near-credentials", NETWORK_ID);
  fs.mkdirSync(credDir, { recursive: true });
  const credPath = path.join(credDir, `${accountId}.json`);
  const data = {
    account_id: accountId,
    public_key: keyPair.getPublicKey().toString(),
    private_key: keyPair.toString(),
  };
  fs.writeFileSync(credPath, JSON.stringify(data, null, 2));
}

async function main() {
  console.log("==================================================================");
  console.log(" ScopeGuard: Fresh Deployment of Policy Guard Contract (v2)");
  console.log("==================================================================");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Owner: ${OWNER_ID}`);
  console.log(`New Guard Contract: ${NEW_GUARD_ID}`);
  console.log(`Agent Sub-Account: ${TRADER_ID}`);
  console.log(`Vault Token: ${TOKEN_ID}`);

  const keyStore = new keyStores.InMemoryKeyStore();
  const ownerKey = await loadKey(OWNER_ID);
  if (!ownerKey) {
    throw new Error(`Missing owner credential for ${OWNER_ID}`);
  }
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKey);

  const near = await connect({
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    keyStore,
  });

  const ownerAccount = await near.account(OWNER_ID);
  const bal = await ownerAccount.getAccountBalance();
  console.log(`Owner balance: ${utils.format.formatNearAmount(bal.available)} NEAR available`);

  // 1. Check or Create guard2.sergeo-guard.testnet
  let guardKey = await loadKey(NEW_GUARD_ID);
  let guardAccount;

  try {
    guardAccount = await near.account(NEW_GUARD_ID);
    await guardAccount.state();
    console.log(`Account ${NEW_GUARD_ID} already exists.`);
  } catch (err) {
    console.log(`Creating fresh sub-account ${NEW_GUARD_ID} with 5 NEAR funding...`);
    guardKey = KeyPair.fromRandom("ed25519");
    const createTx = await ownerAccount.createAccount(
      NEW_GUARD_ID,
      guardKey.getPublicKey(),
      BigInt(utils.format.parseNearAmount("5"))
    );
    saveKey(NEW_GUARD_ID, guardKey);
    console.log(`Created ${NEW_GUARD_ID}! Tx:`, createTx.transaction.hash);
  }

  if (!guardKey) {
    guardKey = await loadKey(NEW_GUARD_ID);
  }
  await keyStore.setKey(NETWORK_ID, NEW_GUARD_ID, guardKey);
  guardAccount = await near.account(NEW_GUARD_ID);

  // 2. Deploy compiled Wasm to guard2
  const wasmPath = path.join(__dirname, "..", "contracts", "target", "wasm32-unknown-unknown", "release", "policy_contract.wasm");
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`Wasm binary not found at ${wasmPath}. Run cargo build first.`);
  }
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`\nDeploying ${wasmPath} (${wasmBytes.length} bytes) to ${NEW_GUARD_ID}...`);
  const deployTx = await guardAccount.deployContract(wasmBytes);
  console.log("Deployed contract! Tx:", deployTx.transaction.hash);

  // 3. Initialize Contract (new)
  console.log("\nInitializing contract state via new()...");
  try {
    const initTx = await guardAccount.functionCall({
      contractId: NEW_GUARD_ID,
      methodName: "new",
      args: {},
      gas: BigInt("30000000000000"),
    });
    console.log("Initialized contract! Tx:", initTx.transaction.hash);
  } catch (err) {
    console.log("Contract may already be initialized:", err.message);
  }

  // 4. Register Agent on guard2 with Strict Policy
  console.log("\nRegistering agent with strict policy (single-token v1, typed actions, no wildcards)...");
  const policy = {
    token: TOKEN_ID,
    targets: {
      [DEX_ID]: ["swap"],
      [TOKEN_ID]: ["ft_transfer"],
    },
    daily_cap: 500,
    recipients: [OWNER_ID],
    max_actions_per_10min: 5,
    auto_pause_rejects: 3,
    auto_pause_window_minutes: 10,
    high_value_threshold: 250,
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 60,
  };

  try {
    const regTx = await ownerAccount.functionCall({
      contractId: NEW_GUARD_ID,
      methodName: "register_agent",
      args: {
        agent_account: TRADER_ID,
        policy,
      },
      gas: BigInt("30000000000000"),
    });
    console.log("Registered agent! Tx:", regTx.transaction.hash);
  } catch (err) {
    console.log("Register note (already registered):", err.message);
  }

  // 5. Setup Scoped Passkey for Agent on NEW_GUARD_ID
  console.log(`\nSetting up Scoped Passkey on ${TRADER_ID} for ${NEW_GUARD_ID}...`);
  const traderKey = await loadKey(TRADER_ID);
  await keyStore.setKey(NETWORK_ID, TRADER_ID, traderKey);
  const traderAccount = await near.account(TRADER_ID);

  const passkeyPair = KeyPair.fromRandom("ed25519");
  const passkeyPub = passkeyPair.getPublicKey().toString();
  const allowance = BigInt(utils.format.parseNearAmount("0.25"));

  const addKeyTx = await traderAccount.addKey(
    passkeyPub,
    NEW_GUARD_ID,
    ["execute"],
    allowance
  );
  console.log("Added scoped passkey to agent account! Tx:", addKeyTx.transaction.hash);

  // Save passkey credential
  const agentCredDir = path.join(__dirname, "..", "demo-agent", "credentials");
  fs.mkdirSync(agentCredDir, { recursive: true });
  const agentCredPath = path.join(agentCredDir, "agent.json");
  const agentCredData = {
    agentAccountId: TRADER_ID,
    policyContractId: NEW_GUARD_ID,
    publicKey: passkeyPub,
    privateKey: passkeyPair.toString(),
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
  };
  fs.writeFileSync(agentCredPath, JSON.stringify(agentCredData, null, 2));
  console.log("Saved agent credential to:", agentCredPath);

  // 6. Register storage and Fund Vault with real NEP-141 tokens (mUSD)
  console.log(`\nRegistering storage on ${TOKEN_ID} for ${OWNER_ID} and ${NEW_GUARD_ID}...`);
  try {
    await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "storage_deposit",
      args: { account_id: OWNER_ID },
      attachedDeposit: BigInt(utils.format.parseNearAmount("0.00125")),
      gas: BigInt("30000000000000"),
    });
    console.log(`Storage registered for ${OWNER_ID}.`);
  } catch (err) {
    console.log("Storage deposit note (owner):", err.message);
  }

  try {
    await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "storage_deposit",
      args: { account_id: NEW_GUARD_ID },
      attachedDeposit: BigInt(utils.format.parseNearAmount("0.00125")),
      gas: BigInt("30000000000000"),
    });
    console.log(`Storage registered for ${NEW_GUARD_ID}.`);
  } catch (err) {
    console.log("Storage deposit note (guard):", err.message);
  }

  // Mint tokens to owner from faucet
  try {
    await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "mint_faucet",
      args: { amount: "1000" },
      gas: BigInt("30000000000000"),
    });
    console.log("Minted 1,000 mUSD to owner for funding.");
  } catch (err) {
    console.log("Mint faucet note:", err.message);
  }

  // Transfer 100 mUSD into vault via ft_transfer_call
  console.log(`Depositing 100 mUSD into ${NEW_GUARD_ID} via ft_transfer_call...`);
  const depositTx = await ownerAccount.functionCall({
    contractId: TOKEN_ID,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: NEW_GUARD_ID,
      amount: "100",
      msg: TRADER_ID, // deposits into agent.sergeo-guard.testnet's vault pot
    },
    attachedDeposit: BigInt(1), // 1 yoctoNEAR
    gas: BigInt("60000000000000"),
  });
  console.log("Deposited 100 mUSD into agent vault! Tx:", depositTx.transaction.hash);

  // 7. Verification: Call get_budget on live contract
  console.log("\nVerifying live contract state via get_budget...");
  const budget = await ownerAccount.viewFunction({
    contractId: NEW_GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: TRADER_ID },
  });
  console.log("Live get_budget result:", budget);

  console.log("\n==================================================================");
  console.log(" Deployment and Initialization SUCCESSFUL!");
  console.log(` Guard: ${NEW_GUARD_ID}`);
  console.log(` Vault Balance: ${budget.vault_balance} mUSD`);
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
