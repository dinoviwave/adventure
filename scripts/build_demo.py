#!/usr/bin/env python3
"""由 source/ 產生展示版頁面 public-demo/index.html（資料改由 /api/snapshot 取得）。
用法：python3 scripts/build_demo.py"""
import json, os
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
L = open(os.path.join(root, 'source/adventure_page_v18_source.html'), encoding='utf-8').read().split('\n')
def grab(a, b):
    i = next(k for k, l in enumerate(L) if l.startswith(a))
    j = next(k for k, l in enumerate(L) if k > i and l.startswith(b))
    return '\n'.join(L[i:j])
sprite = '\n'.join([next(l for l in L if l.startswith('var ACT=')),
                    next(l for l in L if l.startswith('var KIND2ACT')),
                    next(l for l in L if l.startswith('var SWEAT=')),
                    grab('var DROP=', 'function tree(')])
t = open(os.path.join(root, 'source/showcase_template.html'), encoding='utf-8').read()
t = t.replace('__TITLE__', '今天做了什麼').replace('__SPRITE__', sprite)
assert 'var SNAP=__SNAP__;' in t and t.rstrip().endswith('</script>')
t = t.replace('var SNAP=__SNAP__;', "fetch('/api/snapshot',{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(SNAP){", 1)
k = t.rindex('})();')
t = t[:k] + "}).catch(function(){document.getElementById('card').innerHTML='<div class=\"sec\">資料暫時讀不到，請稍後再試。</div>'});\n})();" + t[k + 5:]
t = '<!doctype html>\n<html lang="zh-Hant"><head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + t
os.makedirs(os.path.join(root, 'public-demo'), exist_ok=True)
open(os.path.join(root, 'public-demo/index.html'), 'w', encoding='utf-8').write(t)
print(len(t))
