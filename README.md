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

## 同步狀態提示
右下角「↻」按鈕會顯示最近一次成功同步時間。最近一次同步失敗時多一行紅字（含原因與時間）；超過 24 小時沒有成功同步或從未成功同步時，也會多一行紅字提醒。資料來自 `GET /api/sync-status`（`failed`、`staleHours`）；錯誤開頭為「警告：」的紀錄視為成功。

## 自訂網域（dino.tw）
| 網址 | 對應 | 保護 |
|---|---|---|
| `adventure.dino.tw` | 完整版 `adventure` | Cloudflare Access（Google 登入） |
| `quest.dino.tw` | 展示版 `adventure-demo` | 公開，**不可**放在 Access 範圍內 |

- 設定在 `wrangler.toml` 與 `wrangler.demo.toml` 的 `[[routes]]`（`custom_domain = true`）。部署時 Cloudflare 會自動建立 DNS 記錄與憑證；網域必須是同一個 Cloudflare 帳號裡有效的 zone，且該主機名稱不能已有 CNAME 記錄。
- Access：若 `adventure` 是用「保護整個 Worker」，官方說明會自動涵蓋它所有的網域，不用另外加。若是「依主機名稱」保護，要到 Zero Trust → Access controls → Applications → adventure → Edit，加入 `adventure.dino.tw`。若新增了另一個 Access 應用程式，把它的 AUD 加進 `ACCESS_AUD`（逗號分隔，可填多個）。
- 展示版 `quest.dino.tw` 要公開：確認帳號沒有開「Protect all Workers」，也沒有把它納入任何 Access 應用程式。
- 換網址後登入狀態是依網址分開的，需重新登入一次；iPhone 主畫面要用新網址重新加入。
- `workers.dev` 網址先保留作為過渡，確認新網址都正常後，再把兩份設定的 `workers_dev` 改成 `false` 關閉。

## 版號與手動更新
- 版號在 `package.json` 的 `version`；改版（Dino 核可的里程碑）時手動調整。更新日期是部署時間，由 `npm run deploy` 先執行 `scripts/make_version.py` 產生 `public/version.json`。
- iPhone 主畫面網頁沒有重新整理：右下角「⟳ 重新載入頁面」可整頁重新載入；切回 App 偵測到新版本會自動提示。
- 單獨用 `wrangler deploy` 會沒有更新 version.json，請一律用 `npm run deploy` 或 `npm run update`。
