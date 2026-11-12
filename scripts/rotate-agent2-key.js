// rotate-agent2-key.js
// Key rotation for agent2.sergeo-guard.testnet. Two modes: add, delete.
// This script NEVER prints a private key. It prints public keys, counts, and hashes only.
// It NEVER commits anything. It refuses to delete unless the scoped key is verified present first.
// Usage, from the repo root:
//   node scripts/rotate-agent2-key.js add
//   node scripts/rotate-agent2-key.js delete
// Env overrides (optional):
//   AGENT2_CRED_PATH          path to the credentials file holding the agent2 FULL ACCESS keypair
//   AGENT2_FULLACCESS_BACKUP  path to the backup copy of the full access credentials
//   NEAR_RPC_URL              RPC endpoint (default https://test.rpc.fastnear.com)

const fs = require("fs");
const path = require("path");
const os = require("os");

let nearApi;
try {
  nearApi = require(path.join(__dirname, "..", "sdk", "node_modules", "near-api-js"));
} catch {
  nearApi = require("near-api-js");
}
const { connect, keyStores, KeyPair, transactions, utils } = nearApi;

const AGENT_ID = "agent2.sergeo-guard.testnet";
const GUARD_ID = "scopeguard.testnet";
const NETWORK_ID = "testnet";
const RPC_URL = process.env.NEAR_RPC_URL || "https://test.rpc.fastnear.com";
const ALLOWANCE = BigInt("250000000000000000000000"); // 0.25 NEAR
const OLD_FULLACCESS_PUBKEY = "ed25519:A7vUfC7JppnquiWa9gzETePkq16ucVBR4NSXnVtAP9CJ";

function fail(msg) {
  console.error("STOP: " + msg);
  process.exit(1);
}

function findCredFile() {
  const candidates = [];
  if (process.env.AGENT2_CRED_PATH) candidates.push(process.env.AGENT2_CRED_PATH);
  candidates.push(
    path.join(__dirname, "..", "demo-agent", "credentials", "agent.json"),
    "/var/www/scopeguard/demo-agent/credentials/agent.json",
    path.join(os.homedir(), ".near-credentials", NETWORK_ID, AGENT_ID + ".json")
  );
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  fail("no credentials file found. Tried:\n" + candidates.join("\n") + "\nSet AGENT2_CRED_PATH to the file holding the agent2 full access keypair and re-run.");
}

function loadKeyPair(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const secret = data.private_key || data.secret_key || data.privateKey;
  if (!secret) fail("credentials file " + filePath + " has no private_key/secret_key/privateKey field.");
  return KeyPair.fromString(secret);
}

// Normalize across near-api-js permission shapes:
// "FullAccess" | {FullAccess:{}} | {FunctionCall:{...}} | {receiver_id, method_names, allowance}
function describeKey(k) {
  const perm = k.access_key ? k.access_key.permission : undefined;
  if (perm === "FullAccess" || (perm && typeof perm === "object" && "FullAccess" in perm)) {
    return { publicKey: k.public_key, type: "FullAccess" };
  }
  const fc = perm && typeof perm === "object" ? (perm.FunctionCall || perm) : null;
  if (fc && fc.receiver_id) {
    return {
      publicKey: k.public_key,
      type: "FunctionCall",
      receiver: fc.receiver_id,
      methods: fc.method_names || [],
      allowance: fc.allowance !== undefined && fc.allowance !== null ? String(fc.allowance) : null,
    };
  }
  return { publicKey: k.public_key, type: "UNKNOWN", raw: JSON.stringify(perm) };
}

function printKeys(keys, label) {
  console.log(label + " (" + keys.length + " key(s)):");
  for (const k of keys) {
    const d = describeKey(k);
    if (d.type === "FullAccess") console.log("  " + d.publicKey + " | FullAccess");
    else if (d.type === "FunctionCall") console.log("  " + d.publicKey + " | FunctionCall receiver=" + d.receiver + " methods=" + JSON.stringify(d.methods) + " allowance=" + d.allowance);
    else console.log("  " + d.publicKey + " | UNKNOWN " + d.raw);
  }
}

async function getAccount(keyPair) {
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey(NETWORK_ID, AGENT_ID, keyPair);
  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore });
  return near.account(AGENT_ID);
}

async function cmdAdd() {
  const credPath = findCredFile();
  console.log("Using full access credentials file: " + credPath);
  const fullAccessKeyPair = loadKeyPair(credPath);
  const fullAccessPubkey = fullAccessKeyPair.getPublicKey().toString();
  console.log("Full access public key: " + fullAccessPubkey);
  if (fullAccessPubkey !== OLD_FULLACCESS_PUBKEY) {
    console.log("WARNING: loaded keypair does not match the expected onchain full access key " + OLD_FULLACCESS_PUBKEY + ". Proceeding only if the chain key list below shows this key as FullAccess.");
  }

  // Safety backup of the full access credentials BEFORE anything changes.
  const backupPath = process.env.AGENT2_FULLACCESS_BACKUP || path.join(path.dirname(credPath), "agent2-fullaccess-BACKUP.json");
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, fs.readFileSync(credPath, "utf-8"), "utf-8");
    console.log("Backup of full access credentials written to: " + backupPath);
  } else {
    console.log("Backup already exists at: " + backupPath);
  }

  const account = await getAccount(fullAccessKeyPair);
  const before = await account.getAccessKeys();
  printKeys(before, "Keys BEFORE add");
  const beforeDescribed = before.map(describeKey);
  const hasFullAccess = beforeDescribed.some((d) => d.type === "FullAccess");
  const existingScoped = beforeDescribed.find((d) => d.type === "FunctionCall" && d.receiver === GUARD_ID && d.methods.includes("execute"));
  if (!hasFullAccess && existingScoped) {
    console.log("Target state already reached: no full access key, scoped key present. Nothing to add.");
    return;
  }
  if (!hasFullAccess) fail("no FullAccess key found on " + AGENT_ID + " and no scoped key exists. Cannot proceed. Report the key list above.");
  if (existingScoped) fail("a scoped key already exists AND a full access key exists. Do not add a second scoped key. Report the key list above and stop.");

  const scopedKeyPair = KeyPair.fromRandom("ed25519");
  const scopedPubkey = scopedKeyPair.getPublicKey().toString();
  console.log("Generated fresh scoped public key: " + scopedPubkey);

  const perm = transactions.functionCallAccessKey(GUARD_ID, ["execute"], ALLOWANCE);
  const outcome = await account.signAndSendTransaction({
    receiverId: AGENT_ID,
    actions: [transactions.addKey(utils.PublicKey.from(scopedPubkey), perm)],
  });
  console.log("addKey transaction hash: " + outcome.transaction.hash);

  const after = await account.getAccessKeys();
  printKeys(after, "Keys AFTER add");
  const afterDescribed = after.map(describeKey);
  const scoped = afterDescribed.find((d) => d.publicKey === scopedPubkey);
  if (after.length !== 2) fail("expected exactly 2 keys after add, found " + after.length + ". STOP. Do not delete anything. Report the key list above.");
  if (!scoped || scoped.type !== "FunctionCall" || scoped.receiver !== GUARD_ID || JSON.stringify(scoped.methods) !== JSON.stringify(["execute"]) || scoped.allowance !== String(ALLOWANCE)) {
    fail("scoped key verification FAILED after add. STOP. Do not delete anything. Report the key list above.");
  }
  if (!afterDescribed.some((d) => d.type === "FullAccess")) fail("full access key missing after add (unexpected). STOP. Report the key list above.");

  const scopedCredPath = path.join(path.dirname(credPath), "agent2-scoped.json");
  const secret = scopedKeyPair.toString();
  fs.writeFileSync(scopedCredPath, JSON.stringify({
    account_id: AGENT_ID, agentAccountId: AGENT_ID, policyContractId: GUARD_ID,
    public_key: scopedPubkey, publicKey: scopedPubkey,
    private_key: secret, secret_key: secret, privateKey: secret,
    networkId: NETWORK_ID, nodeUrl: RPC_URL,
  }, null, 2), "utf-8");
  console.log("Scoped credentials saved to: " + scopedCredPath);
  console.log("ADD COMPLETE. Next: switch the server to the scoped credentials, prove it with the demo sequence, then run the delete mode.");
}

async function cmdDelete() {
  const credPath = findCredFile();
  const backupPath = process.env.AGENT2_FULLACCESS_BACKUP || path.join(path.dirname(credPath), "agent2-fullaccess-BACKUP.json");
  const signerPath = fs.existsSync(backupPath) ? backupPath : credPath;
  console.log("Using full access credentials file for delete: " + signerPath);
  const fullAccessKeyPair = loadKeyPair(signerPath);
  const fullAccessPubkey = fullAccessKeyPair.getPublicKey().toString();
  console.log("Full access public key: " + fullAccessPubkey);

  const account = await getAccount(fullAccessKeyPair);
  const before = await account.getAccessKeys();
  printKeys(before, "Keys BEFORE delete");
  const beforeDescribed = before.map(describeKey);
  const scoped = beforeDescribed.find((d) => d.type === "FunctionCall" && d.receiver === GUARD_ID && d.methods.includes("execute"));
  const hasFullAccess = beforeDescribed.some((d) => d.type === "FullAccess");
  if (!hasFullAccess && scoped && before.length === 1) {
    console.log("Target state already reached: exactly one scoped key, no full access key. Nothing to delete.");
    return;
  }
  if (!scoped) fail("no correct scoped key found. REFUSING to delete. The account would be left with no working key. STOP. Report the key list above.");
  if (scoped.allowance !== null && BigInt(scoped.allowance) <= BigInt(0)) fail("scoped key allowance is 0. REFUSING to delete. Report the key list above.");
  if (!hasFullAccess) fail("no full access key found but key list is not the clean target state. STOP. Report the key list above.");

  const outcome = await account.signAndSendTransaction({
    receiverId: AGENT_ID,
    actions: [transactions.deleteKey(utils.PublicKey.from(fullAccessPubkey))],
  });
  console.log("deleteKey transaction hash: " + outcome.transaction.hash);

  // Re-read with a fresh connection (the signer key is now gone; reads need no key).
  const near = await connect({ networkId: NETWORK_ID, nodeUrl: RPC_URL, keyStore: new keyStores.InMemoryKeyStore() });
  const readAccount = await near.account(AGENT_ID);
  const after = await readAccount.getAccessKeys();
  printKeys(after, "Keys AFTER delete");
  const afterDescribed = after.map(describeKey);
  if (after.length !== 1) fail("expected exactly 1 key after delete, found " + after.length + ". STOP. Report the key list above.");
  const remaining = afterDescribed[0];
  if (remaining.type !== "FunctionCall" || remaining.receiver !== GUARD_ID || JSON.stringify(remaining.methods) !== JSON.stringify(["execute"])) {
    fail("remaining key is not the correct scoped key. STOP. Report the key list above.");
  }
  console.log("DELETE COMPLETE. agent2 now holds exactly one key: scoped to scopeguard.testnet execute.");
}

async function main() {
  const mode = process.argv[2];
  if (mode === "add") await cmdAdd();
  else if (mode === "delete") await cmdDelete();
  else {
    console.error("Usage: node scripts/rotate-agent2-key.js add|delete");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("STOP: script failed: " + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
