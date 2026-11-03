const fs = require('fs');
const { execSync } = require('child_process');

const content = fs.readFileSync('.env', 'utf8');
let token = '';
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed.toLowerCase().includes('github token') || trimmed.startsWith('GITHUB_PAT')) {
    const parts = trimmed.split(/[:=]/);
    if (parts.length >= 2) {
      token = parts.slice(1).join(':').trim().replace(/^["']|["']$/g, '');
    }
  }
});

if (!token) {
  console.error('No token found in .env');
  process.exit(1);
}

const pushUrl = `https://${token}@github.com/Sergeo01/Scopeguard.git`;
console.log('Pushing to GitHub main...');
try {
  execSync(`git remote set-url origin ${pushUrl}`);
  const out = execSync(`git push origin main`, { stdio: 'pipe' }).toString();
  console.log(out);
  console.log('Push successful.');
} catch (err) {
  console.error('Git push error:', err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
