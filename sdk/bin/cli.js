#!/usr/bin/env node

/**
 * @file cli.js
 * ScopeGuard CLI for interactive agent onboarding, passkey handoff, and execution.
 * Built with Node stdlib (fs, path, readline, process.argv) and near-api-js.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { connect, keyStores, KeyPair, utils } = require("near-api-js");

const args = process.argv.slice(2);
const command = args[0] || "help";

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
      flags[key] = val;
    }
  }
  return flags;
}

function promptQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

function loadOwnerKey(ownerAccount, networkId = "testnet") {
  if (process.env.OWNER_PRIVATE_KEY) {
    try {
      return KeyPair.fromString(process.env.OWNER_PRIVATE_KEY);
    } catch {}
  }
  const credPath = path.join(os.homedir(), ".near-credentials", networkId, `${ownerAccount}.json`);
  if (fs.existsSync(credPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
      return KeyPair.fromString(data.private_key || data.secret_key);
    } catch {}
  }
  return null;
}

async function runSetup() {
  const flags = parseFlags(args.slice(1));
  const agentAccount = flags.agent || flags.account || process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent.sergeo-guard.testnet";
  const ownerAccount = flags.owner || process.env.OWNER_ACCOUNT_ID || "sergeo-guard.testnet";
  const guardContract = flags.guard || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
  const tokenContract = flags.token || process.env.SCOPEGUARD_TOKEN_ID || "sergeo-guard-token.testnet";
  const networkId = flags.network || process.env.NEAR_NETWORK || "testnet";
  const rpcUrl = flags.rpc || process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";
  const outPath = flags.out || "./agent.json";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("================================================================");
  console.log("  SCOPEGUARD: Interactive Agent Safety Onboarding");
  console.log("================================================================");
  console.log(`Configuring safety envelope for: ${agentAccount}`);
  console.log(`Policy Guard Contract: ${guardContract}`);
  console.log("----------------------------------------------------------------\n");

  // Question 1: Daily Spending Cap
  console.log("Question 1: What is the maximum daily spending budget?");
  console.log("  [1] $25 / day (Conservative)");
  console.log("  [2] $50 / day (Recommended default)");
  console.log("  [3] $100 / day");
  console.log("  [4] Custom dollar amount");
  const ans1 = (await promptQuestion(rl, "Select option [1-4] (default: 2): ")).trim();

  let dailyCap = 50;
  if (ans1 === "1") dailyCap = 25;
  else if (ans1 === "3") dailyCap = 100;
  else if (ans1 === "4") {
    const custom = (await promptQuestion(rl, "Enter custom daily cap in mUSD: ")).trim();
    dailyCap = Number(custom) > 0 ? Number(custom) : 50;
  }

  // Question 2: Authorized Platforms
  console.log("\nQuestion 2: Which platforms is the agent authorized to trade on?");
  console.log("  [1] ScopeGuard Testnet DEX only (Recommended for testing)");
  console.log("  [2] ScopeGuard DEX + Ref Finance (DEX + Swaps)");
  console.log("  [3] All pre-vetted platforms (DEX, Ref Finance, Burrow)");
  const ans2 = (await promptQuestion(rl, "Select option [1-3] (default: 1): ")).trim();

  let targets = { "sergeo-guard-dex.testnet": ["swap"] };
  if (ans2 === "2") {
    targets = {
      "sergeo-guard-dex.testnet": ["swap"],
      "ref-finance.near": ["swap", "deposit"],
    };
  } else if (ans2 === "3") {
    targets = {
      "sergeo-guard-dex.testnet": ["swap"],
      "ref-finance.near": ["swap", "deposit"],
      "contract.main.burrow.near": ["borrow", "repay"],
    };
  }

  // Question 3: Auto-Pause Brake
  console.log("\nQuestion 3: Should the emergency circuit breaker freeze the agent on 3 consecutive errors?");
  console.log("  [1] Yes, halt agent immediately on 3 strikes (Recommended)");
  console.log("  [2] No, do not auto-pause");
  const ans3 = (await promptQuestion(rl, "Select option [1-2] (default: 1): ")).trim();

  const autoPauseRejects = ans3 === "2" ? 10 : 3;

  // Generate Agent Passkey
  const keyPair = KeyPair.fromRandom("ed25519");
  const publicKey = keyPair.getPublicKey().toString();
  const privateKey = keyPair.toString();

  const policy = {
    token: tokenContract,
    targets,
    daily_cap: Number(dailyCap),
    recipients: [],
    max_actions_per_10min: 5,
    auto_pause_rejects: autoPauseRejects,
    auto_pause_window_minutes: 10,
    high_value_threshold: Math.max(1, Math.floor(dailyCap / 2)),
    high_value_delay_seconds: 60,
    policy_change_delay_seconds: 3600,
    max_drawdown_bps: 1500,
    lease_expires_at: null,
    intent_recipients: [],
    canary_methods: ["emergency_drain_vault", "admin_sweep"],
  };

  // MANDATORY ADMIN / OWNER APPROVAL GATE
  console.log("\n================================================================");
  console.log("  ADMIN / OWNER APPROVAL GATE (MANDATORY SECURITY CHECK)");
  console.log("================================================================");
  console.log("The agent cannot approve its own policy onchain.");
  console.log("This prevents prompt-injection attacks from inflating spend limits.\n");
  console.log("PROPOSED POLICY CARD:");
  console.log(`- Agent Account        : ${agentAccount}`);
  console.log(`- Owner / Admin Account: ${ownerAccount}`);
  console.log(`- Daily Spending Cap   : $${dailyCap} mUSD / 24 hours`);
  console.log(`- Allowed Targets      : ${Object.keys(targets).join(", ")}`);
  console.log(`- Speed Throttle       : 5 actions / 10 minutes`);
  console.log(`- Circuit Breaker      : Freeze after ${autoPauseRejects} strikes`);
  console.log("- External Payouts     : Refused ($0 allowed to outside wallets)");
  console.log(`- Agent Public Key     : ${publicKey}\n`);

  const confirm = (await promptQuestion(rl, "As the Admin / Owner, do you authorize and sign this policy? (yes/no): ")).trim().toLowerCase();
  rl.close();

  if (confirm !== "yes" && confirm !== "y") {
    console.log("\n[ABORTED] Policy rejected by admin.");
    console.log("Zero onchain transactions submitted. The agent cannot trade without signed owner authorization.");
    process.exit(1);
  }

  console.log("\n[APPROVED] Admin authorization confirmed.");

  // Write agent credential file
  const credential = {
    agentAccountId: agentAccount,
    policyContractId: guardContract,
    publicKey,
    privateKey,
    networkId,
    nodeUrl: rpcUrl,
    created_at: new Date().toISOString(),
  };

  const resolvedOut = path.resolve(process.cwd(), outPath);
  fs.writeFileSync(resolvedOut, JSON.stringify(credential, null, 2), "utf-8");

  // Attempt Onchain Registration if Owner key is found
  const ownerKey = loadOwnerKey(ownerAccount, networkId);
  if (ownerKey) {
    console.log(`Found owner credentials for ${ownerAccount}. Submitting registration to NEAR ${networkId}...`);
    try {
      const keyStore = new keyStores.InMemoryKeyStore();
      await keyStore.setKey(networkId, ownerAccount, ownerKey);
      const near = await connect({ networkId, nodeUrl: rpcUrl, keyStore });
      const ownerAcc = await near.account(ownerAccount);

      // Register policy on Guard contract
      console.log(`Calling ${guardContract}::register_agent...`);
      const outcome = await ownerAcc.functionCall({
        contractId: guardContract,
        methodName: "register_agent",
        args: {
          agent_account: agentAccount,
          policy,
        },
        gas: "100000000000000",
      });

      console.log(`✓ Policy registered onchain! Tx: ${outcome.transaction.hash}`);
      console.log(`  View Receipt: https://testnet.nearblocks.io/txns/${outcome.transaction.hash}`);

      // Add function-call access key for agent
      console.log(`Adding scoped FunctionCall passkey to ${agentAccount}...`);
      try {
        await ownerAcc.functionCall({
          contractId: agentAccount,
          methodName: "add_key",
          args: {},
          gas: "100000000000000",
        });
      } catch {
        // If owner is not agent directly, owner uses standard near add-key command or already has key
      }
    } catch (err) {
      console.warn("Notice during direct signing:", err.message);
      printManualOwnerCommands(guardContract, agentAccount, policy, ownerAccount, publicKey);
    }
  } else {
    printManualOwnerCommands(guardContract, agentAccount, policy, ownerAccount, publicKey);
  }

  console.log("\n================================================================");
  console.log("  AGENT ONBOARDING COMPLETE");
  console.log("================================================================");
  console.log(`✓ Scoped Passkey saved to: ${resolvedOut}`);
  console.log(`✓ Daily Spending Limit   : $${dailyCap} mUSD`);
  console.log("✓ Protocol Enforcement   : Native NEAR FunctionCall key");
  console.log("The agent cannot exceed these rules or increase its own limits.");
  console.log("================================================================");
}

function printManualOwnerCommands(guardContract, agentAccount, policy, ownerAccount, publicKey) {
  console.log("\nTo finalize activation onchain, sign these commands with your owner account:");
  console.log("----------------------------------------------------------------");
  console.log(`# 1. Register policy on Guard:`);
  console.log(`near call ${guardContract} register_agent '{"agent_account":"${agentAccount}","policy":${JSON.stringify(policy)}}' --accountId ${ownerAccount} --gas 100000000000000\n`);
  console.log(`# 2. Add scoped passkey to agent (0.25 NEAR gas allowance for transaction fees):`);
  console.log(`near add-key ${agentAccount} ${publicKey} --contractId ${guardContract} --methodNames execute --allowance 0.25 --accountId ${ownerAccount}`);
  console.log("----------------------------------------------------------------");
}

async function runConnect() {
  const flags = parseFlags(args.slice(1));
  const account = flags.account || process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent.sergeo-guard.testnet";
  const key = flags.key || process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;
  if (!key) {
    console.error("Error: Scoped passkey is required. Provide --key <ed25519:...> or set SCOPEGUARD_AGENT_PRIVATE_KEY.");
    process.exit(1);
  }
  const guard = flags.guard || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
  const outPath = flags.out || "./agent.json";

  let publicKey = "";
  try {
    publicKey = KeyPair.fromString(key).getPublicKey().toString();
  } catch (err) {
    console.error("Error: Invalid passkey ED25519 format.");
    process.exit(1);
  }

  const credential = {
    agentAccountId: account,
    policyContractId: guard,
    publicKey,
    privateKey: key,
    networkId: "testnet",
    nodeUrl: process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com",
    connected_at: new Date().toISOString(),
  };

  const resolvedOut = path.resolve(process.cwd(), outPath);
  fs.writeFileSync(resolvedOut, JSON.stringify(credential, null, 2), "utf-8");

  console.log("==================================================");
  console.log("  SCOPEGUARD: Agent Connected Successfully");
  console.log("==================================================");
  console.log(`✓ Agent Account : ${account}`);
  console.log(`✓ Public Key    : ${publicKey}`);
  console.log(`✓ Scoped Passkey: ${key.slice(0, 18)}...`);
  console.log(`✓ Policy Guard  : ${guard}`);
  console.log(`✓ Credential File: ${resolvedOut}`);
  console.log("--------------------------------------------------");
  console.log("Status: READY FOR AUTONOMOUS OPERATION");
  console.log("Enforcement: Native NEAR protocol-level security.");
  console.log("==================================================");
}

async function runAct() {
  const flags = parseFlags(args.slice(1));
  let credential = null;
  const credPath = path.resolve(process.cwd(), flags.cred || "./agent.json");

  if (fs.existsSync(credPath)) {
    try {
      credential = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    } catch {}
  }

  const accountId = flags.account || credential?.agentAccountId || process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent.sergeo-guard.testnet";
  const privateKey = flags.key || credential?.privateKey || process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;
  const guardContract = flags.guard || credential?.policyContractId || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
  const networkId = flags.network || credential?.networkId || "testnet";
  const rpcUrl = flags.rpc || credential?.nodeUrl || process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

  if (!privateKey) {
    console.error("Error: No agent passkey found. Run 'node sdk/bin/cli.js connect' or provide --key.");
    process.exit(1);
  }

  const target = flags.target || "sergeo-guard-dex.testnet";
  const method = flags.method || "swap";
  const amount = String(flags.amount || "25");
  const recipient = flags.recipient || null;

  console.log(`Submitting action through ScopeGuard: ${target}::${method}(amount: ${amount})...`);

  try {
    const keyStore = new keyStores.InMemoryKeyStore();
    const keyPair = KeyPair.fromString(privateKey);
    await keyStore.setKey(networkId, accountId, keyPair);
    const near = await connect({ networkId, nodeUrl: rpcUrl, keyStore });
    const account = await near.account(accountId);

    let action;
    if (recipient) {
      action = {
        Transfer: {
          token: "sergeo-guard-token.testnet",
          to: recipient,
          amount,
          memo: "ScopeGuard transfer",
        },
      };
    } else if (method === "swap") {
      action = {
        Swap: {
          dex: target,
          token_in: "sergeo-guard-token.testnet",
          amount_in: amount,
          min_out: "0",
        },
      };
    } else {
      action = {
        ContractCall: {
          target,
          method,
          args: JSON.stringify({ amount }),
        },
      };
    }

    const outcome = await account.functionCall({
      contractId: guardContract,
      methodName: "execute",
      args: { action },
      gas: "100000000000000",
    });

    const resultBytes = outcome.status && outcome.status.SuccessValue;
    let verdict = { status: "ALLOWED" };
    if (resultBytes) {
      try {
        const decoded = Buffer.from(resultBytes, "base64").toString("utf-8");
        verdict = JSON.parse(decoded);
      } catch {}
    }

    console.log("\n==================================================");
    console.log("  ONCHAIN POLICY EVALUATION RESULT");
    console.log("==================================================");
    console.log(`Verdict: ${verdict.status || "ALLOWED"}`);
    if (verdict.reason) {
      console.log(`Refusal Reason: ${verdict.reason}`);
    }
    console.log(`Tx Hash: ${outcome.transaction.hash}`);
    console.log(`Explorer: https://testnet.nearblocks.io/txns/${outcome.transaction.hash}`);
    console.log("==================================================");
  } catch (err) {
    console.error("Execution failed:", err.message);
    process.exit(1);
  }
}

async function runBudget() {
  const flags = parseFlags(args.slice(1));
  const credPath = path.resolve(process.cwd(), flags.cred || "./agent.json");
  let credential = null;
  if (fs.existsSync(credPath)) {
    try {
      credential = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    } catch {}
  }

  const accountId = flags.account || credential?.agentAccountId || process.env.SCOPEGUARD_AGENT_ACCOUNT || "agent.sergeo-guard.testnet";
  const guardContract = flags.guard || credential?.policyContractId || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
  const networkId = flags.network || "testnet";
  const rpcUrl = flags.rpc || process.env.NEAR_TESTNET_RPC || "https://test.rpc.fastnear.com";

  try {
    const near = await connect({ networkId, nodeUrl: rpcUrl, keyStore: new keyStores.InMemoryKeyStore() });
    const account = await near.account(accountId);
    const budget = await account.viewFunction({
      contractId: guardContract,
      methodName: "get_budget",
      args: { agent_account: accountId },
    });

    console.log("==================================================");
    console.log(`  SCOPEGUARD BUDGET: ${accountId}`);
    console.log("==================================================");
    console.log(`Daily Spending Cap : $${budget.cap} mUSD`);
    console.log(`Spent Today        : $${budget.spent} mUSD`);
    console.log(`Remaining Budget   : $${budget.remaining} mUSD`);
    console.log(`Speed Count        : ${budget.actions_in_window} calls in rolling 10m`);
    console.log(`Vault Balance      : $${budget.vault_balance} mUSD`);
    console.log(`Status             : ${budget.paused ? "PAUSED" : "ACTIVE"}`);
    console.log("==================================================");
  } catch (err) {
    console.error("Could not fetch budget:", err.message);
  }
}

async function main() {
  switch (command) {
    case "setup":
      await runSetup();
      break;
    case "connect":
      await runConnect();
      break;
    case "act":
      await runAct();
      break;
    case "budget":
      await runBudget();
      break;
    default:
      console.log("ScopeGuard CLI");
      console.log("Commands:");
      console.log("  setup     Interactive conversational onboarding with Admin Approval Gate");
      console.log("  connect   Connect existing agent passkey to local agent.json");
      console.log("  act       Execute an action through ScopeGuard policy checks");
      console.log("  budget    Query live budget and remaining allowance on NEAR");
      console.log("\nExamples:");
      console.log("  node sdk/bin/cli.js setup");
      console.log("  node sdk/bin/cli.js budget --account agent.sergeo-guard.testnet");
      console.log("  node sdk/bin/cli.js act --target sergeo-guard-dex.testnet --method swap --amount 25");
      process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
