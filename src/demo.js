import { buildSnapshot } from './lib/snapshot.js';
import { rowToDoc } from './lib/tables.js';
import { todayIn, validTz } from './lib/sync-core.js';

// 展示版：沒有驗證、沒有寫入功能，只有 GET /api/snapshot。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/snapshot') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      // 「今天」依檢視者的時區決定（瀏覽器帶 ?tz=IANA 時區），沒帶或無效就用 APP_TZ（預設 Asia/Taipei）
      const tz = validTz(url.searchParams.get('tz')) || validTz(env.APP_TZ) || 'Asia/Taipei';
      const today = todayIn(tz);
      // 只取需要的欄位；desc、note 以外的敏感欄位根本不查（note 只用來取公里與分鐘，且在 snapshot 內被淨化）
      const wk = (await env.DB.prepare('SELECT date,title,kind,mins,done,unplanned,note,actual FROM workouts').all()).results.map((r) => rowToDoc('workouts', r));
      const w = await env.DB.prepare('SELECT rhr,hrv,sleep_h,missing FROM wellness WHERE date=?').bind(today).first();
      const rg = await env.DB.prepare("SELECT value FROM config WHERE key='ranges'").first();
      const snap = buildSnapshot({ today, workouts: wk, wellness: w ? rowToDoc('wellness', w) : undefined, ranges: rg ? JSON.parse(rg.value) : {} });
      return new Response(JSON.stringify(snap), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60' } });
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not Found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
