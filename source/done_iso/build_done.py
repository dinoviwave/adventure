#!/usr/bin/env python3
"""完成的圖（等角 2:1 體素場景）：領獎台、獎盃、彩帶、舉起雙手的娃娃。三種配色。
執行：python3 build_done.py [放大倍數] → iso_done.json（含自己的色票 p）、preview.png。頭部像素取自 idle 影格，不重畫。"""
import json, sys, random
from lib import *
A = ACT['a']
TW, TH, ZH = 8, 4, 4
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def shade(h,k): r,g,b=hx(h); return '#%02x%02x%02x'%tuple(max(0,min(255,int(c*k))) for c in (r,g,b))
def tri(h): return (shade(h,1.0), shade(h,0.82), shade(h,0.64))   # 上、左、右
DECK=('#c8d0e2','#a4acc4','#828aa6'); STONE=tri('#9fb0cc')
SHIRT=('#d8ea60','#a0b838','#6c8028'); SHORTS=('#4652aa','#283078','#1a1e54'); SKIN=('#fad6b0','#eebc8e','#ce966c'); SHOE=('#ffffff','#ecf0f8','#aa92ec')
GOLD=tri('#f2c230'); RED=tri('#e8453c'); POLE=('#acb2bc','#828aa6','#6c7390')
WAYS={'金':{'first':tri('#f2c230'),'second':tri('#c8d0e2'),'third':tri('#d08a4c'),'flags':['#e8453c','#f2c230','#2f6fdd'],'confetti':['#e8453c','#f2c230','#2f6fdd','#62c254','#ffffff','#aa92ec']},
      '青綠':{'first':tri('#24a8b0'),'second':tri('#d8ea60'),'third':tri('#ffffff'),'flags':['#24a8b0','#d8ea60','#ffffff'],'confetti':['#24a8b0','#d8ea60','#ffffff','#146e7c','#aaecf0','#f2c230']},
      '紫':{'first':tri('#8c70d8'),'second':tri('#f6a6d0'),'third':tri('#ffffff'),'flags':['#8c70d8','#f6a6d0','#f2c230'],'confetti':['#8c70d8','#f6a6d0','#f2c230','#aa92ec','#ffffff','#62c254']}}
def voxels(w):
    V={}; put=lambda x,y,z,m: V.__setitem__((x,y,z),m)
    for x in range(10):
        for y in range(10): put(x,y,0,DECK)
    def block(x0,y0,h,m):
        for x in range(x0,x0+3):
            for y in range(y0,y0+3):
                for z in range(1,h+1): put(x,y,z,m)
    block(0,3,2,w['second']); block(3,3,3,w['first']); block(6,3,1,w['third'])
    # 獎盃放在右前方的第三名台上（表面 z=2，不會被娃娃擋住）：底座、杯柄、杯身
    put(7,4,2,GOLD); put(7,4,3,GOLD)
    for z in (4,5):
        put(7,4,z,GOLD); put(7,3,z,GOLD)
    put(7,4,5,tri('#fff3b0')); put(7,3,5,tri('#fff3b0'))     # 杯口亮邊
    put(6,4,4,GOLD); put(8,3,4,GOLD)                           # 把手
    # 第二名台上放一顆彩球
    put(1,4,3,tri(w['flags'][0]))
    return V
def inside(poly,px,py):
    n=len(poly); c=False
    for i in range(n):
        x1,y1=poly[i]; x2,y2=poly[(i+1)%n]
        if (y1>py)!=(y2>py) and px<(x2-x1)*(py-y1)/(y2-y1)+x1: c=not c
    return c
W_,H_,OX,OY=200,240,100,150
def draw(buf,x,y,z,m):
    top,left,right=m; cx=(x-y)*TW/2+OX; cy=(x+y)*TH/2-(z+1)*ZH+OY
    T=[(cx,cy-TH/2),(cx+TW/2,cy),(cx,cy+TH/2),(cx-TW/2,cy)]; L=[(cx-TW/2,cy),(cx,cy+TH/2),(cx,cy+TH/2+ZH),(cx-TW/2,cy+ZH)]; R=[(cx,cy+TH/2),(cx+TW/2,cy),(cx+TW/2,cy+ZH),(cx,cy+TH/2+ZH)]
    for py in range(int(cy-TH/2)-1,int(cy+TH/2+ZH)+2):
        for px in range(int(cx-TW/2)-1,int(cx+TW/2)+2):
            if not(0<=px<W_ and 0<=py<H_): continue
            p=(px+.5,py+.5)
            if inside(T,*p): buf[py][px]=top
            elif inside(L,*p): buf[py][px]=left
            elif inside(R,*p): buf[py][px]=right
def build(w):
    V=voxels(w); buf=[[None]*W_ for _ in range(H_)]
    for (x,y,z) in sorted(V,key=lambda k:(k[0]+k[1]+k[2],k[2])): draw(buf,x,y,z,V[(x,y,z)])
    f=A['idle']['f'][0]; fw=A['idle']['w']; fh=A['idle']['h']
    ox=int(round(OX-fw/2)); oy=int(round(OY+2-fh))                                  # 腳底踩在第一名台面中央
    for y,x,ww,c in f:
        for i in range(ww):
            px,py=x+i+ox,y+oy
            if 0<=px<W_ and 0<=py<H_: buf[py][px]='#'+ACT['p'][c]
    def Q(x,y,ww,hh,c):
        for j in range(hh):
            for k in range(ww):
                px,py=ox+x+k,oy+y+j
                if 0<=px<W_ and 0<=py<H_: buf[py][px]=c
    for i in range(5):                                                               # 緞帶（V 字）
        Q(7+i,14+i,2,1,'#e8453c'); Q(15-i,14+i,2,1,'#e8453c')
    Q(9,19,4,4,'#f2c230'); Q(9,19,4,1,'#fff3b0'); Q(10,20,2,2,'#c9971f')              # 獎牌
    hyp=oy+14; hxp=OX
    # 紙花碎片：只畫在空白處，避開娃娃本體與頭部
    rnd=random.Random(11); cs=w['confetti']; ex=(OX-18,oy-6,OX+18,OY+8)
    for i in range(46):
        px=rnd.randrange(OX-62,OX+62); py=rnd.randrange(oy-30,OY+30); c=cs[i%len(cs)]
        ww,hh=((2,2),(3,2),(2,3))[i%3]
        if ex[0]<=px<=ex[2] and ex[1]<=py<=ex[3]: continue
        if all(0<=py+j<H_ and 0<=px+k<W_ and buf[py+j][px+k] is None for j in range(hh) for k in range(ww)):
            for j in range(hh):
                for k in range(ww): buf[py+j][px+k]=c
    return buf
def crop(buf,pad=1):
    ys=[y for y,r in enumerate(buf) if any(v is not None for v in r)]; xs=[x for r in buf for x,v in enumerate(r) if v is not None]
    y0,y1,x0,x1=max(min(ys)-pad,0),max(ys)+pad,max(min(xs)-pad,0),max(xs)+pad
    return [r[x0:x1+1] for r in buf[y0:y1+1]]
if __name__=='__main__':
    bufs={k:crop(build(w)) for k,w in WAYS.items()}
    pal=[]; idx={}
    def pi(c):
        if c not in idx: idx[c]=len(pal); pal.append(c)
        return idx[c]
    out={'meta':{'note':'完成的圖（等角 2:1 體素場景）：領獎台、獎盃、彩帶紙花、舉起雙手的娃娃。三種配色，使用時隨機挑一個。格式 [y,x,寬,色票索引]，色票用本檔的 p（十六進位，不含 #）。頭部像素取自 idle 影格。由 source/done_iso/build_done.py 產生。','colorways':list(WAYS)},'variants':{}}
    frames=[]
    for k,b in bufs.items():
        runs=[]
        for y,row in enumerate(b):
            x=0
            while x<len(row):
                if row[x] is None: x+=1; continue
                c=row[x]; s=x
                while x<len(row) and row[x]==c: x+=1
                runs.append([y,s,x-s,pi(c)])
        out['variants'][k]={'w':len(b[0]),'h':len(b),'f':[runs]}
    out['p']=[c.lstrip('#') for c in pal]
    json.dump(out,open('iso_done.json','w'),ensure_ascii=False,separators=(',',':'))
    import lib
    lib.P=['#'+c for c in out['p']]
    frames=[(v['f'][0],v['w'],v['h']) for v in out['variants'].values()]
    sheet(frames,scale=int(sys.argv[1]) if len(sys.argv)>1 else 5).save('preview.png'); print([(f[1],f[2]) for f in frames], len(pal),'色')
