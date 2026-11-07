#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
process.env.AWS_LC_SYS_PREBUILT_NASM = process.env.AWS_LC_SYS_PREBUILT_NASM || "1";

const tempLedgerPath = path.join(os.tmpdir(), `scopeguard-verify-ledger-${Date.now()}.json`);
process.env.LEDGER_PATH = tempLedgerPath;

const trackedLedgerFile = path.join(rootDir, "web", "data", "activity-ledger.json");
const initialLedgerHash = fs.existsSync(trackedLedgerFile)
  ? crypto.createHash("sha256").update(fs.readFileSync(trackedLedgerFile)).digest("hex")
  : "";

const suites = [
  { name: "Rust Contracts", cmd: "cargo test --manifest-path contracts/Cargo.toml", cwd: rootDir },
  { name: "TypeScript SDK", cmd: "npm test", cwd: path.join(rootDir, "sdk") },
  { name: "Web Studio & Drafter", cmd: "npm test", cwd: path.join(rootDir, "web") },
  { name: "Stateless Watcher", cmd: "npm test", cwd: path.join(rootDir, "watcher") },
  { name: "IronClaw MCP Server", cmd: "npm test", cwd: path.join(rootDir, "packages", "ironclaw-mcp") },
  { name: "ElizaOS Plugin", cmd: "npm test", cwd: path.join(rootDir, "packages", "plugin-eliza") },
];

console.log("=== ScopeGuard Test Verification Suite ===\n");

const results = [];
let totalFailed = 0;

for (const suite of suites) {
  process.stdout.write(`[RUNNING] ${suite.name}... `);
  const start = Date.now();
  try {
    execSync(suite.cmd, {
      cwd: suite.cwd,
      stdio: "pipe",
      env: process.env,
    });
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`PASS (${elapsed}s)`);
    results.push({ name: suite.name, status: "PASS", duration: `${elapsed}s` });
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`FAIL (${elapsed}s)`);
    results.push({ name: suite.name, status: "FAIL", duration: `${elapsed}s` });
    totalFailed++;
  }
}

if (fs.existsSync(tempLedgerPath)) {
  try { fs.unlinkSync(tempLedgerPath); } catch {}
}

let ledgerPristine = true;
if (fs.existsSync(trackedLedgerFile)) {
  const finalLedgerHash = crypto.createHash("sha256").update(fs.readFileSync(trackedLedgerFile)).digest("hex");
  if (finalLedgerHash !== initialLedgerHash) {
    ledgerPristine = false;
  }
}

console.log("\n==============================================================");
console.log("               ScopeGuard Verification Summary");
console.log("==============================================================");
console.log(`${"Suite".padEnd(28)} ${"Status".padEnd(12)} ${"Duration"}`);
console.log("--------------------------------------------------------------");
for (const r of results) {
  console.log(`${r.name.padEnd(28)} ${r.status.padEnd(12)} ${r.duration}`);
}
console.log("--------------------------------------------------------------");
console.log(`Activity Ledger: ${ledgerPristine ? "Pristine (unchanged)" : "MODIFIED (ERROR)"}`);
console.log(`Overall Result:  ${totalFailed === 0 && ledgerPristine ? "PASS (6/6 suites passed)" : "FAIL"}`);
console.log("==============================================================\n");

if (totalFailed > 0 || !ledgerPristine) {
  process.exit(1);
} else {
  process.exit(0);
}
