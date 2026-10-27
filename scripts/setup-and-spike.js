const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
const NETWORK_ID = "testnet";

const OWNER_ID = "sergeo-guard.testnet";
const GUARD_ID = "guard.sergeo-guard.testnet";
const DEX_ID = "sergeo-guard-dex.testnet";
const TOKEN_ID = "sergeo-guard-token.testnet";
const TRADER_ID = "trader.sergeo-guard.testnet";

async function loadKey(accountId) {
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${accountId}.json`);
  if (!fs.existsSync(credPath)) {
    throw new Error(`Missing credential file: ${credPath}`);
  }
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return KeyPair.fromString(data.private_key || data.secret_key);
}

async function run() {
  console.log("=== ScopeGuard Testnet Setup & Protocol Spike ===");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Owner: ${OWNER_ID}`);
  console.log(`Guard: ${GUARD_ID}`);
  console.log(`DEX: ${DEX_ID}`);
  console.log(`Trader Agent: ${TRADER_ID}`);

  const keyStore = new keyStores.InMemoryKeyStore();
  const ownerKey = await loadKey(OWNER_ID);
  const traderKey = await loadKey(TRADER_ID);
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKey);
  await keyStore.setKey(NETWORK_ID, TRADER_ID, traderKey);

  const near = await connect({
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    keyStore,
  });

  const ownerAccount = await near.account(OWNER_ID);
  const traderAccount = await near.account(TRADER_ID);

  // 1. Register agent on Guard contract with Timelocked Policy
  console.log("\n[1] Checking / Registering Agent on Guard Policy Contract...");
  const existingBudget = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: TRADER_ID },
  });

  if (existingBudget) {
    console.log("Agent already registered. Existing budget:", existingBudget);
  } else {
    console.log("Agent not registered yet. Registering now with initial policy...");
    const policy = {
      targets: {
        [DEX_ID]: ["swap"],
      },
      daily_cap: 500,
      recipients: [OWNER_ID],
      max_actions_per_10min: 5,
      auto_pause_rejects: 3,
      auto_pause_window_minutes: 10,
      high_value_threshold: 250, // 50% cap
      high_value_delay_seconds: 60, // 60s for testnet verification
      policy_change_delay_seconds: 60,
    };

    const res = await ownerAccount.functionCall({
      contractId: GUARD_ID,
      methodName: "register_agent",
      args: {
        agent_account: TRADER_ID,
        policy,
      },
      gas: BigInt("30000000000000"),
    });
    console.log("Registered agent! Tx:", res.transaction.hash);
  }

  // 2. Generate and Add Scoped Passkey for Agent
  console.log("\n[2] Setting up Agent Scoped Passkey (Function-Call Key)...");
  const agentCredDir = path.join(__dirname, "..", "demo-agent", "credentials");
  fs.mkdirSync(agentCredDir, { recursive: true });
  const agentCredPath = path.join(agentCredDir, "agent.json");

  let passkeyPair;
  if (fs.existsSync(agentCredPath)) {
    const existing = JSON.parse(fs.readFileSync(agentCredPath, "utf-8"));
    passkeyPair = KeyPair.fromString(existing.privateKey);
    console.log("Loaded existing agent passkey:", passkeyPair.getPublicKey().toString());
  } else {
    passkeyPair = KeyPair.fromRandom("ed25519");
    console.log("Generated fresh agent passkey:", passkeyPair.getPublicKey().toString());
  }

  const passkeyPub = passkeyPair.getPublicKey().toString();

  // Check if key is already added to trader account
  const currentKeys = await traderAccount.getAccessKeys();
  const hasPasskey = currentKeys.some((k) => k.public_key === passkeyPub);

  if (!hasPasskey) {
    console.log(`Adding Function-Call Key to ${TRADER_ID} strictly scoped to ${GUARD_ID} and method ["execute"]...`);
    const allowance = utils.format.parseNearAmount("0.25"); // 0.25 NEAR gas allowance
    const res = await traderAccount.addKey(
      passkeyPub,
      GUARD_ID,
      ["execute"],
      allowance
    );
    console.log("Scoped Passkey successfully added! Tx:", res.transaction.hash);
  } else {
    console.log("Passkey already attached to trader account.");
  }

  // Save the passkey to agent credential file (holding ONLY this passkey, never the master key)
  const agentCredData = {
    agentAccountId: TRADER_ID,
    policyContractId: GUARD_ID,
    publicKey: passkeyPub,
    privateKey: passkeyPair.toString(),
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
  };
  fs.writeFileSync(agentCredPath, JSON.stringify(agentCredData, null, 2));
  console.log("Agent credential file written to:", agentCredPath);

  // 3. PROTOCOL-LEVEL SPIKE VERIFICATIONS
  console.log("\n[3] Conducting Protocol Enforcement Spike...");
  // Create an isolated KeyStore representing ONLY the agent's machine holding the passkey
  const agentOnlyKeyStore = new keyStores.InMemoryKeyStore();
  await agentOnlyKeyStore.setKey(NETWORK_ID, TRADER_ID, passkeyPair);
  const agentNear = await connect({
    networkId: NETWORK_ID,
    nodeUrl: RPC_URL,
    keyStore: agentOnlyKeyStore,
  });
  const agentScopedAccount = await agentNear.account(TRADER_ID);

  // Spike Test A: Authorized call to Guard execute (Legit swap below threshold)
  console.log("\n--- Test A: Authorized execution through Guard (Swap 50 mUSD to authorized recipient) ---");
  try {
    const resA = await agentScopedAccount.functionCall({
      contractId: GUARD_ID,
      methodName: "execute",
      args: {
        target: DEX_ID,
        method: "swap",
        args: JSON.stringify({ amount: "50" }),
        amount: "50",
        recipient: OWNER_ID,
      },
      gas: BigInt("50000000000000"),
    });
    const parsedA = JSON.parse(Buffer.from(resA.status.SuccessValue, "base64").toString());
    console.log("Outcome from Guard:", parsedA);
    if (parsedA.status === "ALLOWED") {
      console.log("SUCCESS: Authorized action passed all 7 checks and executed!");
    } else {
      console.log("Outcome status:", parsedA.status, parsedA.reason);
    }
  } catch (e) {
    console.error("Test A unexpected error:", e.message);
  }

  // Spike Test B: High-Value Timelock Veto Queue (Amount 300 mUSD >= threshold 250)
  console.log("\n--- Test B: Timelock Veto Queue (Amount 300 mUSD >= 250 threshold) ---");
  let queuedPendingId = null;
  try {
    const resB = await agentScopedAccount.functionCall({
      contractId: GUARD_ID,
      methodName: "execute",
      args: {
        target: DEX_ID,
        method: "swap",
        args: JSON.stringify({ amount: "300" }),
        amount: "300",
        recipient: OWNER_ID,
      },
      gas: BigInt("50000000000000"),
    });
    const parsedB = JSON.parse(Buffer.from(resB.status.SuccessValue, "base64").toString());
    console.log("Outcome from Guard:", parsedB);
    if (parsedB.status === "PENDING") {
      queuedPendingId = parsedB.pending_id;
      console.log(`SUCCESS: High-value action entered timelock veto queue with pending_id=${queuedPendingId}!`);
    } else {
      console.log("Outcome status:", parsedB.status, parsedB.reason);
    }
  } catch (e) {
    console.error("Test B unexpected error:", e.message);
  }

  // Spike Test B2: Verify Queued Pending Action via View Call
  console.log("\n--- Test B2: Query Pending Queue via View Function ---");
  try {
    const pendingList = await ownerAccount.viewFunction({
      contractId: GUARD_ID,
      methodName: "get_pending_actions",
      args: { agent_account: TRADER_ID },
    });
    console.log("Current Pending Queue onchain:", pendingList);
    if (pendingList.length > 0 && pendingList.some((p) => p.id === queuedPendingId)) {
      console.log("SUCCESS: Pending action is visible in public onchain timelock queue!");
    }
  } catch (e) {
    console.error("Test B2 error:", e.message);
  }

  // Spike Test B3: Owner Immediate Veto of Pending High-Value Action
  if (queuedPendingId !== null) {
    console.log(`\n--- Test B3: Owner Veto (Immediate Cancel of Pending Action ${queuedPendingId}) ---`);
    try {
      const cancelRes = await ownerAccount.functionCall({
        contractId: GUARD_ID,
        methodName: "cancel_pending",
        args: {
          agent_account: TRADER_ID,
          id: queuedPendingId,
        },
        gas: BigInt("30000000000000"),
      });
      console.log("Owner cancelled pending action! Tx:", cancelRes.transaction.hash);
      const afterCancel = await ownerAccount.viewFunction({
        contractId: GUARD_ID,
        methodName: "get_pending_actions",
        args: { agent_account: TRADER_ID },
      });
      console.log("Pending Queue after Owner Veto:", afterCancel);
      console.log("SUCCESS: Owner veto cancelled pending action with 0 delay!");
    } catch (e) {
      console.error("Test B3 error:", e.message);
    }
  }

  // Spike Test C: Protocol Rejection on Unauthorized Target (Bypass Attempt)
  console.log("\n--- Test C: Direct Call to DEX Bypassing Guard (Protocol Enforcement) ---");
  try {
    await agentScopedAccount.functionCall({
      contractId: DEX_ID,
      methodName: "swap",
      args: { amount: "10" },
      gas: BigInt("30000000000000"),
    });
    console.error("FAILURE: Call should have been blocked by NEAR protocol!");
  } catch (err) {
    console.log("SUCCESS: NEAR protocol blocked direct call!");
    console.log("Protocol Error Message:", err.message);
  }

  // Spike Test D: Protocol Rejection on Unauthorized Method on Guard
  console.log("\n--- Test D: Unauthorized Method Call on Guard Contract (Protocol Enforcement) ---");
  try {
    await agentScopedAccount.functionCall({
      contractId: GUARD_ID,
      methodName: "cancel_policy_change",
      args: { agent_account: TRADER_ID },
      gas: BigInt("20000000000000"),
    });
    console.error("FAILURE: Call should have been blocked by NEAR protocol!");
  } catch (err) {
    console.log("SUCCESS: NEAR protocol blocked unauthorized method call!");
    console.log("Protocol Error Message:", err.message);
  }

  // Spike Test E: Protocol Rejection on Direct Value Transfer (Drain Attempt)
  console.log("\n--- Test E: Direct NEAR Transfer / Drain Attempt (Protocol Enforcement) ---");
  try {
    await agentScopedAccount.sendMoney(OWNER_ID, utils.format.parseNearAmount("0.1"));
    console.error("FAILURE: Direct transfer should have been blocked by NEAR protocol!");
  } catch (err) {
    console.log("SUCCESS: NEAR protocol blocked direct value transfer!");
    console.log("Protocol Error Message:", err.message);
  }

  console.log("\n=== All Protocol Spike Verifications Complete! ===");
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
