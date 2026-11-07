#!/usr/bin/env python3
"""休息圖（等角 2:1，體素堆疊，逐像素光柵化）。執行：python3 build_iso.py [放大倍數] → iso_rest.json、preview.png
格式同 sprite_data.json：[y,x,寬,色票索引]，色票沿用 ACT.p。頭部像素取自 idle（正面）影格，不重畫。"""
import json, math, sys
from lib import *
A = ACT['a']
TW, TH, ZH = 8, 4, 4          # 頂面菱形 8×4（2:1），每一層高 4 px
# 材質 (上, 左, 右)：光源在左上，上最亮、左次之、右最暗
M = dict(
  deck=(21,22,23), coping=(26,27,22), frame=(27,22,23), pole=(22,23,23), grey=(15,23,22), white=(25,26,27),
  shirt=(10,11,12), shorts=(17,18,19), skin=(3,4,5), watch=(15,23,23), shoe=(25,26,24),
  shade=(22,23,23), water=(32,33,34), waterHi=(31,32,33),
)
COLORWAYS = {'青綠': (6,7,8), '紫': (24,29,30), '萊姆': (10,11,12)}

def voxels(stripe):
    V = {}
    put = lambda x,y,z,m: V.__setitem__((x,y,z),m)
    for x in range(16):
        for y in range(16):
            if y >= 12: put(x,y,-1, M['waterHi'] if (x*3+y*5)%7==0 else M['water'])   # 前方泳池，低一格
            else: put(x,y,0, M['coping'] if y==11 else M['deck'])
    zc = lambda x: 3 + (9-x) if x < 9 else 3               # 椅背向頭端斜升
    for x in range(4,16):
        for y in range(5,9):
            put(x,y,zc(x), stripe if (x//2)%2==0 else M['white'])
        if x < 9:
            for y in (5,8):
                for z in range(3, zc(x)): put(x,y,z,M['frame'])
    for (x,y) in [(5,5),(5,8),(14,5),(14,8)]:
        for z in (1,2): put(x,y,z,M['frame'])
    for x in range(5,15): put(x,5,2,M['frame']); put(x,8,2,M['frame'])
    for x in (6,7,8):                                        # 軀幹（襯衫）
        for y in (6,7): put(x,y,zc(x)+1,M['shirt']); put(x,y,zc(x)+2,M['shirt'])
    for x in (9,10):                                         # 短褲
        for y in (6,7): put(x,y,4,M['shorts']); put(x,y,5,M['shorts'])
    for x in range(11,14):                                   # 腿
        for y in (6,7): put(x,y,4,M['skin'])
    for x in (14,15):                                        # 鞋（鞋頭朝 +x，右面為紫色鞋底）
        for y in (6,7): put(x,y,4,M['shoe'])
    for x in (7,8,9):                                        # 手臂放兩側
        put(x,5,zc(x)+1,M['skin']); put(x,8,zc(x)+1,M['skin'])
    put(9,5,4,M['watch']); put(9,8,4,M['watch'])
    for z in range(1,17): put(7,2,z,M['pole'])               # 傘桿在椅後
    cx,cy,zt = 7,2,17
    for x in range(0,16):
        for y in range(-4,9):
            d = math.hypot(x-cx,y-cy)
            if d <= 5.6:
                sec = int(((math.atan2(y-cy,x-cx)+math.pi)/(2*math.pi))*10)%2
                put(x,y,zt, stripe if sec==0 else M['white'])
    put(7,2,zt+1,M['grey'])
    return V

def inside(poly, px, py):
    n=len(poly); c=False
    for i in range(n):
        x1,y1=poly[i]; x2,y2=poly[(i+1)%n]
        if (y1>py)!=(y2>py) and px < (x2-x1)*(py-y1)/(y2-y1)+x1: c=not c
    return c
def draw_voxel(buf,W,H,ox,oy,x,y,z,m):
    top,left,right = m
    cx = (x-y)*TW/2+ox; cy = (x+y)*TH/2 - (z+1)*ZH + oy     # 頂面菱形中心
    T=[(cx,cy-TH/2),(cx+TW/2,cy),(cx,cy+TH/2),(cx-TW/2,cy)]
    L=[(cx-TW/2,cy),(cx,cy+TH/2),(cx,cy+TH/2+ZH),(cx-TW/2,cy+ZH)]
    R=[(cx,cy+TH/2),(cx+TW/2,cy),(cx+TW/2,cy+ZH),(cx,cy+TH/2+ZH)]
    for py in range(int(cy-TH/2)-1,int(cy+TH/2+ZH)+2):
        for px in range(int(cx-TW/2)-1,int(cx+TW/2)+2):
            if not(0<=px<W and 0<=py<H): continue
            p=(px+.5,py+.5)
            if inside(T,*p): buf[py][px]=top
            elif inside(L,*p): buf[py][px]=left
            elif inside(R,*p): buf[py][px]=right
W,H,OX,OY = 220,240,110,100
def build(stripe):
    V=voxels(stripe); buf=[[None]*W for _ in range(H)]
    for (x,y,z) in sorted(V,key=lambda k:(k[0]+k[1]+k[2],k[2])): draw_voxel(buf,W,H,OX,OY,x,y,z,V[(x,y,z)])
    # 頭：idle（正面）第 0–13 列；底部置中於椅背頂端
    f=A['idle']['f'][0]; rows=[(y,x,w,c) for y,x,w,c in f if y<=13]
    x0=min(x for _,x,_,_ in rows); x1=max(x+w for _,x,w,_ in rows)
    hx=(5.5-6.5)*TW/2+OX; hy=(5.5+6.5)*TH/2-(3+(9-5)+1)*ZH+OY
    ox=int(round(hx-(x0+x1)/2)); oy=int(round(hy-14))+3
    for y,x,w,c in rows:
        for i in range(w):
            px,py=x+i+ox,y+oy
            if 0<=px<W and 0<=py<H: buf[py][px]=c
    return buf
def crop(buf,pad=1):
    ys=[y for y,r in enumerate(buf) if any(v is not None for v in r)]; xs=[x for r in buf for x,v in enumerate(r) if v is not None]
    y0,y1,x0,x1=max(min(ys)-pad,0),max(ys)+pad,max(min(xs)-pad,0),max(xs)+pad
    return [r[x0:x1+1] for r in buf[y0:y1+1]]
def runs(buf):
    out=[]
    for y,row in enumerate(buf):
        x=0; wd=len(row)
        while x<wd:
            if row[x] is None: x+=1; continue
            c=row[x]; s=x
            while x<wd and row[x]==c: x+=1
            out.append([y,s,x-s,c])
    return out
if __name__=='__main__':
    out={'meta':{'note':'休息圖（等角 2:1 體素場景）：泳池、躺椅、遮陽傘、躺著的娃娃。三種配色，使用時隨機挑一個。格式 [y,x,寬,色票索引]，色票沿用 ACT.p。頭部像素取自 idle 影格。由 source/rest_iso/build_iso.py 產生。','colorways':list(COLORWAYS)},'variants':{}}
    bufs={k:crop(build(st)) for k,st in COLORWAYS.items()}
    sz=(max(len(b[0]) for b in bufs.values()),max(len(b) for b in bufs.values()))
    frames=[]
    for k,b in bufs.items():
        r=runs(b); out['variants'][k]={'w':len(b[0]),'h':len(b),'f':[r]}; frames.append((r,len(b[0]),len(b)))
    json.dump(out,open('iso_rest.json','w'),ensure_ascii=False,separators=(',',':'))
    sheet(frames,scale=int(sys.argv[1]) if len(sys.argv)>1 else 5).save('preview.png'); print([(f[1],f[2]) for f in frames])
