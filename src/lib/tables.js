// 表格定義與欄位轉換：頁面用 camelCase（Firestore 風格），D1 用 snake_case。
// 沒有專屬欄位的欄位放進 x（JSON），讀出時展開回原樣。

export const TABLES = {
  workouts: {
    pk: 'id',
    cols: ['date', 'title', 'kind', 'mins', 'desc', 'done', 'doneAt', 'key', 'source', 'unplanned', 'note', 'removedFromIcu', 'actual', 'createdAt'],
    bool: ['done', 'key', 'unplanned', 'removedFromIcu'],
    json: ['actual'],
  },
  wellness: {
    pk: 'date', idIsDate: true,
    cols: ['rhr', 'hrv', 'ctl', 'atl', 'sleepH', 'sleepScore', 'missing', 'source'],
    bool: ['missing'], json: [],
  },
  checks: { pk: 'id', cols: ['race', 'item', 'done', 'doneAt'], bool: ['done'], json: [] },
  checkitems: { pk: 'id', cols: ['race', 'label', 'required'], bool: ['required'], json: [] },
  events: { pk: 'id', cols: ['t', 'type', 'label'], bool: [], json: [] },
  sync_requests: { pk: 'id', cols: ['t', 'status'], bool: [], json: [] },
};
export const WRITABLE = [...Object.keys(TABLES), 'config'];
export const CONFIG_KEYS = ['ranges', 'races'];

export const snake = (s) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export const col = (c) => (c === 'desc' ? '"desc"' : c === 'key' ? '"key"' : c === 'trigger' ? '"trigger"' : snake(c));

export function rowToDoc(t, row) {
  const d = TABLES[t], out = {};
  for (const c of d.cols) {
    let v = row[snake(c)];
    if (v === undefined || v === null) continue; // 空值不輸出，維持與原 Firestore 文件相同的形狀
    if (d.bool.includes(c)) v = v === 1 || v === true;
    else if (d.json.includes(c) && typeof v === 'string') { try { v = JSON.parse(v) } catch { /* 保持原樣 */ } }
    out[c] = v;
  }
  if (row.x) { try { Object.assign(out, JSON.parse(row.x)) } catch { /* 略過壞資料 */ } }
  return out;
}

// 回傳 {cols:[欄位名], vals:[值]}，不含主鍵
export function docToRow(t, doc) {
  const d = TABLES[t], cols = [], vals = [], extra = {};
  for (const [k, v] of Object.entries(doc || {})) {
    if (k === 'id') continue;
    if (d.cols.includes(k)) {
      cols.push(col(k));
      if (d.bool.includes(k)) vals.push(v ? 1 : 0);
      else if (d.json.includes(k)) vals.push(v == null ? null : JSON.stringify(v));
      else vals.push(v === undefined ? null : v);
    } else extra[k] = v;
  }
  cols.push('x'); vals.push(Object.keys(extra).length ? JSON.stringify(extra) : null);
  return { cols, vals };
}

export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
