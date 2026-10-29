const fs = require('fs');
const { execSync } = require('child_process');

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Logo Comparison</title>
  <style>
    body { background: #000000; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; }
    .compare-grid { display: flex; align-items: center; gap: 40px; margin-top: 20px; }
    .card { background: #0B0F19; border: 1px solid #1E293B; border-radius: 16px; padding: 24px; text-align: center; }
    .label { font-size: 12px; font-weight: 700; color: #94A3B8; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em; }
    .brand-row { display: flex; align-items: center; gap: 14px; }
    .brand-name { font-size: 32px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
    .scope { color: #FFFFFF; }
    .guard { color: #3B82F6; }
  </style>
</head>
<body>
  <h2>Exact Logo Match Verification</h2>
  
  <div class="compare-grid">
    <!-- User Uploaded Original -->
    <div class="card">
      <div class="label">User Attached Image</div>
      <img src="C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/.user_uploaded/media_1793298832413_a9a7b41c.png" style="height: 64px;" />
    </div>

    <!-- Our Precision Vector Recreation -->
    <div class="card">
      <div class="label">Recreated Vector Brand Mark</div>
      <div class="brand-row">
        <svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Top Arm -->
          <path
            d="M 90.0 27.8 L 69.5 15.3 L 57.2 10.0 L 51.0 10.0 L 10.0 31.3 L 10.0 49.1 L 12.1 52.7 L 34.6 61.6 L 34.6 49.1 L 22.3 42.0 L 28.5 36.7 L 55.1 24.2 L 90.0 40.2 Z"
            fill="#FFFFFF"
          />
          <!-- Center Star (Sparkle) -->
          <path
            d="M 51.0 40.0 Q 51.0 49.1 41.5 49.1 Q 51.0 49.1 51.0 58.2 Q 51.0 49.1 60.5 49.1 Q 51.0 49.1 51.0 40.0 Z"
            fill="#FFFFFF"
          />
          <!-- Bottom Arm -->
          <path
            d="M 90.0 50.9 L 65.4 38.4 L 65.4 50.9 L 77.7 58.0 L 71.5 63.3 L 44.9 75.8 L 10.0 59.8 L 10.0 72.2 L 30.5 84.7 L 42.8 90.0 L 49.0 90.0 L 90.0 68.7 Z"
            fill="#FFFFFF"
          />
        </svg>
        <div class="brand-name">
          <span class="scope">Scope</span><span class="guard">Guard</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/scratch/verify_logo.html', html);

const chrome = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"';
const dest = 'C:\\Users\\ROG ZEPHYRUS\\.gemini\\antigravity\\brain\\0ebc59da-bcd1-459d-ab9a-7f1003be33bd\\scratch\\verify_logo.png';
execSync(`${chrome} --headless=new --hide-scrollbars --window-size=900,400 --screenshot="${dest}" "C:/Users/ROG ZEPHYRUS/.gemini/antigravity/brain/0ebc59da-bcd1-459d-ab9a-7f1003be33bd/scratch/verify_logo.html"`);
console.log('Comparison screenshot created at', dest);
