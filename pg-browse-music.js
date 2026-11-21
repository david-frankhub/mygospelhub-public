const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";

  async function supabaseQuery(table, params) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) throw new Error(`Failed to load ${table}`);
    return res.json();
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  function formatCount(n) {
    n = n || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function highlight(text, q) {
    if (!q) return escapeHtml(text);
    const safe = escapeHtml(text);
    const idx = safe.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return safe;
    return safe.slice(0, idx) + "<mark>" + safe.slice(idx, idx + q.length) + "</mark>" + safe.slice(idx + q.length);
  }

  function trackDest(t) {
    return `/${t.type === "Video" ? "video" : "song"}/${encodeURIComponent(t.slug || t.id)}`;
  }

  const PAGE_SIZE = 12;
  let allTracks = [];
  let query = "";
  let activeGenre = "All";
  let sort = "plays";
  let visibleCount = PAGE_SIZE;

  function getFiltered() {
    let list = allTracks.filter(t => {
      const matchesGenre = activeGenre === "All" || (t.genre || "").trim() === activeGenre;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || t.title.toLowerCase().includes(q) || (t.artist || "").toLowerCase().includes(q);
      return matchesGenre && matchesQuery;
    });
    if (sort === "plays") list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sort === "newest") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }

  function render() {
    const filtered = getFiltered();
    const visible = filtered.slice(0, visibleCount);
    const countEl = document.getElementById("resultsCount");
    const list = document.getElementById("trackList");
    const loadMoreWrap = document.getElementById("loadMoreWrap");

    countEl.innerHTML = `<strong>${filtered.length}</strong> track${filtered.length !== 1 ? "s" : ""}`;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="state-block-inner">No tracks found. Try a different search or filter.</div>`;
      loadMoreWrap.style.display = "none";
      return;
    }

    list.innerHTML = visible.map((t, i) => `
      <div class="track-row" data-id="${t.id}">
        <div class="track-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="track-art" style="${t.cover_url ? `background-image:url('${escapeHtml(t.cover_url)}')` : ""}"></div>
        <div>
          <div class="track-title">${highlight(t.title, query)}</div>
          <div class="track-artist">${highlight(t.artist || "", query)}</div>
        </div>
        <div class="track-genre">${escapeHtml(t.genre || "")}</div>
        <div class="track-plays">${formatCount(t.views)} plays</div>
      </div>
    `).join("");

    list.querySelectorAll(".track-row").forEach(row => {
      row.addEventListener("click", () => {
        const track = allTracks.find(t => String(t.id) === row.dataset.id);
        if (track) window.location.href = trackDest(track);
      });
    });

    loadMoreWrap.style.display = visibleCount < filtered.length ? "block" : "none";
  }

  function renderGenreChips() {
    const genres = Array.from(new Set(allTracks.map(t => (t.genre || "").trim()).filter(Boolean)));
    const wrap = document.getElementById("genreChips");
    wrap.innerHTML = `<button class="chip active" data-genre="All">All</button>` +
      genres.map(g => `<button class="chip" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`).join("");

    wrap.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        wrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        activeGenre = chip.dataset.genre;
        visibleCount = PAGE_SIZE;
        render();
      });
    });
  }

  document.getElementById("searchInput").addEventListener("input", (e) => {
    query = e.target.value;
    visibleCount = PAGE_SIZE;
    render();
  });

  document.getElementById("sortSelect").addEventListener("change", (e) => {
    sort = e.target.value;
    render();
  });

  document.getElementById("loadMoreBtn").addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  async function loadTracks() {
    try {
      const rows = await supabaseQuery("content", "status=eq.Published&select=*");
      allTracks = rows || [];
      renderGenreChips();
      render();
    } catch (err) {
      console.error(err);
      document.getElementById("resultsCount").textContent = "";
      document.getElementById("trackList").innerHTML = `<div class="state-block-inner">Couldn't load music right now. Refresh to try again.</div>`;
    }
  }

  loadTracks();
