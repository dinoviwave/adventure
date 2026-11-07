// 同步核心（純函式，不碰網路與資料庫）。規則依《資料同步功能設計 v0.1》第四、九節。
// icu 的 events / activities / wellness 讀取失敗時傳 null：該部分不寫入、不刪除。

export const kindOf = (type = '') => {
  if (/Run/i.test(type)) return '跑';
  if (/Ride|Bike|Cycl/i.test(type)) return '騎';
  if (/Swim/i.test(type)) return '游';
  if (/Weight|Strength/i.test(type)) return '肌力';
  return '其他';
};
const day = (s) => String(s || '').slice(0, 10);
const same = (a, b) => (a ?? null) === (b ?? null);
const startIso = (a) => a.start_date || (a.start_date_local ? new Date(a.start_date_local + '+08:00').toISOString() : null);

export function planSync({ existing, icu, range, nowIso, wellnessFrom }) {
  const ops = { upsertWorkouts: [], patchWorkouts: [], deleteWorkouts: [], flagWorkouts: [], upsertWellness: [] };
  const c = { added: 0, updated: 0, removed: 0, skipped: 0 };
  const report = { skipped: [], unmatched: [], warnings: [] };
  const byId = new Map(existing.workouts.map((w) => [w.id, w]));
  const patches = new Map(); // id -> patch（合併同一文件的多項更新，只算一次更新）
  const patch = (id, p) => patches.set(id, { ...(patches.get(id) || {}), ...p });

  // ---- 課表 ----
  const planned = [];
  if (icu.events) {
    const evs = icu.events.filter((e) => !e.category || e.category === 'WORKOUT');
    const seen = new Set();
    for (const e of evs) {
      const id = `icu-${e.id}`; seen.add(id);
      const src = { date: day(e.start_date_local), title: e.name || '', kind: kindOf(e.type), mins: e.moving_time ? Math.round(e.moving_time / 60) : null, desc: e.description ?? null };
      const cur = byId.get(id);
      planned.push({ id, ...src, cur });
      if (!cur) {
        ops.upsertWorkouts.push({ id, doc: { ...src, done: false, doneAt: null, key: false, source: 'intervals.icu', createdAt: nowIso } });
        c.added++;
      } else {
        const diff = {};
        for (const k of ['date', 'title', 'kind', 'mins', 'desc']) if (!same(cur[k], src[k])) diff[k] = src[k];
        if (cur.removedFromIcu) diff.removedFromIcu = false;
        if (Object.keys(diff).length) { patch(id, diff); c.updated++; }
      }
    }
    if (evs.length === 0) report.warnings.push('讀到的課表數為 0，未執行刪除');
    else {
      for (const w of existing.workouts) {
        if (!/^icu-\d+$/.test(w.id) || w.unplanned) continue;
        if (w.date < range.from || w.date > range.to || seen.has(w.id)) continue;
        if (w.done) { if (!w.removedFromIcu) { ops.flagWorkouts.push(w.id); c.removed++; } }
        else { ops.deleteWorkouts.push(w.id); c.removed++; }
      }
    }
  }

  // ---- 活動 ----
  if (icu.activities) {
    const acts = [];
    for (const a of icu.activities) {
      const secs = a.moving_time ?? a.elapsed_time ?? 0;
      if (secs < 120 || a.distance === 0) { c.skipped++; report.skipped.push(`${day(a.start_date_local)} ${a.name || ''}（${secs} 秒）`); continue; }
      acts.push({ a, date: day(a.start_date_local), min: Math.round(secs / 60), kind: kindOf(a.type),
        km: a.distance ? Math.round(a.distance / 100) / 10 : null });
    }
    // 1) 名稱包含課表名稱；2) 同一天、同類型且只有一筆候選
    const claims = new Map(); // planned id -> [act]
    const loose = [];
    for (const x of acts) {
      let p = planned.find((q) => q.date === x.date && q.title && String(x.a.name || '').includes(q.title));
      if (!p) {
        const cand = planned.filter((q) => q.date === x.date && q.kind === x.kind);
        const sameKindActs = acts.filter((y) => y.date === x.date && y.kind === x.kind);
        if (cand.length === 1 && sameKindActs.length === 1) p = cand[0];
      }
      if (p) { if (!claims.has(p.id)) claims.set(p.id, []); claims.get(p.id).push(x); } else loose.push(x);
    }
    for (const [pid, list] of claims) { // 一個課表對到多筆：取時長最接近計畫者，其餘計畫外
      const p = planned.find((q) => q.id === pid);
      list.sort((u, v) => Math.abs(u.min - (p.mins ?? u.min)) - Math.abs(v.min - (p.mins ?? v.min)));
      const [best, ...rest] = list; loose.push(...rest);
      const actual = { min: best.min, km: best.km, avgHr: best.a.average_heartrate ? Math.round(best.a.average_heartrate) : null, load: best.a.icu_training_load ?? null };
      const at = startIso(best.a);
      if (!p.cur) { const op = ops.upsertWorkouts.find((o) => o.id === pid); Object.assign(op.doc, { done: true, doneAt: at, actual }); }
      else {
        const diff = {};
        if (!p.cur.done) diff.done = true;
        if (!p.cur.doneAt) diff.doneAt = at;
        if (JSON.stringify(p.cur.actual ?? null) !== JSON.stringify(actual)) diff.actual = actual;
        if (Object.keys(diff).length) { if (!patches.has(pid)) c.updated++; patch(pid, diff); }
      }
    }
    for (const x of loose) {
      const id = `icu-act-${x.a.id}`;
      const hr = x.a.average_heartrate ? Math.round(x.a.average_heartrate) : null, load = x.a.icu_training_load ?? null;
      const note = [x.km ? `${x.km}km` : null, `${x.min} 分`, hr ? `均心率 ${hr}` : null, load != null ? `負荷 ${load}` : null].filter(Boolean).join('・');
      const src = { date: x.date, title: x.a.name || '', kind: x.kind, mins: x.min, note };
      report.unmatched.push(`${x.date} ${src.title}`);
      // 舊版（人工同步）用自訂編號建立的同日同名計畫外文件：改用真實編號後，移除舊的避免重複
      for (const w of existing.workouts) {
        if (w.unplanned && w.id.startsWith('icu-act-') && w.id !== id && w.date === x.date && w.title === src.title && !acts.some((y) => `icu-act-${y.a.id}` === w.id)
            && !ops.deleteWorkouts.includes(w.id)) { ops.deleteWorkouts.push(w.id); c.removed++; }
      }
      const cur = byId.get(id);
      if (!cur) { ops.upsertWorkouts.push({ id, doc: { ...src, done: true, doneAt: startIso(x.a), key: false, source: 'intervals.icu', unplanned: true, createdAt: nowIso } }); c.added++; }
      else {
        const diff = {}; for (const k of ['date', 'title', 'kind', 'mins', 'note']) if (!same(cur[k], src[k])) diff[k] = src[k];
        if (Object.keys(diff).length) { patch(id, diff); c.updated++; }
      }
    }
  }
  for (const [id, p] of patches) ops.patchWorkouts.push({ id, patch: p });

  // ---- wellness ----
  if (icu.wellness) {
    const wById = new Map(existing.wellness.map((w) => [w.id, w]));
    for (const w of icu.wellness) {
      const date = day(w.id); if (!date || date < wellnessFrom) continue;
      const sleepH = w.sleepSecs ? Math.round(w.sleepSecs / 360) / 10 : 0;
      const tsb = w.ctl != null && w.atl != null ? Math.round((w.ctl - w.atl) * 10) / 10 : null;
      const doc = { rhr: w.restingHR ?? null, hrv: w.hrv ?? null, ctl: w.ctl ?? null, atl: w.atl ?? null, tsb, sleepH, sleepScore: w.sleepScore ?? null, missing: !(sleepH > 0) || w.hrv == null, source: 'intervals.icu' };
      const cur = wById.get(date);
      if (!cur || Object.keys(doc).some((k) => !same(cur[k], doc[k]))) { ops.upsertWellness.push({ id: date, doc }); cur ? c.updated++ : c.added++; }
    }
  }
  return { ops, counts: c, report };
}

export const ymd = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000));
export const taipeiToday = (now = new Date()) => ymd(new Date(now.getTime() + 8 * 3600e3));
