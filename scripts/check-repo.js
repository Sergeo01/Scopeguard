#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error("FAIL: " + msg);
}

// ---------------------------------------------------------------------------
// Check A: No tracked files contain legacy hardcoded contract ID
// (except web/data/activity-ledger.json which holds real historical entries)
// ---------------------------------------------------------------------------
const legacyContract = ["guard2", "sergeo-guard", "testnet"].join(".");
console.log(`Checking A: No tracked files contain '${legacyContract}' (except ledger)...`);
try {
  const stdout = execSync(`git grep -n "${legacyContract}" -- . ":!web/data/activity-ledger.json" ":!scripts/check-repo.js"`, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (stdout.trim().length > 0) {
    fail(`Check A: Found '${legacyContract}' in tracked files:\n` + stdout.trim());
  }
} catch (err) {
  if (err.status !== 1) {
    fail("Check A: git grep command failed with error: " + (err.stderr || err.message));
  }
}

// ---------------------------------------------------------------------------
// Check B: No client component under web/app, web/components, or web/lib
// calls throwing getPolicyContractId() or getGuardContractId().
// ---------------------------------------------------------------------------
console.log("Checking B: Client components use safe tryGet* variants...");
const clientDirs = ["web/app", "web/components", "web/lib"];
function checkClientFiles(dir) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) return;
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const ent of entries) {
    const fullPath = path.join(fullDir, ent.name);
    if (ent.isDirectory()) {
      checkClientFiles(path.join(dir, ent.name));
    } else if (/\.(ts|tsx|js|jsx)$/.test(ent.name)) {
      const content = fs.readFileSync(fullPath, "utf8");
      const isClient = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/.test(content);
      if (isClient) {
        if (/getPolicyContractId\s*\(/.test(content)) {
          fail(`Check B: ${path.relative(rootDir, fullPath)} is a client component but calls getPolicyContractId()`);
        }
        if (/getGuardContractId\s*\(/.test(content)) {
          fail(`Check B: ${path.relative(rootDir, fullPath)} is a client component but calls getGuardContractId()`);
        }
      }
    }
  }
}
clientDirs.forEach(checkClientFiles);

// ---------------------------------------------------------------------------
// Check C: Every reason code defined in contracts/policy/src/types.rs
// appears in docs/policy-reference.md
// ---------------------------------------------------------------------------
console.log("Checking C: Policy contract reason codes documented in policy-reference.md...");
const typesPath = path.join(rootDir, "contracts", "policy", "src", "types.rs");
const docsPolicyPath = path.join(rootDir, "docs", "policy-reference.md");
if (!fs.existsSync(typesPath)) {
  fail("Check C: contracts/policy/src/types.rs not found");
} else if (!fs.existsSync(docsPolicyPath)) {
  fail("Check C: docs/policy-reference.md not found");
} else {
  const typesContent = fs.readFileSync(typesPath, "utf8");
  const docsPolicyContent = fs.readFileSync(docsPolicyPath, "utf8");
  const reasonMatches = [...typesContent.matchAll(/pub\s+const\s+REASON_[A-Z0-9_]+:\s*&str\s*=\s*"([^"]+)";/g)];
  if (reasonMatches.length === 0) {
    fail("Check C: Could not extract reason code constants from types.rs");
  } else {
    for (const match of reasonMatches) {
      const code = match[1];
      if (!docsPolicyContent.includes(code)) {
        fail(`Check C: Reason code "${code}" from types.rs is missing from docs/policy-reference.md`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check D: README.md, docs/*.md, and web/app/**/*.tsx contain no hardcoded test counts
// ---------------------------------------------------------------------------
console.log("Checking D: No hardcoded test count tallies in docs or web UI...");
const testCountRegex = /\b\d+\s+(?:passing\s+|unit\s+|property\s+)?tests?\b/i;
const docFiles = [path.join(rootDir, "README.md")];
const docsDir = path.join(rootDir, "docs");
if (fs.existsSync(docsDir)) {
  for (const f of fs.readdirSync(docsDir)) {
    if (f.endsWith(".md")) docFiles.push(path.join(docsDir, f));
  }
}
function collectTsx(dir) {
  const full = path.join(rootDir, dir);
  if (!fs.existsSync(full)) return;
  for (const ent of fs.readdirSync(full, { withFileTypes: true })) {
    const p = path.join(full, ent.name);
    if (ent.isDirectory()) collectTsx(path.join(dir, ent.name));
    else if (ent.name.endsWith(".tsx")) docFiles.push(p);
  }
}
collectTsx("web/app");

for (const filePath of docFiles) {
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (testCountRegex.test(line)) {
      fail(`Check D: Hardcoded test count in ${path.relative(rootDir, filePath)}:${i + 1}: ${line.trim()}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check E: docs/threat-model.md contains "full-access"
// ---------------------------------------------------------------------------
console.log("Checking E: docs/threat-model.md documents full-access account key risk...");
const threatModelPath = path.join(rootDir, "docs", "threat-model.md");
if (!fs.existsSync(threatModelPath)) {
  fail("Check E: docs/threat-model.md not found");
} else {
  const threatContent = fs.readFileSync(threatModelPath, "utf8");
  if (!threatContent.includes("full-access")) {
    fail("Check E: docs/threat-model.md does not contain 'full-access'");
  }
}

// ---------------------------------------------------------------------------
// Check F: NEXT_DIST_DIR appears in web/next.config.js and web/test/bundle-inlining.test.ts
// ---------------------------------------------------------------------------
console.log("Checking F: NEXT_DIST_DIR configured in next.config.js and bundle test...");
const nextConfigPath = path.join(rootDir, "web", "next.config.js");
const bundleTestPath = path.join(rootDir, "web", "test", "bundle-inlining.test.ts");
if (!fs.existsSync(nextConfigPath) || !fs.readFileSync(nextConfigPath, "utf8").includes("NEXT_DIST_DIR")) {
  fail("Check F: NEXT_DIST_DIR missing from web/next.config.js");
}
if (!fs.existsSync(bundleTestPath) || !fs.readFileSync(bundleTestPath, "utf8").includes("NEXT_DIST_DIR")) {
  fail("Check F: NEXT_DIST_DIR missing from web/test/bundle-inlining.test.ts");
}

// ---------------------------------------------------------------------------
// Check G: Toolchain channel in rust-toolchain.toml appears in README.md and CI
// ---------------------------------------------------------------------------
console.log("Checking G: Rust toolchain channel consistency...");
const toolchainPath = path.join(rootDir, "rust-toolchain.toml");
const readmePath = path.join(rootDir, "README.md");
const ciPath = path.join(rootDir, ".github", "workflows", "ci.yml");
if (!fs.existsSync(toolchainPath)) {
  fail("Check G: rust-toolchain.toml not found");
} else {
  const toolchainContent = fs.readFileSync(toolchainPath, "utf8");
  const channelMatch = toolchainContent.match(/channel\s*=\s*"([^"]+)"/);
  if (!channelMatch) {
    fail("Check G: Could not extract channel from rust-toolchain.toml");
  } else {
    const channel = channelMatch[1];
    if (!fs.existsSync(readmePath) || !fs.readFileSync(readmePath, "utf8").includes(channel)) {
      fail(`Check G: Toolchain channel "${channel}" missing from README.md`);
    }
    if (!fs.existsSync(ciPath) || !fs.readFileSync(ciPath, "utf8").includes(channel)) {
      fail(`Check G: Toolchain channel "${channel}" missing from .github/workflows/ci.yml`);
    }
  }
}

// ---------------------------------------------------------------------------
// Full check: Next.js builds with unset env and with inlined contract ID
// ---------------------------------------------------------------------------
const isFull = process.argv.includes("--full");
if (isFull) {
  console.log("Checking Full: Running Next.js build verification...");
  const webDir = path.join(rootDir, "web");
  const tsConfigPath = path.join(webDir, "tsconfig.json");
  const nextEnvPath = path.join(webDir, "next-env.d.ts");
  const envLocalPath = path.join(webDir, ".env.local");
  const envLocalBakPath = path.join(webDir, ".env.local.checkbak");

  const origTsConfig = fs.existsSync(tsConfigPath) ? fs.readFileSync(tsConfigPath, "utf8") : null;
  const origNextEnv = fs.existsSync(nextEnvPath) ? fs.readFileSync(nextEnvPath, "utf8") : null;
  const hadEnvLocal = fs.existsSync(envLocalPath);

  function runBuild(label, envVars, onChunks) {
    console.log(`Building Next.js (${label})...`);
    const realTmp = fs.mkdtempSync(path.join(os.tmpdir(), "sg-check-"));
    const junctionName = ".tmp-check-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const junctionPath = path.join(webDir, junctionName);
    const nodeModules = path.join(webDir, "node_modules");

    try {
      try {
        fs.symlinkSync(realTmp, junctionPath, process.platform === "win32" ? "junction" : "dir");
      } catch {}

      const distDirTarget = fs.existsSync(junctionPath) ? junctionName : realTmp;

      const baseEnv = { ...process.env };
      delete baseEnv.NEXT_PUBLIC_POLICY_CONTRACT_ID;
      delete baseEnv.SCOPEGUARD_POLICY_CONTRACT;
      delete baseEnv.NEXT_PUBLIC_OWNER_ACCOUNT_ID;
      delete baseEnv.NEXT_PUBLIC_TOKEN_CONTRACT;
      delete baseEnv.NEXT_PUBLIC_DEX_CONTRACT;
      delete baseEnv.NEXT_PUBLIC_NEAR_NETWORK;
      delete baseEnv.NEXT_PUBLIC_NEAR_RPC;

      execSync("node ./node_modules/next/dist/bin/next build", {
        cwd: webDir,
        env: {
          ...baseEnv,
          NODE_PATH: (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : "") + nodeModules,
          NEXT_DIST_DIR: distDirTarget,
          ...envVars,
        },
        stdio: "pipe",
      });

      if (onChunks) {
        const chunksDir = path.join(realTmp, "static", "chunks");
        if (!fs.existsSync(chunksDir)) {
          fail(`Full check (${label}): Chunks directory missing in build output`);
        } else {
          function findChunks(dir) {
            const res = [];
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, ent.name);
              if (ent.isDirectory()) res.push(...findChunks(full));
              else if (ent.isFile() && ent.name.endsWith(".js")) res.push(full);
            }
            return res;
          }
          const chunks = findChunks(chunksDir);
          onChunks(chunks);
        }
      }
    } finally {
      try {
        if (fs.existsSync(junctionPath)) fs.unlinkSync(junctionPath);
      } catch {}
      try {
        fs.rmSync(realTmp, { recursive: true, force: true });
      } catch {}
    }
  }

  try {
    if (hadEnvLocal) {
      fs.renameSync(envLocalPath, envLocalBakPath);
    }

    // 1. Build with env unset
    try {
      runBuild("env unset", {}, null);
      console.log("Next.js build with env unset passed.");
    } catch (err) {
      fail("Full check: Next.js build failed with env unset: " + (err.stderr ? err.stderr.toString() : err.message));
    }

    // 2. Build with NEXT_PUBLIC_POLICY_CONTRACT_ID=check-guard.testnet
    const testId = "check-guard.testnet";
    try {
      runBuild("with contract ID set", { NEXT_PUBLIC_POLICY_CONTRACT_ID: testId }, (chunks) => {
        const matched = chunks.filter((c) => fs.readFileSync(c, "utf8").includes(testId));
        if (matched.length === 0) {
          fail(`Full check: "${testId}" not found in any client chunk under static/chunks`);
        } else {
          console.log(`Found "${testId}" in ${matched.length} client chunk(s).`);
        }
      });
      console.log("Next.js build with contract ID inlining passed.");
    } catch (err) {
      fail("Full check: Next.js build failed with contract ID: " + (err.stderr ? err.stderr.toString() : err.message));
    }
  } finally {
    if (hadEnvLocal && fs.existsSync(envLocalBakPath)) {
      try {
        fs.renameSync(envLocalBakPath, envLocalPath);
      } catch {}
    }
    if (origTsConfig !== null) {
      try {
        fs.writeFileSync(tsConfigPath, origTsConfig, "utf8");
      } catch {}
    }
    if (origNextEnv !== null) {
      try {
        fs.writeFileSync(nextEnvPath, origNextEnv, "utf8");
      } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// Report and exit
// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`\nCheck failed with ${failures.length} error(s).`);
  process.exit(1);
} else {
  console.log("\nAll repository integrity checks passed.");
  process.exit(0);
}
