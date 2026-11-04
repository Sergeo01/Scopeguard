const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const key = path.join(os.homedir(), '.ssh', 'deploy_key');
const host = 'root@76.13.255.164';

console.log('Uploading updated web files to VPS...');

const filesToUpload = [
  { local: path.join(__dirname, '..', 'web', 'package.json'), remote: '/var/www/scopeguard/web/package.json' },
  { local: path.join(__dirname, '..', 'web', 'lib', 'wallet-selector.ts'), remote: '/var/www/scopeguard/web/lib/wallet-selector.ts' },
  { local: path.join(__dirname, '..', 'web', 'lib', 'admin.ts'), remote: '/var/www/scopeguard/web/lib/admin.ts' },
  { local: path.join(__dirname, '..', 'web', 'lib', 'ledger.ts'), remote: '/var/www/scopeguard/web/lib/ledger.ts' },
  { local: path.join(__dirname, '..', 'web', 'lib', 'drafter.ts'), remote: '/var/www/scopeguard/web/lib/drafter.ts' },
  { local: path.join(__dirname, '..', 'web', 'context', 'WalletContext.tsx'), remote: '/var/www/scopeguard/web/context/WalletContext.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'AuthModal.tsx'), remote: '/var/www/scopeguard/web/components/AuthModal.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'ReceiptModal.tsx'), remote: '/var/www/scopeguard/web/components/ReceiptModal.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'AttackAutopsy.tsx'), remote: '/var/www/scopeguard/web/components/AttackAutopsy.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'BudgetVelocityGauge.tsx'), remote: '/var/www/scopeguard/web/components/BudgetVelocityGauge.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'PlatformPresets.tsx'), remote: '/var/www/scopeguard/web/components/PlatformPresets.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'WebhookAlertSettings.tsx'), remote: '/var/www/scopeguard/web/components/WebhookAlertSettings.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'create', 'page.tsx'), remote: '/var/www/scopeguard/web/app/create/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'dashboard', 'page.tsx'), remote: '/var/www/scopeguard/web/app/dashboard/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'docs', 'page.tsx'), remote: '/var/www/scopeguard/web/app/docs/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'api', 'tx', 'route.ts'), remote: '/var/www/scopeguard/web/app/api/tx/route.ts' },
  { local: path.join(__dirname, '..', 'web', 'app', 'api', 'alerts', 'test', 'route.ts'), remote: '/var/www/scopeguard/web/app/api/alerts/test/route.ts' },
];

for (const f of filesToUpload) {
  console.log(`Uploading ${f.local} -> ${f.remote}...`);
  execSync(`scp -i "${key}" -o StrictHostKeyChecking=no "${f.local}" ${host}:${f.remote}`);
}

console.log('Running build and pm2 restart on VPS...');
const cmd = `ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "cd /var/www/scopeguard/web && npm run build && pm2 restart scopeguard"`;
const out = execSync(cmd, { stdio: 'pipe' }).toString();
console.log(out);
console.log('VPS production deployment updated successfully!');
