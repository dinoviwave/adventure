// 完整版今日圖卡：一般／品質／比賽當天。node scripts/card_scenarios.cjs <輸出資料夾>（需本機 :8787）
const { chromium } = require('playwright'); const { execSync } = require('child_process'); const fs = require('fs');
const out = process.argv[2] || '.';
const sql = (q) => execSync(`npx wrangler d1 execute adventure --local --command "${q.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const cases = [
  ['normal', () => { sql("DELETE FROM workouts WHERE id IN ('q-1','n-1','d-1','w-1','t-1','t-2')"); sql(`INSERT INTO workouts (id,date,title,kind,mins,done,key,unplanned) VALUES ('n-1','${day(2)}','南山銳2_SAT_跑步Z2','跑',50,0,0,0)`) }, null, 0.1],
  ['quality', () => { sql("DELETE FROM workouts WHERE id IN ('q-1','n-1','d-1','w-1','t-1','t-2')"); sql(`INSERT INTO workouts (id,date,title,kind,mins,done,key,unplanned) VALUES ('q-1','${day(2)}','南山銳2_SAT_節奏跑','跑',50,0,0,0)`) }, null, 0.1],
  ['race_gold', () => { sql("DELETE FROM workouts WHERE id IN ('q-1','n-1','d-1','w-1','t-1','t-2')"); sql(`INSERT INTO workouts (id,date,title,kind,mins,done,key,unplanned) VALUES ('n-1','2026-11-22','南山半馬','跑',120,0,0,0)`); }, '2026-11-22T09:00:00', 0.1],
  ['race_royal', () => { }, '2026-11-22T09:00:00', 0.9],
  ['done', () => { sql("DELETE FROM workouts WHERE id IN ('q-1','n-1','d-1','w-1','t-1','t-2')"); sql(`INSERT INTO workouts (id,date,title,kind,mins,done,key,unplanned) VALUES ('d-1','${day(0)}','南山銳2_THU_節奏跑','跑',45,1,0,0)`) }, null, 0.1],
];
(async () => {
  const b = await chromium.launch(), res = [];
  for (const [name, setup, fixed, rnd] of cases) {
    setup();
    const ctx = await b.newContext({ viewport: { width: 420, height: 900 } });
    await ctx.addInitScript((r) => { Math.random = () => r; }, rnd);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    if (fixed) await p.clock.setFixedTime(new Date(fixed));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(1500);
    await p.click('#shotGen'); await p.waitForSelector('#shotOut:not([hidden])', { timeout: 15000 });
    const b64 = await p.evaluate(async () => { const bl = await (await fetch(document.getElementById('shotImg').src)).blob(); const buf = new Uint8Array(await bl.arrayBuffer()); let s = ''; buf.forEach((x) => (s += String.fromCharCode(x))); return btoa(s) });
    fs.writeFileSync(`${out}/card_${name}.png`, Buffer.from(b64, 'base64')); res.push(`${name}: 錯誤 ${errs.length}`); await ctx.close();
  }
  await b.close(); console.log(res.join('\n'));
})();
