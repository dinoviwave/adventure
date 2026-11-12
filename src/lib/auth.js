// Cloudflare Access JWT 驗證（RS256）。依官方「Validate JWTs」：
// 從 https://<team>.cloudflareaccess.com/cdn-cgi/access/certs 取公鑰，驗簽章、aud、iss、exp。
const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
let jwksCache = { at: 0, keys: null };

// 容錯：設定值若多寫了 https:// 或結尾斜線，自動去掉
export const teamHost = (t) => String(t || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');

async function getKeys(team, force = false) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetch(`https://${teamHost(team)}/cdn-cgi/access/certs`, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; adventure-worker)', Accept: 'application/json' } });
  if (!r.ok) throw new Error('jwks ' + r.status);
  jwksCache = { at: Date.now(), keys: (await r.json()).keys };
  return jwksCache.keys;
}

export async function verifyAccessJwt(token, env) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('format');
  const head = JSON.parse(new TextDecoder().decode(b64u(h)));
  const pay = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (head.alg !== 'RS256') throw new Error('alg');
  let keys = await getKeys(env.ACCESS_TEAM_DOMAIN);
  let jwk = keys.find((k) => k.kid === head.kid);
  if (!jwk) { keys = await getKeys(env.ACCESS_TEAM_DOMAIN, true); jwk = keys.find((k) => k.kid === head.kid); } // 金鑰輪替：重抓一次
  if (!jwk) throw new Error(`kid ${String(head.kid).slice(0, 8)} iss=${pay.iss} keys=${keys.map((k) => String(k.kid).slice(0, 8)).join(',')}`);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('sig');
  const aud = Array.isArray(pay.aud) ? pay.aud : [pay.aud];
  const allowed = String(env.ACCESS_AUD || '').split(',').map((x) => x.trim()).filter(Boolean); // 可填多個 AUD（逗號分隔）
  if (!allowed.some((x) => aud.includes(x))) throw new Error('aud');
  if (pay.iss !== `https://${teamHost(env.ACCESS_TEAM_DOMAIN)}`) throw new Error('iss');
  if (!pay.exp || pay.exp * 1000 < Date.now()) throw new Error('exp');
  return pay;
}

const list = (s) => String(s || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

// 回傳 {email, role} 或 {reason}（未通過）。reason 只給診斷用，不含 email 或設定內容：
// bad_jwt:xxx 的 xxx 為失敗步驟（jwks、kid、sig、aud、iss、exp、alg、format）。config（Worker 變數沒設）、no_jwt（沒帶 Access 憑證）、bad_jwt（憑證驗證失敗）、not_listed（email 不在名單）。
export async function authenticate(request, env) {
  let email;
  if (!env.ACCESS_TEAM_DOMAIN) {
    // 只有本機開發（.dev.vars 設了 DEV_AUTH_EMAIL、且沒設 ACCESS_TEAM_DOMAIN）才略過 Access
    if (!env.DEV_AUTH_EMAIL) return { reason: 'config' };
    email = (request.headers.get('x-dev-email') || env.DEV_AUTH_EMAIL).toLowerCase();
  } else {
    const tok = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!tok) return { reason: 'no_jwt' };
    try { const pay = await verifyAccessJwt(tok, env); email = String(pay.email || '').toLowerCase() } catch (e) { return { reason: 'bad_jwt:' + (e && e.message ? String(e.message).slice(0, 120) : 'unknown') } }
  }
  if (list(env.EDITOR_EMAILS).includes(email)) return { email, role: 'editor' };
  if (list(env.VIEWER_EMAILS).includes(email)) return { email, role: 'viewer' };
  return { reason: 'not_listed' };
}
