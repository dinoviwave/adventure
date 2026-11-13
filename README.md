# Dino's Big Adventure（Cloudflare 版）

每日訓練冒險頁面：從 intervals.icu 同步課表與身體訊號，用像素風角色呈現「今天做了什麼」。
需求依據：`docs/開發規格 v0.1.md`；文件索引：`docs/README.md`；進度與決定：`CLAUDE.md`。

## 架構

| 項目 | 說明 |
|---|---|
| 完整版 Worker `adventure` | `adventure.dino.tw`。Cloudflare Access（Google 登入）保護；Worker 自己再驗證 `Cf-Access-Jwt-Assertion`。提供頁面、`/api/*`、排程同步 |
| 展示版 Worker `adventure-demo` | `quest.dino.tw`。公開，只有頁面與 `/api/snapshot`（只組出淨化欄位） |
| 資料庫 | 一個 D1（`adventure`），兩個 Worker 共用 |
| 排程 | 台北 06:00–22:30 每 30 分鐘＋23:00（`wrangler.toml` 的 `crons`，UTC） |
| 資料來源 | intervals.icu，**只用 GET**；金鑰只放 Cloudflare 機密 `ICU_API_KEY` |

## 本機開發

```bash
npm i
cp .dev.vars.example .dev.vars   # 本機身分與機密，已被 .gitignore 排除
npm run db:local
node scripts/seed_to_sql.mjs seed/seed_2026-11-07.json > seed/seed.sql   # seed/ 含身體資料，不進 git
npx wrangler d1 execute adventure --local --file=seed/seed.sql
npm run dev            # 完整版 :8787（用 x-dev-email 標頭切換身分）
npm run dev:demo       # 展示版 :8788（要等完整版啟動完再開，避免 SQLite 鎖）
npm test               # 自動測試
```

## 部署與更新

日常更新只要一行（拉最新程式、安裝套件、建置、部署兩個 Worker）：

```bash
npm run update
```

- **一律用 `npm run update` 或 `npm run deploy`**：它們會先產生 `public/version.json`（新版本偵測用）。單獨用 `wrangler deploy` 不會更新版本檔。
- **有新的資料庫升級檔時**（`migrations/` 多了檔案），先升級遠端資料庫再部署：`npm run db:remote`，再 `npm run update`。沒套用時，同步的紀錄寫入會失敗（Cloudflare 指標會出現「未發現的例外」）。
- 部署前後不經過 GitHub Actions，全部在自己的電腦上執行。

### 第一次部署（需在 Cloudflare 帳號操作）
1. `npx wrangler d1 create adventure`，把 `database_id` 填進兩個 wrangler 設定。
2. `npx wrangler d1 migrations apply adventure --remote`；匯入種子：`npx wrangler d1 execute adventure --remote --file=seed/seed.sql`。
3. Zero Trust 建 Access 應用程式，政策只 Allow 指定 email；登入方式用 Google（細節見 `docs/階段0 Access 登入設定手冊.md`）。把 team domain、AUD、`EDITOR_EMAILS`、`VIEWER_EMAILS` 填入 `wrangler.toml`。
4. `npx wrangler secret put ICU_API_KEY`。
5. `npm run update`。

## 設定與機密

| 名稱 | 位置 | 說明 |
|---|---|---|
| `ICU_API_KEY` | Cloudflare 機密（`wrangler secret put`）、本機 `.dev.vars` | intervals.icu 金鑰。不得出現在程式碼、日誌、資料庫、文件、commit、對話 |
| `ICU_ATHLETE_ID`、`ICU_BASE_URL` | `wrangler.toml` | 選手代號與 API 位址 |
| `ACCESS_TEAM_DOMAIN`、`ACCESS_AUD` | `wrangler.toml` | Access 簽發者網域（例如 `xxx.cloudflareaccess.com`）與應用程式 AUD；`ACCESS_AUD` 可填多個（逗號分隔） |
| `EDITOR_EMAILS`、`VIEWER_EMAILS` | `wrangler.toml` | 可編輯者、只讀者（逗號分隔，不寫死在程式碼） |
| `APP_TZ` | `wrangler.toml` | 伺服器端同步範圍用的時區（預設 Asia/Taipei）；畫面上的時間依裝置時區 |
| `SYNC_COOLDOWN_MIN` | `wrangler.toml`（可選） | 打開頁面時自動同步的冷卻分鐘數（預設 10） |

## 日常運作

- **資料更新**：排程每 30 分鐘一次；可編輯者打開頁面或切回 App 時自動在背景同步（10 分鐘內剛同步過就略過）；右下角「↻ 更新於 HH:MM」＝立即同步（至少間隔 60 秒），只讀者按下為重新載入資料。
- **同步狀態**：「↻」按鈕在最近一次同步失敗、超過 24 小時沒成功同步、或從未同步時多一行紅字（含原因與時間）。資料來自 `GET /api/sync-status`；錯誤開頭是「警告：」的紀錄視為成功。失敗不做主動通知（Dino 決定，頁面有呈現即可）。
- **手動更新頁面**（iPhone 主畫面網頁沒有重新整理）：右下角「⟳ 重新載入頁面」；切回 App 時偵測到新版本會在上方提示。頁面底端顯示版號與更新日期。
- **版號**：在 `package.json` 的 `version`，Dino 核可的里程碑再手動調整；更新日期是部署時間。
- **同步規則**：依 `docs/資料同步功能設計 v0.1.md`（課表以 intervals.icu 為準、勾選與關鍵標記不覆蓋、27 秒誤觸略過、缺資料標 missing、讀到 0 筆課表不刪除）。

## 金鑰輪替

intervals.icu 的個人 API Key 只有一組；重新產生後**舊的立刻失效**，其他使用這把金鑰的流程（例如貼金鑰到對話的文件流程）也會一併失效。

1. 到 intervals.icu 的設定重新產生 API Key。
2. 在自己的終端機（不要貼到對話）執行，依提示貼上新金鑰：

```bash
npx wrangler secret put ICU_API_KEY
```

3. 觸發一次同步確認成功：打開完整版頁面按「↻」，或等下次排程。
4. 打開 `https://adventure.dino.tw/api/sync-status`，確認最近一次紀錄的 `error` 是空的、時間是剛才。
5. 更新其他使用這把金鑰的流程。
6. 本機測試用的 `.dev.vars` 裡如果有舊金鑰，一併刪除或更新。

若第 4 步看到「同步失敗：金鑰失效」，代表機密沒更新成功或貼錯，回到第 2 步重做。

## 備份與還原

手冊與驗收紀錄：`docs/備份與還原演練.md`。常用指令：

```bash
npx wrangler d1 export adventure --remote --output=backup/adventure-$(date +%Y%m%d).sql
```

- 備份檔含身體資料，只放自己的電腦或私人雲端，`backup/` 已被 git 排除，**不得公開**。
- 還原先用本機空資料庫驗證（`rm -rf .wrangler/state` 後 `wrangler d1 execute adventure --local --file=備份檔`），再核對各表筆數。
- D1 Time Travel（免費可回溯 7 天）可作輔助，**不要在正式資料庫隨意 `time-travel restore`**。
- 2026-11-13 已演練一次：遠端與本機還原後各表筆數逐項一致。

## 自訂網域（dino.tw）

| 網址 | 對應 | 保護 |
|---|---|---|
| `adventure.dino.tw` | 完整版 `adventure` | Cloudflare Access（Google 登入） |
| `quest.dino.tw` | 展示版 `adventure-demo` | 公開，**不可**放在 Access 範圍內 |

- 設定在 `wrangler.toml` 與 `wrangler.demo.toml` 的 `[[routes]]`（`custom_domain = true`），部署時 Cloudflare 自動建立 DNS 與憑證。`workers.dev` 網址已關閉（`workers_dev = false`）。
- Access 若是「保護整個 Worker」會自動涵蓋所有網域；若是「依主機名稱」要把 `adventure.dino.tw` 加進應用程式的 Public hostnames。
- 展示版要公開：確認沒開「Protect all Workers」，也沒納入任何 Access 應用程式。
- 換網址後登入狀態依網址分開，需重新登入；iPhone 主畫面要用新網址重新加入。

## 測試與檢查腳本

| 指令 | 用途 |
|---|---|
| `npm test` | 自動測試（同步規則、快照淨化、短標籤、拱門規則、游泳背景、圖片資料等） |
| `bash scripts/security_check.sh` | 本機安全複查：名單外／只讀／可編輯三種身分、寫入權限、端點白名單、回應不含機密（需本機 :8787） |
| `bash scripts/check_domains.sh` | 線上未登入視角：完整版應 302 導向登入，展示版只有 `/api/snapshot` 且無禁止欄位 |
| `node scripts/states_matrix.cjs` | 展示版「動作 × 身體狀態」所有狀態並排截圖（整頁） |
| `node scripts/card_scenarios.cjs`、`card_check.cjs` | 完整版今日圖卡（一般／品質／比賽／完成）檢查 |
| `node scripts/sync_status_states.cjs`、`sync_open_check.cjs`、`sync_btn_check.cjs`、`version_check.cjs`、`add_form_check.cjs` | 同步狀態、打開自動同步、更新按鈕、版號與新版本偵測、新增課表摺疊的行為檢查 |
| `node scripts/mock_intervals.mjs` | 模擬 intervals.icu（:8799，金鑰 `GOODKEY`），搭配 `wrangler dev --test-scheduled` 與 `curl "localhost:8787/__scheduled?cron=0+23+*+*+*"` 測同步 |

腳本依賴 Playwright（全域安裝，執行前 `export NODE_PATH=$(npm root -g)`）。

## 圖片素材（像素角色不可重畫）

角色影格在頁面的 `ACT`，備份在 `source/sprite_data.json`。休息圖、完成圖是等角 Q 版場景，頭部沿用現有影格：

| 素材 | 來源與重新產生 |
|---|---|
| 休息圖（今天沒有課表） | `source/rest_iso/`：`python3 source/rest_iso/build_iso.py` |
| 完成圖（今天的課表完成） | `source/done_iso/`：`python3 source/done_iso/build_done.py` |
| 終點拱門、游泳背景、短標籤、拱門規則 | `source/archplan.js`、`source/swimbg.js`、`source/wlabel.js`（展示版模板與完整版頁面各內含一份，有測試比對一致） |

改完素材後執行 `npm run build:demo` 重新產生 `rest-art.js`、`done-art.js` 與展示版頁面。

## 疑難排解

| 現象 | 原因與處理 |
|---|---|
| `/api/me` 回 403 | 看回應的 `reason`：`config`＝Worker 變數沒設；`no_jwt`＝Access 沒保護此網址；`bad_jwt:...`＝憑證驗證失敗（後面帶步驟與簽發者，例如簽發者網域不同）；`not_listed`＝email 不在名單 |
| 每次打開都要重新登入 | Access 登入有**兩層**（全域與應用程式），兩層的登入時間都要調到 1 個月；見 `docs/階段0 Access 登入設定手冊.md` |
| Cloudflare 指標出現大量「未發現的例外」 | 檢查遠端資料庫是否已套用最新 migrations（`npm run db:remote`） |
| 同步顯示失敗但資料其實有更新 | 紀錄寫入失敗被當成同步失敗，通常也是 migrations 沒套用；程式已加保險，會退回簡版紀錄 |
| `wrangler d1 execute --remote` 回 7403 | 重新登入：`npx wrangler logout` 再 `npx wrangler login`，必要時改用後台 D1 Console |
| D1 查詢出現 `too many terms in compound SELECT` | 複合查詢（UNION）項數有上限，改用子查詢 |
| 頁面停在舊版（iPhone 主畫面） | 按右下角「⟳ 重新載入頁面」；部署請用 `npm run update` |
| 新增課表時日期與類型重疊（舊版 iPhone） | 已修正（新增課表為摺疊，窄螢幕上下排）；請先更新頁面 |
