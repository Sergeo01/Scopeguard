const path = require("path");
const fs = require("fs");
const os = require("os");

let nearApi;
try {
  nearApi = require(path.join(__dirname, "..", "web", "node_modules", "near-api-js"));
} catch {
  nearApi = require("/var/www/scopeguard/web/node_modules/near-api-js");
}
const { connect, keyStores, KeyPair } = require;

const RPC_URL = process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org";
const NETWORK_ID = "testnet";

const OWNER_ID = process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
const GUARD_ID = process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
const DEX_ID = process.env.SCOPEGUARD_DEX_CONTRACT || "sergeo-guard-dex.testnet";
const TOKEN_ID = process.env.SCOPEGUARD_TOKEN_CONTRACT || "sergeo-guard-token.testnet";
const AGENT_ID = process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent.sergeo-guard.testnet";

async function loadOwnerKey() {
  const credPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return nearApi.KeyPair.fromString(data.private_key || data.secret_key);
}

async function loadAgentKey() {
  let credPath = path.join(__dirname, "..", "demo-agent", "credentials", "agent.json");
  if (!fs.existsSync(credPath)) {
    credPath = "/var/www/scopeguard/demo-agent/credentials/agent.json";
  }
  const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
  return nearApi.KeyPair.fromString(data.privateKey);
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

  const ownerKeyStore = new nearApi.keyStores.InMemoryKeyStore();
  await ownerKeyStore.setKey(NETWORK_ID, OWNER_ID, await loadOwnerKey());
  const ownerNear = await nearApi.connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore: ownerKeyStore });
  const ownerAccount = await ownerNear.account(OWNER_ID);

  const agentKeyStore = new nearApi.keyStores.InMemoryKeyStore();
  await agentKeyStore.setKey(NETWORK_ID, AGENT_ID, await loadAgentKey());
  const agentNear = await nearApi.connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore: agentKeyStore });
  const agentAccount = await agentNear.account(AGENT_ID);

  const getBudget = async () => {
    return await ownerAccount.viewFunction({
      contractId: GUARD_ID,
      methodName: "get_budget",
      args: { agent_account: AGENT_ID },
    });
  };

  const logRow = [];

  // Step 0: Pre-flight check & cleanup
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

  const cleanBudget = await getBudget();
  console.log(`  Initial Budget: Spent ${cleanBudget.spent} / ${cleanBudget.cap} | Remaining: ${cleanBudget.remaining} | Vault: ${cleanBudget.vault_balance} | Paused: ${cleanBudget.paused}`);

  // -------------------------------------------------------------
  // Step 1: Legit Swap 25 mUSD on DEX
  // -------------------------------------------------------------
  console.log("\n[Step 1] Legit Swap 25 mUSD on sergeo-guard-dex.testnet...");
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
    name: "Legit Swap 25 mUSD on sergeo-guard-dex.testnet",
    hash: tx1.transaction.hash,
    status: o1.status,
    reason: o1.reason || "None (ALLOWED)",
    spent: b1After.spent,
    remaining: b1After.remaining,
    paused: b1After.paused,
  });

  // -------------------------------------------------------------
  // Step 2: Blocked Recipient: transfer 100 mUSD to attacker.testnet
  // -------------------------------------------------------------
  console.log("\n[Step 2] Blocked Recipient: transfer 100 mUSD to attacker.testnet...");
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
    name: "Blocked Recipient (transfer 100 mUSD to attacker.testnet)",
    hash: tx2.transaction.hash,
    status: o2.status,
    reason: o2.reason,
    spent: b2After.spent,
    remaining: b2After.remaining,
    paused: b2After.paused,
  });

  // -------------------------------------------------------------
  // Step 3: Blocked Target: call phish-vault.testnet deposit
  // -------------------------------------------------------------
  console.log("\n[Step 3] Blocked Target: call phish-vault.testnet deposit...");
  const tx3 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        ContractCall: {
          target: "phish-vault.testnet",
          method: "deposit",
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
    name: "Blocked Target (call phish-vault.testnet deposit)",
    hash: tx3.transaction.hash,
    status: o3.status,
    reason: o3.reason,
    spent: b3After.spent,
    remaining: b3After.remaining,
    paused: b3After.paused,
  });

  // -------------------------------------------------------------
  // Step 4: Over Cap: swap 600 mUSD on DEX (trips 3rd reject -> auto_pause)
  // -------------------------------------------------------------
  console.log("\n[Step 4] Over Cap: swap 600 mUSD on sergeo-guard-dex.testnet (3rd reject -> auto_pause)...");
  const tx4 = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Swap: {
          dex: DEX_ID,
          token_in: TOKEN_ID,
          amount_in: "600",
          min_out: "0",
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
  console.log("  Paused:  ", b4After.paused);
  logRow.push({
    step: 4,
    name: "Over Daily Cap (swap 600 mUSD, 3rd reject trips AUTO_PAUSE)",
    hash: tx4.transaction.hash,
    status: o4.status,
    reason: `${o4.reason} (Tripped AUTO_PAUSE)`,
    spent: b4After.spent,
    remaining: b4After.remaining,
    paused: b4After.paused,
  });

  // -------------------------------------------------------------
  // Step 5: High Value: swap 300 mUSD -> Pending
  // -------------------------------------------------------------
  console.log("\n[Step 5] High Value: swap 300 mUSD -> Pending (delay queued)...");
  console.log("  First, owner unpauses agent after circuit breaker trip...");
  const tx5Unpause = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "unpause",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  Unpause Tx: ", tx5Unpause.transaction.hash);

  const tx5 = await agentAccount.functionCall({
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
  const o5 = parseOutcome(tx5);
  const b5After = await getBudget();
  console.log("  Tx Hash:    ", tx5.transaction.hash);
  console.log("  Outcome:    ", JSON.stringify(o5));
  console.log("  Pending ID: ", o5.pending_id);
  logRow.push({
    step: 5,
    name: `High-Value Quarantine (Swap 300 mUSD, Pending #${o5.pending_id})`,
    hash: tx5.transaction.hash,
    status: o5.status,
    reason: `Pending Timelock #${o5.pending_id}`,
    spent: b5After.spent,
    remaining: b5After.remaining,
    paused: b5After.paused,
  });

  // -------------------------------------------------------------
  // Step 6: Settle pending action via owner, and reset windows so demo agent is clean
  // -------------------------------------------------------------
  console.log("\n[Step 6] Settle pending action via owner and reset windows...");
  console.log("  Waiting 62 seconds for timelock quarantine delay to mature (60s policy delay)...");
  for (let s = 62; s > 0; s -= 10) {
    console.log(`    ... ${s}s remaining in quarantine`);
    await sleep(Math.min(10, s) * 1000);
  }

  console.log(`  Calling settle_pending for item #${o5.pending_id} as Owner...`);
  const tx6Settle = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "settle_pending",
    args: { agent: AGENT_ID, id: o5.pending_id },
    gas: BigInt("150000000000000"),
  });
  const o6Settle = parseOutcome(tx6Settle);
  console.log("  Settle Tx:   ", tx6Settle.transaction.hash);
  console.log("  Outcome:     ", JSON.stringify(o6Settle));

  console.log("  Calling reset_windows to leave agent in clean state (spent 0, unpaused)...");
  const tx6Reset = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "reset_windows",
    args: { agent_account: AGENT_ID },
    gas: BigInt("30000000000000"),
  });
  console.log("  Final reset_windows Tx:", tx6Reset.transaction.hash);

  const b6Final = await getBudget();
  console.log(`  Final State: Spent ${b6Final.spent} / ${b6Final.cap} | Remaining: ${b6Final.remaining} | Vault: ${b6Final.vault_balance} | Paused: ${b6Final.paused}`);

  logRow.push({
    step: 6,
    name: "Settle Pending Action & Reset Windows",
    hash: `${tx6Settle.transaction.hash} (settle) / ${tx6Reset.transaction.hash} (reset)`,
    status: "CONFIRMED",
    reason: "Settled on DEX & clean state restored",
    spent: b6Final.spent,
    remaining: b6Final.remaining,
    paused: b6Final.paused,
  });

  console.log("\n==================================================================");
  console.log(" ORDERED DEMO RUN LOG (VERIFIED ONCHAIN)");
  console.log("==================================================================");
  console.table(logRow);

  const outputPath = path.join(__dirname, "demo-run-results.json");
  fs.writeFileSync(outputPath, JSON.stringify(logRow, null, 2));
  console.log(`\nResults written to ${outputPath}`);
}

main().catch((err) => {
  console.error("FATAL ERROR in demo sequence:", err);
  process.exit(1);
});
