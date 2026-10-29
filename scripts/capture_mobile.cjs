const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const artDir = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\antigravity\\brain\\0ebc59da-bcd1-459d-ab9a-7f1003be33bd';

const routes = [
  { url: 'http://localhost:3000/', file: 'mobile_home.png' },
  { url: 'http://localhost:3000/dashboard', file: 'mobile_dashboard.png' },
  { url: 'http://localhost:3000/create', file: 'mobile_create.png' },
];

for (const r of routes) {
  const dest = path.join(artDir, r.file);
  // Mobile viewport with mobile User-Agent
  const ua = '"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"';
  const cmd = `${chrome} --headless=new --hide-scrollbars --window-size=430,932 --user-agent=${ua} --force-device-scale-factor=1 --screenshot="${dest}" ${r.url}`;
  console.log(`Capturing mobile ${r.url} -> ${r.file}...`);
  execSync(cmd, { stdio: 'ignore' });
  if (fs.existsSync(dest)) {
    console.log(`Saved ${r.file} (${fs.statSync(dest).size} bytes)`);
  }
}

console.log('Mobile captures complete.');
