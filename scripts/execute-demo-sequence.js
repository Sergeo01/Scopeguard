const path = require("path");
const fs = require("fs");
const os = require("os");
const { connect, keyStores, KeyPair } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));
const { getPolicyContractId } = require(path.join(__dirname, "..", "sdk", "dist", "config"));

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
const NETWORK_ID = "testnet";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const GUARD_ID = getPolicyContractId();
const DEX_ID = process.env.SCOPEGUARD_DEX_CONTRACT || "sergeo-guard-dex.testnet";
const TOKEN_ID = process.env.SCOPEGUARD_TOKEN_CONTRACT || "sergeo-guard-token.testnet";
const AGENT_ID = process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent.sergeo-guard.testnet";

async function loadOwnerKey() {
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return KeyPair.fromString(data.private_key || data.secret_key);
}

async function loadAgentKey() {
  const credPath = path.join(__dirname, "..", "demo-agent", "credentials", "agent.json");
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return KeyPair.fromString(data.privateKey);
}

function parseOutcome(txRes) {
  if (!txRes?.status?.SuccessValue) return null;
  try {
    return JSON.parse(Buffer.from(txRes.status.SuccessValue, "base64").toString());
  } catch {
    return null;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("==================================================================");
  console.log(" ScopeGuard Live Testnet Demo Sequence (Ordered Verification)");
  console.log(" Evaluated directly on NEAR Testnet Consensus");
  console.log("==================================================================");
  console.log("RPC:     ", RPC_URL);
  console.log("Guard:   ", GUARD_ID);
  console.log("Token:   ", TOKEN_ID);
  console.log("DEX:     ", DEX_ID);
  console.log("Owner:   ", OWNER_ID);
  console.log("Agent:   ", AGENT_ID);

  const ownerKeyStore = new keyStores.InMemoryKeyStore();
  await ownerKeyStore.setKey(NETWORK_ID, OWNER_ID, await loadOwnerKey());
  const ownerNear = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore: ownerKeyStore });
  const ownerAccount = await ownerNear.account(OWNER_ID);

  const agentKeyStore = new keyStores.InMemoryKeyStore();
  await agentKeyStore.setKey(NETWORK_ID, AGENT_ID, await loadAgentKey());
  const agentNear = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore: agentKeyStore });
  const agentAccount = await agentNear.account(AGENT_ID);

  const getBudget = async () => {
    return await ownerAccount.viewFunction({
      contractId: GUARD_ID,
      methodName: "get_budget",
      args: { agent_account: AGENT_ID },
    });
  };

  const logRow = [];

  // Pre-flight check & cleanup
  console.log("\n[Preflight] Resetting windows and clearing any stale items...");
  const preBudget = await getBudget();
  if (preBudget.paused) {
    console.log("  Agent currently paused; unpausing...");
    const unpauseRes = await ownerAccount.functionCall({
      contractId: GUARD_ID,
      methodName: "unpause",
      args: { agent_account: AGENT_ID },
      gas: BigInt("30000000000000"),
    });
    console.log("  Unpause Tx:", unpauseRes.transaction.hash);
  }

  const prePending = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_pending_actions",
    args: { agent_account: AGENT_ID },
  });
  for (const item of prePending) {
    console.log(`  Cancelling existing pending item #${item.id}...`);
    const cRes = await ownerAccount.functionCall({
      contractId: GUARD_ID,
      methodName: "cancel_pending",
      args: { agent_account: AGENT_ID, id: item.id },
      gas: BigInt("30000000000000"),
    });
    console.log(`  Cancelled #${item.id} Tx:`, cRes.transaction.hash);
  }

  const initReset = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "reset_windows",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  Initial reset_windows Tx:", initReset.transaction.hash);

  // -------------------------------------------------------------
  // Step 1: Legit swap (25 mUSD on DEX)
  // -------------------------------------------------------------
  console.log("\n[Step 1] Legit Swap: 25 mUSD on DEX...");
  const b1Before = await getBudget();
  const tx1 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Swap: {
          dex: DEX_ID,
          token_in: TOKEN_ID,
          amount_in: "25",
          min_out: "0",
        },
      },
    },
    gas: BigInt("100000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o1 = parseOutcome(tx1);
  const b1After = await getBudget();
  console.log("  Tx Hash: ", tx1.transaction.hash);
  console.log("  Outcome: ", JSON.stringify(o1));
  console.log(`  Budget:   Spent ${b1After.spent} / ${b1After.cap} (Remaining: ${b1After.remaining})`);
  logRow.push({
    step: 1,
    name: "Legitimate Swap (25 mUSD on DEX)",
    hash: tx1.transaction.hash,
    status: o1.status,
    reason: o1.reason || "None (ALLOWED)",
    spent: b1After.spent,
    remaining: b1After.remaining,
    paused: b1After.paused,
  });

  // -------------------------------------------------------------
  // Step 2: Non-allowlisted recipient (sweep to outside account)
  // -------------------------------------------------------------
  console.log("\n[Step 2] Non-allowlisted recipient (sweep to attacker.testnet)...");
  const tx2 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Transfer: {
          token: TOKEN_ID,
          to: "attacker.testnet",
          amount: "100",
          memo: null,
        },
      },
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o2 = parseOutcome(tx2);
  const b2After = await getBudget();
  console.log("  Tx Hash: ", tx2.transaction.hash);
  console.log("  Outcome: ", JSON.stringify(o2));
  logRow.push({
    step: 2,
    name: "Non-allowlisted Recipient (Sweep to attacker.testnet)",
    hash: tx2.transaction.hash,
    status: o2.status,
    reason: o2.reason,
    spent: b2After.spent,
    remaining: b2After.remaining,
    paused: b2After.paused,
  });

  // -------------------------------------------------------------
  // Step 3: Unlisted target (evil_contract.testnet)
  // -------------------------------------------------------------
  console.log("\n[Step 3] Unlisted Target (Call evil_contract.testnet)...");
  const tx3 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        ContractCall: {
          target: "evil_contract.testnet",
          method: "drain",
          args: "{}",
        },
      },
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o3 = parseOutcome(tx3);
  const b3After = await getBudget();
  console.log("  Tx Hash: ", tx3.transaction.hash);
  console.log("  Outcome: ", JSON.stringify(o3));
  logRow.push({
    step: 3,
    name: "Unlisted Target (evil_contract.testnet)",
    hash: tx3.transaction.hash,
    status: o3.status,
    reason: o3.reason,
    spent: b3After.spent,
    remaining: b3After.remaining,
    paused: b3After.paused,
  });

  // Operational maintenance between isolated tests:
  // Reset reject counter to isolate Step 4 and Step 5 so they test their specific rules
  // without early circuit breaker tripping.
  console.log("\n  [Operational Maintenance] Resetting reject history before Step 4/5...");
  const midReset = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "reset_windows",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  reset_windows Tx:", midReset.transaction.hash);

  // -------------------------------------------------------------
  // Step 4: Unlisted method (target DEX with drain)
  // -------------------------------------------------------------
  console.log("\n[Step 4] Unlisted Method: DEX drain()...");
  const tx4 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        ContractCall: {
          target: DEX_ID,
          method: "drain",
          args: "{}",
        },
      },
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o4 = parseOutcome(tx4);
  const b4After = await getBudget();
  console.log("  Tx Hash: ", tx4.transaction.hash);
  console.log("  Outcome: ", JSON.stringify(o4));
  logRow.push({
    step: 4,
    name: "Unlisted Method (DEX drain)",
    hash: tx4.transaction.hash,
    status: o4.status,
    reason: o4.reason,
    spent: b4After.spent,
    remaining: b4After.remaining,
    paused: b4After.paused,
  });

  // -------------------------------------------------------------
  // Step 5: Over daily cap (swap 1200 mUSD on DEX)
  // -------------------------------------------------------------
  console.log("\n[Step 5] Over Daily Cap: Swap 1200 mUSD on DEX...");
  const tx5 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Swap: {
          dex: DEX_ID,
          token_in: TOKEN_ID,
          amount_in: "1200",
          min_out: "0",
        },
      },
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o5 = parseOutcome(tx5);
  const b5After = await getBudget();
  console.log("  Tx Hash: ", tx5.transaction.hash);
  console.log("  Outcome: ", JSON.stringify(o5));
  logRow.push({
    step: 5,
    name: "Over Daily Cap (Swap 1200 mUSD)",
    hash: tx5.transaction.hash,
    status: o5.status,
    reason: o5.reason,
    spent: b5After.spent,
    remaining: b5After.remaining,
    paused: b5After.paused,
  });

  // -------------------------------------------------------------
  // Step 6: Velocity burst to breaker trip (3rd reject trips AUTO_PAUSE)
  // -------------------------------------------------------------
  console.log("\n[Step 6] Velocity Burst / Breaker Trip (3rd reject in window)...");
  // Steps 4 and 5 were 2 rejects. One more reject trips the 3-reject threshold!
  const tx6 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        ContractCall: {
          target: "unauthorized_vault.testnet",
          method: "steal",
          args: "{}",
        },
      },
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o6 = parseOutcome(tx6);
  const b6After = await getBudget();
  console.log("  Tx Hash: ", tx6.transaction.hash);
  console.log("  Outcome: ", JSON.stringify(o6));
  console.log("  Paused:  ", b6After.paused);
  logRow.push({
    step: 6,
    name: "Circuit Breaker Trip (3 Rejects in Window)",
    hash: tx6.transaction.hash,
    status: o6.status,
    reason: `${o6.reason} (Tripped AUTO_PAUSE)`,
    spent: b6After.spent,
    remaining: b6After.remaining,
    paused: b6After.paused,
  });

  // -------------------------------------------------------------
  // Step 7: Owner unpause and reset
  // -------------------------------------------------------------
  console.log("\n[Step 7] Owner Unpause & Reset Windows...");
  const tx7Unpause = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "unpause",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  Unpause Tx:      ", tx7Unpause.transaction.hash);

  const tx7Reset = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "reset_windows",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  reset_windows Tx:", tx7Reset.transaction.hash);
  const b7After = await getBudget();
  console.log("  Paused:          ", b7After.paused);
  logRow.push({
    step: 7,
    name: "Owner Unpause & Reset Windows",
    hash: `${tx7Unpause.transaction.hash} (unpause) / ${tx7Reset.transaction.hash} (reset)`,
    status: "CONFIRMED",
    reason: "Restored ACTIVE state",
    spent: b7After.spent,
    remaining: b7After.remaining,
    paused: b7After.paused,
  });

  // -------------------------------------------------------------
  // Step 8: High value quarantine (swap 300 mUSD on DEX)
  // -------------------------------------------------------------
  console.log("\n[Step 8] High Value Quarantine: Swap 300 mUSD (>= 250 threshold)...");
  const tx8 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Swap: {
          dex: DEX_ID,
          token_in: TOKEN_ID,
          amount_in: "300",
          min_out: "0",
        },
      },
    },
    gas: BigInt("100000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o8 = parseOutcome(tx8);
  const b8After = await getBudget();
  console.log("  Tx Hash:    ", tx8.transaction.hash);
  console.log("  Outcome:    ", JSON.stringify(o8));
  console.log("  Pending ID: ", o8.pending_id);
  logRow.push({
    step: 8,
    name: `High-Value Quarantine (Swap 300 mUSD, Pending #${o8.pending_id})`,
    hash: tx8.transaction.hash,
    status: o8.status,
    reason: `Pending Timelock #${o8.pending_id}`,
    spent: b8After.spent,
    remaining: b8After.remaining,
    paused: b8After.paused,
  });

  // -------------------------------------------------------------
  // Step 9: Owner cancel of one queued item
  // -------------------------------------------------------------
  console.log(`\n[Step 9] Owner Veto: Cancel Pending Item #${o8.pending_id}...`);
  const tx9 = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "cancel_pending",
    args: { agent_account: AGENT_ID, id: o8.pending_id },
    gas: BigInt("30000000000000"),
  });
  const b9After = await getBudget();
  console.log("  Cancel Tx:  ", tx9.transaction.hash);
  logRow.push({
    step: 9,
    name: `Owner Cancel / Veto of Item #${o8.pending_id}`,
    hash: tx9.transaction.hash,
    status: "CANCELLED",
    reason: `Vetoed Pending #${o8.pending_id}`,
    spent: b9After.spent,
    remaining: b9After.remaining,
    paused: b9After.paused,
  });

  // -------------------------------------------------------------
  // Step 10: High value quarantine #2 + owner settle after window
  // -------------------------------------------------------------
  console.log("\n[Step 10] High Value Quarantine #2 + Owner Settle after Window...");
  console.log("  Submitting second 300 mUSD swap...");
  const tx10Submit = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Swap: {
          dex: DEX_ID,
          token_in: TOKEN_ID,
          amount_in: "300",
          min_out: "0",
        },
      },
    },
    gas: BigInt("100000000000000"),
    attachedDeposit: BigInt(0),
  });
  const o10 = parseOutcome(tx10Submit);
  console.log("  Queued Tx:   ", tx10Submit.transaction.hash);
  console.log("  Queued ID:   ", o10.pending_id);

  console.log("  Waiting 62 seconds for timelock window to mature (60s demo delay)...");
  for (let s = 62; s > 0; s -= 10) {
    console.log(`    ... ${s}s remaining in quarantine`);
    await sleep(Math.min(10, s) * 1000);
  }

  console.log(`  Calling settle_pending for item #${o10.pending_id} as Owner...`);
  const tx10Settle = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "settle_pending",
    args: { agent: AGENT_ID, id: o10.pending_id },
    gas: BigInt("150000000000000"),
  });
  const o10Settle = parseOutcome(tx10Settle);
  const b10After = await getBudget();
  console.log("  Settle Tx:   ", tx10Settle.transaction.hash);
  console.log("  Outcome:     ", JSON.stringify(o10Settle));
  console.log(`  Final Budget: Spent ${b10After.spent} / ${b10After.cap} (Remaining: ${b10After.remaining})`);

  logRow.push({
    step: 10,
    name: `High-Value Settle after Window (Item #${o10.pending_id})`,
    hash: `${tx10Submit.transaction.hash} (queue) / ${tx10Settle.transaction.hash} (settle)`,
    status: o10Settle.status,
    reason: `Settled & Executed on DEX`,
    spent: b10After.spent,
    remaining: b10After.remaining,
    paused: b10After.paused,
  });

  // Post-suite cleanup: leave agent in pristine unpaused state with fresh budget
  console.log("\n[Post-Suite Cleanup] Restoring fresh windows...");
  const finalReset = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "reset_windows",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  Final reset_windows Tx:", finalReset.transaction.hash);

  console.log("\n==================================================================");
  console.log(" ORDERED DEMO RUN LOG (VERIFIED ONCHAIN)");
  console.log("==================================================================");
  console.table(logRow);

  fs.writeFileSync(
    path.join(__dirname, "demo-run-results.json"),
    JSON.stringify(logRow, null, 2)
  );
  console.log("\nResults written to scripts/demo-run-results.json");
}

main().catch((err) => {
  console.error("FATAL ERROR in demo sequence:", err);
  process.exitCode = 1;
});
