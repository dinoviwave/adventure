import { planSync, taipeiToday } from './lib/sync-core.js';
import { TABLES, rowToDoc, docToRow, newId } from './lib/tables.js';

const UA = 'Mozilla/5.0 (compatible; viwave-sync)'; // 設計文件實測：預設 User-Agent 會被回 403

// 只用 GET。金鑰只從 env.ICU_API_KEY 讀，不寫入日誌、資料庫或回應。
async function icuGet(env, path, params, retry = true) {
  const base = env.ICU_BASE_URL || 'https://intervals.icu/api/v1';
  const url = `${base}/athlete/${env.ICU_ATHLETE_ID}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { method: 'GET', headers: { Authorization: 'Basic ' + btoa('API_KEY:' + env.ICU_API_KEY), 'User-Agent': UA, Accept: 'application/json' } });
  if (r.status === 429 && retry) { await new Promise((res) => setTimeout(res, 5000)); return icuGet(env, path, params, false); }
  if (r.status === 401) { const e = new Error('金鑰失效'); e.auth = true; throw e; }
  if (!r.ok) throw new Error(`${path} 回應 ${r.status}`);
  return r.json();
}

const docs = async (env, t) => (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results.map((r) => ({ id: r[TABLES[t].pk], ...rowToDoc(t, r) }));

function upsertStmt(env, t, id, doc) {
  const pk = TABLES[t].pk, { cols, vals } = docToRow(t, doc);
  const upd = cols.map((c) => `${c}=excluded.${c}`).join(',');
  return env.DB.prepare(`INSERT INTO ${t} (${pk},${cols.join(',')}) VALUES (?,${cols.map(() => '?').join(',')}) ON CONFLICT(${pk}) DO UPDATE SET ${upd}`).bind(id, ...vals);
}

export async function runSync(env, trigger = 'cron') {
  const now = new Date(), nowIso = now.toISOString(), today = taipeiToday(now);
  // 讀取範圍（設計文件第四節）：階段起始日 → 最後一場賽事後一週；活動與體能到今天
  const start = env.SYNC_START || '2026-11-02', endPlan = env.SYNC_END || '2026-12-27';
  const range = { from: start, to: endPlan };
  const logId = newId();
  const log = async (counts, error, detail) => {
    await env.DB.prepare('INSERT INTO sync_log (id,t,"trigger",range_from,range_to,added,updated,removed,skipped,error,detail) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .bind(logId, nowIso, trigger, range.from, range.to, counts?.added ?? 0, counts?.updated ?? 0, counts?.removed ?? 0, counts?.skipped ?? 0, error ?? null, detail ? JSON.stringify(detail) : null).run();
    await env.DB.prepare("UPDATE sync_requests SET status='done' WHERE status='pending'").run();
  };
  const scrub = (m) => String(m || '').split(env.ICU_API_KEY || '\u0000').join('***').slice(0, 300);
  try {
    if (!env.ICU_API_KEY) throw new Error('尚未設定 intervals.icu 金鑰');
    const reads = await Promise.allSettled([
      icuGet(env, 'events', { oldest: start, newest: endPlan, category: 'WORKOUT' }),
      icuGet(env, 'activities', { oldest: start, newest: today }),
      icuGet(env, 'wellness', { oldest: start, newest: today }), // 全段重讀（含最近 3 天延遲補上的 HRV）
    ]);
    const auth = reads.find((r) => r.status === 'rejected' && r.reason?.auth);
    if (auth) throw auth.reason; // 401：不修改任何資料
    const names = ['課表', '活動', '體能指標'], failed = [];
    const val = reads.map((r, i) => (r.status === 'fulfilled' ? r.value : (failed.push(`${names[i]}：${scrub(r.reason?.message)}`), null)));
    if (failed.length === 3) throw new Error('讀取失敗：' + failed.join('；'));

    const existingW = await docs(env, 'wellness'), existingWk = await docs(env, 'workouts');
    const wkById = new Map(existingWk.map((w) => [w.id, w]));
    const { ops, counts, report } = planSync({ existing: { workouts: existingWk, wellness: existingW }, icu: { events: val[0], activities: val[1], wellness: val[2] }, range, nowIso, wellnessFrom: start });
    if (failed.length) { ops.deleteWorkouts.length = 0; ops.flagWorkouts.length = 0; counts.removed = 0; } // 部分讀取失敗：不刪除任何文件
    const stmts = [];
    for (const o of ops.upsertWorkouts) stmts.push(upsertStmt(env, 'workouts', o.id, o.doc));
    for (const o of ops.patchWorkouts) { const cur = wkById.get(o.id); if (cur) { const { id, ...rest } = cur; stmts.push(upsertStmt(env, 'workouts', o.id, { ...rest, ...o.patch })); } }
    for (const id of ops.flagWorkouts) { const cur = wkById.get(id); if (cur) { const { id: _i, ...rest } = cur; stmts.push(upsertStmt(env, 'workouts', id, { ...rest, removedFromIcu: true })); } }
    for (const id of ops.deleteWorkouts) stmts.push(env.DB.prepare('DELETE FROM workouts WHERE id=?').bind(id));
    for (const o of ops.upsertWellness) stmts.push(upsertStmt(env, 'wellness', o.id, o.doc));
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50)); // 一批最多 50 筆
    const err = failed.length ? '部分讀取失敗：' + failed.join('；') : report.warnings.length ? '警告：' + report.warnings.join('；') : null;
    await log(counts, err, { skipped: report.skipped, unmatched: report.unmatched, warnings: report.warnings, failed });
    return { ok: !failed.length, counts, error: err };
  } catch (e) {
    const msg = e.auth ? '同步失敗：金鑰失效' : '同步失敗：' + scrub(e.message);
    await log(null, msg);
    return { ok: false, error: msg };
  }
}

// 打開頁面時觸發：冷卻時間內不重複同步（含排程剛跑過），並用鎖避免同時兩次。
export async function syncNow(env, force = false) {
  const cool = force ? 60000 : (Number(env.SYNC_COOLDOWN_MIN) || 10) * 60000; // 手動按鈕：最少間隔 60 秒
  const last = await env.DB.prepare('SELECT t FROM sync_log ORDER BY t DESC LIMIT 1').first();
  if (last && Date.now() - Date.parse(last.t) < cool) return { status: 'cooldown', lastAt: last.t };
  const lock = await env.DB.prepare("SELECT value FROM config WHERE key='sync_lock'").first();
  if (lock && Date.now() - Number(lock.value) < 90000) return { status: 'busy' };
  await env.DB.prepare("INSERT INTO config (key,value) VALUES ('sync_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(Date.now())).run();
  try {
    const r = await runSync(env, 'open');
    return { status: r.ok ? 'done' : 'failed', counts: r.counts, error: r.error || null };
  } finally {
    await env.DB.prepare("DELETE FROM config WHERE key='sync_lock'").run();
  }
}
