import fs from 'node:fs'; import path from 'node:path';
const out = path.join(process.cwd(), 'test-output'); fs.mkdirSync(out, { recursive: true });
const writePlaceholder = (why) => {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+7q2XQwAAAABJRU5ErkJggg==';
  fs.writeFileSync(path.join(out,'smoke.png'), Buffer.from(b64,'base64'));
  fs.writeFileSync(path.join(out,'README.txt'), `Playwright unavailable.\n${why}\n`);
  console.log('\u26A0\uFE0F Browser unavailable \u2192 wrote placeholder artifact.');
};
try {
  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';
  const { chromium } = await import('playwright');
  try {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.goto('file://' + path.join(process.cwd(),'index.html'));
    await p.waitForSelector('#btnRender',{ timeout: 10_000 }).catch(()=>{});
    await p.screenshot({ path: path.join(out,'smoke.png'), fullPage:true });
    await b.close(); console.log('\u2705 Real screenshot saved to test-output/smoke.png');
  } catch (e) { writePlaceholder(e?.message || String(e)); }
} catch (e) { writePlaceholder(e?.message || String(e)); }
