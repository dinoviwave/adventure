import { describe, it, expect } from 'vitest';
import { planSync } from '../src/lib/sync-core.js';
import { todayIn, validTz } from '../src/lib/sync-core.js';
import { buildSnapshot } from '../src/lib/snapshot.js';

const range = { from: '2026-11-01', to: '2026-12-31' };
const ev = (id, date, name) => ({ id, start_date_local: date + 'T07:00:00', name, type: 'Run', moving_time: 1800, description: 'd' });
const run = (existing, icu) => planSync({ existing, icu: { events: [], activities: [], wellness: [], ...icu }, range, nowIso: 'n', wellnessFrom: '2026-11-04' });
const apply = (ex, ops) => {
  const m = new Map(ex.workouts.map((w) => [w.id, { ...w }]));
  ops.upsertWorkouts.forEach((o) => m.set(o.id, { id: o.id, ...o.doc }));
  ops.patchWorkouts.forEach((o) => Object.assign(m.get(o.id), o.patch));
  ops.deleteWorkouts.forEach((i) => m.delete(i));
  ops.flagWorkouts.forEach((i) => (m.get(i).removedFromIcu = true));
  return { workouts: [...m.values()], wellness: ex.wellness };
};

describe('同步', () => {
  const icu = { events: [ev(1, '2026-11-05', 'A_跑步')], activities: [{ id: 9, start_date_local: '2026-11-05T08:00:00', name: 'A_跑步 晨跑', type: 'Run', moving_time: 1800, distance: 5000, average_heartrate: 140, icu_training_load: 30 }] };
  it('重複執行：第二次 0 新增 0 更新', () => {
    const ex0 = { workouts: [], wellness: [] };
    const r1 = run(ex0, icu); expect(r1.counts.added).toBe(1);
    const r2 = run(apply(ex0, r1.ops), icu);
    expect(r2.counts).toEqual({ added: 0, updated: 0, removed: 0, skipped: 0 });
  });
  it('不覆蓋勾選，並以 intervals.icu 為準更新名稱與日期', () => {
    const ex = { workouts: [{ id: 'icu-1', date: '2026-11-04', title: '舊', kind: '跑', mins: 30, desc: 'd', done: true, doneAt: 't', key: true, actual: { min: 30, km: 5, avgHr: 140, load: 30 } }], wellness: [] };
    const { ops } = run(ex, icu);
    const patch = ops.patchWorkouts.find((p) => p.id === 'icu-1').patch;
    expect(patch).toMatchObject({ date: '2026-11-05', title: 'A_跑步' });
    expect(patch).not.toHaveProperty('done'); expect(patch).not.toHaveProperty('key');
  });
  it('刪除：未完成刪、已完成標記；課表數為 0 時不刪', () => {
    const ex = { workouts: [{ id: 'icu-2', date: '2026-11-06', title: 'x', kind: '跑', done: false }, { id: 'icu-3', date: '2026-11-07', title: 'y', kind: '跑', done: true }], wellness: [] };
    const r = run(ex, icu);
    expect(r.ops.deleteWorkouts).toEqual(['icu-2']); expect(r.ops.flagWorkouts).toEqual(['icu-3']);
    const z = run(ex, { events: [] });
    expect(z.ops.deleteWorkouts).toEqual([]); expect(z.ops.flagWorkouts).toEqual([]);
  });
  it('27 秒活動與距離 0 略過', () => {
    const r = run({ workouts: [], wellness: [] }, { activities: [{ id: 5, start_date_local: '2026-11-05T08:00:00', name: 'z', type: 'Run', moving_time: 27, distance: 100 }, { id: 6, start_date_local: '2026-11-05T08:00:00', name: 'z', type: 'Ride', moving_time: 900, distance: 0 }] });
    expect(r.counts.skipped).toBe(2); expect(r.ops.upsertWorkouts).toHaveLength(0);
  });
  it('名稱不含課表名稱 → 計畫外', () => {
    const r = run({ workouts: [], wellness: [] }, { events: [ev(1, '2026-11-05', 'A_跑步')], activities: [{ id: 7, start_date_local: '2026-11-05T08:00:00', name: '登山', type: 'Ride', moving_time: 3600, distance: 20000 }] });
    expect(r.ops.upsertWorkouts.find((o) => o.id === 'icu-act-7').doc.unplanned).toBe(true);
  });
  it('wellness：睡眠 0 或 HRV 空 → missing', () => {
    const r = run({ workouts: [], wellness: [] }, { wellness: [{ id: '2026-11-06', restingHR: 56, hrv: null, sleepSecs: 0 }, { id: '2026-11-05', restingHR: 50, hrv: 60, sleepSecs: 25200 }] });
    expect(r.ops.upsertWellness.map((o) => o.doc.missing)).toEqual([true, false]);
  });
});

describe('配對與標記完成', () => {
  const act = (id, name, type, secs, dist = 5000) => ({ id, start_date_local: '2026-11-05T08:00:00', start_date: '2026-11-05T00:00:00Z', name, type, moving_time: secs, distance: dist });
  it('名稱不符但同天同類型只有一筆 → 配對並標記完成、記錄 doneAt 與實際值', () => {
    const r = run({ workouts: [], wellness: [] }, { events: [ev(1, '2026-11-05', 'A_跑步')], activities: [act(9, '晨跑', 'Run', 1900)] });
    const d = r.ops.upsertWorkouts[0].doc;
    expect(r.ops.upsertWorkouts).toHaveLength(1);
    expect(d).toMatchObject({ done: true, doneAt: '2026-11-05T00:00:00Z', actual: { min: 32, km: 5 } });
  });
  it('一個課表對到多筆：取時長最接近者，其餘為計畫外', () => {
    const r = run({ workouts: [], wellness: [] }, { events: [ev(1, '2026-11-05', 'A_跑步')], activities: [act(1, 'A_跑步 前半', 'Run', 600), act(2, 'A_跑步 本體', 'Run', 1800)] });
    expect(r.ops.upsertWorkouts.find((o) => o.id === 'icu-1').doc.actual.min).toBe(30);
    expect(r.ops.upsertWorkouts.find((o) => o.id === 'icu-act-1').doc.unplanned).toBe(true);
  });
  it('部分讀取失敗（events 為 null）：不產生刪除', () => {
    const ex = { workouts: [{ id: 'icu-2', date: '2026-11-06', title: 'x', kind: '跑', done: false }], wellness: [] };
    const r = run(ex, { events: null, activities: [] });
    expect(r.ops.deleteWorkouts).toEqual([]);
  });
  it('略過清單進報告', () => {
    const r = run({ workouts: [], wellness: [] }, { activities: [act(5, '誤觸', 'Run', 27, 100)] });
    expect(r.report.skipped[0]).toContain('27 秒');
  });
});

describe('舊編號的計畫外文件', () => {
  it('同日同名的舊編號文件被取代，不重複', () => {
    const ex = { workouts: [{ id: 'icu-act-mtb-1', date: '2026-11-05', title: '八德區 登山車', kind: '騎', unplanned: true, done: true }], wellness: [] };
    const r = run(ex, { events: [], activities: [{ id: 'i77', start_date_local: '2026-11-05T08:00:00', name: '八德區 登山車', type: 'Ride', moving_time: 3600, distance: 20000 }] });
    expect(r.ops.deleteWorkouts).toContain('icu-act-mtb-1');
    expect(r.ops.upsertWorkouts.some((o) => o.id === 'icu-act-i77')).toBe(true);
  });
});

describe('runSync（假資料庫與假網路）', () => {
  const mkEnv = () => { const calls = []; return { calls, env: { ICU_API_KEY: 'SECRETKEY', ICU_ATHLETE_ID: 'i1', DB: {
    prepare: (sql) => ({ bind: (...a) => ({ sql, a, all: async () => ({ results: [] }), run: async () => (calls.push({ sql, a }), {}) }), all: async () => ({ results: [] }), run: async () => (calls.push({ sql, a: [] }), {}) }),
    batch: async (st) => { calls.push({ batch: st.length }); } } } } };
  it('GET 且帶 User-Agent；401 時資料不變、紀錄寫「金鑰失效」、金鑰不外洩', async () => {
    const { runSync } = await import('../src/sync.js');
    const seen = []; globalThis.fetch = async (u, o) => (seen.push(o), new Response('no', { status: 401 }));
    const { env, calls } = mkEnv();
    const r = await runSync(env, 'cron');
    expect(r.ok).toBe(false);
    expect(seen.every((o) => o.method === 'GET' && /Mozilla/.test(o.headers['User-Agent']))).toBe(true);
    expect(calls.some((c) => 'batch' in c)).toBe(false);
    const lg = calls.find((c) => /INSERT INTO sync_log/.test(c.sql || ''));
    expect(lg.a).toContain('同步失敗：金鑰失效');
    expect(JSON.stringify(calls)).not.toContain('SECRETKEY');
  });
});

describe('展示版快照', () => {
  it('不含禁止欄位', () => {
    const s = buildSnapshot({ today: '2026-11-06', ranges: {}, wellness: { rhr: 60, hrv: 30, sleepH: 7 },
      workouts: [{ date: '2026-11-06', title: 'T', kind: '跑', mins: 50, done: true, desc: 'SECRET', actual: { min: 50, km: 8, avgHr: 150, load: 40 } },
        { date: '2026-11-06', unplanned: true, title: 'U', note: '2.4km・8 分・均心率 115・負荷 9' }] });
    const j = JSON.stringify(s);
    for (const w of ['SECRET', 'avgHr', 'load', '115', 'desc', 'hrv":3', 'rhr":6']) expect(j).not.toContain(w);
    expect(s.body).toEqual({ rhr: 'out', hrv: 'out' });
    expect(s.extras[0]).toEqual({ title: 'U', km: 2.4, min: 8 });
  });
});

describe('時區', () => {
  const t = new Date('2026-11-07T20:00:00Z');
  it('同一個時間點，不同時區的「今天」不同', () => {
    expect(todayIn('Asia/Taipei', t)).toBe('2026-11-08');
    expect(todayIn('America/Los_Angeles', t)).toBe('2026-11-07');
    expect(todayIn('Asia/Tokyo', t)).toBe('2026-11-08');
  });
  it('無效時區回傳 null', () => { expect(validTz('Not/AZone')).toBeNull(); expect(validTz('')).toBeNull(); expect(validTz('Asia/Taipei')).toBe('Asia/Taipei'); });
});
