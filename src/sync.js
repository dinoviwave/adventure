import { planSync, taipeiToday, addDays } from './lib/sync-core.js';
import { TABLES, rowToDoc, docToRow, newId } from './lib/tables.js';

// 只用 GET。金鑰只從 env.ICU_API_KEY 讀，不寫入日誌、資料庫或回應。
async function icuGet(env, path, params) {
  const base = env.ICU_BASE_URL || 'https://intervals.icu/api/v1';
  const url = `${base}/athlete/${env.ICU_ATHLETE_ID}/${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { method: 'GET', headers: { Authorization: 'Basic ' + btoa('API_KEY:' + env.ICU_API_KEY) } });
  if (!r.ok) throw new Error(`intervals.icu ${path} 回應 ${r.status}`);
  return r.json();
}

const docs = async (env, t) => (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results.map((r) => ({ id: r[TABLES[t].pk], ...rowToDoc(t, r) }));

async function upsertStmt(env, t, id, doc) {
  const pk = TABLES[t].pk, { cols, vals } = docToRow(t, doc);
  const upd = cols.map((c) => `${c}=excluded.${c}`).join(',');
  return env.DB.prepare(`INSERT INTO ${t} (${pk},${cols.join(',')}) VALUES (?,${cols.map(() => '?').join(',')}) ON CONFLICT(${pk}) DO UPDATE SET ${upd}`).bind(id, ...vals);
}

export async function runSync(env, trigger = 'cron') {
  const now = new Date(), nowIso = now.toISOString(), today = taipeiToday(now);
  const range = { from: addDays(today, -Number(env.SYNC_PAST_DAYS || 14)), to: addDays(today, Number(env.SYNC_FUTURE_DAYS || 70)) };
  const logId = newId();
  const log = async (counts, error) => {
    await env.DB.prepare('INSERT INTO sync_log (id,t,"trigger",range_from,range_to,added,updated,removed,skipped,error) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(logId, nowIso, trigger, range.from, range.to, counts?.added ?? 0, counts?.updated ?? 0, counts?.removed ?? 0, counts?.skipped ?? 0, error ?? null).run();
    await env.DB.prepare("UPDATE sync_requests SET status='done' WHERE status='pending'").run();
  };
  try {
    if (!env.ICU_API_KEY) throw new Error('尚未設定 intervals.icu 金鑰');
    const existingW = await docs(env, 'wellness');
    const wFrom = existingW.length ? addDays(today, -3) : addDays(today, -14); // 平常重讀最近 3 天
    // 全部讀完才寫入：任何一步失敗，資料不變
    const [events, activities, wellness] = await Promise.all([
      icuGet(env, 'events', { oldest: range.from, newest: range.to, category: 'WORKOUT' }),
      icuGet(env, 'activities', { oldest: range.from, newest: range.to }),
      icuGet(env, 'wellness', { oldest: wFrom, newest: today }),
    ]);
    const existingWk = await docs(env, 'workouts'), wkById = new Map(existingWk.map((w) => [w.id, w]));
    const { ops, counts } = planSync({ existing: { workouts: existingWk, wellness: existingW }, icu: { events, activities, wellness }, range, nowIso, wellnessFrom: wFrom });
    const stmts = [];
    for (const o of ops.upsertWorkouts) stmts.push(await upsertStmt(env, 'workouts', o.id, o.doc));
    for (const o of ops.patchWorkouts) {
      const cur = wkById.get(o.id);
      if (cur) { const { id, ...rest } = cur; stmts.push(await upsertStmt(env, 'workouts', o.id, { ...rest, ...o.patch })); }
    }
    for (const id of ops.flagWorkouts) {
      const cur = wkById.get(id);
      if (cur) { const { id: _i, ...rest } = cur; stmts.push(await upsertStmt(env, 'workouts', id, { ...rest, removedFromIcu: true })); }
    }
    for (const id of ops.deleteWorkouts) stmts.push(env.DB.prepare('DELETE FROM workouts WHERE id=?').bind(id));
    for (const o of ops.upsertWellness) stmts.push(await upsertStmt(env, 'wellness', o.id, o.doc));
    if (stmts.length) await env.DB.batch(stmts);
    await log(counts, null);
    return { ok: true, counts };
  } catch (e) {
    await log(null, String(e.message || e).replace(env.ICU_API_KEY || '\u0000', '***').slice(0, 300));
    return { ok: false };
  }
}
