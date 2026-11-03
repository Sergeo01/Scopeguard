const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const key = path.join(os.homedir(), '.ssh', 'deploy_key');
const host = 'root@76.13.255.164';

console.log('Deploying updated web files to VPS...');

// 1. Upload updated files
const filesToUpload = [
  { local: path.join(__dirname, '..', 'web', 'package.json'), remote: '/var/www/scopeguard/web/package.json' },
  { local: path.join(__dirname, '..', 'web', 'package-lock.json'), remote: '/var/www/scopeguard/web/package-lock.json' },
  { local: path.join(__dirname, '..', 'web', 'lib', 'wallet-selector.ts'), remote: '/var/www/scopeguard/web/lib/wallet-selector.ts' },
  { local: path.join(__dirname, '..', 'web', 'context', 'WalletContext.tsx'), remote: '/var/www/scopeguard/web/context/WalletContext.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'AuthModal.tsx'), remote: '/var/www/scopeguard/web/components/AuthModal.tsx' },
];

for (const f of filesToUpload) {
  console.log(`Uploading ${f.local} -> ${f.remote}...`);
  execSync(`scp -i "${key}" -o StrictHostKeyChecking=no "${f.local}" ${host}:${f.remote}`);
}

// 2. Run install, build and pm2 reload on VPS
console.log('Installing dependencies, rebuilding web on VPS and reloading PM2...');
const out = execSync(`ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "cd /var/www/scopeguard/web && npm install && npm run build && pm2 reload scopeguard"`, { stdio: 'pipe' }).toString();
console.log(out);
console.log('VPS production deployment updated successfully!');
