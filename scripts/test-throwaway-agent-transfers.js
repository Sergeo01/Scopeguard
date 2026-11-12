process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { connect, keyStores, KeyPair, transactions, utils } = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));

const GUARD_ID = "scopeguard.testnet";
const OWNER_ID = "sergeo-guard.testnet";
const TOKEN_ID = "sergeo-guard-token.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = "https://test.rpc.fastnear.com";

async function main() {
  console.log("==================================================================");
  console.log(" ScopeGuard Onchain Verification: Throwaway Agent Transfer Test");
  console.log("==================================================================");

  // 1. Load Owner Credentials
  const ownerCredPath = path.join(os.homedir(), ".near-credentials", NETWORK_ID, `${OWNER_ID}.json`);
  if (!fs.existsSync(ownerCredPath)) {
    throw new Error(`Missing owner credentials at ${ownerCredPath}`);
  }
  const ownerCred = JSON.parse(fs.readFileSync(ownerCredPath, "utf-8"));
  const ownerKeyPair = KeyPair.fromString(ownerCred.private_key || ownerCred.secret_key);

  const timestamp = Date.now().toString().slice(-6);
  const THROWAWAY_AGENT = `paytest${timestamp}.${OWNER_ID}`;
  console.log(`\nThrowaway Agent Sub-Account: ${THROWAWAY_AGENT}`);
  console.log(`Guard Contract:               ${GUARD_ID}`);
  console.log(`Owner Account:                ${OWNER_ID}`);

  // Generate scoped keypair for throwaway agent
  const agentKeyPair = KeyPair.fromRandom("ed25519");
  const agentPublicKey = agentKeyPair.getPublicKey().toString();
  console.log(`Generated Agent Scoped Key:   ${agentPublicKey}`);

  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, OWNER_ID, ownerKeyPair);
  await keyStore.setKey(NETWORK_ID, THROWAWAY_AGENT, agentKeyPair);

  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
  const ownerAccount = await near.account(OWNER_ID);

  // 2. Provision throwaway sub-account with scoped key
  console.log(`\n[Step 1] Creating sub-account ${THROWAWAY_AGENT} with scoped key...`);
  const createTx = await ownerAccount.signAndSendTransaction({
    receiverId: THROWAWAY_AGENT,
    actions: [
      transactions.createAccount(),
      transactions.transfer(BigInt("300000000000000000000000")), // 0.3 NEAR
      transactions.addKey(
        ownerKeyPair.getPublicKey(),
        transactions.fullAccessKey()
      ),
      transactions.addKey(
        utils.PublicKey.from(agentPublicKey),
        transactions.functionCallAccessKey(
          GUARD_ID,
          ["execute"],
          BigInt("250000000000000000000000") // 0.25 NEAR allowance
        )
      ),
    ],
  });
  console.log(`  Sub-Account Provisioned: ${createTx.transaction.hash}`);

  // 3. Register throwaway agent with transfer-capable policy
  console.log(`\n[Step 2] Registering transfer-capable policy on ${GUARD_ID}...`);
  const testPolicy = {
    token: TOKEN_ID,
    targets: {
      [TOKEN_ID]: ["ft_transfer"],
      "sergeo-guard-dex.testnet": ["swap"],
    },
    daily_cap: 50,
    recipients: [OWNER_ID],
    max_actions_per_10min: 5,
    auto_pause_rejects: 3,
    auto_pause_window_minutes: 10,
    high_value_threshold: 25,
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 60,
    max_drawdown_bps: 5000,
    lease_expires_at: null,
    intent_recipients: [],
    canary_methods: ["drain_vault", "admin_drain"],
    near_daily_cap: null,
    near_high_value_threshold: null,
  };

  const regTx = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "register_agent",
    args: {
      agent_account: THROWAWAY_AGENT,
      policy: testPolicy,
    },
    gas: BigInt("100000000000000"),
  });
  console.log(`  Registration Hash: ${regTx.transaction.hash}`);

  // 4. Fund test agent vault with 10 mUSD
  console.log(`\n[Step 3] Funding vault with 10 mUSD via ft_transfer_call...`);
  const fundTx = await ownerAccount.functionCall({
    contractId: TOKEN_ID,
    methodName: "ft_transfer_call",
    args: {
      receiver_id: GUARD_ID,
      amount: "10",
      msg: THROWAWAY_AGENT,
    },
    gas: BigInt("50000000000000"),
    attachedDeposit: BigInt(1),
  });
  console.log(`  Funding Hash: ${fundTx.transaction.hash}`);

  // 5. Query initial budget
  const initialBudget = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_budget",
    args: { agent_account: THROWAWAY_AGENT },
  });
  console.log(`  Vault Balance: ${initialBudget.vault_balance} mUSD | Daily Cap: ${initialBudget.cap} mUSD`);

  // 6. Execute ALLOWED transfer to allowlisted recipient (sergeo-guard.testnet)
  console.log(`\n[Step 4] Executing ALLOWED transfer of 2 mUSD to ${OWNER_ID}...`);
  const agentAccount = await near.account(THROWAWAY_AGENT);
  const allowTransferTx = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Transfer: {
          token: TOKEN_ID,
          to: OWNER_ID,
          amount: "2",
          memo: "allowed testnet payout",
        },
      },
    },
    gas: BigInt("100000000000000"),
  });
  const allowHash = allowTransferTx.transaction.hash;
  console.log(`  ALLOWED Transfer Hash: ${allowHash}`);

  // Parse outcome
  let allowOutcome = "UNKNOWN";
  if (allowTransferTx.status && allowTransferTx.status.SuccessValue) {
    const rawVal = Buffer.from(allowTransferTx.status.SuccessValue, "base64").toString("utf-8");
    allowOutcome = JSON.parse(rawVal);
  }
  console.log(`  ALLOWED Execution Outcome:`, JSON.stringify(allowOutcome));

  // 7. Execute BLOCKED transfer to unlisted recipient (attacker.testnet)
  console.log(`\n[Step 5] Executing BLOCKED transfer of 2 mUSD to attacker.testnet...`);
  const rejectTransferTx = await agentAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "execute",
    args: {
      action: {
        Transfer: {
          token: TOKEN_ID,
          to: "attacker.testnet",
          amount: "2",
          memo: "malicious rogue payout",
        },
      },
    },
    gas: BigInt("100000000000000"),
  });
  const rejectHash = rejectTransferTx.transaction.hash;
  console.log(`  REJECTED Transfer Hash: ${rejectHash}`);

  // Parse outcome
  let rejectOutcome = "UNKNOWN";
  if (rejectTransferTx.status && rejectTransferTx.status.SuccessValue) {
    const rawVal = Buffer.from(rejectTransferTx.status.SuccessValue, "base64").toString("utf-8");
    rejectOutcome = JSON.parse(rawVal);
  }
  console.log(`  REJECTED Execution Outcome:`, JSON.stringify(rejectOutcome));

  // 8. Revoke throwaway agent
  console.log(`\n[Step 6] Revoking throwaway agent ${THROWAWAY_AGENT} on ${GUARD_ID}...`);
  const revokeTx = await ownerAccount.functionCall({
    contractId: GUARD_ID,
    methodName: "revoke_agent",
    args: { agent_account: THROWAWAY_AGENT },
    gas: BigInt("100000000000000"),
  });
  console.log(`  Revoke Hash: ${revokeTx.transaction.hash}`);

  // Verify revocation
  const postRevokePolicy = await ownerAccount.viewFunction({
    contractId: GUARD_ID,
    methodName: "get_policy",
    args: { agent_account: THROWAWAY_AGENT },
  });
  console.log(`  Post-Revoke Policy:`, postRevokePolicy);

  // 9. Output complete summary table
  console.log("\n==================================================================");
  console.log(" THROWAWAY AGENT ONCHAIN TEST PROOF SUMMARY");
  console.log("==================================================================");
  console.log(`Agent Sub-Account:      ${THROWAWAY_AGENT}`);
  console.log(`Signer Scoped Key:      ${agentPublicKey}`);
  console.log(`Registration Tx:        ${regTx.transaction.hash}`);
  console.log(`Vault Funding Tx:       ${fundTx.transaction.hash}`);
  console.log(`Allowed Transfer Tx:    ${allowHash}`);
  console.log(`Blocked Transfer Tx:    ${rejectHash}`);
  console.log(`Agent Revocation Tx:    ${revokeTx.transaction.hash}`);
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
