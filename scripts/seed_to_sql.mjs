// 把 seed/*.json（Firestore 匯出）轉成 D1 可匯入的 SQL：node scripts/seed_to_sql.mjs seed/xxx.json > seed/seed.sql
// 先清空再匯入；種子含個人資料，輸出放在 seed/（已被 .gitignore 排除）。
import fs from 'node:fs';
import { TABLES, docToRow } from '../src/lib/tables.js';
const q = (v) => v == null ? 'NULL' : typeof v === 'number' ? String(v) : "'" + String(v).replace(/'/g, "''") + "'";
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
for (const t of ['workouts', 'wellness', 'checks', 'checkitems', 'events']) {
  out.push(`DELETE FROM ${t};`);
  for (const [id, doc] of Object.entries(d[t] || {})) {
    const { cols, vals } = docToRow(t, doc);
    out.push(`INSERT INTO ${t} (${TABLES[t].pk},${cols.join(',')}) VALUES (${[id, ...vals].map(q).join(',')});`);
  }
}
out.push('DELETE FROM config;');
for (const [k, v] of Object.entries(d.config || {})) out.push(`INSERT INTO config (key,value) VALUES (${q(k)},${q(JSON.stringify(v))});`);
console.log(out.join('\n'));
