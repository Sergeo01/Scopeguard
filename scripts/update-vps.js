const { execSync } = require("child_process");

function runSsh(command) {
  const sshCmd = `ssh -p 4443 -i "C:\\Users\\ROG ZEPHYRUS\\.ssh\\deploy_key" -o StrictHostKeyChecking=no -o ConnectionAttempts=3 root@76.13.255.164 "${command}"`;
  console.log(`[SSH] Running: ${command}`);
  let retries = 5;
  while (retries > 0) {
    try {
      execSync(sshCmd, { stdio: "inherit" });
      return;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.log(`[SSH] Command failed, retrying in 12 seconds... (${retries} left)`);
      execSync("powershell -Command Start-Sleep -Seconds 12");
    }
  }
}

function runRemotePython(code) {
  const b64 = Buffer.from(code).toString("base64");
  const sshCmd = `ssh -p 4443 -i "C:\\Users\\ROG ZEPHYRUS\\.ssh\\deploy_key" -o StrictHostKeyChecking=no root@76.13.255.164 "echo ${b64} | base64 -d | python3"`;
  execSync(sshCmd, { stdio: "inherit" });
}

try {
  // 1. Sync repository with latest origin/main
  console.log("Syncing repository from origin/main on VPS...");
  runSsh("cd /var/www/scopeguard && git fetch origin && git reset --hard origin/main && git log -n 1 --oneline");

  // 2. Rebuild Next.js web on VPS
  console.log("Building Next.js on VPS...");
  runSsh("cd /var/www/scopeguard/web && npm run build");

  // 3. Restart PM2
  console.log("Restarting PM2 process 2 (scopeguard)...");
  runSsh("pm2 restart 2");

  console.log("\n[PASS] VPS deployment and restart completed successfully!");
} catch (err) {
  console.error("Error updating VPS:", err.message);
  process.exit(1);
}
