// 完整版「下一個課表」終點線：有下一個課表／沒有（整頁）。node scripts/next_goal_states.cjs <輸出資料夾>
const { chromium } = require('playwright'); const { execSync } = require('child_process');
const out = process.argv[2] || '.';
const sql = (q) => execSync(`npx wrangler d1 execute adventure --local --command "${q.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
const fut = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const cases = [
  ['with', () => { sql("DELETE FROM workouts WHERE id LIKE 'fut-%'"); sql(`INSERT INTO workouts (id,date,title,kind,mins,done,key,unplanned) VALUES ('fut-1','${fut(2)}','南山銳2_FRI_游泳輕鬆','游',40,0,0,0)`); sql(`INSERT INTO workouts (id,date,title,kind,mins,done,key,unplanned) VALUES ('fut-2','${fut(4)}','南山銳2_SUN_長跑Z2','跑',90,0,1,0)`) }],
  ['without', () => { sql("DELETE FROM workouts WHERE id LIKE 'fut-%'") }],
];
(async () => {
  const b = await chromium.launch(); const res = [];
  for (const [name, setup] of cases) {
    setup();
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, extraHTTPHeaders: { 'x-dev-email': 'wife@example.test' } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(1800);
    const vis = await p.locator('#finl').isVisible(); const txt = vis ? (await p.locator('#finl').innerText()).replace(/\n/g, ' ') : '(隱藏)';
    await p.screenshot({ path: `${out}/ng_${name}.png`, fullPage: true }); res.push(`${name} → ${txt} 錯誤:${errs.length}`); await ctx.close();
  }
  await b.close(); console.log(res.join('\n'));
})();
