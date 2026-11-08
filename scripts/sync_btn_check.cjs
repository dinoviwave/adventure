// 「↻ 更新」按鈕檢查：node scripts/sync_btn_check.cjs <輸出資料夾> [viewer]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.', viewer = process.argv[3] === 'viewer';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, extraHTTPHeaders: viewer ? { 'x-dev-email': 'wife@example.test' } : {} });
  const p = await ctx.newPage(); const calls = [];
  p.on('request', (r) => { if (r.url().includes('sync-now')) calls.push(r.method() + ' ' + (r.postData() || '')) });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(2500);
  const label0 = await p.locator('#syncBtn').innerText();
  await p.evaluate(() => { /* 模擬切回 App */ document.dispatchEvent(new Event('visibilitychange')) });
  await p.waitForTimeout(500);
  await p.locator('#syncBtn').tap(); await p.waitForTimeout(1500);
  const bar = await p.evaluate(() => { const e = document.getElementById('syncBar'); return e && !e.hidden ? e.textContent : null });
  await p.screenshot({ path: out + '/btn_' + (viewer ? 'viewer' : 'editor') + '.png' });
  console.log(JSON.stringify({ viewer, label: label0, calls, bar_after_tap: bar, label_after: await p.locator('#syncBtn').innerText() }));
  await b.close();
})();
