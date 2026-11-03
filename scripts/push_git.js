/**
 * Push main to GitHub without ever writing the token into .git/config.
 *
 * The old version called `git remote set-url origin <token>@github.com/...` and
 * left it there, permanently persisting a password-equivalent credential in a
 * local config file. This version:
 *
 *   1. leaves the remote URL clean forever,
 *   2. passes the credential as a single per-invocation HTTP header,
 *   3. never prints the token.
 *
 * The user and password come from .env:
 *   GITHUB_PAT=ghp_...          (preferred)
 *   or GITHUB_TOKEN=ghp_...
 *
 * A fine-grained PAT scoped to this repository is sufficient.
 */
const fs = require("fs");
const { execSync } = require("child_process");

const REMOTE = "https://github.com/Sergeo01/Scopeguard.git";

function loadToken() {
  const content = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
  let token = "";
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(GITHUB_PAT|GITHUB_TOKEN|GITHUB\s+TOKEN)\s*[=:]\s*(.+)$/i);
    if (match) {
      token = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return token || process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || "";
}

const token = loadToken();
if (!token) {
  console.error("No GitHub token found. Set GITHUB_PAT=<token> in .env.");
  process.exit(1);
}

// Never print the token, never embed it in a remote URL.
const auth = Buffer.from(`x-access-token:${token}`).toString("base64");

try {
  execSync(`git remote set-url origin ${REMOTE}`);
  const out = execSync(
    `git -c http.extraHeader="Authorization: Basic ${auth}" push origin main`,
    { stdio: ["pipe", "pipe", "pipe"] }
  ).toString();
  console.log("Push successful.");
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : err.message;
  // Redact any accidental token echoes before printing.
  console.error("Git push failed:", stderr.replace(new RegExp(token, "g"), "***"));
  process.exit(1);
}
