/* 終點拱門的出現規則與風格（前端；依賴 wlabel）。
   - 比賽當天：拱門隨機用金色（gold）或皇家紅毯（royal），名牌寫賽事名稱
   - 品質課表（標記為關鍵課表，或名稱含節奏、間歇、閾值、乳酸、CP、配速、tempo、interval、VO2）：彩旗慶典門（festival），名牌寫課表短標籤
   - 其他（一般課表）：沒有拱門，維持原本畫面
   force：預覽用，強制指定風格 */
function isQuality(w){ return !!w && (w.key===true || /節奏|間歇|閾值|乳酸|CP|配速|tempo|interval|VO2/i.test(String(w.title||''))); }
function raceLabel(name){ return String(name||'').replace(/人壽|馬拉松|\s/g,''); }
function archPlan(nx,race,today,force){
  var st=null,label=null;
  if(race&&race.date===today){ st=Math.random()<0.5?'gold':'royal'; label=raceLabel(race.name); }
  else if(nx&&isQuality(nx)){ st='festival'; label=wlabel(nx.title,nx.kind); }
  if(force==='gold'||force==='festival'||force==='royal'){ if(!st) label=nx?wlabel(nx.title,nx.kind):'終點'; st=force; }
  return st?{style:st,label:label}:null;
}
