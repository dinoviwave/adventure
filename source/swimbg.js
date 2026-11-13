/* 游泳場景背景（取代跑道上的一塊水）：泳池 pool／海邊 sea。
   swimScene(W,H,surf,style) → {bg:[[x,y,w,h,色]...], fg:[...]}；色 'SKY' 由呼叫端換成天空色。
   bg 畫在娃娃後面，fg（前景水面與水波）畫在娃娃前面，讓娃娃泡在水裡。surf＝前景水面的 y。 */
function swimScene(W,H,surf,style){
  var bg=[],fg=[],i,x,y,h0=Math.round(H*(style==='sea'?0.34:0.30)),h1=h0+Math.round(H*0.16);
  function B(x,y,w,h,c){bg.push([x,y,w,h,c])}
  function F(x,y,w,h,c){fg.push([x,y,w,h,c])}
  B(0,0,W,h0,'SKY');
  if(style==='sea'){
    var sx=Math.round(W*0.18), sy=Math.round(H*0.17), r=Math.round(H*0.07);                  // 太陽與光芒
    B(sx-r,sy-r+2,2*r,2*r-4,'#ffd23f'); B(sx-r+2,sy-r,2*r-4,2*r,'#ffd23f'); B(sx-r+3,sy-r+3,r,r,'#fff3b0');
    [[0,-r-4,2,3],[0,r+1,2,3],[-r-4,0,3,2],[r+1,0,3,2]].forEach(function(q){B(sx+q[0],sy+q[1],q[2],q[3],'#ffd23f')});
    [[0.45,0.14],[0.78,0.2]].forEach(function(c){var cx=Math.round(W*c[0]),cy=Math.round(H*c[1]);B(cx,cy,16,4,'#ffffff');B(cx+3,cy-3,9,3,'#ffffff');B(cx+10,cy-2,6,2,'#ffffff')}); // 雲
    var bands=[[h0,0.17,'#8fd0f2'],[h0+Math.round(H*0.17),0.22,'#5ea9e6'],[h0+Math.round(H*0.39),1,'#3480cc']];
    bands.forEach(function(b,k){B(0,b[0],W,(k<2?Math.round(H*b[1]):H-b[0]),b[2])});
    var bx=Math.round(W*0.74); B(bx,h0-4,16,3,'#7a4a2a'); B(bx+7,h0-17,1,13,'#13203d'); B(bx+8,h0-17,7,12,'#ffffff'); B(bx+8,h0-17,7,1,'#e8453c'); // 遠方帆船
    for(i=0;i<14;i++){ x=(i*47+13)%(W-8); y=h0+4+((i*29)%(H-h0-10)); B(x,y,5,1,'#ffffff'); B(x+1,y-1,3,1,'#ffffff'); }  // 浪尖
  }else{
    B(0,h0,W,h1-h0,'#d9deea');                                                                  // 池邊地磚
    for(x=0;x<W;x+=10) B(x,h0,1,h1-h0,'#c3cadb'); B(0,Math.round((h0+h1)/2),W,1,'#c3cadb'); B(0,h1-2,W,2,'#9fb0cc');
    var tx=Math.round(W*0.1); B(tx+4,h0-9,4,10,'#7a4a2a'); B(tx,h0-17,12,9,'#2f7d3d'); B(tx+2,h0-21,8,6,'#2f7d3d');   // 樹
    var lx=Math.round(W*0.84); B(lx,h0-4,2,h1-h0+14,'#acb2bc'); B(lx+7,h0-4,2,h1-h0+14,'#acb2bc'); [0,5,10].forEach(function(o){B(lx,h0+2+o,9,1,'#acb2bc')}); // 扶梯
    B(0,h1,W,H-h1,'#6eb8e6'); B(0,h1+Math.round((H-h1)*0.55),W,H,'#4a9bd8');
    for(i=0;i<16;i++){ x=(i*53+7)%(W-8); y=h1+3+((i*31)%(H-h1-6)); B(x,y,6,1,'#bee2f6'); }  // 水光
    var ry=h1+Math.round((surf-h1)*0.4);                                                         // 遠側分隔繩
    for(x=0;x<W;x+=8){B(x,ry,4,3,'#e8453c');B(x+4,ry,4,3,'#ffffff');}
  }
  // 前景：水面與水波，蓋住娃娃下半身
  F(0,surf,W,H-surf,style==='sea'?'#3a8fe0':'#5aaee8'); F(0,surf,W,2,'#bee2f6');
  for(i=0;i<12;i++){ x=(i*41+5)%(W-10); y=surf+4+((i*17)%(H-surf-8)); F(x,y,7,1,'#d6efff'); F(x+2,y+1,4,1,'#8fcaf2'); }
  if(style!=='sea'){ var ny=H-Math.round(H*0.08); for(x=0;x<W;x+=8){F(x,ny,4,3,'#e8453c');F(x+4,ny,4,3,'#ffffff');} }  // 近側分隔繩
  return {bg:bg,fg:fg};
}
