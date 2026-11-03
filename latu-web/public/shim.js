/* Connects the Latu page to this website: server storage (Supabase), AI (Gemini) and logout.
   Provides the same window.claude.use(...) interface the page was written against. */
(function () {
  var U = window.LATU_USER || {};
  // Local cache belongs to one account; clear it if a different user signs in on this browser.
  try {
    if (localStorage.getItem('latu-owner') !== U.id) {
      ['latu-v2', 'latu-v1'].forEach(function (k) { localStorage.removeItem(k); });
      localStorage.setItem('latu-owner', U.id || '');
    }
  } catch (e) {}

  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }
  function check(r) {
    if (r.status === 401) { location.href = '/login'; throw err('session_expired'); }
    if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw err(j.code || 'error', j.message); });
    return r;
  }

  var db = {
    collection: function () {
      return {
        get: function () {
          return fetch('/api/docs', { cache: 'no-store', credentials: 'same-origin' }).then(check).then(function (r) { return r.json(); }).then(function (j) {
            return { docs: (j.docs || []).map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
          });
        },
        doc: function (id) {
          return {
            set: function (data) {
              return fetch('/api/docs/' + encodeURIComponent(id), { method: 'PUT', credentials: 'same-origin', keepalive: JSON.stringify(data).length < 60000, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).then(check).then(function () {});
            }
          };
        }
      };
    }
  };
  var user = { id: function () { return Promise.resolve(U.id || null); } };

  function sample(turns, o) {
    o = o || {};
    var text = '';
    return fetch('/api/ai', { method: 'POST', signal: o.signal, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'chat', turns: turns }) })
      .then(check)
      .then(function (r) {
        var rd = r.body.getReader(), dec = new TextDecoder();
        function pump() {
          return rd.read().then(function (x) {
            if (x.done) return { text: text, truncated: false };
            text += dec.decode(x.value, { stream: true });
            if (o.onText) o.onText({ text: text });
            return pump();
          });
        }
        return pump();
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') { var c = err('cancelled'); c.text = text; throw c; }
        if (e && !e.code) { var n = err('error', e.message); n.text = text; throw n; }
        if (text) e.text = text;
        throw e;
      });
  }
  function toB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result); res({ mime: blob.type || 'image/jpeg', b64: s.slice(s.indexOf(',') + 1) }); };
      fr.onerror = rej; fr.readAsDataURL(blob);
    });
  }
  sample.json = function (prompt, o) {
    o = o || {};
    return Promise.all((o.images || []).map(toB64)).then(function (imgs) {
      return fetch('/api/ai', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'json', prompt: prompt, images: imgs }) });
    }).then(check).then(function (r) { return r.json(); }).then(function (j) { return j.data; });
  };
  sample.limits = function () { return Promise.resolve({ images: { mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } }); };

  var caps = { db: db, user: user, sample: U.ai ? sample : null, downloads: null };
  window.claude = { use: function (name) { return Promise.resolve(caps[name] || null); } };

  // Logout: clear the local cache, then end the session on the server.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-act="logout"]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    b.disabled = true; b.textContent = 'Salvestan…';
    flushNow();
    setTimeout(function () {
      var f = document.createElement('form'); f.method = 'POST'; f.action = '/logout'; document.body.appendChild(f); f.submit();
    }, 900);
  }, true);

  // Flush unsaved changes when the tab is hidden.
  function flushNow() { try { if (window.__latuFlush) window.__latuFlush(); } catch (x) {} }
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushNow(); });
})();
