/* Serve Supabase storage files (covers, songs) through our own cached /s/ address. */
(function () {
  var BASE = "https://kqgnpryubgdtmtcjtasi.supabase.co/storage/v1/object/public/";
  function fix(v) {
    if (typeof v === "string") return v.indexOf(BASE) === 0 ? "/s/" + v.slice(BASE.length) : v;
    if (Array.isArray(v)) return v.map(fix);
    if (v && typeof v === "object") { var o = {}; for (var k in v) o[k] = fix(v[k]); return o; }
    return v;
  }
  var orig = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var p = orig.apply(this, arguments);
    if (url.indexOf("/rest/v1/") === -1) return p;
    return p.then(function (res) {
      if (!res.ok || (res.headers.get("content-type") || "").indexOf("json") === -1) return res;
      return res.clone().json().then(function (data) {
        return new Response(JSON.stringify(fix(data)), { status: res.status, statusText: res.statusText, headers: res.headers });
      }).catch(function () { return res; });
    });
  };
})();

/* CSP-friendly helpers: page data from the Worker (a JSON block, not a script) and clickable cards. */
(function () {
  Object.defineProperty(window, "__PRETTY", {
    configurable: true,
    get: function () {
      var e = document.getElementById("mgh-pretty");
      if (!e) return undefined;
      try { return JSON.parse(e.textContent); } catch (x) { return undefined; }
    }
  });
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var el = t.closest("[data-href]");
    if (!el || t.closest("a,button,input,select,textarea,label")) return;
    window.location.href = el.getAttribute("data-href");
  });
})();
