/* 資料庫轉接層：讓頁面維持原本的 window.claude.use('db' | 'user' | 'downloads') 呼叫形狀，
   背後改用 /api（Cloudflare Worker + D1）。頁面其他程式不需要改。 */
(function () {
  'use strict';
  var API = '/api/';
  var listeners = []; // {kind:'col'|'doc', path, cb, errCb}
  var me = { canWrite: true };

  function fail(status, msg) { var e = new Error(msg || ('HTTP ' + status)); e.status = status; e.code = status === 403 ? 'invalid_argument' : 'unavailable'; return e }
  function req(method, path, body) {
    return fetch(API + path, {
      method: method, credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok && !(r.status === 404 && method === 'GET')) return r.text().then(function () { throw fail(r.status) });
      return r.status === 404 ? null : r.json();
    });
  }
  var meta = { fromCache: false };
  function colSnap(list) {
    return { docs: list.map(function (o) { var id = o.id, d = Object.assign({}, o); delete d.id; return { id: id, data: function () { return Object.assign({}, d) } } }), metadata: meta, size: list.length };
  }
  function docSnap(o) { return { exists: !!o, data: function () { return o ? Object.assign({}, o) : undefined }, metadata: meta } }

  function load(l) {
    return req('GET', l.path).then(function (r) { l.cb(l.kind === 'col' ? colSnap(r || []) : docSnap(r)) },
      function (e) { if (l.errCb) l.errCb(e) });
  }
  function refresh() { listeners.forEach(load) }
  setInterval(function () { if (!document.hidden) refresh() }, 30000);

  function wrapWrite(p) { return p.then(function (r) { refresh(); return r }) }

  function docRef(table, id) {
    return {
      id: id,
      set: function (o) { return wrapWrite(req('PUT', table + '/' + encodeURIComponent(id), o)) },
      update: function (o) { return wrapWrite(req('PATCH', table + '/' + encodeURIComponent(id), o)) },
      delete: function () { return wrapWrite(req('DELETE', table + '/' + encodeURIComponent(id))) },
    };
  }
  var db = {
    collection: function (name) {
      return {
        onSnapshot: function (cb, errCb) { var l = { kind: 'col', path: name, cb: cb, errCb: errCb }; listeners.push(l); load(l); return function () { listeners = listeners.filter(function (x) { return x !== l }) } },
        add: function (o) { return wrapWrite(req('POST', name, o)).then(function (r) { return { id: r && r.id } }) },
        doc: function (id) { return docRef(name, id) },
      };
    },
    doc: function (path) {
      var p = path.split('/'), table = p[0], id = p[1];
      var ref = docRef(table, id);
      ref.onSnapshot = function (cb, errCb) { var l = { kind: 'doc', path: path, cb: cb, errCb: errCb }; listeners.push(l); load(l); return function () { listeners = listeners.filter(function (x) { return x !== l }) } };
      return ref;
    },
  };

  var downloads = {
    save: function (o) {
      return new Promise(function (res, rej) {
        try {
          var url = URL.createObjectURL(o.data), a = document.createElement('a');
          a.href = url; a.download = o.filename; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url) }, 4000); res();
        } catch (e) { rej(e) }
      });
    },
  };

  /* 打開頁面時在背景要求同步（伺服器端有冷卻時間，排程剛跑過就不會重複）。
     結果用頁面右上角的小狀態列顯示：更新中／已更新／同步失敗（失敗會一直顯示，點一下關閉）。 */
  var bar = null, barT = null;
  function showBar(msg, kind, sticky) {
    try {
      if (!bar) {
        bar = document.createElement('div'); bar.id = 'syncBar';
        bar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:50;max-width:260px;padding:4px 10px;font:13px/1.5 var(--font-body,sans-serif);border:2px solid var(--line,#13203d);background:var(--panel,#f8fbff);color:var(--ink,#13203d);box-shadow:3px 3px 0 var(--line,#13203d);cursor:pointer';
        bar.addEventListener('click', function () { bar.hidden = true });
        document.body.appendChild(bar);
      }
      bar.hidden = false; bar.textContent = msg;
      bar.style.borderColor = kind === 'err' ? '#ee3b3b' : 'var(--line,#13203d)';
      clearTimeout(barT);
      if (!sticky) barT = setTimeout(function () { bar.hidden = true }, 3000);
    } catch (e) { /* 狀態列失敗不影響頁面 */ }
  }
  var syncing = false, btn = null, lastOk = null;
  // 時間依裝置時區顯示（Intl 會用裝置的 IANA 時區，例如 Asia/Taipei、America/Los_Angeles）
  function hhmm(iso) {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));
    } catch (e) { return '' }
  }
  function setBtn(label, line2, title) {
    try {
      if (!btn) {
        btn = document.createElement('button'); btn.id = 'syncBtn'; btn.type = 'button';
        btn.style.cssText = 'position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:50;padding:6px 12px;font:14px/1.3 var(--font-body,sans-serif);border:2px solid var(--line,#13203d);background:var(--panel,#f8fbff);color:var(--ink,#13203d);box-shadow:3px 3px 0 var(--line,#13203d);cursor:pointer;min-height:40px';
        btn.addEventListener('click', function () { manual() });
        document.body.appendChild(btn);
      }
      btn.textContent = '';
      btn.appendChild(document.createTextNode(label));
      if (line2) {
        var d2 = document.createElement('div');
        d2.textContent = line2; d2.style.cssText = 'font-size:12px;line-height:1.4;color:' + ALERT + ';margin-top:2px';
        btn.appendChild(d2);
      }
      btn.title = title || '';
    } catch (e) { /* 按鈕失敗不影響頁面 */ }
  }
  var st = null, ALERT = '#ee3b3b';
  // 按鈕：第一行「↻ 更新於 HH:MM」；有問題時多一行紅字（只有文字上色，不整塊上色）：
  //   最近一次同步失敗 → 「同步失敗：原因（HH:MM）」；超過 24 小時沒有成功同步 → 「超過 N 小時未更新」
  function updateLabel() {
    var line1 = '↻ ' + (lastOk ? '更新於 ' + hhmm(lastOk) : '更新'), line2 = null, full = '';
    if (st && st.failed && st.last) {
      var why = String(st.last.error || '原因不明').replace(/^(同步失敗|部分讀取失敗)：/, '');
      full = '最近一次同步失敗（' + hhmm(st.last.t) + '）：' + why;
      line2 = '同步失敗：' + (why.length > 22 ? why.slice(0, 22) + '…' : why) + '（' + hhmm(st.last.t) + '）';
    } else if (st && st.staleHours != null && st.staleHours >= 24) {
      line2 = '超過 ' + st.staleHours + ' 小時未更新'; full = line2;
    } else if (st && st.lastOkAt == null) {
      line2 = '尚未成功同步'; full = line2;
    }
    setBtn(line1, line2, full);
  }
  function loadStatus() {
    return req('GET', 'sync-status').then(function (r) { if (r) { st = r; if (r.lastOkAt) lastOk = r.lastOkAt } updateLabel() }, updateLabel);
  }
  function runSync(force) {
    if (syncing) return;
    syncing = true; setBtn('↻ 更新中…'); if (force) showBar('更新資料中…', 'info', true);
    req('POST', 'sync-now', { force: !!force }).then(function (r) {
      syncing = false;
      if (r && r.status === 'done') { refresh(); loadStatus(); showBar('已更新', 'info', false); return }
      if (!r || r.status === 'cooldown' || r.status === 'busy') {
        refresh(); loadStatus();
        if (force) showBar(r && r.status === 'busy' ? '正在更新中，請稍候' : '剛剛已更新過，已重新載入畫面', 'info', false); else if (bar) bar.hidden = true;
        return;
      }
      loadStatus();
      showBar('同步失敗：' + (r.error ? String(r.error).replace(/^同步失敗：/, '') : '原因不明') + '（目前顯示上次的資料，點一下關閉）', 'err', true);
    }, function () { syncing = false; loadStatus(); showBar('同步失敗：連不到伺服器（目前顯示上次的資料，點一下關閉）', 'err', true) });
  }
  // 打開、切回 App、從背景回來：自動更新（伺服器端有冷卻，排程剛跑過就不會重複同步）。只有可編輯者能觸發同步
  var lastOpenAt = 0;
  function syncOnOpen() { if (Date.now() - lastOpenAt < 2000) return; lastOpenAt = Date.now(); refresh(); loadStatus(); if (me.canWrite) runSync(false); }
  // 按鈕：可編輯者＝立即同步（至少間隔 60 秒）；只讀者＝重新載入資料
  function manual() {
    if (me.canWrite) runSync(true);
    else { refresh(); loadStatus(); showBar('已重新載入', 'info', false); }
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) syncOnOpen() });
  window.addEventListener('pageshow', function (e) { if (e.persisted) syncOnOpen() });
  window.addEventListener('focus', function () { syncOnOpen() });

  window.claude = {
    use: function (name) {
      if (name === 'db') {
        // 先確認身分與連線：失敗就回傳 null，頁面會顯示「目前沒有連上資料庫」
        return fetch(API + 'me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
          if (!r.ok) return null;
          return r.json().then(function (j) { me = j; setTimeout(function () { if (document.body) syncOnOpen() }, 300); return db });
        }).catch(function () { return null });
      }
      if (name === 'user') return Promise.resolve({ can: function (k) { return Promise.resolve(k === 'data.write' ? !!me.canWrite : true) } });
      if (name === 'downloads') return Promise.resolve(downloads);
      return Promise.resolve(null);
    },
  };
})();
