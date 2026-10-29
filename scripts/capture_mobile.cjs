const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const artDir = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\antigravity\\brain\\0ebc59da-bcd1-459d-ab9a-7f1003be33bd';

const routes = [
  { url: 'http://localhost:3000/', file: 'mobile_home.png' },
  { url: 'http://localhost:3000/dashboard', file: 'mobile_dashboard.png' },
];

for (const r of routes) {
  const dest = path.join(artDir, r.file);
  // iPhone 14 viewport 390x844
  const cmd = `${chrome} --headless=new --hide-scrollbars --window-size=390,844 --screenshot="${dest}" ${r.url}`;
  console.log(`Capturing mobile ${r.url} -> ${r.file}...`);
  execSync(cmd, { stdio: 'ignore' });
  if (fs.existsSync(dest)) {
    console.log(`Saved ${r.file} (${fs.statSync(dest).size} bytes)`);
  }
}

console.log('Mobile captures complete.');
