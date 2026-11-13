// 新增課表摺疊與版面檢查：node scripts/add_form_check.cjs <輸出資料夾>（需本機 :8787，可編輯者）
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || '.', b = await chromium.launch(), res = [];
  for (const w of [320, 360, 390, 430, 768]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(1500);
    const det = p.locator('#addDet'); const closedOpen = await det.evaluate((e) => e.open);
    const hiddenInputs = !(await p.locator('#f-date').isVisible());
    await p.locator('#addDet > summary').scrollIntoViewIfNeeded();
    if (w === 390) await p.screenshot({ path: `${out}/add_closed.png`, fullPage: true });
    await p.locator('#addDet > summary').click(); await p.waitForTimeout(200);
    const d = await p.locator('#f-date').boundingBox(), k = await p.locator('#f-kind').boundingBox(), box = await p.locator('#addForm').boundingBox();
    const overlap = !(d.x + d.width <= k.x + 0.5 || k.x + k.width <= d.x + 0.5 || d.y + d.height <= k.y + 0.5 || k.y + k.height <= d.y + 0.5);
    const inside = d.x + d.width <= box.x + box.width + 0.5 && k.x + k.width <= box.x + box.width + 0.5;
    if (w === 390) await p.screenshot({ path: `${out}/add_open.png`, fullPage: true });
    res.push(`${w}px：預設關閉=${!closedOpen}（輸入框隱藏=${hiddenInputs}）｜展開後日期與類型重疊=${overlap}｜都在卡片內=${inside}｜錯誤=${errs.length}`);
    await ctx.close();
  }
  await b.close(); console.log(res.join('\n'));
})();
