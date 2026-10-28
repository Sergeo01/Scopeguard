const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org";
const NETWORK_ID = process.env.NEAR_NETWORK || "testnet";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const GUARD_ID = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
const TRADER_ID = process.env.SCOPEGUARD_AGENT_ACCOUNT || "trader.sergeo-guard.testnet";

async function loadOwnerKey() {
  if (process.env.OWNER_PRIVATE_KEY) {
    return KeyPair.fromString(process.env.OWNER_PRIVATE_KEY);
  }
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  if (!fs.existsSync(credPath)) {
    throw new Error(`Owner credentials not found at ${credPath} or in OWNER_PRIVATE_KEY environment variable.`);
  }
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return KeyPair.fromString(data.private_key || data.secret_key);
}

async function main() {
  console.log("==================================================================");
  console.log(" ScopeGuard: One-Command Testnet Demo Reset & State Verifier");
  console.log("==================================================================");
  console.log(`RPC:     ${RPC_URL}`);
  console.log(`Guard:   ${GUARD_ID}`);
  console.log(`Agent:   ${TRADER_ID}`);
  console.log(`Owner:   ${OWNER_ID}`);

  const isDryRun = process.argv.includes("--dry-run") || process.argv.includes("--status");
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  const hasOwnerKey = Boolean(process.env.OWNER_PRIVATE_KEY) || fs.existsSync(credPath);

  const keyStore = new keyStores.InMemoryKeyStore();
  if (hasOwnerKey && !isDryRun) {
    const ownerKey = await loadOwnerKey();
    await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKey);
  }

  const near = await connect({
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    keyStore,
  });

  const account = await near.account(OWNER_ID);

  // 1. Query current budget and pause state via view method
  const budget = await account.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: TRADER_ID },
  });

  console.log("\n[Step 1] Inspecting Current Onchain State...");
  console.log(`  Paused:        ${budget.paused}`);
  console.log(`  Remaining:     ${budget.remaining} mUSD (Cap: ${budget.cap})`);
  console.log(`  Vault Balance: ${budget.vault_balance} mUSD`);

  // 2. Query access keys on agent account to verify restricted passkey status
  try {
    const keyQuery = await near.connection.provider.query({
      request_type: "view_access_key_list",
      finality: "final",
      account_id: TRADER_ID,
    });
    console.log(`  Access Keys:   ${keyQuery.keys.length} key(s) registered on NEAR consensus.`);
    for (const k of keyQuery.keys) {
      const perm = k.access_key.permission;
      if (typeof perm === "string") {
        console.log(`    - ${k.public_key.slice(0, 16)}... [${perm}]`);
      } else {
        console.log(`    - ${k.public_key.slice(0, 16)}... [FunctionCall -> ${perm.FunctionCall.receiver_id}::${perm.FunctionCall.method_names.join(",")}]`);
      }
    }
  } catch (keyErr) {
    console.warn("  Could not fetch access key list:", keyErr.message);
  }

  // 3. Inspect Timelock Quarantine
  const pendingActions = await account.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_pending_actions",
    args: { agent_account: TRADER_ID },
  });
  console.log(`\n[Step 2] Checking Timelock Queue: ${pendingActions.length} item(s) pending.`);

  if (isDryRun || !hasOwnerKey) {
    console.log("\n==================================================================");
    console.log(" Read-Only Inspection Complete (--dry-run / observer mode)");
    console.log("==================================================================");
    if (!hasOwnerKey) {
      console.log(" Note: To submit onchain state resets, configure owner key in ~/.near-credentials.");
    }
    return;
  }

  // 4. Unpause if paused (Owner signing required)
  if (budget.paused) {
    console.log("\n[Step 3] Agent is paused. Submitting unpause transaction...");
    const unpauseRes = await account.functionCall({
      contractId: GUARD_ID,
      methodName: "unpause",
      args: { agent_account: TRADER_ID },
      gas: BigInt("30000000000000"),
    });
    console.log(`  --> Successfully unpaused! Tx: ${unpauseRes.transaction.hash}`);
  } else {
    console.log("\n[Step 3] Agent is already active (unpaused).");
  }

  // 5. Clear pending timelock actions queue if any
  for (const item of pendingActions) {
    console.log(`  Vetoing quarantined pending intent #${item.id} (${item.amount} mUSD)...`);
    const cancelRes = await account.functionCall({
      contractId: GUARD_ID,
      methodName: "cancel_pending",
      args: { agent_account: TRADER_ID, id: item.id },
      gas: BigInt("30000000000000"),
    });
    console.log(`  --> Cancelled intent #${item.id}! Tx: ${cancelRes.transaction.hash}`);
  }

  // 4. Final verification
  const finalBudget = await account.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: TRADER_ID },
  });

  const finalPending = await account.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_pending_actions",
    args: { agent_account: TRADER_ID },
  });

  console.log("\n==================================================================");
  console.log(" Demo Reset Complete: Ready for Live Evaluation and Replay");
  console.log("==================================================================");
  console.log(`  Agent:         ${TRADER_ID}`);
  console.log(`  Status:        ${finalBudget.paused ? "PAUSED" : "ACTIVE (Ready)"}`);
  console.log(`  Pending Queue: ${finalPending.length} items`);
  console.log(`  Vault Balance: ${finalBudget.vault_balance} mUSD`);
  console.log(`  Spend Limit:   ${finalBudget.remaining} mUSD available`);
  console.log("==================================================================\n");
}

main().catch((err) => {
  console.error("FATAL ERROR resetting demo state:", err.message);
  process.exit(1);
});
