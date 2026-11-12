const { execSync } = require("child_process");

function runSsh(command) {
  const sshCmd = `ssh -p 4443 -i "C:\\Users\\ROG ZEPHYRUS\\.ssh\\deploy_key" -o StrictHostKeyChecking=no root@76.13.255.164 "${command}"`;
  console.log(`[SSH] Running: ${command}`);
  const out = execSync(sshCmd, { stdio: "inherit" });
}

function runRemotePython(code) {
  const b64 = Buffer.from(code).toString("base64");
  const sshCmd = `ssh -p 4443 -i "C:\\Users\\ROG ZEPHYRUS\\.ssh\\deploy_key" -o StrictHostKeyChecking=no root@76.13.255.164 "echo ${b64} | base64 -d | python3"`;
  execSync(sshCmd, { stdio: "inherit" });
}

try {
  // 1. Update Caddyfile with HSTS
  console.log("Adding HSTS header to Caddyfile...");
  runRemotePython(`
with open('/etc/caddy/Caddyfile', 'r') as f:
    c = f.read()
target = 'scopeguard.blockframe.cloud {'
hsts = 'scopeguard.blockframe.cloud {\\n\\theader Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"'
if 'Strict-Transport-Security' not in c:
    c = c.replace(target, hsts, 1)
    with open('/etc/caddy/Caddyfile', 'w') as f:
        f.write(c)
    print('HSTS header successfully added to Caddyfile')
else:
    print('HSTS header already present')
`);

  runSsh("caddy reload --config /etc/caddy/Caddyfile");
  console.log("Caddy reloaded!");

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
