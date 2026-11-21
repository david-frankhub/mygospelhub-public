const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";
  const NAME = (new URLSearchParams(location.search).get("name") || "").trim();
  const H = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY };
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; };
  const q = NAME.replace(/[,()*%]/g, " ").replace(/\s+/g, " ").trim();
  const rest = (path) => fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: H }).then((r) => r.json()).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
  const cover = (r) => esc(r.cover_url || r.thumbnail_url || "og-image.jpg");
  function card(href, r, badge, line2, snip) {
    return `<a class="ar-card" href="${href}"><img class="ar-cover" loading="lazy" src="${cover(r)}" alt=""><div class="ar-meta"><span class="ar-badge">${badge}</span><div class="ar-title">${esc(r.title)}</div><div class="ar-line">${esc(line2)}</div>${snip ? `<div class="ar-snip">${esc(snip)}</div>` : ""}</div></a>`;
  }
  async function run() {
    if (!q) { document.getElementById("arName").textContent = "All artistes"; document.getElementById("arSub").textContent = "Open a song or video and tap the artiste's name."; return; }
    document.getElementById("arName").textContent = NAME;
    document.title = NAME + " — songs, videos and news | MyGospelHub";
    const enc = encodeURIComponent("*" + q + "*");
    const [media, posts] = await Promise.all([
      rest(`content?status=eq.Published&or=(artist.ilike.${enc},title.ilike.${enc},description.ilike.${enc})&order=created_at.desc&select=id,slug,title,artist,type,cover_url,thumbnail_url,lyrics,description&limit=60`),
      rest(`gist_articles?status=eq.Published&or=(title.ilike.${enc},body.ilike.${enc})&order=created_at.desc&select=id,slug,title,category,cover_url,body&limit=30`),
    ]);
    const lc = q.toLowerCase();
    media.sort((a, b) => (String(b.artist || "").toLowerCase().includes(lc) - String(a.artist || "").toLowerCase().includes(lc)));
    const out = [];
    const types = [["Audio", "Songs", "song"], ["Lyrics", "Lyrics", "song"], ["Video", "Videos", "video"]];
    types.forEach(([t, label, kind]) => {
      const rows = media.filter((r) => (r.type || "Audio") === t);
      if (rows.length) out.push(`<h2>${label} <span>${rows.length}</span></h2>` + rows.map((r) => card(`/${kind}/${encodeURIComponent(r.slug || r.id)}`, r, t === "Audio" ? "Song" : t, r.artist, t === "Lyrics" ? (r.lyrics || "").trim() : "")).join(""));
    });
    if (posts.length) out.push(`<h2>Gist <span>${posts.length}</span></h2>` + posts.map((r) => card(`/gist/${encodeURIComponent(r.slug || r.id)}`, r, esc(r.category || "Gist"), "", String(r.body || "").replace(/[*\[\]]/g, "").trim().slice(0, 140))).join(""));
    const total = media.length + posts.length;
    document.getElementById("arSub").textContent = total ? total + " post" + (total > 1 ? "s" : "") + " related to " + NAME : "Nothing found for " + NAME + " yet.";
    document.getElementById("arContent").innerHTML = out.join("") || '<div class="ar-empty">No posts yet. Check back soon.</div>';
    const m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute("content", "All songs, videos and news about " + NAME + " on MyGospelHub.");
  }
  run();
