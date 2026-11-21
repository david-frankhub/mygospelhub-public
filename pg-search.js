const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";
  let searchIndex = [];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n); };
  async function sb(table, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
    if (!r.ok) throw new Error("load failed");
    return r.json();
  }
  async function loadIndex() {
    const [content, gist] = await Promise.all([
      sb("content", "status=eq.Published&order=created_at.desc&limit=1000"),
      sb("gist_articles", "status=eq.Published&order=created_at.desc&limit=1000"),
    ]);
    const key = x => encodeURIComponent(x.slug || x.id);
    searchIndex = (content || []).map(c => {
      const isVideo = c.type === "Video";
      return { type: isVideo ? "video" : "music", title: c.title || "", sub: [c.artist, c.genre].filter(Boolean).join(" · "), tag: c.genre || (isVideo ? "Video" : "Music"),
        plays: fmt(c.views) + (isVideo ? " views" : " plays"), dur: c.year || "", cover: c.cover_url || "", url: (isVideo ? "/video/" : "/song/") + key(c) };
    }).concat((gist || []).map(g => ({ type: "gist", title: g.title || "", sub: [g.category, g.excerpt].filter(Boolean).join(" · ").slice(0, 90), tag: g.category || "Gist", cover: g.cover_url || "", url: "/gist/" + key(g) })));
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
  }

  function highlight(text, q) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return text.slice(0, idx) + '<mark>' + text.slice(idx, idx + q.length) + '</mark>' + text.slice(idx + q.length);
  }

  let currentQuery = getQueryParam('q');
  let activeTab = 'all';

  const queryText = document.getElementById('queryText');
  const resultsContainer = document.getElementById('resultsContainer');
  const tabs = document.querySelectorAll('.tab');

  function getMatches(q) {
    if (!q.trim()) return [];
    return searchIndex.filter(item =>
      item.title.toLowerCase().includes(q.toLowerCase()) || item.sub.toLowerCase().includes(q.toLowerCase())
    );
  }

  function renderVideoCard(item, q) {
    return `
      <div class="media-card" data-href="${item.url}">
        <div class="media-cover" style="${item.cover ? `background-image:url(\'${esc(item.cover)}\');background-size:cover;background-position:center` : ''}"><span class="cat">${item.tag}</span><span class="dur">${item.dur}</span></div>
        <div class="media-body"><h3>${highlight(item.title, q)}</h3><div class="media-sub">${item.sub}</div></div>
      </div>`;
  }

  function renderGistCard(item, q) {
    return `
      <div class="media-card" data-href="${item.url}">
        <div class="media-cover gist" style="${item.cover ? `background-image:url(\'${esc(item.cover)}\');background-size:cover;background-position:center` : ''}"><span class="cat">${item.tag}</span></div>
        <div class="media-body"><h3>${highlight(item.title, q)}</h3><div class="media-sub">${item.sub}</div></div>
      </div>`;
  }

  function renderTrackRow(item, q) {
    return `
      <div class="track-row" data-href="${item.url}">
        <div class="track-art" style="${item.cover ? `background:url(\'${esc(item.cover)}\') center/cover` : ''}"></div>
        <div>
          <div class="track-title">${highlight(item.title, q)}</div>
          <div class="track-artist">${item.sub}</div>
        </div>
        <div class="track-plays">${item.plays}</div>
        <div class="track-dur">${item.dur}</div>
      </div>`;
  }

  function render() {
    queryText.textContent = `"${currentQuery}"`;
    const matches = getMatches(currentQuery);
    const videos = matches.filter(m => m.type === 'video');
    const music = matches.filter(m => m.type === 'music');
    const gist = matches.filter(m => m.type === 'gist');

    document.getElementById('countAll').textContent = matches.length;
    document.getElementById('countVideo').textContent = videos.length;
    document.getElementById('countMusic').textContent = music.length;
    document.getElementById('countGist').textContent = gist.length;

    if (matches.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="display">No results for "${esc(currentQuery)}"</div>
          <p>Try a different search term, or check the spelling of an artist or title.</p>
        </div>`;
      return;
    }

    let html = '';

    if ((activeTab === 'all' || activeTab === 'video') && videos.length > 0) {
      html += `<div class="result-group">
        <div class="group-head"><h2>Videos</h2>${activeTab === 'all' ? '<a href="#" data-goto="video">See all videos →</a>' : ''}</div>
        <div class="card-grid">${videos.slice(0, activeTab === 'all' ? 3 : 99).map(v => renderVideoCard(v, currentQuery)).join('')}</div>
      </div>`;
    }

    if ((activeTab === 'all' || activeTab === 'music') && music.length > 0) {
      html += `<div class="result-group">
        <div class="group-head"><h2>Music</h2>${activeTab === 'all' ? '<a href="#" data-goto="music">See all music →</a>' : ''}</div>
        <div class="track-list">${music.slice(0, activeTab === 'all' ? 4 : 99).map(m => renderTrackRow(m, currentQuery)).join('')}</div>
      </div>`;
    }

    if ((activeTab === 'all' || activeTab === 'gist') && gist.length > 0) {
      html += `<div class="result-group">
        <div class="group-head"><h2>Gist</h2>${activeTab === 'all' ? '<a href="#" data-goto="gist">See all gist →</a>' : ''}</div>
        <div class="card-grid">${gist.slice(0, activeTab === 'all' ? 3 : 99).map(g => renderGistCard(g, currentQuery)).join('')}</div>
      </div>`;
    }

    resultsContainer.innerHTML = html;

    resultsContainer.querySelectorAll('[data-goto]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        setTab(link.dataset.goto);
      });
    });
  }

  function setTab(tab) {
    activeTab = tab;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    render();
  }

  tabs.forEach(tab => tab.addEventListener('click', () => setTab(tab.dataset.tab)));

  // nav search bar wired to reload this page with new query
  const searchInput = document.getElementById('siteSearch');
  const searchClear = document.getElementById('searchClear');
  searchInput.value = currentQuery;
  searchClear.classList.toggle('show', currentQuery.length > 0);

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
      window.location.href = '/search?q=' + encodeURIComponent(searchInput.value.trim());
    }
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.remove('show');
    searchInput.focus();
  });

  resultsContainer.innerHTML = '<div class="empty-state"><p>Searching…</p></div>';
  loadIndex().then(render).catch(() => { resultsContainer.innerHTML = '<div class="empty-state"><div class="display">Couldn\'t load results</div><p>Check your connection and try again.</p></div>'; });
