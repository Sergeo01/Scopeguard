import test from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

test("Next.js bundler inlines NEXT_PUBLIC_POLICY_CONTRACT_ID into client chunks under .next/static", { timeout: 60000 }, () => {
  const webDir = path.resolve(__dirname, "..");
  const testContractId = "inlined-test-guard-contract-1234.testnet";
  const realTmp = fs.mkdtempSync(path.join(os.tmpdir(), "next-build-"));
  const junctionName = ".tmp-build-" + Date.now();
  const junctionPath = path.join(webDir, junctionName);
  const nodeModules = path.join(webDir, "node_modules");
  const tsConfigPath = path.join(webDir, "tsconfig.json");
  const nextEnvPath = path.join(webDir, "next-env.d.ts");
  const origTsConfig = fs.existsSync(tsConfigPath) ? fs.readFileSync(tsConfigPath, "utf8") : null;
  const origNextEnv = fs.existsSync(nextEnvPath) ? fs.readFileSync(nextEnvPath, "utf8") : null;

  try {
    try {
      fs.symlinkSync(realTmp, junctionPath, "junction");
    } catch {}

    const distDirTarget = fs.existsSync(junctionPath) ? junctionName : realTmp;

    execSync("node ./node_modules/next/dist/bin/next build", {
      cwd: webDir,
      env: {
        ...process.env,
        NODE_PATH: (process.env.NODE_PATH ? process.env.NODE_PATH + path.delimiter : "") + nodeModules,
        NEXT_DIST_DIR: distDirTarget,
        NEXT_PUBLIC_POLICY_CONTRACT_ID: testContractId,
      },
      stdio: "pipe",
    });

    const chunksDir = path.join(realTmp, "static", "chunks");
    assert.ok(fs.existsSync(chunksDir), "Static chunks directory must exist in temporary distDir under os.tmpdir()");

    function findChunks(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...findChunks(fullPath));
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const chunkFiles = findChunks(chunksDir);
    assert.ok(chunkFiles.length > 0, "Build must produce client chunks");

    const matchingChunks = chunkFiles.filter((filePath) => {
      const content = fs.readFileSync(filePath, "utf8");
      return content.includes(testContractId);
    });

    assert.ok(
      matchingChunks.length > 0,
      `Expected NEXT_PUBLIC_POLICY_CONTRACT_ID (${testContractId}) to be inlined into at least one client chunk, but found in none.`
    );
  } finally {
    try {
      if (fs.existsSync(junctionPath)) {
        fs.unlinkSync(junctionPath);
      }
    } catch {}
    try {
      fs.rmSync(realTmp, { recursive: true, force: true });
    } catch {}
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
});
