// ==================================================================
  // Supabase connection — same project the admin console writes to.
  // Only reads happen here; the anon key is safe to expose in frontend
  // code as long as Row Level Security policies are set correctly.
  // ==================================================================
  const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";

  async function supabaseQuery(table, params) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`Failed to load ${table}`);
    return res.json();
  }

  function formatCount(n) {
    if (n == null) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  }

  function timeAgo(dateString) {
    if (!dateString) return "";
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "JUST NOW";
    if (mins < 60) return `${mins}M AGO`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}H AGO`;
    const days = Math.floor(hrs / 24);
    return `${days}D AGO`;
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

  function downloadTrack(track) {
    const src = track.file_url;
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = track.title || "download";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function shareTrack(track) {
    const url = `${window.location.origin}${window.location.pathname}#track-${track.id}`;
    const shareData = {
      title: track.title,
      text: `Listen to "${track.title}" by ${track.artist || "MyGospelHub"} on MyGospelHub`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // user cancelled the share sheet — do nothing further
        if (err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard.");
    } catch (err) {
      prompt("Copy this link:", url);
    }
  }

  // ==================================================================
  // State
  // ==================================================================
  let allContent = [];
  let allGist = [];
  let currentTrack = null;
  let isPlaying = false;

  const audioEl = document.getElementById("mediaAudio");
  const videoEl = document.getElementById("mediaVideo");

  function isAudioTrack(track) {
    if (track.type === "Audio") return true;
    if (track.type === "Video") return false;
    const src = track.file_url || "";
    return !/\.(mp4|mov|webm|m4v)(\?|$)/i.test(src);
  }

  function activeMediaEl() {
    return currentTrack && !isAudioTrack(currentTrack) ? videoEl : audioEl;
  }

  // ==================================================================
  // Player controls
  // ==================================================================
  function playTrack(track) {
    const src = track.file_url || track.streaming_link || track.video_url;
    if (!src) return;

    if (currentTrack && currentTrack.id === track.id) {
      togglePlay();
      return;
    }

    // stop whichever element was previously playing
    audioEl.pause();
    videoEl.pause();

    currentTrack = track;
    const el = activeMediaEl();
    el.src = src;
    MGH.setMediaSession(track, el);
    el.currentTime = 0;
    el.play().then(() => {
      isPlaying = true;
      updatePlayerUI();
    }).catch(() => {
      isPlaying = false;
      updatePlayerUI();
    });

    document.body.classList.add("has-player");
    document.getElementById("playerBar").classList.add("show");
    renderTrackLists();
  }

  function togglePlay() {
    const el = activeMediaEl();
    if (!el.src) return;
    if (isPlaying) {
      el.pause();
      isPlaying = false;
    } else {
      el.play();
      isPlaying = true;
    }
    updatePlayerUI();
    renderTrackLists();
  }

  function closePlayer() {
    audioEl.pause();
    videoEl.pause();
    audioEl.src = "";
    videoEl.src = "";
    currentTrack = null;
    isPlaying = false;
    document.body.classList.remove("has-player");
    document.getElementById("playerBar").classList.remove("show");
    renderTrackLists();
  }

  function updatePlayerUI() {
    const toggleBtn = document.getElementById("playerToggle");
    toggleBtn.textContent = isPlaying ? "❚❚" : "▶";
    if (!currentTrack) return;
    document.getElementById("playerTitle").textContent = currentTrack.title;
    document.getElementById("playerArtist").textContent = currentTrack.artist || "";
    const thumb = document.getElementById("playerThumb");
    thumb.style.backgroundImage = currentTrack.cover_url ? `url(${currentTrack.cover_url})` : "none";
  }

  [audioEl, videoEl].forEach(el => {
    el.addEventListener("timeupdate", () => {
      if (activeMediaEl() !== el) return;
      const seek = document.getElementById("playerSeek");
      seek.max = el.duration || 0;
      seek.value = el.currentTime || 0;
      document.getElementById("playerTime").textContent = formatDuration(el.currentTime);
      document.getElementById("playerDuration").textContent = formatDuration(el.duration);
    });
    el.addEventListener("ended", () => {
      if (activeMediaEl() !== el) return;
      isPlaying = false;
      updatePlayerUI();
      renderTrackLists();
    });
  });

  document.getElementById("playerToggle").addEventListener("click", togglePlay);
  document.getElementById("playerClose").addEventListener("click", closePlayer);
  document.getElementById("playerSeek").addEventListener("input", (e) => {
    const el = activeMediaEl();
    el.currentTime = Number(e.target.value);
  });


  // ==================================================================
  // Rendering
  // ==================================================================
  function renderTicker() {
    const ticker = document.getElementById("ticker");
    if (allContent.length === 0) {
      ticker.innerHTML = `<span>Welcome to MyGospelHub — new content dropping soon</span>`;
      return;
    }
    const items = allContent.slice(0, 4);
    const doubled = [...items, ...items];
    ticker.innerHTML = doubled.map(c =>
      `<span>NEW: ${escapeHtml(c.title)} — ${escapeHtml(c.artist || "")}</span>`
    ).join("");
  }

  let heroSlideIndex = 0;
  let heroTimer = null;

  function heroSlideDest(item) {
    if (item.kind === "gist") return `/gist/${item.slug || item.id}`;
    return `/${item.type === "Video" ? "video" : "song"}/${encodeURIComponent(item.slug || item.id)}`;
  }

  function renderHero() {
    // Mix the most recent gist posts with the most recent songs/videos into
    // one list of slides, newest first, capped at 6 so the carousel stays snappy.
    const gistSlides = allGist.slice(0, 4).map(g => ({ kind: "gist", ...g }));
    const contentSlides = allContent.slice(0, 4).map(c => ({ kind: "content", ...c }));
    const slides = [...gistSlides, ...contentSlides]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);

    const wrap = document.getElementById("heroSlides");
    const dotsWrap = document.getElementById("heroDots");

    if (slides.length === 0) {
      // Leave the default "no content live yet" slide in place — nothing to do.
      return;
    }

    wrap.innerHTML = slides.map((item, i) => {
      const tag = item.kind === "gist" ? (item.category || "Gist") : (item.type === "Video" ? "Video" : "Music");
      const sub = item.kind === "gist" ? "MyGospelHub Gist" : (item.artist || "");
      return `
        <div class="hero-slide ${i === 0 ? "active" : ""}" data-index="${i}" data-url="${escapeHtml(heroSlideDest(item))}">
          ${item.cover_url ? `<img class="hero-bg" src="${escapeHtml(item.cover_url)}" alt=""><img class="hero-cover" src="${escapeHtml(item.cover_url)}" alt="">` : ""}
          <div class="hero-slide-body">
            <span class="hero-slide-tag">${escapeHtml(tag)}</span>
            <h2 class="hero-slide-title">${escapeHtml(item.title)}</h2>
            <div class="hero-slide-sub">${escapeHtml(sub)}</div>
            <div class="hero-slide-actions">
              <span class="btn btn-gold btn-lg">${item.kind === "gist" ? "Read Full Post" : (item.type === "Video" ? "Watch Now" : "Listen Now")}</span>
              <button class="btn btn-lg hero-share-btn" data-share-url="${escapeHtml(heroSlideDest(item))}" data-share-title="${escapeHtml(item.title)}">Share</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    dotsWrap.innerHTML = slides.map((_, i) => `<button class="hero-dot ${i === 0 ? "active" : ""}" data-index="${i}" aria-label="Slide ${i + 1}"></button>`).join("");

    wrap.querySelectorAll(".hero-slide").forEach(el => {
      el.addEventListener("click", () => { window.location.href = el.dataset.url; });
    });

    wrap.querySelectorAll(".hero-share-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation(); // don't also trigger the slide's own click-to-navigate
        const fullUrl = `${window.location.origin}/${btn.dataset.shareUrl}`;
        const shareData = { title: btn.dataset.shareTitle, url: fullUrl };
        if (navigator.share) {
          try { await navigator.share(shareData); } catch (err) {}
        } else {
          await navigator.clipboard.writeText(fullUrl);
          const original = btn.textContent;
          btn.textContent = "Link copied!";
          setTimeout(() => { btn.textContent = original; }, 1800);
        }
      });
    });
    dotsWrap.querySelectorAll(".hero-dot").forEach(dot => {
      dot.addEventListener("click", () => goToHeroSlide(Number(dot.dataset.index)));
    });

    heroSlideIndex = 0;
    if (heroTimer) clearInterval(heroTimer);
    if (slides.length > 1) {
      heroTimer = setInterval(() => {
        goToHeroSlide((heroSlideIndex + 1) % slides.length);
      }, 6000);
    }
  }

  function goToHeroSlide(index) {
    const slides = document.querySelectorAll(".hero-slide");
    const dots = document.querySelectorAll(".hero-dot");
    if (!slides.length) return;
    heroSlideIndex = index;
    slides.forEach((s, i) => s.classList.toggle("active", i === index));
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }

  const ICON_PLAY_SM = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_PAUSE_SM = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;

  function rpc(fn, args) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).catch(() => {});
  }
  function trackLocked(t) {
    return t.release_date && new Date(t.release_date).getTime() > Date.now();
  }

  function trackCardHtml(t) {
    const locked = trackLocked(t);
    const hasFile = Boolean(t.file_url);
    const canPlay = !locked && (hasFile || t.streaming_link);
    const active = currentTrack && currentTrack.id === t.id;
    const playing = active && isPlaying;
    const meta = [t.year, `${formatCount(t.views)} plays`].filter(Boolean).join(" • ");
    return `
      <div class="track-card${active ? " playing" : ""}" data-track-id="${t.id}" id="track-${t.id}">
        <div class="tc-art" style="${t.cover_url ? `background-image:url('${escapeHtml(t.cover_url)}')` : ""}"></div>
        <div class="tc-body">
          <div class="tc-title">${escapeHtml(t.title)}</div>
          <div class="tc-artist">${escapeHtml(t.artist || "")}</div>
          <div class="tc-meta">${escapeHtml(meta)}</div>
          ${locked ? `<div class="tc-lock">Releases ${escapeHtml(new Date(t.release_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>`
                   : (t.description ? `<div class="tc-desc">${escapeHtml(t.description)}</div>` : "")}
        </div>
        <div class="tc-actions">
          <button class="tc-btn${playing ? " is-playing" : ""}" data-act="play" aria-label="Play ${escapeHtml(t.title)}" ${canPlay ? "" : "disabled"}>${playing ? ICON_PAUSE_SM : ICON_PLAY_SM}</button>
          <button class="tc-btn dl" data-act="download" aria-label="Download ${escapeHtml(t.title)}" ${hasFile && !locked ? "" : "disabled"}>${ICON_DOWNLOAD}</button>
        </div>
      </div>`;
  }

  async function downloadTrackFile(t) {
    rpc("increment_downloads", { row_id: t.id });
    try {
      await MGH.downloadSong(t);
    } catch (err) {
      window.open(t.file_url, "_blank");
    }
  }

  function attachTrackCardHandlers(container) {
    container.addEventListener("click", (e) => {
      const card = e.target.closest(".track-card");
      if (!card) return;
      const t = allContent.find(c => String(c.id) === card.dataset.trackId);
      if (!t) return;
      const btn = e.target.closest(".tc-btn");
      if (btn) {
        e.stopPropagation();
        if (btn.disabled) return;
        if (btn.dataset.act === "play") {
          if (t.file_url) {
            if (!(currentTrack && currentTrack.id === t.id)) { rpc("increment_views", { row_id: t.id }); t.views = (t.views || 0) + 1; }
            playTrack(t);
          } else if (t.streaming_link) {
            rpc("increment_views", { row_id: t.id });
            window.open(t.streaming_link, "_blank", "noopener,noreferrer");
          }
        } else if (btn.dataset.act === "download") {
          downloadTrackFile(t);
        }
        return;
      }
      window.location.href = `/song/${t.slug || t.id}`;
    });
  }

  function trackRowHtml(track, index) {
    const isActive = currentTrack && currentTrack.id === track.id;
    const num = isActive && isPlaying ? "▶" : String(index + 1).padStart(2, "0");
    const hasDownload = Boolean(track.file_url);
    return `
      <div class="track-row" data-track-id="${track.id}" id="track-${track.id}">
        <div class="track-num ${isActive ? "playing" : ""}">${num}</div>
        <div class="track-thumb" style="${track.cover_url ? `background-image:url(${escapeHtml(track.cover_url)})` : ""}"></div>
        <div>
          <div class="track-title">${escapeHtml(track.title)}</div>
          <div class="track-meta">${escapeHtml(track.artist || "")} · ${formatCount(track.views)} views</div>
        </div>
        <div class="track-tag">${escapeHtml(track.genre || track.type || "")}</div>
        <div class="track-actions">
          ${hasDownload ? `<button class="track-action-btn download-btn" data-track-id="${track.id}" title="Download" aria-label="Download">${ICON_DOWNLOAD}</button>` : ""}
          <button class="track-action-btn share-btn" data-track-id="${track.id}" title="Share" aria-label="Share">${ICON_SHARE}</button>
        </div>
      </div>
    `;
  }

  function attachTrackRowHandlers(container) {
    container.querySelectorAll(".track-row").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.trackId;
        const track = allContent.find(c => String(c.id) === String(id));
        const dest = track && track.type === "Video" ? "/video/" : "/song/";
        window.location.href = dest + encodeURIComponent((track && track.slug) || id);
      });
    });
    container.querySelectorAll(".download-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const track = allContent.find(c => String(c.id) === String(btn.dataset.trackId));
        if (track) { if (track.type === "Audio" && track.file_url) downloadTrackFile(track); else downloadTrack(track); }
      });
    });
    container.querySelectorAll(".share-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const track = allContent.find(c => String(c.id) === String(btn.dataset.trackId));
        if (track) shareTrack(track);
      });
    });
  }

  attachTrackCardHandlers(document.getElementById("setlistTracks"));
  attachVideoCardHandlers(document.getElementById("setlistVideos"));

  function videoCardHtml(t) {
    const locked = trackLocked(t);
    const hasFile = Boolean(t.file_url);
    const meta = [t.year, `${formatCount(t.views)} views`].filter(Boolean).join(" • ");
    return `
      <div class="track-card" data-track-id="${t.id}" data-kind="video" id="track-${t.id}">
        <div class="tc-art" style="${t.cover_url ? `background-image:url('${escapeHtml(t.cover_url)}')` : ""}"></div>
        <div class="tc-body">
          <div class="tc-title">${escapeHtml(t.title)}</div>
          <div class="tc-artist">${escapeHtml(t.artist || "")}</div>
          <div class="tc-meta">${escapeHtml(meta)}</div>
          ${locked ? `<div class="tc-lock">Releases ${escapeHtml(new Date(t.release_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>`
                   : (t.description ? `<div class="tc-desc">${escapeHtml(t.description)}</div>` : "")}
        </div>
        <div class="tc-actions">
          <button class="tc-btn" data-act="watch" aria-label="Watch ${escapeHtml(t.title)}" ${locked ? "disabled" : ""}>${ICON_PLAY_SM}</button>
          <button class="tc-btn dl" data-act="download" aria-label="Download ${escapeHtml(t.title)}" ${hasFile && !locked ? "" : "disabled"}>${ICON_DOWNLOAD}</button>
        </div>
      </div>`;
  }

  function attachVideoCardHandlers(container) {
    container.addEventListener("click", (e) => {
      const card = e.target.closest(".track-card");
      if (!card) return;
      const t = allContent.find(c => String(c.id) === card.dataset.trackId);
      if (!t) return;
      const go = () => { window.location.href = `/video/${t.slug || t.id}`; };
      const btn = e.target.closest(".tc-btn");
      if (btn) {
        e.stopPropagation();
        if (btn.disabled) return;
        if (btn.dataset.act === "download") downloadTrackFile(t); else go();
        return;
      }
      go();
    });
  }

  function gistRowHtml(p) {
    return `
      <div class="gist-row" data-href="/gist/${p.slug || p.id}">
        <div class="gr-art" style="${p.cover_url ? `background-image:url('${escapeHtml(p.cover_url)}')` : ""}"></div>
        <div class="gr-body">
          <span class="gr-cat">${escapeHtml(p.category || "Gist")}</span>
          <div class="gr-title">${escapeHtml(p.title)}</div>
          <div class="gr-meta">${timeAgo(p.created_at)} · ${formatCount(p.reads)} reads</div>
        </div>
        <div class="gr-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
      </div>`;
  }

  function renderTrackLists() {
    // Latest Videos (5 most recently uploaded, type = Video)
    const videoList = document.getElementById("setlistVideos");
    const videos = allContent.filter(c => c.type === "Video");
    if (videos.length === 0) {
      videoList.innerHTML = `<div class="empty-state">No videos published yet — check back soon.</div>`;
    } else {
      const latestVideos = [...videos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
      videoList.innerHTML = latestVideos.map(videoCardHtml).join("");
    }

    // Latest Songs (5 most recently uploaded, type = Audio)
    const trackList = document.getElementById("setlistTracks");
    const tracks = allContent.filter(c => c.type === "Audio");
    if (tracks.length === 0) {
      trackList.innerHTML = `<div class="empty-state">No tracks published yet — check back soon.</div>`;
    } else {
      const trendingTracks = [...tracks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
      trackList.innerHTML = trendingTracks.map(trackCardHtml).join("");
    }

    // Trending Tracks (most played)
    const trendRow = document.getElementById("trendRow");
    if (trendRow) {
      const hot = [...tracks].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8);
      document.getElementById("trending").style.display = hot.length ? "" : "none";
      trendRow.innerHTML = hot.map(t => `
        <a class="trend-card" href="/song/${t.slug || t.id}">
          <div class="trend-art" style="${t.cover_url ? `background-image:url('${escapeHtml(t.cover_url)}')` : ""}"></div>
          <div class="trend-title">${escapeHtml(t.title)}</div>
          <div class="trend-artist">${escapeHtml(t.artist || "")}</div>
        </a>`).join("");
    }

    // Genre-filtered results (searches across both videos and tracks)
    const activeGenre = document.querySelector(".genre-pill.active")?.dataset.genre || "All";
    const genreResults = document.getElementById("genreResults");
    if (activeGenre === "All") {
      genreResults.innerHTML = "";
    } else {
      const filtered = allContent.filter(c => c.genre === activeGenre);
      genreResults.innerHTML = filtered.length === 0
        ? `<div class="empty-state">Nothing in ${escapeHtml(activeGenre)} yet.</div>`
        : filtered.map((t, i) => trackRowHtml(t, i)).join("");
      attachTrackRowHandlers(genreResults);
    }
  }

  function renderGenres() {
    const genres = ["All", ...new Set(allContent.map(c => c.genre).filter(Boolean))];
    const strip = document.getElementById("genreStrip");
    strip.innerHTML = genres.map(g =>
      `<button class="genre-pill ${g === "All" ? "active" : ""}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`
    ).join("");
    strip.querySelectorAll(".genre-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        strip.querySelectorAll(".genre-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        renderTrackLists();
      });
    });
  }

  function gistCardHtml(post) {
    return `
      <div class="gist-card" data-href="/gist/${post.slug || post.id}">
        <div class="gist-cover" style="${post.cover_url ? `background-image:url(${escapeHtml(post.cover_url)})` : ""}">
          <span class="cat">${escapeHtml(post.category || "Gist")}</span>
        </div>
        <div class="gist-body">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.excerpt || post.body || "")}</p>
          <div class="gist-meta"><span>${timeAgo(post.created_at)}</span><span>${formatCount(post.reads)} reads</span></div>
        </div>
      </div>
    `;
  }

  function renderGist() {
    const list = document.getElementById("gistGrid");
    if (allGist.length === 0) {
      list.innerHTML = `<div class="empty-state">No gist posted yet — check back soon.</div>`;
      return;
    }
    list.innerHTML = [...allGist].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(gistRowHtml).join("");
  }

  // ==================================================================
  // Load data
  // ==================================================================
  async function loadContent() {
    try {
      const [contentData, gistData] = await Promise.all([
        supabaseQuery("content", "status=eq.Published&order=created_at.desc"),
        supabaseQuery("gist_articles", "status=eq.Published&order=created_at.desc"),
      ]);
      allContent = contentData || [];
      allGist = gistData || [];
    } catch (err) {
      console.error(err);
      const errMsg = `<div class="empty-state">Couldn't load MyGospelHub right now. Refresh to try again.</div>`;
      const errMsgGrid = `<div class="empty-state" style="grid-column:1/-1;">Couldn't load gist right now.</div>`;
      document.getElementById("setlistVideos").innerHTML = errMsg;
      document.getElementById("setlistTracks").innerHTML = errMsg;
      document.getElementById("gistGrid").innerHTML = errMsgGrid;
      return;
    }
    renderTicker();
    renderHero();
    renderTrackLists();
    renderGenres();
    renderGist();
  }

  // ==================================================================
  // Search
  // ==================================================================
  function searchResultRow(item, kind) {
    const title = kind === "gist" ? item.title : item.title;
    const meta = kind === "gist" ? (item.category || "Gist") : (item.artist || item.type || "");
    const thumbStyle = item.cover_url ? `background-image:url(${escapeHtml(item.cover_url)})` : "";
    return `
      <div class="search-result-row" data-kind="${kind}" data-id="${item.id}">
        <div class="search-result-thumb" style="${thumbStyle}"></div>
        <div>
          <div class="search-result-title">${escapeHtml(title)}</div>
          <div class="search-result-meta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }

  function closeAllSearchResults() {
    document.getElementById("searchResults").classList.remove("show");
    document.getElementById("searchResultsMobile").classList.remove("show");
  }

  function runSearch(query, resultsEl, inputEl) {
    const q = query.trim().toLowerCase();
    if (!q) {
      resultsEl.classList.remove("show");
      resultsEl.innerHTML = "";
      return;
    }
    const contentMatches = allContent.filter(c =>
      (c.title || "").toLowerCase().includes(q) ||
      (c.artist || "").toLowerCase().includes(q) ||
      (c.genre || "").toLowerCase().includes(q)
    ).slice(0, 6);
    const gistMatches = allGist.filter(g =>
      (g.title || "").toLowerCase().includes(q) ||
      (g.category || "").toLowerCase().includes(q)
    ).slice(0, 4);

    if (contentMatches.length === 0 && gistMatches.length === 0) {
      resultsEl.innerHTML = `<div class="search-empty">No results for "${escapeHtml(query)}"</div>`;
    } else {
      resultsEl.innerHTML =
        contentMatches.map(c => searchResultRow(c, "content")).join("") +
        gistMatches.map(g => searchResultRow(g, "gist")).join("");
    }
    resultsEl.classList.add("show");

    resultsEl.querySelectorAll(".search-result-row").forEach(row => {
      row.addEventListener("click", () => {
        const id = row.dataset.id;
        const item = (row.dataset.kind === "gist" ? allGist : allContent).find(c => String(c.id) === String(id));
        if (!item) return;
        const page = row.dataset.kind === "gist" ? "/gist/" : (item.type === "Video" ? "/video/" : "/song/");
        window.location.href = page + encodeURIComponent(item.slug || item.id);
      });
    });
  }

  // Desktop search
  function goSearch(e, el) { if (e.key === "Enter" && el.value.trim()) window.location.href = "/search?q=" + encodeURIComponent(el.value.trim()); }
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("keydown", (e) => goSearch(e, searchInput));
  const searchResults = document.getElementById("searchResults");
  searchInput.addEventListener("input", (e) => runSearch(e.target.value, searchResults, searchInput));
  searchInput.addEventListener("focus", (e) => { if (e.target.value.trim()) runSearch(e.target.value, searchResults, searchInput); });

  // Mobile search
  const searchInputMobile = document.getElementById("searchInputMobile");
  searchInputMobile.addEventListener("keydown", (e) => goSearch(e, searchInputMobile));
  const searchResultsMobile = document.getElementById("searchResultsMobile");
  const mobileSearchBar = document.getElementById("mobileSearchBar");
  searchInputMobile.addEventListener("input", (e) => runSearch(e.target.value, searchResultsMobile, searchInputMobile));

  document.getElementById("mobileSearchToggle").addEventListener("click", () => {
    mobileSearchBar.classList.add("show");
    searchInputMobile.focus();
  });
  document.getElementById("mobileSearchClose").addEventListener("click", () => {
    mobileSearchBar.classList.remove("show");
    searchInputMobile.value = "";
    searchResultsMobile.classList.remove("show");
  });

  // Mobile menu (hamburger) open/close
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const navToggleBtn = document.querySelector(".nav-toggle");

  function openMobileMenu() {
    mobileMenu.scrollTop = 0;
    mobileMenu.classList.add("open");
    mobileMenuOverlay.classList.add("open");
    mobileMenu.setAttribute("aria-hidden", "false");
  }
  function closeMobileMenu() {
    mobileMenu.classList.remove("open");
    mobileMenuOverlay.classList.remove("open");
    mobileMenu.setAttribute("aria-hidden", "true");
  }
  navToggleBtn.addEventListener("click", openMobileMenu);
  document.getElementById("mobileMenuClose").addEventListener("click", closeMobileMenu);
  mobileMenuOverlay.addEventListener("click", closeMobileMenu);
  mobileMenu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMobileMenu));

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-search-wrap")) {
      searchResults.classList.remove("show");
    }
  });

  loadContent();
