/* 課表原名 → 短標籤（前端顯示用；資料本身不改）。
   「南山銳1_WED_跑步Z2」→「Z2」、「南山銳1_MON_騎車恢復」→「輕鬆騎」、「南山銳2_THU_節奏跑」→「節奏跑」。
   名稱不是「計畫_星期_內容」格式（例如活動名稱含地名）時，只顯示類型。 */
function wlabel(title,kind){
  var K={'跑':'跑步','騎':'騎車','游':'游泳','肌力':'肌力訓練'}, C={'跑':'跑','騎':'騎','游':'游'};
  var parts=String(title||'').split('_');
  if(parts.length<3) return K[kind]||kind||'其他';
  var s=parts.slice(2).join('_').replace(/恢復/g,'輕鬆').replace(/跑步|騎車|游泳/g,'').trim();
  if(!s) return K[kind]||kind||'其他';
  if(s==='輕鬆') return '輕鬆'+(C[kind]||'');
  return s;
}
