import test from "node:test";
import assert from "node:assert";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

test("Next.js bundler inlines NEXT_PUBLIC_POLICY_CONTRACT_ID into client chunks under .next/static", { timeout: 60000 }, () => {
  const webDir = path.resolve(__dirname, "..");
  const testContractId = "inlined-test-guard-contract-1234.testnet";

  // Build web application with NEXT_PUBLIC_POLICY_CONTRACT_ID explicitly set
  execSync("node ./node_modules/next/dist/bin/next build", {
    cwd: webDir,
    env: {
      ...process.env,
      NEXT_PUBLIC_POLICY_CONTRACT_ID: testContractId,
    },
    stdio: "pipe",
  });

  // Verify that testContractId exists in at least one client JavaScript chunk
  const chunksDir = path.join(webDir, ".next", "static", "chunks");
  assert.ok(fs.existsSync(chunksDir), ".next/static/chunks directory must exist");

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
});
