// 展示版：3 種動作 × 4 種情況（一般／品質／比賽金色／比賽皇家紅毯）整頁並排。node scripts/arch_scenarios.cjs <輸出資料夾>；需先在 :8801 提供 public-demo/
const { chromium } = require('playwright');
const out = process.argv[2] || 'docs/shots';
const acts = [['跑', '南山銳1_WED_跑步Z2'], ['騎', '南山銳1_MON_騎車恢復'], ['游', '南山銳2_FRI_游泳輕鬆']];
const scen = [
  ['normal', { nextTitle: '南山銳2_MON_跑步Z2', raceDate: '2026-11-22' }, 0.1],
  ['quality', { nextTitle: '南山銳2_THU_節奏跑', raceDate: '2026-11-22' }, 0.1],
  ['race_gold', { nextTitle: '南山銳2_MON_跑步Z2', raceDate: '2026-11-12' }, 0.1],
  ['race_royal', { nextTitle: '南山銳2_MON_跑步Z2', raceDate: '2026-11-12' }, 0.9],
];
(async () => {
  const b = await chromium.launch(), errs = [];
  for (const [kind, title] of acts) for (const [name, sc, rnd] of scen) {
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
    await ctx.addInitScript((r) => { Math.random = () => r; }, rnd);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.route(/\/api\/snapshot/, (r) => r.fulfill({ json: { date: '2026-11-12', weekNo: 2, weeks: 7, race: { name: '南山人壽半馬', date: sc.raceDate },
      workout: { kind, title, mins: 40, done: false, actual: null }, next: { date: '2026-11-14', kind: kind === '游' ? '跑' : kind, title: sc.nextTitle, mins: 50, key: false },
      extras: [], week: { done: 3, total: 5 }, body: { rhr: 'ok', hrv: 'ok' } } }));
    await p.goto('http://127.0.0.1:8801/index.html'); await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/s_${kind}_${name}.png`, fullPage: true }); await ctx.close();
  }
  await b.close(); console.log('pageerrors:', errs.length, errs.slice(0, 3));
})();
