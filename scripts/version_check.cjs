// 版號、更新日期、新版本偵測與手動重新載入：node scripts/version_check.cjs <輸出資料夾>（需本機 :8787；會暫時改寫 public/version.json 模擬部署）
const { chromium } = require('playwright'); const fs = require('fs');
const vf = 'public/version.json'; const orig = fs.readFileSync(vf, 'utf8');
const write = (v) => fs.writeFileSync(vf, JSON.stringify({ v, version: '0.9.0', built: new Date().toISOString() }));
(async () => {
  const out = process.argv[2] || '.'; write('aaaaaaaaaaaa');
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, timezoneId: 'Asia/Taipei' });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(1800);
  const foot1 = await p.locator('#appFoot').innerText(); const hasBtn = await p.locator('#reloadBtn').isVisible();
  const bar0 = await p.evaluate(() => { const e = document.getElementById('syncBar'); return e && !e.hidden ? e.textContent : null });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/foot_before.png` });
  write('bbbbbbbbbbbb');                                   // 模擬：伺服器部署了新版本
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await p.waitForTimeout(1200);
  const bar1 = await p.evaluate(() => { const e = document.getElementById('syncBar'); return e && !e.hidden ? e.textContent : null });
  await p.screenshot({ path: `${out}/foot_banner.png` });
  await p.locator('#syncBar').click(); await p.waitForLoadState('load'); await p.waitForTimeout(1800);
  const foot2 = await p.locator('#appFoot').innerText(); const bar2 = await p.evaluate(() => { const e = document.getElementById('syncBar'); return e && !e.hidden ? e.textContent : null });
  await p.locator('#reloadBtn').click(); await p.waitForLoadState('load'); await p.waitForTimeout(1200);
  const foot3 = await p.locator('#appFoot').innerText();
  fs.writeFileSync(vf, orig); await b.close();
  console.log(JSON.stringify({ 底端: foot1, 有重新載入按鈕: hasBtn, 載入時提示: bar0, 新版本提示: bar1, 點提示後底端: foot2, 重新載入後提示: bar2, 按鈕重新載入後底端: foot3, 錯誤: errs.length }, null, 1));
})();
