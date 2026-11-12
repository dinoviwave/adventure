# 階段 0：Cloudflare Access 加 Google 登入（操作手冊與紀錄）

更新：2026-11-12。目標：手機（含 iOS 主畫面網頁）一個月內不用重新登入，過期時直接跳 Google，不收驗證碼。不需要改程式。
依據：Cloudflare 與 Google 官方文件（來源見 `待查證清單.md` 第 5、15 項）。

## 設定值（非機密）

| 項目 | 值 |
|---|---|
| Team domain | `dinohome.cloudflareaccess.com` |
| Google 授權的 JavaScript 來源 | `https://dinohome.cloudflareaccess.com` |
| Google 授權的重新導向 URI | `https://dinohome.cloudflareaccess.com/cdn-cgi/access/callback` |
| Google Cloud 專案 | `adventure-login`（同意畫面：外部、測試中） |
| 允許登入的帳號 | 可編輯 `dino.ko@gmail.com`、只讀 `conniebe@gmail.com`（Worker 變數 `EDITOR_EMAILS`、`VIEWER_EMAILS`） |

**機密**：Google 的用戶端密鑰只放在 Cloudflare 的 Identity provider 設定裡，不寫進文件、程式或對話。

## 步驟與目前狀態

| # | 步驟 | 位置 | 狀態 |
|---|---|---|---|
| 1 | 建立 Google 專案、OAuth 同意畫面（外部）、網頁應用程式 OAuth 用戶端 | Google Cloud 主控台 | 完成 |
| 1b | 把兩個帳號加入「目標對象 → 測試使用者」 | Google Auth Platform | **待確認**（未回報） |
| 2 | 在 Cloudflare 新增 Google 登入方式，並按 Test | Zero Trust → Integrations → Identity providers | 完成（第一次 Test 因舊分頁出現「Unable to find the requested identity provider」，重試成功） |
| 3a | 全域登入時間設為 1 個月 | Zero Trust → Access controls → Access settings → Set your global session duration | 完成（Dino 回報兩層都已設定，2026-11-12） |
| 3b | `adventure` 應用程式的 Session Duration 設為 1 個月 | Access controls → Applications → adventure → Edit | 完成（同上） |
| 4 | `adventure` 只勾 Google、取消 One-time PIN、開啟 Apply instant authentication，並 Save | 同上 | 完成（2026-11-12 先前截圖是舊設定的收驗證碼畫面；調整後已生效） |
| 5 | 驗證：無痕視窗開網址應直接跳 Google；手機主畫面網頁實測 | 瀏覽器、iPhone | 部分完成：電腦開網址**直接跳 Google**；iPhone 主畫面網頁**直接進到頁面，沒有跳到 Safari 或出現其他畫面**（Dino 回報，2026-11-12）。「幾天內是否不用重登」需要觀察 |

## 重要觀念（官方文件）

1. Access 登入有**兩層**：全域登入（15 分鐘到 1 個月，預設 24 小時）與應用程式登入（立即到 1 個月，預設 24 小時）。**兩層都要調**才會長期不用重登。
2. Gmail 帳號即可使用 Google 登入，不需要 Google Workspace。
3. 只允許單一登入方式時，開 **Apply instant authentication**，使用者看不到 Access 登入頁，直接導向 Google。
4. 外部同意畫面「測試中」：只要求 openid、email、profile 時，refresh token 不受 7 天限制，也不需額外驗證；但登入者需在「測試使用者」名單內。

## 驗證清單（做完逐項確認）

- [x] Identity providers 列表有 Google，Test 成功
- [x] 全域登入時間 = 1 個月
- [x] `adventure` 的 Session Duration = 1 個月
- [x] `adventure` 的登入方式只勾 Google，One-time PIN 已取消
- [x] Apply instant authentication 已開啟，Save 成功
- [x] 無痕視窗開網址 → 直接跳 Google（不出現「Send login code」）→ 登入後可編輯
- [ ] 太太的帳號登入 → 顯示「目前只能檢視」，勾選被擋
- [x] iPhone 主畫面網頁：沒有跳到 Safari，直接進到頁面（2026-11-12）
- [ ] 觀察：幾天到一個月內是否不需重登（持續記錄，若又要求登入，記下日期與間隔）

## 疑難排解

| 現象 | 原因與處理 |
|---|---|
| Test 出現「Unable to find the requested identity provider」 | 舊分頁或尚未儲存。重新整理列表，確認 Google 在列表內，用列表上的 Test 重測 |
| Google 顯示 `redirect_uri_mismatch` | Google 用戶端的重新導向 URI 與上表不一致，逐字核對 |
| Google 顯示「存取遭拒」或「應用程式未驗證」 | 登入帳號不在「測試使用者」名單 |
| `Error 401: deleted_client` | Google 端的 OAuth 用戶端被刪或過期，重建用戶端並更新 Cloudflare 的 App ID 與密鑰 |
| 登入後 403 | Access 允許規則或 Worker 的 `EDITOR_EMAILS`／`VIEWER_EMAILS` 沒有該 email；API 的 `reason` 代碼見 README 疑難排解 |
| 仍出現「Send login code」 | 應用程式還啟用 One-time PIN，或沒有指定 Google；回應用程式編輯畫面調整後 Save，並用無痕視窗重測 |

## 回退

若 Google 登入出問題，在 `adventure` 應用程式的登入方式重新勾選 One-time PIN 並 Save，即可回到原本的收驗證碼登入。
