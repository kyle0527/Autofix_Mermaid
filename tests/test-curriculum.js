const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const filePath = path.join(__dirname, 'index.html');
  await page.goto('file://' + filePath);
  await page.waitForSelector('#btnRender');
  const outDir = path.join(__dirname, 'test-output');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, 'smoke.png'), fullPage: true });
  await browser.close();
  console.log('Curriculum smoke test completed');
})();
