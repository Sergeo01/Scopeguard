const { execSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const key = path.join(os.homedir(), ".ssh", "deploy_key");
const host = "root@76.13.255.164";
const webDir = path.join(__dirname, "..", "web");
const tarPath = path.join(__dirname, "..", "deploy.tar.gz");

console.log("Packaging deployment tarball...");
execSync(`tar -czf "${tarPath}" app components context lib public package.json next.config.js tsconfig.json`, { cwd: webDir });

console.log("Transferring archive to VPS via scp...");
execSync(`scp -i "${key}" -o StrictHostKeyChecking=no "${tarPath}" ${host}:/var/www/scopeguard/web/deploy.tar.gz`);

if (fs.existsSync(tarPath)) {
  fs.unlinkSync(tarPath);
}

console.log("Extracting, building, and reloading PM2 on VPS...");
const cmd = `ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "cd /var/www/scopeguard/web && tar -xzf deploy.tar.gz && rm deploy.tar.gz && npm run build && pm2 reload scopeguard"`;
const out = execSync(cmd, { stdio: "pipe" }).toString();
console.log(out);
console.log("VPS production deployment updated successfully!");
