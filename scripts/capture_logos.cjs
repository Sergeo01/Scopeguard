const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const artDir = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\antigravity\\brain\\0ebc59da-bcd1-459d-ab9a-7f1003be33bd';

const tasks = [
  { url: 'http://localhost:3000/brand-logos', file: 'scopeguard_logo_options_sheet.png', w: 1600, h: 1050 },
  { url: 'http://localhost:3000/brand-logos/single?id=1', file: 'logo_1_precision_aperture.png', w: 512, h: 512 },
  { url: 'http://localhost:3000/brand-logos/single?id=2', file: 'logo_2_isometric_nexus.png', w: 512, h: 512 },
  { url: 'http://localhost:3000/brand-logos/single?id=3', file: 'logo_3_scoped_s_monogram.png', w: 512, h: 512 },
  { url: 'http://localhost:3000/brand-logos/single?id=4', file: 'logo_4_sentinel_radar.png', w: 512, h: 512 },
  { url: 'http://localhost:3000/brand-logos/single?id=5', file: 'logo_5_bounded_infinity.png', w: 512, h: 512 },
];

for (const t of tasks) {
  const dest = path.join(artDir, t.file);
  const cmd = `${chrome} --headless=new --hide-scrollbars --window-size=${t.w},${t.h} --screenshot="${dest}" "${t.url}"`;
  console.log(`Capturing ${t.file}...`);
  try {
    execSync(cmd, { stdio: 'ignore' });
    if (fs.existsSync(dest)) {
      const stats = fs.statSync(dest);
      console.log(`Saved ${t.file} (${stats.size} bytes)`);
    }
  } catch (err) {
    console.error(`Failed ${t.file}:`, err.message);
  }
}

console.log('All logo captures complete!');
