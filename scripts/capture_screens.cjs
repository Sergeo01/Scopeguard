const { execSync } = require('child_process');
const path = require('path');

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const artDir = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\antigravity\\brain\\0ebc59da-bcd1-459d-ab9a-7f1003be33bd';

const routes = [
  { url: 'http://localhost:3000/', file: 'studio_home.png' },
  { url: 'http://localhost:3000/dashboard', file: 'studio_dashboard.png' },
  { url: 'http://localhost:3000/create', file: 'studio_create.png' },
  { url: 'http://localhost:3000/create?issued=true', file: 'studio_handoff.png' }
];

for (const r of routes) {
  const dest = path.join(artDir, r.file);
  const cmd = `${chrome} --headless=new --hide-scrollbars --window-size=1440,1400 --screenshot="${dest}" ${r.url}`;
  console.log(`Capturing ${r.url} -> ${r.file}...`);
  execSync(cmd, { stdio: 'inherit' });
}
console.log('Finished capturing all screenshots.');
