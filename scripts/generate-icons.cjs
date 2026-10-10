// 설치된 Playwright·Chromium으로 기존 SVG를 한 번 래스터화한다. 빌드·CI에는 연결하지 않는다.
// PLAYWRIGHT_MODULE=/설치된/playwright/index.js node scripts/generate-icons.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
async function main() {
  const root = path.resolve(__dirname, '..'), svg = fs.readFileSync(path.join(root, 'public/icon.svg'), 'utf8');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    for (const [file, size, maskable] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512, true]]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      // 그림을 중앙 80%로 줄이고 바깥은 단색으로 채워 maskable 안전 영역을 확보한다.
      const image = maskable ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#4f46e5"/><g transform="translate(51.2 51.2) scale(.8)">${svg.replace(/<svg[^>]*>|<\/svg>/g, '')}</g></svg>` : svg;
      await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${image}`);
      await page.screenshot({ path: path.join(root, 'public', file), omitBackground: true }); await page.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
