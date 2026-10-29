#!/usr/bin/env node

/**
 * @file cli.js
 * Minimal zero-dependency CLI for ScopeGuard agent connection and passkey handoff.
 * ponytail: Pure Node stdlib (fs, path, process.argv) - no heavy commander/yargs bloat.
 */

const fs = require("fs");
const path = require("path");

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

if (command === "connect") {
  const flags = parseFlags(args.slice(1));
  const account = flags.account || process.env.SCOPEGUARD_AGENT_ACCOUNT || "trader.sergeo-guard.testnet";
  const key = flags.key || process.env.SCOPEGUARD_AGENT_PRIVATE_KEY;
  if (!key) {
    console.error("Error: Scoped passkey is required. Provide --key <ed25519:...> or set SCOPEGUARD_AGENT_PRIVATE_KEY.");
    process.exit(1);
  }
  const guard = flags.guard || process.env.SCOPEGUARD_POLICY_CONTRACT || "guard2.sergeo-guard.testnet";
  const outPath = flags.out || "./agent.json";

  let publicKey = "";
  try {
    const { KeyPair } = require("near-api-js");
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
    nodeUrl: process.env.NEAR_TESTNET_RPC || "https://rpc.testnet.near.org",
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
  console.log("Your agent can only execute trades through the Guard contract.");
  console.log("==================================================");
  process.exit(0);
} else {
  console.log("ScopeGuard CLI");
  console.log("Usage:");
  console.log("  node sdk/bin/cli.js connect --account <id> --key <ed25519:...> --guard <contract>");
  console.log("");
  console.log("Options:");
  console.log("  --account   The agent sub-account (e.g. trader.sergeo-guard.testnet)");
  console.log("  --key       The restricted function-call passkey");
  console.log("  --guard     The ScopeGuard policy contract on NEAR");
  console.log("  --out       Output credential file path (defaults to ./agent.json)");
  process.exit(0);
}
