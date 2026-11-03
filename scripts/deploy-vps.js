const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const key = path.join(os.homedir(), '.ssh', 'deploy_key');
const host = 'root@76.13.255.164';

console.log('Uploading updated web files to VPS...');

const filesToUpload = [
  { local: path.join(__dirname, '..', 'web', 'package.json'), remote: '/var/www/scopeguard/web/package.json' },
  { local: path.join(__dirname, '..', 'web', 'lib', 'wallet-selector.ts'), remote: '/var/www/scopeguard/web/lib/wallet-selector.ts' },
  { local: path.join(__dirname, '..', 'web', 'context', 'WalletContext.tsx'), remote: '/var/www/scopeguard/web/context/WalletContext.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'AuthModal.tsx'), remote: '/var/www/scopeguard/web/components/AuthModal.tsx' },
];

for (const f of filesToUpload) {
  console.log(`Uploading ${f.local} -> ${f.remote}...`);
  execSync(`scp -i "${key}" -o StrictHostKeyChecking=no "${f.local}" ${host}:${f.remote}`);
}

console.log('Running npm install, build, and pm2 reload on VPS...');
const cmd = `ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "cd /var/www/scopeguard/web && npm install --save @near-wallet-selector/core @near-wallet-selector/modal-ui @near-wallet-selector/my-near-wallet @near-wallet-selector/meteor-wallet @near-wallet-selector/here-wallet @near-wallet-selector/sender && npm run build && pm2 reload scopeguard"`;
const out = execSync(cmd, { stdio: 'pipe' }).toString();
console.log(out);
console.log('VPS production deployment updated successfully!');
