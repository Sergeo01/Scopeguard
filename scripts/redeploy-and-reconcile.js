const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
const NETWORK_ID = "testnet";

const OWNER_ID = "sergeo-guard.testnet";
const GUARD_ID = "guard2.sergeo-guard.testnet";
const TRADER_ID = "agent.sergeo-guard.testnet";
const DEX_ID = "sergeo-guard-dex.testnet";
const TOKEN_ID = "sergeo-guard-token.testnet";

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
  console.log(" ScopeGuard: Single Batched Redeploy & State Reconciliation");
  console.log(" Includes: Preflight View + First-Use Quarantine on guard2");
  console.log("==================================================================");
  console.log(`RPC:     ${RPC_URL}`);
  console.log(`Guard:   ${GUARD_ID}`);
  console.log(`Owner:   ${OWNER_ID}`);
  console.log(`Agent:   ${TRADER_ID}`);

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

  const guardAccount = await near.account(GUARD_ID);
  const ownerAccount = await near.account(OWNER_ID);

  // 1. Deploy compiled Wasm to guard2
  const wasmPath = path.join(__dirname, "..", "contracts", "target", "wasm32-unknown-unknown", "release", "policy_contract.wasm");
  console.log(`\n[1/6] Reading Wasm from: ${wasmPath}`);
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`      Wasm size: ${wasmBytes.length} bytes`);

  console.log(`      Deploying contract wasm to ${GUARD_ID}...`);
  const deployRes = await guardAccount.deployContract(wasmBytes);
  console.log(`      Contract deployed! Tx: ${deployRes.transaction.hash}`);

  // 2. Call migrate to cleanly initialize state
  console.log(`\n[2/6] Initializing state via migrate()...`);
  const migrateRes = await guardAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "migrate",
    args: {},
    gas: BigInt("30000000000000"),
  });
  console.log(`      Migrate completed! Tx: ${migrateRes.transaction.hash}`);

  // 3. Register Agent with Hardened Policy
  console.log(`\n[3/6] Registering ${TRADER_ID} with hardened policy...`);
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

  const regRes = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "register_agent",
    args: {
      agent_account: TRADER_ID,
      policy,
    },
    gas: BigInt("30000000000000"),
  });
  console.log(`      Agent registered! Tx: ${regRes.transaction.hash}`);

  // 4. Ensure storage is registered and deposit 350 mUSD into Vault
  console.log(`\n[4/6] Registering storage and funding agent vault with 350 mUSD...`);
  try {
    await ownerAccount.functionCall({
      contractId: TOKEN_ID,
      methodName: "storage_deposit",
      args: { account_id: GUARD_ID },
      attachedDeposit: BigInt(utils.format.parseNearAmount("0.00125")),
      gas: BigInt("30000000000000"),
    });
  } catch (err) {
    // Already registered
  }

  const depositRes = await ownerAccount.functionCall({
    contractId: TOKEN_ID,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: GUARD_ID,
      amount: "350",
      msg: TRADER_ID,
    },
    attachedDeposit: BigInt(1),
    gas: BigInt("60000000000000"),
  });
  console.log(`      Vault funded with 350 mUSD! Tx: ${depositRes.transaction.hash}`);

  // 5. Verify live onchain state
  console.log(`\n[5/6] Verifying onchain budget and unconfirmed recipients...`);
  const budget = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: TRADER_ID },
  });
  console.log(`      Budget: Vault=${budget.vault_balance} mUSD, Remaining=${budget.remaining}/${budget.cap}, Paused=${budget.paused}`);

  const unconfirmed = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_unconfirmed_recipients",
    args: { agent_account: TRADER_ID },
  });
  console.log(`      Unconfirmed Recipients: [${unconfirmed.join(", ")}]`);

  // 6. Test onchain preflight view
  console.log(`\n[6/6] Testing live onchain preflight view...`);
  const preflightSwap = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "preflight",
    args: {
      agent_account: TRADER_ID,
      action: {
        Swap: {
          dex: DEX_ID,
          token_in: TOKEN_ID,
          amount_in: "25",
          min_out: "20",
        },
      },
    },
  });
  console.log("      Preflight Swap Result:", JSON.stringify(preflightSwap));

  const preflightForbidden = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "preflight",
    args: {
      agent_account: TRADER_ID,
      action: {
        Transfer: {
          token: TOKEN_ID,
          to: "attacker.testnet",
          amount: "100",
          memo: "illegal drain",
        },
      },
    },
  });
  console.log("      Preflight Forbidden Result:", JSON.stringify(preflightForbidden));

  console.log("\n==================================================================");
  console.log(" SUCCESS: Single Guard redeploy and reconciliation complete!");
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
