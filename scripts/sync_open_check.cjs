// 打開頁面時自動同步的狀態列檢查：node scripts/sync_open_check.cjs <輸出資料夾> [viewer]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.', viewer = process.argv[3] === 'viewer';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 420, height: 700 }, extraHTTPHeaders: viewer ? { 'x-dev-email': 'wife@example.test' } : {} });
  const p = await ctx.newPage(); const log = []; const calls = [];
  p.on('request', (r) => { if (r.url().includes('sync-now')) calls.push(r.method()) });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8787/');
  for (let i = 0; i < 12; i++) { await p.waitForTimeout(500);
    const t = await p.evaluate(() => { const e = document.getElementById('syncBar'); return e && !e.hidden ? e.textContent : null });
    if (t && log[log.length - 1] !== t) { log.push(t); await p.screenshot({ path: `${out}/bar_${log.length}.png` }) } }
  console.log(JSON.stringify({ viewer, sync_now_calls: calls, bar: log }));
  await b.close();
})();
