// 本機端對端檢查：node scripts/e2e.cjs <輸出資料夾>（需先啟動兩個 wrangler dev）
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const log = [];
  async function page(url, email) {
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1, extraHTTPHeaders: email ? { 'x-dev-email': email } : {} });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => log.push('pageerror ' + e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto(url); await p.waitForTimeout(1500); return p;
  }
  let p = await page('http://127.0.0.1:8787/');
  await p.screenshot({ path: out + '/full.png', fullPage: true });
  const note1 = await p.locator('#note').innerText().catch(() => '');
  log.push('editor note: [' + note1 + '] hidden=' + (await p.locator('#note').isHidden()));
  // 勾選第一個課表並確認寫入 D1
  const before = await (await fetch('http://127.0.0.1:8787/api/workouts')).json();
  const btn = p.locator('[data-act="toggle-workout"]').first();
  if (await btn.count()) {
    const id = await btn.getAttribute('data-id'); const was = before.find((w) => w.id === id).done;
    await btn.click(); await p.waitForTimeout(1200);
    const after = (await (await fetch('http://127.0.0.1:8787/api/workouts')).json()).find((w) => w.id === id).done;
    log.push(`toggle ${id}: ${was} -> ${after}`);
    await p.reload(); await p.waitForTimeout(1200);
    await p.locator('[data-act="toggle-workout"]').first().click(); await p.waitForTimeout(1000); // 還原
  } else log.push('沒有可勾選的課表按鈕');
  await p.close();
  p = await page('http://127.0.0.1:8787/', 'wife@example.test');
  log.push('viewer note: [' + (await p.locator('#note').innerText()) + ']');
  await p.locator('[data-act="toggle-workout"]').first().click().catch(() => {}); await p.waitForTimeout(800);
  log.push('viewer toast: [' + (await p.locator('#toast').innerText().catch(() => '')) + ']');
  await p.screenshot({ path: out + '/viewer.png', fullPage: true }); await p.close();
  p = await page('http://127.0.0.1:8788/');
  await p.screenshot({ path: out + '/demo.png', fullPage: true });
  log.push('demo text has 心率/HRV 數字? ' + /\d+\s*bpm/.test(await p.innerText('body')));
  await b.close(); console.log(log.join('\n'));
})();
