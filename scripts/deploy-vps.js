const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const key = path.join(os.homedir(), '.ssh', 'deploy_key');
const host = 'root@76.13.255.164';

console.log('Deploying updated web files to VPS...');

// 1. Upload updated files
const filesToUpload = [
  { local: path.join(__dirname, '..', 'web', 'app', 'layout.tsx'), remote: '/var/www/scopeguard/web/app/layout.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'page.tsx'), remote: '/var/www/scopeguard/web/app/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'docs', 'page.tsx'), remote: '/var/www/scopeguard/web/app/docs/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'create', 'page.tsx'), remote: '/var/www/scopeguard/web/app/create/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'app', 'dashboard', 'page.tsx'), remote: '/var/www/scopeguard/web/app/dashboard/page.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'AuthModal.tsx'), remote: '/var/www/scopeguard/web/components/AuthModal.tsx' },
  { local: path.join(__dirname, '..', 'web', 'components', 'IncidentExportModal.tsx'), remote: '/var/www/scopeguard/web/components/IncidentExportModal.tsx' },
];

for (const f of filesToUpload) {
  console.log(`Uploading ${f.local} -> ${f.remote}...`);
  execSync(`scp -i "${key}" -o StrictHostKeyChecking=no "${f.local}" ${host}:${f.remote}`);
}

// 2. Run build and pm2 reload on VPS
console.log('Rebuilding web on VPS and reloading PM2...');
const out = execSync(`ssh -i "${key}" -o StrictHostKeyChecking=no ${host} "cd /var/www/scopeguard/web && npm run build && pm2 reload scopeguard"`, { stdio: 'pipe' }).toString();
console.log(out);
console.log('VPS production deployment updated successfully!');
