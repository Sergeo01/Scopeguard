const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceEnvPath = 'D:\\Antigravity\\WhatsApp business manager\\.env';
const localWebEnv = 'd:\\Hackathon\\NEAR\\web\\.env.local';

if (!fs.existsSync(sourceEnvPath)) {
  console.error('Source .env does not exist:', sourceEnvPath);
  process.exit(1);
}

const sourceContent = fs.readFileSync(sourceEnvPath, 'utf8');
let supabaseUrl = '';
let supabaseAnonKey = '';

sourceContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('SUPABASE_URL=')) {
    supabaseUrl = trimmed.substring('SUPABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
  } else if (trimmed.startsWith('SUPABASE_ANON_KEY=')) {
    supabaseAnonKey = trimmed.substring('SUPABASE_ANON_KEY='.length).trim().replace(/^["']|["']$/g, '');
  }
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Failed to extract SUPABASE_URL or SUPABASE_ANON_KEY from source');
  process.exit(1);
}

console.log('Extracted Supabase URL domain:', new URL(supabaseUrl).hostname);

// Read existing local web/.env.local
let existing = fs.existsSync(localWebEnv) ? fs.readFileSync(localWebEnv, 'utf8') : '';

// Remove any existing SUPABASE_* lines to avoid duplication
const filteredLines = existing.split('\n').filter(line => {
  const k = line.split('=')[0].trim();
  return !k.includes('SUPABASE');
});

const newEnvBlock = [
  ...filteredLines,
  '',
  '# Supabase Authentication Credentials',
  `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey}`,
  `SUPABASE_URL=${supabaseUrl}`,
  `SUPABASE_ANON_KEY=${supabaseAnonKey}`,
  ''
].join('\n');

fs.writeFileSync(localWebEnv, newEnvBlock, 'utf8');
console.log('Successfully updated local web/.env.local');

// Now prepare to deploy to VPS
const key = process.env.USERPROFILE + '\\.ssh\\deploy_key';
const hostip = 'root@76.13.255.164';

console.log('Deploying .env.local and lib/supabase.ts to VPS...');

// Push supabase.ts
const supabaseTs = fs.readFileSync('d:\\Hackathon\\NEAR\\web\\lib\\supabase.ts', 'utf8');
execSync(`ssh -i "${key}" -o StrictHostKeyChecking=no ${hostip} "cat > /var/www/scopeguard/web/lib/supabase.ts"`, {
  input: supabaseTs,
  stdio: ['pipe', 'inherit', 'inherit']
});

// Push web/.env.local
execSync(`ssh -i "${key}" -o StrictHostKeyChecking=no ${hostip} "cat > /var/www/scopeguard/web/.env.local"`, {
  input: newEnvBlock,
  stdio: ['pipe', 'inherit', 'inherit']
});

console.log('Files transferred to VPS. Running production build and PM2 reload...');
execSync(`ssh -i "${key}" -o StrictHostKeyChecking=no ${hostip} "cd /var/www/scopeguard/web && npm run build && pm2 reload scopeguard"`, {
  stdio: 'inherit'
});

console.log('Production build and reload completed successfully!');
