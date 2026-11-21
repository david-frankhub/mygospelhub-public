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

  function formatTime(sec) {
    if (!isFinite(sec) || sec == null) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const PAGE_SIZE = 10;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
  const ICON_DL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  let allTracks = [];
  let activeGenre = "All";
  let shown = PAGE_SIZE;
  let playingId = null;
  const audio = document.getElementById("sharedAudio");

  function supabaseRpc(fn, args) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).catch(() => {});
  }

  function trackUrl(t) {
    return `/${t.type === "Video" ? "video" : "song"}/${encodeURIComponent(t.slug || t.id)}`;
  }
  function isLocked(t) {
    return t.release_date && new Date(t.release_date).getTime() > Date.now();
  }
  function filteredTracks() {
    return activeGenre === "All" ? allTracks : allTracks.filter(t => (t.genre || "").trim() === activeGenre);
  }

  function renderGenres() {
    const genres = Array.from(new Set(allTracks.map(t => (t.genre || "").trim()).filter(Boolean)));
    const strip = document.getElementById("genreStrip");
    strip.innerHTML = `<div class="genre-pill active" data-genre="All">All</div>` +
      genres.map(g => `<div class="genre-pill" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</div>`).join("");
    strip.querySelectorAll(".genre-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        strip.querySelectorAll(".genre-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        activeGenre = pill.dataset.genre;
        shown = PAGE_SIZE;
        renderTrackList();
      });
    });
  }

  function cardHtml(t) {
    const locked = isLocked(t);
    const hasFile = Boolean(t.file_url);
    const canPlay = !locked && (hasFile || t.streaming_link);
    const meta = [t.year, `${formatCount(t.views)} plays`].filter(Boolean).join(" • ");
    return `
      <div class="track-card${String(t.id) === String(playingId) ? " playing" : ""}" data-id="${t.id}">
        <div class="tc-art" style="${t.cover_url ? `background-image:url('${escapeHtml(t.cover_url)}')` : ""}"></div>
        <div class="tc-body">
          <div class="tc-title">${escapeHtml(t.title)}</div>
          <div class="tc-artist">${escapeHtml(t.artist)}</div>
          <div class="tc-meta">${escapeHtml(meta)}</div>
          ${locked ? `<div class="tc-lock">Releases ${escapeHtml(new Date(t.release_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>`
                   : (t.description ? `<div class="tc-desc">${escapeHtml(t.description)}</div>` : "")}
        </div>
        <div class="tc-actions">
          <button class="tc-btn play${String(t.id) === String(playingId) && !audio.paused ? " is-playing" : ""}" data-act="play" aria-label="Play ${escapeHtml(t.title)}" ${canPlay ? "" : "disabled"}>${String(t.id) === String(playingId) && !audio.paused ? ICON_PAUSE : ICON_PLAY}</button>
          <button class="tc-btn dl" data-act="download" aria-label="Download ${escapeHtml(t.title)}" ${hasFile && !locked ? "" : "disabled"}>${ICON_DL}</button>
        </div>
      </div>`;
  }

  function renderTrackList() {
    const list = document.getElementById("trackList");
    const wrap = document.getElementById("seeMoreWrap");
    const btn = document.getElementById("seeMoreBtn");
    const filtered = filteredTracks();
    if (filtered.length === 0) {
      list.innerHTML = `<div class="state-block">No tracks in ${escapeHtml(activeGenre)} yet.</div>`;
      wrap.style.display = "none";
      return;
    }
    list.innerHTML = filtered.slice(0, shown).map(cardHtml).join("");
    const remaining = filtered.length - shown;
    if (remaining > 0) {
      btn.textContent = `See More (${remaining} remaining)`;
      wrap.style.display = "flex";
    } else {
      wrap.style.display = "none";
    }
  }

  document.getElementById("seeMoreBtn").addEventListener("click", () => {
    shown += PAGE_SIZE;
    renderTrackList();
  });

  async function downloadTrack(t) {
    supabaseRpc("increment_downloads", { row_id: t.id });
    try {
      await MGH.downloadSong(t);
    } catch (err) {
      window.open(t.file_url, "_blank");
    }
  }

  function playTrack(t) {
    if (!t.file_url) {
      if (t.streaming_link) {
        supabaseRpc("increment_views", { row_id: t.id });
        window.open(t.streaming_link, "_blank", "noopener,noreferrer");
      }
      return;
    }
    if (String(playingId) === String(t.id)) {
      if (audio.paused) audio.play(); else audio.pause();
      return;
    }
    playingId = t.id;
    audio.src = t.file_url;
    MGH.setMediaSession(t, audio);
    audio.play().catch(() => {});
    supabaseRpc("increment_views", { row_id: t.id });
    t.views = (t.views || 0) + 1;
    renderTrackList();
  }
  audio.addEventListener("play", renderTrackList);
  audio.addEventListener("pause", renderTrackList);
  audio.addEventListener("ended", () => { playingId = null; renderTrackList(); });

  document.getElementById("trackList").addEventListener("click", (e) => {
    const card = e.target.closest(".track-card");
    if (!card) return;
    const t = allTracks.find(x => String(x.id) === card.dataset.id);
    if (!t) return;
    const btn = e.target.closest(".tc-btn");
    if (btn) {
      e.stopPropagation();
      if (btn.disabled) return;
      if (btn.dataset.act === "play") playTrack(t);
      else if (btn.dataset.act === "download") downloadTrack(t);
      return;
    }
    window.location.href = trackUrl(t);
  });

  async function loadTracks() {
    const list = document.getElementById("trackList");
    try {
      const rows = await supabaseQuery("content", "status=eq.Published&type=eq.Audio&order=created_at.desc&select=*");
      allTracks = rows || [];
      renderGenres();
      renderTrackList();
    } catch (err) {
      console.error(err);
      list.innerHTML = `<div class="state-block">Couldn't load music right now. Refresh to try again.</div>`;
    }
  }
  loadTracks();
