const { execSync } = require('child_process');
const path = require('path');

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const artDir = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\antigravity\\brain\\0ebc59da-bcd1-459d-ab9a-7f1003be33bd';

const routes = [
  { url: 'https://scopeguard.blockframe.cloud/', file: 'live_beatapi_landing.png' },
  { url: 'https://scopeguard.blockframe.cloud/dashboard', file: 'live_beatapi_dashboard.png' },
  { url: 'https://scopeguard.blockframe.cloud/create', file: 'live_beatapi_create.png' }
];

for (const r of routes) {
  const dest = path.join(artDir, r.file);
  const cmd = `${chrome} --headless=new --hide-scrollbars --window-size=1440,1200 --screenshot="${dest}" "${r.url}"`;
  console.log(`Capturing ${r.url} -> ${r.file}...`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    console.error(`Failed to capture ${r.url}:`, e.message);
  }
}
console.log('Finished capturing all live screenshots.');
