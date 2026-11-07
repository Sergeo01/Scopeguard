#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");

process.env.AWS_LC_SYS_PREBUILT_NASM = process.env.AWS_LC_SYS_PREBUILT_NASM || "1";

// Ensure all test executions write activity logs to an ephemeral temp file
const tempLedgerPath = path.join(os.tmpdir(), `scopeguard-suite-ledger-${Date.now()}.json`);
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

console.log("=== Running All ScopeGuard Test Suites ===\n");

let failed = 0;
for (const suite of suites) {
  console.log(`--- [Suite] ${suite.name} ---`);
  try {
    execSync(suite.cmd, { cwd: suite.cwd, stdio: "inherit", env: process.env });
    console.log(`[PASS] ${suite.name}\n`);
  } catch (err) {
    console.error(`[FAIL] ${suite.name}\n`);
    failed++;
  }
}

// Clean up temp test ledger if created
if (fs.existsSync(tempLedgerPath)) {
  try { fs.unlinkSync(tempLedgerPath); } catch {}
}

// Verify tracked activity ledger was never dirtied by any test suite
if (fs.existsSync(trackedLedgerFile)) {
  const finalLedgerHash = crypto.createHash("sha256").update(fs.readFileSync(trackedLedgerFile)).digest("hex");
  if (finalLedgerHash !== initialLedgerHash) {
    console.error("CRITICAL: Tracked web/data/activity-ledger.json was modified during test suite execution!");
    process.exit(1);
  }
}

if (failed > 0) {
  console.error(`=== Test Run Failed: ${failed} suite(s) failed ===`);
  process.exit(1);
} else {
  console.log("=== All Test Suites Passed Successfully (Ledger Pristine) ===");
  process.exit(0);
}
