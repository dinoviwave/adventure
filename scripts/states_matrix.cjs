// 展示版「三種動作 × 四種身體狀態」並排截圖（整頁）。node scripts/states_matrix.cjs <輸出資料夾>；需先在 :8801 提供 public-demo/
const { chromium } = require('playwright');
const out = process.argv[2] || 'docs/shots';
const acts = [['跑', '南山銳1_WED_跑步Z2', '南山銳2_THU_節奏跑'], ['騎', '南山銳1_MON_騎車恢復', '南山銳2_SAT_騎車恢復'], ['游', '南山銳2_FRI_游泳輕鬆', '南山銳2_SUN_長跑Z2'], ['休息', null, '南山銳2_MON_跑步Z2'], ['完成', '南山銳1_WED_跑步Z2', '南山銳2_THU_節奏跑']]; // 休息：今天沒有課表；完成：今天的課表已完成
const states = [['missing', '缺資料'], ['ok', '範圍內'], ['near', '接近邊界'], ['out', '超出']];
(async () => {
  const b = await chromium.launch(), errs = [];
  for (const [kind0, title, nextTitle] of acts) for (const [st, label] of states) {
    const kind = kind0 === '完成' ? '跑' : kind0, done = kind0 === '完成';
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.route(/\/api\/snapshot/, (r) => r.fulfill({ json: { date: '2026-11-07', weekNo: 1, weeks: 7, race: { name: '南山人壽半馬', date: '2026-11-22' },
      workout: title ? { kind, title, mins: 40, done, actual: done ? { km: 7.8, min: 50 } : null } : null, next: { date: '2026-11-09', kind: kind === '游' ? '跑' : (kind === '休息' ? '跑' : kind), title: nextTitle, mins: 50 }, extras: [], week: { done: 3, total: 5 }, body: { rhr: st, hrv: st } } }));
    await p.goto('http://127.0.0.1:8801/index.html'); await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/m_${kind0}_${st}.png`, fullPage: true }); await ctx.close();
  }
  await b.close(); console.log('pageerrors:', errs.length, errs.slice(0, 3));
})();
