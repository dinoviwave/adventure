from lib import *  # 需在 source/rest 目錄執行：python3 build_rest.py
import json,sys
A=ACT['a']; W,H=64,44
def grid(): return [[None]*W for _ in range(H)]
def px(g,x,y,c):
    if 0<=x<W and 0<=y<H: g[y][x]=c
def rect(g,x,y,w,h,c):
    for j in range(h):
        for i in range(w): px(g,x+i,y+j,c)
def band(g,x0,y0,x1,y1,t,c):  # 以階梯方式畫斜帶（粗 t），x 方向掃描
    n=max(abs(x1-x0),1)
    for i in range(n+1):
        x=x0+i; y=round(y0+(y1-y0)*i/n)
        for k in range(t): px(g,x,y+k,c)
def paste_rows(g,src,w,h,r0,r1,dx,dy):
    for y,x,ww,c in src:
        if r0<=y<=r1:
            for i in range(ww): px(g,x+i+dx,y+dy,c)
def build(canopy, chair_stripe):
    g=grid()
    # 泳池與地面（水面沿用 swim 影格的水色型）
    sw=A['swim']['f'][0]; water={}
    for y,x,ww,c in sw:
        if 31<=c<=34:
            for i in range(ww): water[(x+i,y)]=c
    wys=sorted({y for (_,y) in water}); wxs=[x for (x,_) in water]
    # 地面
    for y in range(36,44):
        for x in range(W): px(g,x,y,26 if y==36 else (27 if y in (40,) else 21))
    # 泳池：x 0..21，水面深一格
    for y in range(36,44):
        for x in range(0,22):
            yy=wys[(y-36)%len(wys)]; xx=min(wxs)+((x)%(max(wxs)-min(wxs)+1))
            px(g,x,y,water.get((xx,yy),32))
    for x in range(0,22): px(g,x,36,31 if x%4<2 else 25)   # 水面反光
    rect(g,22,36,1,8,27)  # 池緣
    # 躺椅：椅背（斜）、坐墊、横桿、椅腳
    band(g,28,27,38,32,3,25)                    # 椅背軟墊
    for i in range(29,38,3):
        yy=27+round((i-28)*.5); px(g,i,yy,chair_stripe); px(g,i,yy+1,chair_stripe); px(g,i,yy+2,chair_stripe)
    rect(g,36,32,23,2,25)                        # 坐墊（白）
    for x in range(38,58,3): rect(g,x,32,1,2,chair_stripe)
    rect(g,36,34,23,1,23)                        # 横桿
    rect(g,28,31,1,4,23); rect(g,36,35,1,1,23); rect(g,57,35,1,1,23)   # 椅腳
    # 人物：頭部沿用騎車影格第 0–12 列
    paste_rows(g,A['bike']['f'][0],34,32,0,12,16,12)
    # 身體：襯衫（沿用色票 10/11/12），逐列填出斜躺的軀幹
    spans={25:(30,34),26:(30,36),27:(30,38),28:(31,40),29:(33,41),30:(36,41),31:(38,41)}
    for y,(x0,x1) in spans.items():
        n=x1-x0+1
        for i,x in enumerate(range(x0,x1+1)):
            c=10 if i<n*0.45 else 11
            if i>=n-2 or y==31: c=12
            px(g,x,y,c)
    # 短褲、腿（平放在坐墊上）、鞋（鞋頭朝上微翹）
    rect(g,41,28,5,4,17); rect(g,41,31,5,1,19); rect(g,42,29,3,1,18)
    rect(g,46,29,6,3,4); rect(g,46,31,6,1,5); rect(g,46,29,6,1,3)
    rect(g,52,28,5,3,26); rect(g,52,28,5,1,25); rect(g,52,31,5,1,24); px(g,57,29,26); px(g,57,30,24)
    # 手臂：前臂放在腹部，手腕有灰色運動帶
    band(g,36,27,41,29,2,4); px(g,38,28,15); px(g,38,29,15)
    # 遮陽傘：傘桿 x=22..23，傘面 x 12..50
    rect(g,22,10,2,26,23); rect(g,22,10,1,26,22)
    rows=[(4,26,38),(5,22,42),(6,18,46),(7,15,49),(8,13,51),(9,12,52),(10,12,52)]
    for y,x0,x1 in rows:
        for x in range(x0,x1+1):
            c=canopy[0] if ((x-12)//4)%2==0 else canopy[1]
            if y==10: c=canopy[2] if ((x-12)//4)%2==0 else canopy[3]
            px(g,x,y,c)
    for x in range(12,53,4): px(g,x,10,None)   # 傘緣鋸齒
    rect(g,31,3,2,1,23); rect(g,30,2,4,1,22)   # 傘頂小蓋
    return g
def runs(g):
    out=[]
    for y,row in enumerate(g):
        x=0
        while x<W:
            if row[x] is None: x+=1; continue
            c=row[x]; s=x
            while x<W and row[x]==c: x+=1
            out.append([y,s,x-s,c])
    return out
VARS={
 'A 青綠':   ((7,25,8,25),7),
 'B 紫':     ((24,25,30,25),24),
 'C 萊姆':   ((10,25,11,25),10),
}
if __name__=='__main__':
    res={}
    for k,(cp,st) in VARS.items(): res[k]=runs(build(cp,st))
    json.dump(res,open('variants.json','w'))
    ims=[(res[k],W,H) for k in VARS]
    sheet(ims,scale=8).save('variants.png'); print(sheet(ims,scale=8).size)
