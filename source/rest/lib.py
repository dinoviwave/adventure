import json,re
from PIL import Image
S=open('../../public/index.html',encoding='utf-8').read()
ACT=json.loads(re.search(r'^var ACT=(.*);\s*$',S,re.M).group(1))
P=['#'+c for c in ACT['p']]
def render(frame,w,h,scale=8,bg=(190,227,245)):
    im=Image.new('RGBA',(w,h),(0,0,0,0))
    for y,x,ww,c in frame:
        for i in range(ww):
            if 0<=x+i<w and 0<=y<h: im.putpixel((x+i,y),tuple(int(P[c][k:k+2],16) for k in (1,3,5))+(255,))
    return im
def sheet(frames,scale=8,gap=4):
    ims=[render(f,w,h) for f,w,h in frames]
    W=sum(i.size[0] for i in ims)+gap*(len(ims)+1); H=max(i.size[1] for i in ims)+2*gap
    bg=Image.new('RGBA',(W,H),(190,227,245,255)); x=gap
    for i in ims: bg.alpha_composite(i,(x,gap)); x+=i.size[0]+gap
    return bg.resize((W*scale,H*scale),Image.NEAREST)
