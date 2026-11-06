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
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh() });

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

  window.claude = {
    use: function (name) {
      if (name === 'db') {
        // 先確認身分與連線：失敗就回傳 null，頁面會顯示「目前沒有連上資料庫」
        return fetch(API + 'me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) {
          if (!r.ok) return null;
          return r.json().then(function (j) { me = j; return db });
        }).catch(function () { return null });
      }
      if (name === 'user') return Promise.resolve({ can: function (k) { return Promise.resolve(k === 'data.write' ? !!me.canWrite : true) } });
      if (name === 'downloads') return Promise.resolve(downloads);
      return Promise.resolve(null);
    },
  };
})();
