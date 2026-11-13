#!/usr/bin/env bash
# 本機安全複查（四種身分＋寫入權限＋端點白名單）：bash scripts/security_check.sh
# 需先在本機啟動完整版（npx wrangler dev --port 8787），.dev.vars 設 DEV_AUTH_EMAIL、EDITOR_EMAILS、VIEWER_EMAILS。
B=${1:-http://127.0.0.1:8787}; EDITOR=${EDITOR:-dino@example.test}; VIEWER=${VIEWER:-wife@example.test}; STRANGER=${STRANGER:-evil@example.test}
pass=0; fail=0
chk() { # 說明 預期碼 實際碼
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf "  ✔ %-58s %s\n" "$1" "$3"; else fail=$((fail+1)); printf "  ✘ %-58s 預期 %s 實際 %s\n" "$1" "$2" "$3"; fi; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
H='content-type: application/json'
echo "名單外身分（不得看到任何資料）"
for p in /api/me /api/workouts /api/wellness /api/config/ranges /api/sync-status; do chk "GET $p" 403 "$(code -H "x-dev-email: $STRANGER" $B$p)"; done
chk "POST /api/workouts" 403 "$(code -XPOST -H "x-dev-email: $STRANGER" -H "$H" -d '{}' $B/api/workouts)"
echo "只讀者（可讀，寫入全部被拒）"
for p in /api/me /api/workouts /api/wellness /api/config/ranges /api/sync-status; do chk "GET $p" 200 "$(code -H "x-dev-email: $VIEWER" $B$p)"; done
chk "POST /api/workouts" 403 "$(code -XPOST -H "x-dev-email: $VIEWER" -H "$H" -d '{"date":"2026-01-01","title":"x","kind":"跑"}' $B/api/workouts)"
chk "PUT /api/workouts/zz" 403 "$(code -XPUT -H "x-dev-email: $VIEWER" -H "$H" -d '{}' $B/api/workouts/zz)"
chk "PATCH /api/workouts/zz" 403 "$(code -XPATCH -H "x-dev-email: $VIEWER" -H "$H" -d '{}' $B/api/workouts/zz)"
chk "DELETE /api/workouts/zz" 403 "$(code -XDELETE -H "x-dev-email: $VIEWER" $B/api/workouts/zz)"
chk "PUT /api/config/ranges" 403 "$(code -XPUT -H "x-dev-email: $VIEWER" -H "$H" -d '{}' $B/api/config/ranges)"
chk "POST /api/events" 403 "$(code -XPOST -H "x-dev-email: $VIEWER" -H "$H" -d '{}' $B/api/events)"
chk "POST /api/sync-now（觸發同步）" 403 "$(code -XPOST -H "x-dev-email: $VIEWER" -H "$H" -d '{}' $B/api/sync-now)"
echo "可編輯者（可讀寫，且只能碰白名單端點）"
chk "GET /api/me" 200 "$(code -H "x-dev-email: $EDITOR" $B/api/me)"
ID=$(curl -s -XPOST -H "x-dev-email: $EDITOR" -H "$H" -d '{"date":"2026-01-01","title":"安全複查暫存","kind":"跑"}' $B/api/workouts | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
chk "POST /api/workouts（新增）" 1 "$([ -n "$ID" ] && echo 1 || echo 0)"
chk "DELETE /api/workouts/{新增的}" 200 "$(code -XDELETE -H "x-dev-email: $EDITOR" $B/api/workouts/$ID)"
for p in /api/secrets /api/sync_log /api/d1_migrations /api/config/sync_lock /api/config/ICU_API_KEY; do chk "GET $p（非白名單）" 404 "$(code -H "x-dev-email: $EDITOR" $B$p)"; done
echo "回應內容不得含金鑰或設定值"
BODY=$( (curl -s -H "x-dev-email: $EDITOR" $B/api/me; curl -s -H "x-dev-email: $EDITOR" $B/api/sync-status; curl -s -H "x-dev-email: $STRANGER" $B/api/me) )
chk "回應不含 ICU_API_KEY／EDITOR_EMAILS 字樣" 0 "$(echo "$BODY" | grep -c -E 'ICU_API_KEY|EDITOR_EMAILS|VIEWER_EMAILS|Basic ')"
echo; echo "通過 $pass 項，失敗 $fail 項"; [ $fail -eq 0 ]
