#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

function run(cmd, cwd = rootDir) {
  console.log(`\n> ${cmd} (in ${path.relative(rootDir, cwd) || "."})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log("=== ScopeGuard Project Setup ===");

// 1. Install and build SDK first (required dependency for other packages)
const sdkDir = path.join(rootDir, "sdk");
run("npm install", sdkDir);
run("npm run build", sdkDir);

// 2. Install dependencies for all other packages
const packages = [
  "drafter",
  "demo-agent",
  "watcher",
  "packages/ironclaw-mcp",
  "packages/plugin-eliza",
  "web",
];

for (const pkg of packages) {
  const pkgDir = path.join(rootDir, pkg);
  run("npm install", pkgDir);
}

console.log("\n=== Setup Complete ===");
