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

## 同步測試（本機）
`node scripts/mock_intervals.mjs` 啟動模擬 intervals.icu（:8799，金鑰 GOODKEY），`.dev.vars` 加 `ICU_API_KEY=GOODKEY`、`ICU_BASE_URL=http://127.0.0.1:8799`，用 `wrangler dev --test-scheduled` 後 `curl "localhost:8787/__scheduled?cron=0+23+*+*+*"` 觸發。同步必須帶一般 User-Agent（否則 403，見設計文件第八節）。

## 疑難排解：/api/me 回 403
回應的 `reason` 代表原因：`config`（Worker 變數沒設）、`no_jwt`（Access 沒保護此網址）、`bad_jwt:...`（憑證驗證失敗，後面帶步驟與簽發者）、`not_listed`（email 不在名單）。`ACCESS_TEAM_DOMAIN` 要填 **Access 簽發者網域**（例如 `xxx.cloudflareaccess.com`），不是 Worker 名稱；`ACCESS_AUD` 要填該 Access 應用程式的 AUD tag。更新並部署：`npm run update`。

## 休息圖
今天沒有課表時，展示版與今日圖卡改顯示休息圖（等角 Q 版，三種配色隨機）。像素資料在 `source/rest_iso/iso_rest.json`，重新產生用 `python3 source/rest_iso/build_iso.py`，再跑 `npm run build:demo` 更新 `rest-art.js`。

## 資料更新時機
- 排程：台北 06:00–22:30 每 30 分鐘，另加 23:00（`wrangler.toml` 的 `crons`，UTC）。
- 打開頁面或切回 App：可編輯者自動在背景同步，10 分鐘內剛同步過就略過（`SYNC_COOLDOWN_MIN` 可調）。
- 右下角「↻ 更新於 HH:MM」：立即同步，最少間隔 60 秒；只讀者按下為重新載入資料。
- 檢查腳本：`scripts/sync_open_check.cjs`、`scripts/sync_btn_check.cjs`（需本機 :8787 與模擬 intervals.icu）。

## 資料庫升級（有新的 migrations 時）
拉到新版程式後，若 `migrations/` 有新檔案，先升級遠端資料庫再部署：`npm run db:remote`（會列出待套用的檔案並要求確認），再 `npm run update`。2026-11-12 的 `0002_sync_log_detail.sql` 為 `sync_log` 加 `detail` 欄位；沒套用時，排程同步的紀錄寫入會失敗（Cloudflare 指標顯示「未發現的例外」）。
