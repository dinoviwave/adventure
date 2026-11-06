# 雙半馬冒險路線（Cloudflare 版）

兩個 Worker 共用一個 D1：`adventure`（完整版，Access 保護，含排程同步）與 `adventure-demo`（公開展示版，只有 `/api/snapshot`）。需求依據：`docs/開發規格 v0.1.md`。

## 本機開發
```bash
npm i
cp .dev.vars.example .dev.vars   # 本機身分與機密，已被 .gitignore 排除
npm run db:local
node scripts/seed_to_sql.mjs seed/seed_2026-11-07.json > seed/seed.sql
npx wrangler d1 execute adventure --local --file=seed/seed.sql
npm run dev            # 完整版 :8787（用 x-dev-email 標頭切換身分）
npm run dev:demo       # 展示版 :8788（要等完整版啟動完再開，避免 SQLite 鎖）
npm test               # 同步邏輯與展示版淨化測試
```

## 部署（需在 Cloudflare 帳號操作）
1. `npx wrangler d1 create adventure`，把 `database_id` 填進兩個 wrangler 設定。
2. `npx wrangler d1 migrations apply adventure --remote`；匯入種子：`wrangler d1 execute adventure --remote --file=seed/seed.sql`。
3. Zero Trust 建 Access 應用程式（保護完整版網址），政策 Allow 指定 email（外部 email 用一次性 PIN）。把 team domain 與 AUD 填入 `wrangler.toml` 的 `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD`，`EDITOR_EMAILS`、`VIEWER_EMAILS` 填 email。
4. `npx wrangler secret put ICU_API_KEY`（金鑰只放這裡）。
5. `npm run build:demo && npm run deploy && npm run deploy:demo`。

## 金鑰輪替
intervals.icu 重新產生金鑰（舊的立刻失效，其他使用金鑰的流程一併更新）→ `wrangler secret put ICU_API_KEY` → 等下次排程或手動觸發 → 看 `/api/sync-status` 確認成功。

## 備份
`wrangler d1 export adventure --remote --output backup/xxx.sql`（指令待查證；備份含身體資料，勿公開）。

## 待查證（開工前規格要求）
Workers 靜態資源 vs Pages、Access 免費人數上限與 PIN 設定、Cron 時區（目前以 UTC 設定）、D1 額度。
