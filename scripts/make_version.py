#!/usr/bin/env python3
"""部署前產生 public/version.json：內容是 public/ 裡頁面檔案的雜湊。頁面用它偵測「是否有新版本」。
由 npm run deploy 自動呼叫；public/version.json 是產物，不進 git。"""
import datetime, hashlib, json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
h = hashlib.sha256()
for name in sorted(os.listdir(root)):
    if name == 'version.json' or not os.path.isfile(os.path.join(root, name)): continue
    h.update(name.encode()); h.update(open(os.path.join(root, name), 'rb').read())
v = h.hexdigest()[:12]
ver = json.load(open(os.path.join(root, '..', 'package.json'), encoding='utf-8')).get('version', '')
built = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
# v＝內容雜湊（偵測新版本用，內容沒變就不變）；version＝版號（package.json）；built＝這次建置的時間（UTC）
json.dump({'v': v, 'version': ver, 'built': built}, open(os.path.join(root, 'version.json'), 'w'))
print('version', ver, 'build', v, built)
