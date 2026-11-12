#!/usr/bin/env bash
# 自訂網域保護狀態檢查（未登入視角）：bash scripts/check_domains.sh
# 完整版：未登入應被導向 Access 登入（302）；展示版：公開，只有 /api/snapshot 有資料，其他 /api/* 為 404，且不含禁止欄位。
FULL=${1:-adventure.dino.tw}; DEMO=${2:-quest.dino.tw}
code() { curl -s -m 20 -o /dev/null -w "%{http_code}" "$1"; }
echo "完整版（預期 302 導向登入）"; for p in / /api/me /api/workouts /api/wellness; do printf "  %-16s %s\n" "$p" "$(code https://$FULL$p)"; done
echo "展示版（預期 / 與 /api/snapshot 為 200，其餘 /api/* 為 404）"; for p in / /api/snapshot /api/workouts /api/wellness /api/me /api/sync-status; do printf "  %-16s %s\n" "$p" "$(code https://$DEMO$p)"; done
curl -s -m 20 "https://$DEMO/api/snapshot" | python3 -c "
import sys,json,re
raw=sys.stdin.read(); d=json.loads(raw)
bad=re.findall(r'bpm|@|\"(?:desc|note|email|avgHr|load|ctl|atl|tsb|sleepH?|sleepScore)\"',raw)
print('  禁止欄位或內容：', bad or '無'); print('  body：', d.get('body'))"
