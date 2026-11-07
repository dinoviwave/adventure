// 圖卡產生檢查：開完整版（本機 :8787）→ 按「產生圖片」→ 取出 PNG 並驗證尺寸。node scripts/card_check.cjs <輸出png>
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(1500);
  await p.click('#shotGen'); await p.waitForSelector('#shotOut:not([hidden])', { timeout: 15000 });
  const info = await p.evaluate(async () => { const src = document.getElementById('shotImg').src; const bl = await (await fetch(src)).blob();
    const bm = await createImageBitmap(bl); const buf = new Uint8Array(await bl.arrayBuffer()); let s = ''; buf.forEach((x) => (s += String.fromCharCode(x)));
    return { w: bm.width, h: bm.height, type: bl.type, b64: btoa(s), saveHidden: document.getElementById('shotSave').hidden, toast: document.getElementById('toast').textContent }; });
  fs.writeFileSync(process.argv[2], Buffer.from(info.b64, 'base64'));
  console.log(JSON.stringify({ w: info.w, h: info.h, type: info.type, saveBtnHidden: info.saveHidden, toast: info.toast, pageerrors: errs }));
  await b.close();
})();
