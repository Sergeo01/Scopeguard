const fs = require('fs');
const { execSync } = require('child_process');

// We will render high-definition comparison of the refined paths
const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { background: #07090E; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; display: flex; flex-direction: column; gap: 30px; }
    .row { display: flex; align-items: center; gap: 30px; }
    .box { background: #0B0F19; border: 1px solid #1E293B; border-radius: 20px; padding: 24px 32px; display: flex; align-items: center; gap: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .light-box { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; padding: 24px 32px; display: flex; align-items: center; gap: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); }
    .brand-name { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
    .scope-dark { color: #FFFFFF; }
    .scope-light { color: #0F172A; }
    .guard { color: #3B82F6; }
    .label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.08em; }
  </style>
</head>
<body>
  <div>
    <div class="label">USER ATTACHED IMAGE (PNG):</div>
    <img src="C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/.user_uploaded/media_1793298832413_a9a7b41c.png" style="height: 64px;" />
  </div>

  <div class="row">
    <div>
      <div class="label">RECREATED PRODUCTION LOGO (DARK MODE):</div>
      <div class="box">
        <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Top Arm -->
          <path
            d="M 88 38 L 88 28 L 50 6 L 12 28 L 12 54 L 35 67 L 35 53 L 25 47 L 25 36 L 50 21 L 75 36 L 75 45 Z"
            fill="#FFFFFF"
          />
          <!-- Center 4-Point Star (Sparkle) -->
          <path
            d="M 50 38 Q 50 50 38 50 Q 50 50 50 62 Q 50 50 62 50 Q 50 50 50 38 Z"
            fill="#FFFFFF"
          />
          <!-- Bottom Arm (Exact 180deg rotation) -->
          <path
            d="M 12 62 L 12 72 L 50 94 L 88 72 L 88 46 L 65 33 L 65 47 L 75 53 L 75 64 L 50 79 L 25 64 L 25 55 Z"
            fill="#FFFFFF"
          />
        </svg>
        <div class="brand-name">
          <span class="scope-dark">Scope</span><span class="guard">Guard</span>
        </div>
      </div>
    </div>

    <div>
      <div class="label">RECREATED PRODUCTION LOGO (LIGHT MODE):</div>
      <div class="light-box">
        <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Top Arm -->
          <path
            d="M 88 38 L 88 28 L 50 6 L 12 28 L 12 54 L 35 67 L 35 53 L 25 47 L 25 36 L 50 21 L 75 36 L 75 45 Z"
            fill="#0F172A"
          />
          <!-- Center 4-Point Star (Sparkle) -->
          <path
            d="M 50 38 Q 50 50 38 50 Q 50 50 50 62 Q 50 50 62 50 Q 50 50 50 38 Z"
            fill="#2563EB"
          />
          <!-- Bottom Arm (Exact 180deg rotation) -->
          <path
            d="M 12 62 L 12 72 L 50 94 L 88 72 L 88 46 L 65 33 L 65 47 L 75 53 L 75 64 L 50 79 L 25 64 L 25 55 Z"
            fill="#0F172A"
          />
        </svg>
        <div class="brand-name">
          <span class="scope-light">Scope</span><span class="guard">Guard</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/scratch/test_hex_logo.html', html);
const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const dest = 'C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/scratch/test_hex_logo.png';
execSync(`${chrome} --headless=new --hide-scrollbars --window-size=1100,500 --screenshot="${dest}" "C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/scratch/test_hex_logo.html"`);
console.log('Saved refined test_hex_logo.png');
