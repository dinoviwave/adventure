// 同步核心（純函式，不碰網路與資料庫），方便測試。
// 注意：《資料同步功能設計 v0.1》未隨附，本實作依開發規格第七節的摘要；細節如與該文件不同，以該文件為準。

export const kindOf = (type = '') => {
  if (/Run/i.test(type)) return '跑';
  if (/Ride|Bike|Cycl/i.test(type)) return '騎';
  if (/Swim/i.test(type)) return '游';
  if (/Weight|Strength|Workout|Yoga/i.test(type)) return '肌力';
  if (/Rest/i.test(type)) return '休息';
  return '其他';
};
const day = (s) => String(s || '').slice(0, 10);
const same = (a, b) => (a ?? null) === (b ?? null);

// existing: {workouts:[doc+id], wellness:[doc+id]}；icu: {events, activities, wellness}
export function planSync({ existing, icu, range, nowIso, wellnessFrom }) {
  const ops = { upsertWorkouts: [], patchWorkouts: [], deleteWorkouts: [], flagWorkouts: [], upsertWellness: [] };
  const c = { added: 0, updated: 0, removed: 0, skipped: 0 };
  const byId = new Map(existing.workouts.map((w) => [w.id, w]));
  const planned = [];

  // 課表
  const evs = icu.events.filter((e) => e.category ? e.category === 'WORKOUT' : true);
  const seen = new Set();
  for (const e of evs) {
    const id = `icu-${e.id}`; seen.add(id);
    const src = { date: day(e.start_date_local), title: e.name || '', kind: kindOf(e.type), mins: e.moving_time ? Math.round(e.moving_time / 60) : (e.icu_training_load ? null : null), desc: e.description ?? null };
    planned.push({ id, ...src });
    const cur = byId.get(id);
    if (!cur) {
      ops.upsertWorkouts.push({ id, doc: { ...src, done: false, doneAt: null, key: false, source: 'intervals.icu', createdAt: nowIso } });
      c.added++;
    } else {
      const diff = {};
      for (const k of ['date', 'title', 'kind', 'mins', 'desc']) if (!same(cur[k], src[k])) diff[k] = src[k];
      if (cur.removedFromIcu) diff.removedFromIcu = false;
      if (Object.keys(diff).length) { ops.patchWorkouts.push({ id, patch: diff }); c.updated++; }
    }
  }
  // 刪除：讀到的課表數為 0 視為可疑，不刪除
  if (evs.length > 0) {
    for (const w of existing.workouts) {
      if (!/^icu-\d+$/.test(w.id) || w.unplanned) continue;
      if (w.date < range.from || w.date > range.to || seen.has(w.id)) continue;
      if (w.done) { if (!w.removedFromIcu) { ops.flagWorkouts.push(w.id); c.removed++; } }
      else { ops.deleteWorkouts.push(w.id); c.removed++; }
    }
  }

  // 活動
  const actSeen = new Set();
  for (const a of icu.activities) {
    const secs = a.moving_time ?? a.elapsed_time ?? 0;
    if (secs < 120 || a.distance === 0) { c.skipped++; continue; }
    const date = day(a.start_date_local), min = Math.round(secs / 60);
    const km = a.distance ? Math.round(a.distance / 100) / 10 : null;
    const actual = { min, km, avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null, load: a.icu_training_load ?? null };
    const match = planned.find((p) => p.date === date && p.title && String(a.name || '').includes(p.title) && !ops._matched?.has(p.id));
    if (match) {
      (ops._matched ||= new Set()).add(match.id);
      const cur = byId.get(match.id);
      if (!cur) { const op = ops.upsertWorkouts.find((o) => o.id === match.id); if (op) op.doc.actual = actual; }
      else if (JSON.stringify(cur.actual ?? null) !== JSON.stringify(actual)) { ops.patchWorkouts.push({ id: match.id, patch: { actual } }); c.updated++; }
      continue;
    }
    const id = `icu-act-${a.id}`; actSeen.add(id);
    const note = [km ? `${km}km` : null, `${min} 分`, actual.avgHr ? `均心率 ${actual.avgHr}` : null, actual.load != null ? `負荷 ${actual.load}` : null].filter(Boolean).join('・');
    const src = { date, title: a.name || '', kind: kindOf(a.type), mins: min, note };
    const cur = byId.get(id);
    if (!cur) { ops.upsertWorkouts.push({ id, doc: { ...src, done: true, doneAt: null, key: false, source: 'intervals.icu', unplanned: true, createdAt: nowIso } }); c.added++; }
    else {
      const diff = {}; for (const k of ['date', 'title', 'kind', 'mins', 'note']) if (!same(cur[k], src[k])) diff[k] = src[k];
      if (Object.keys(diff).length) { ops.patchWorkouts.push({ id, patch: diff }); c.updated++; }
    }
  }
  delete ops._matched;
  if (icu.activities.length > 0) {
    for (const w of existing.workouts) {
      if (!/^icu-act-/.test(w.id) || w.date < range.from || w.date > range.to || actSeen.has(w.id)) continue;
      ops.deleteWorkouts.push(w.id); c.removed++;
    }
  }

  // wellness：以起床當天為日期，只處理 wellnessFrom 以後
  const wById = new Map(existing.wellness.map((w) => [w.id, w]));
  for (const w of icu.wellness) {
    const date = day(w.id); if (!date || date < wellnessFrom) continue;
    const sleepH = w.sleepSecs ? Math.round(w.sleepSecs / 360) / 10 : 0;
    const doc = { rhr: w.restingHR ?? null, hrv: w.hrv ?? null, ctl: w.ctl ?? null, atl: w.atl ?? null, sleepH, sleepScore: w.sleepScore ?? null, missing: !(sleepH > 0) || w.hrv == null, source: 'intervals.icu' };
    const cur = wById.get(date);
    if (!cur || Object.keys(doc).some((k) => !same(cur[k], doc[k]))) { ops.upsertWellness.push({ id: date, doc }); cur ? c.updated++ : c.added++; }
  }
  return { ops, counts: c };
}

export const ymd = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => ymd(new Date(Date.parse(s + 'T00:00:00Z') + n * 86400000));
export const taipeiToday = (now = new Date()) => ymd(new Date(now.getTime() + 8 * 3600e3));
