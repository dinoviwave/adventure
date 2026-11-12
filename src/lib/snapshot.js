// 展示版快照：只組出淨化後的欄位（規格第八節；課表名稱維持原樣，要怎麼顯示由前端決定）。不含 desc、心率、HRV、睡眠、CTL/ATL、note 內的心率與負荷。
export const START = '2026-11-02', NWEEKS = 7;
export const RACES = [
  { id: 'nanshan', name: '南山人壽半馬', date: '2026-11-22' },
  { id: 'taipei', name: '台北馬拉松 半馬', date: '2026-12-20' },
];
const d0 = (s) => Date.parse(s + 'T00:00:00Z');
const diff = (a, b) => Math.round((d0(b) - d0(a)) / 86400000);
const addDays = (s, n) => new Date(d0(s) + n * 86400000).toISOString().slice(0, 10);

function judge(w, r) {
  if (!w || w.missing || w.hrv == null || !(w.sleepH > 0)) return { rhr: 'missing', hrv: 'missing' };
  return {
    rhr: w.rhr > r.rhrMax ? 'out' : w.rhr >= r.rhrMax - 1 ? 'near' : 'ok',
    hrv: w.hrv < r.hrvMin ? 'out' : w.hrv <= r.hrvMin + 2 ? 'near' : 'ok',
  };
}

// workouts: [{date,title,kind,mins,done,unplanned,note,actual}]；wellness: 今天那筆或 undefined
export function buildSnapshot({ today, workouts, wellness, ranges }) {
  const r = { rhrMax: Number(ranges?.rhrMax) || 56, hrvMin: Number(ranges?.hrvMin) || 43 };
  const wi = Math.max(0, Math.min(NWEEKS - 1, Math.floor(diff(START, today) / 7)));
  const ws = addDays(START, wi * 7), we = addDays(START, wi * 7 + 6);
  const inWeek = workouts.filter((w) => w.date >= ws && w.date <= we && !w.unplanned && w.kind !== '休息');
  const tw = workouts.find((w) => !w.unplanned && w.date === today && w.kind !== '休息');
  const race = RACES.find((x) => x.date >= today) || null;
  const extras = workouts.filter((w) => w.unplanned && w.date === today).map((w) => {
    const km = /([\d.]+)\s*km/.exec(w.note || ''), mn = /(\d+)\s*分/.exec(w.note || '');
    return { title: w.title, km: km ? Number(km[1]) : null, min: mn ? Number(mn[1]) : null };
  });
  // 下一個課表：從今天起最近一筆「還沒完成的訓練」（今天的還沒完成就是今天的；休息、計畫外不算）；新增欄位，內容不轉換
  const nx = workouts.filter((w) => !w.unplanned && w.kind !== '休息' && (w.date > today || (w.date === today && !w.done))).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  return {
    date: today, weekNo: wi + 1, weeks: NWEEKS,
    next: nx ? { date: nx.date, kind: nx.kind, title: nx.title, mins: nx.mins ?? null, key: !!nx.key } : null,
    race: race && { name: race.name, date: race.date },
    workout: tw ? {
      kind: tw.kind, title: tw.title, mins: tw.mins ?? null, done: !!tw.done,
      actual: tw.done && tw.actual ? { km: tw.actual.km ?? null, min: tw.actual.min ?? null } : null,
    } : null,
    extras,
    week: { done: inWeek.filter((w) => w.done).length, total: inWeek.length },
    body: judge(wellness, r),
  };
}
