import { TABLES, WRITABLE, CONFIG_KEYS, rowToDoc, docToRow, newId } from './lib/tables.js';
import { authenticate } from './lib/auth.js';
import { runSync, syncNow } from './sync.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const err = (status, code, msg) => json({ error: code, message: msg }, status);

async function listTable(env, t) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${t}`).all();
  const pk = TABLES[t].pk;
  return results.map((r) => ({ id: r[pk], ...rowToDoc(t, r) }));
}

async function upsert(env, t, id, doc, merge) {
  const pk = TABLES[t].pk;
  if (merge) {
    const cur = await env.DB.prepare(`SELECT * FROM ${t} WHERE ${pk}=?`).bind(id).first();
    if (!cur) return false;
    doc = { ...rowToDoc(t, cur), ...doc };
  }
  const { cols, vals } = docToRow(t, doc);
  const ph = cols.map(() => '?').join(',');
  const upd = cols.map((c) => `${c}=excluded.${c}`).join(',');
  await env.DB.prepare(`INSERT INTO ${t} (${pk},${cols.join(',')}) VALUES (?,${ph}) ON CONFLICT(${pk}) DO UPDATE SET ${upd}`)
    .bind(id, ...vals).run();
  return true;
}

async function handleApi(request, env, url, who) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // 去掉 'api'
  if (parts[0] === 'sync-requests') parts[0] = 'sync_requests'; // 規格寫法的別名
  const [t, id] = parts;
  const m = request.method;

  if (t === 'me') return json({ email: who.email, canWrite: who.role === 'editor' });
  if (t === 'sync-now') {
    if (m !== 'POST') return err(405, 'method', '不支援的方法');
    if (who.role !== 'editor') return err(403, 'read_only', '目前只能檢視');
    let body = {}; try { body = await request.json() } catch { /* 沒有內容也可 */ }
    return json(await syncNow(env, !!(body && body.force)));
  }
  if (t === 'sync-status') {
    const last = await env.DB.prepare('SELECT * FROM sync_log ORDER BY t DESC LIMIT 1').first();
    const lastOk = await env.DB.prepare("SELECT t FROM sync_log WHERE error IS NULL ORDER BY t DESC LIMIT 1").first();
    return json({ last, lastOkAt: lastOk?.t || null });
  }
  if (!WRITABLE.includes(t)) return err(404, 'not_found', '沒有這個資源');
  if (m !== 'GET' && who.role !== 'editor') return err(403, 'read_only', '目前只能檢視，無法修改資料');

  try {
    if (t === 'config') {
      if (!CONFIG_KEYS.includes(id)) return err(404, 'not_found', '沒有這個設定');
      if (m === 'GET') {
        const r = await env.DB.prepare('SELECT value FROM config WHERE key=?').bind(id).first();
        return r ? json(JSON.parse(r.value)) : err(404, 'not_found', '尚未設定');
      }
      if (m === 'PUT') {
        const body = await request.json();
        await env.DB.prepare('INSERT INTO config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(id, JSON.stringify(body)).run();
        return json({ ok: true });
      }
      return err(405, 'method', '不支援的方法');
    }
    if (!id) {
      if (m === 'GET') return json(await listTable(env, t));
      if (m === 'POST') {
        const body = await request.json();
        const nid = newId();
        const doc = t === 'sync_requests' ? { t: new Date().toISOString(), status: 'pending' } : body;
        await upsert(env, t, nid, doc, false);
        return json({ id: nid }, 201);
      }
      return err(405, 'method', '不支援的方法');
    }
    if (m === 'GET') {
      const r = await env.DB.prepare(`SELECT * FROM ${t} WHERE ${TABLES[t].pk}=?`).bind(id).first();
      return r ? json({ id, ...rowToDoc(t, r) }) : err(404, 'not_found', '找不到');
    }
    if (m === 'PUT') { await upsert(env, t, id, await request.json(), false); return json({ ok: true }) }
    if (m === 'PATCH') { const ok = await upsert(env, t, id, await request.json(), true); return ok ? json({ ok: true }) : err(404, 'not_found', '找不到') }
    if (m === 'DELETE') { await env.DB.prepare(`DELETE FROM ${t} WHERE ${TABLES[t].pk}=?`).bind(id).run(); return json({ ok: true }) }
    return err(405, 'method', '不支援的方法');
  } catch (e) {
    if (e instanceof SyntaxError) return err(400, 'bad_json', '內容格式錯誤');
    return err(500, 'server', '伺服器錯誤');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const who = await authenticate(request, env);
    if (!who.role) return json({ error: 'forbidden', message: '沒有權限', reason: who.reason }, 403);
    return handleApi(request, env, url, who);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSync(env, 'cron').catch((e) => console.error('排程同步未預期錯誤：', String(e && e.message).slice(0, 200))));
  },
};
