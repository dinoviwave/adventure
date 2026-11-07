import http from 'node:http';
const today = new Date(Date.now()+8*3600e3).toISOString().slice(0,10);
http.createServer((q,r)=>{
  const ua=q.headers['user-agent']||''; const ok=q.headers.authorization==='Basic '+Buffer.from('API_KEY:GOODKEY').toString('base64');
  if(q.method!=='GET'||!/Mozilla/.test(ua)){r.statusCode=403;return r.end('x')}
  if(!ok){r.statusCode=401;return r.end('x')}
  r.setHeader('content-type','application/json');
  if(q.url.includes('/events')) return r.end(JSON.stringify([
    {id:150470849,category:'WORKOUT',start_date_local:'2026-11-04T00:00:00',name:'南山銳1_WED_跑步Z2',type:'Run',moving_time:1800,description:'Warmup'},
    {id:150470852,category:'WORKOUT',start_date_local:'2026-11-07T00:00:00',name:'南山銳1_FRI_CP測試',type:'Run',moving_time:3000,description:'CP'},
    {id:999,category:'WORKOUT',start_date_local:'2026-11-09T00:00:00',name:'南山銳2_MON_騎車',type:'Ride',moving_time:2400,description:'new'}]));
  if(q.url.includes('/activities')) return r.end(JSON.stringify([
    {id:1,start_date_local:'2026-11-04T07:00:00',start_date:'2026-11-03T23:00:00Z',name:'土城區 - 南山銳1_WED_跑步Z2',type:'Run',moving_time:1860,distance:4800,average_heartrate:140,icu_training_load:40},
    {id:2,start_date_local:'2026-11-06T09:00:00',name:'誤觸',type:'Run',moving_time:27,distance:50}]));
  if(q.url.includes('/wellness')) return r.end(JSON.stringify([{id:'2026-11-06',restingHR:55,hrv:null,sleepSecs:0,ctl:58,atl:63},{id:'2026-11-07',restingHR:50,hrv:60,sleepSecs:25200,ctl:59,atl:60}]));
  r.statusCode=404;r.end('{}');
}).listen(8799);
