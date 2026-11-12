// 同步狀態四種情況並排（整頁）：node scripts/sync_status_states.cjs <輸出資料夾>
// 需本機 :8787，並用 wrangler d1 execute --local 預先建立 sync_log 資料列。這裡用只讀者開頁面（不會觸發同步，狀態才不會被覆蓋）。
const { chromium } = require('playwright'); const { execSync } = require('child_process');
const out = process.argv[2] || '.';
const sql = (q) => execSync(`npx wrangler d1 execute adventure --local --command "${q.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
const iso = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const ins = (id, h, err) => sql(`INSERT INTO sync_log (id,t,trigger,range_from,range_to,added,updated,removed,skipped,error) VALUES ('${id}','${iso(h)}','cron','2026-11-02','2026-12-27',0,0,0,0,${err ? "'" + err + "'" : 'NULL'})`);
const cases = [
  ['normal', () => { sql('DELETE FROM sync_log'); ins('a', 0.2, null) }],
  ['failed', () => { sql('DELETE FROM sync_log'); ins('a', 3, null); ins('b', 0.3, '同步失敗：金鑰失效') }],
  ['stale', () => { sql('DELETE FROM sync_log'); ins('a', 30, null) }],
  ['none', () => { sql('DELETE FROM sync_log') }],
];
(async () => {
  const b = await chromium.launch(); const res = [];
  for (const [name, setup] of cases) {
    setup();
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1, extraHTTPHeaders: { 'x-dev-email': 'wife@example.test' } });
    const p = await ctx.newPage(); await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await p.goto('http://127.0.0.1:8787/'); await p.waitForTimeout(1800);
    const txt = await p.locator('#syncBtn').innerText();
    await p.screenshot({ path: `${out}/st_${name}.png`, fullPage: true }); res.push(name + ' → ' + txt.replace(/\n/g, ' / ')); await ctx.close();
  }
  await b.close(); console.log(res.join('\n'));
})();
