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
    const safe = escapeHtml(text);
    if (!q) return safe;
    const idx = safe.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return safe;
    return safe.slice(0, idx) + "<mark>" + safe.slice(idx, idx + q.length) + "</mark>" + safe.slice(idx + q.length);
  }

  function videoDest(v) {
    return `/video/${v.slug || v.id}`;
  }

  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;

  const ICON_DL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  function rpc(fn, args) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).catch(() => {});
  }
  async function downloadVideo(v) {
    rpc("increment_downloads", { row_id: v.id });
    try {
      const res = await fetch(v.file_url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${v.title} - ${v.artist || ""}`.replace(/[^\w\s-]/g, "") || "video";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(v.file_url, "_blank");
    }
  }
  const PAGE_SIZE = 10;

  let allVideos = [];
  let query = "";
  let activeGenre = "All";
  let sort = "newest";
  let visibleCount = PAGE_SIZE;

  function getFiltered() {
    let list = allVideos.filter(v => {
      const matchesGenre = activeGenre === "All" || (v.genre || "").trim() === activeGenre;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || v.title.toLowerCase().includes(q) || (v.artist || "").toLowerCase().includes(q);
      return matchesGenre && matchesQuery;
    });
    if (sort === "views") list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else if (sort === "newest") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }

  function render() {
    const filtered = getFiltered();
    const visible = filtered.slice(0, visibleCount);
    const countEl = document.getElementById("resultsCount");
    const grid = document.getElementById("videoGrid");
    const loadMoreWrap = document.getElementById("loadMoreWrap");

    countEl.innerHTML = `<strong>${filtered.length}</strong> video${filtered.length !== 1 ? "s" : ""}`;

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="state-block-inner" style="grid-column:1/-1;">No videos found. Try a different search or filter.</div>`;
      loadMoreWrap.style.display = "none";
      return;
    }

    grid.innerHTML = visible.map(v => {
      const locked = v.release_date && new Date(v.release_date).getTime() > Date.now();
      const meta = [v.year, `${formatCount(v.views)} views`].filter(Boolean).join(" • ");
      return `
      <div class="track-card" data-id="${v.id}">
        <div class="tc-art" style="${v.cover_url ? `background-image:url('${escapeHtml(v.cover_url)}')` : ""}"></div>
        <div class="tc-body">
          <div class="tc-title">${highlight(v.title, query)}</div>
          <div class="tc-artist">${escapeHtml(v.artist || "")}</div>
          <div class="tc-meta">${escapeHtml(meta)}</div>
          ${locked ? `<div class="tc-lock">Releases ${escapeHtml(new Date(v.release_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>`
                   : (v.description ? `<div class="tc-desc">${escapeHtml(v.description)}</div>` : "")}
        </div>
        <div class="tc-actions">
          <button class="tc-btn" data-act="watch" aria-label="Watch ${escapeHtml(v.title)}" ${locked ? "disabled" : ""}>${ICON_PLAY}</button>
          <button class="tc-btn dl" data-act="download" aria-label="Download ${escapeHtml(v.title)}" ${v.file_url && !locked ? "" : "disabled"}>${ICON_DL}</button>
        </div>
      </div>`;
    }).join("");

    grid.querySelectorAll(".track-card").forEach(card => {
      card.addEventListener("click", (e) => {
        const video = allVideos.find(v => String(v.id) === card.dataset.id);
        if (!video) return;
        const btn = e.target.closest(".tc-btn");
        if (btn) {
          if (btn.disabled) return;
          if (btn.dataset.act === "download") { downloadVideo(video); return; }
        }
        window.location.href = videoDest(video);
      });
    });

    document.getElementById("loadMoreBtn").textContent = `See More (${Math.max(filtered.length - visibleCount, 0)} remaining)`;

    loadMoreWrap.style.display = visibleCount < filtered.length ? "block" : "none";
  }

  function renderGenreChips() {
    const genres = Array.from(new Set(allVideos.map(v => (v.genre || "").trim()).filter(Boolean)));
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

  async function loadVideos() {
    try {
      const rows = await supabaseQuery("content", "status=eq.Published&type=eq.Video&select=*");
      allVideos = rows || [];
      renderGenreChips();
      render();
    } catch (err) {
      console.error(err);
      document.getElementById("resultsCount").textContent = "";
      document.getElementById("videoGrid").innerHTML = `<div class="state-block-inner" style="grid-column:1/-1;">Couldn't load videos right now. Refresh to try again.</div>`;
    }
  }

  loadVideos();
