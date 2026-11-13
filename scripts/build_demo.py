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
t = t.replace('<main class="card" id="card"', '<script src="/rest-art.js"></script>\n<script src="/done-art.js"></script>\n<main class="card" id="card"', 1)
# 沒有課表（休息）時改顯示休息圖
t = t.replace("function scene(){", "function scene(){\n  if(w&&w.done&&window.DONE_ART){var dv=DONE_ART.pick(),dx=Math.round((220-dv.w)/2),dy=Math.round((130-dv.h)/2),dq='<svg viewBox=\\\"0 0 220 130\\\" role=\\\"img\\\" aria-label=\\\"今天的課表完成了\\\" shape-rendering=\\\"crispEdges\\\"><rect class=\\\"m-sky\\\" x=\\\"0\\\" y=\\\"0\\\" width=\\\"220\\\" height=\\\"130\\\"/>';dv.f[0].forEach(function(r){dq+='<rect x=\\\"'+(r[1]+dx)+'\\\" y=\\\"'+(r[0]+dy)+'\\\" width=\\\"'+r[2]+'\\\" height=\\\"1\\\" fill=\\\"#'+DONE_ART.p[r[3]]+'\\\"/>'});return dq+'</svg>'}\n  if(!w&&window.REST_ART){var v=REST_ART.pick(),ox=Math.round((220-v.w)/2),oy=Math.round((130-v.h)/2),q='<svg viewBox=\"0 0 220 130\" role=\"img\" aria-label=\"角色正在休息\" shape-rendering=\"crispEdges\"><rect class=\"m-sky\" x=\"0\" y=\"0\" width=\"220\" height=\"130\"/>';v.f[0].forEach(function(r){q+='<rect x=\"'+(r[1]+ox)+'\" y=\"'+(r[0]+oy)+'\" width=\"'+r[2]+'\" height=\"1\" fill=\"#'+REST_ART.p[r[3]]+'\"/>'});return q+'</svg>'}", 1)
assert 'var SNAP=__SNAP__;' in t and t.rstrip().endswith('</script>')
t = t.replace('var SNAP=__SNAP__;', "fetch('/api/snapshot?tz='+encodeURIComponent((function(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return ''}})()),{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(SNAP){", 1)
k = t.rindex('})();')
t = t[:k] + "}).catch(function(e){try{console.error('展示版載入失敗：',e)}catch(_){}document.getElementById('card').innerHTML='<div class=\"sec\">資料暫時讀不到，請稍後再試。</div>'});\n})();" + t[k + 5:]
t = '<!doctype html>\n<html lang="zh-Hant"><head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + t
os.makedirs(os.path.join(root, 'public-demo'), exist_ok=True)
open(os.path.join(root, 'public-demo/index.html'), 'w', encoding='utf-8').write(t)
print(len(t))

# 休息圖（等角 Q 版，三種配色隨機）：產生 rest-art.js，完整版與展示版共用
rest = json.load(open(os.path.join(root, 'source/rest_iso/iso_rest.json'), encoding='utf-8'))
pal = json.load(open(os.path.join(root, 'source/sprite_data.json'), encoding='utf-8'))['palette']
js = ('/* 由 scripts/build_demo.py 產生，來源 source/rest_iso/iso_rest.json。三種配色，pick() 隨機回傳一種。 */\n'
      'window.REST_ART={p:' + json.dumps(pal) + ',variants:' + json.dumps(rest['variants'], separators=(',', ':')) +
      ',pick:function(){var k=Object.keys(this.variants);return this.variants[k[Math.floor(Math.random()*k.length)]]}};\n')
for d in ('public', 'public-demo'):
    open(os.path.join(root, d, 'rest-art.js'), 'w', encoding='utf-8').write(js)

# 完成的圖（等角 Q 版領獎台，三種配色隨機）：產生 done-art.js（有自己的色票 p）
done = json.load(open(os.path.join(root, 'source/done_iso/iso_done.json'), encoding='utf-8'))
djs = ('/* 由 scripts/build_demo.py 產生，來源 source/done_iso/iso_done.json。今天的課表完成時使用，pick() 隨機回傳一種配色。 */\n'
       'window.DONE_ART={p:' + json.dumps(done['p']) + ',variants:' + json.dumps(done['variants'], separators=(',', ':')) +
       ',pick:function(){var k=Object.keys(this.variants);return this.variants[k[Math.floor(Math.random()*k.length)]]}};\n')
for d in ('public', 'public-demo'):
    open(os.path.join(root, d, 'done-art.js'), 'w', encoding='utf-8').write(djs)
