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

  async function supabaseInsert(table, body) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Insert failed");
    return res.json();
  }

  async function supabaseRpc(fn, args) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    return res.ok;
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
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function initials(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  }

  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
  const ICON_STREAM = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>`;
  const ICON_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;
  const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

  const params = new URLSearchParams(window.location.search);
  if (window.__PRETTY) params.set(window.__PRETTY.k, window.__PRETTY.v);
  const songSlug = params.get("slug");
  const songId = params.get("id");
  let currentSong = null;
  let liked = false;

  async function loadSong() {
    if (!songSlug && !songId) {
      document.getElementById("songContent").innerHTML = `<div class="state-block">No song specified.</div>`;
      return;
    }
    try {
      // Prefer the clean slug when present; fall back to id for older links
      // that were shared before slugs existed, so nothing breaks.
      const filter = songSlug ? `slug=eq.${encodeURIComponent(songSlug)}` : `id=eq.${songId}`;
      const rows = await supabaseQuery("content", `${filter}&status=eq.Published&select=*`);
      if (!rows || rows.length === 0) {
        document.getElementById("songContent").innerHTML = `<div class="state-block">This song couldn't be found — it may have been removed.</div>`;
        return;
      }
      currentSong = rows[0];
      document.getElementById("crumbTitle").textContent = currentSong.title;
      document.title = `${currentSong.title} — MyGospelHub`;
      setSeo(document.title, currentSong.description || `Play and download "${currentSong.title}" by ${currentSong.artist} on MyGospelHub.`, "song.html", currentSong.slug || currentSong.id);
      renderSong();
      loadRelated();
      loadComments();
      loadFollowSection();
    } catch (err) {
      console.error(err);
      document.getElementById("songContent").innerHTML = `<div class="state-block">Couldn't load this song right now. Refresh to try again.</div>`;
    }
  }

function setSeo(title, desc, page, id) {
  try {
    var m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute("content", String(desc || title).replace(/\*|\[\[|\]\]/g, "").replace(/\s+/g, " ").slice(0, 155));
    var l = document.querySelector('link[rel="canonical"]');
    if (!l) { l = document.createElement("link"); l.rel = "canonical"; document.head.appendChild(l); }
    l.href = "https://mygospelhub.com.ng/" + String(page).replace("gist-post.html","gist").replace(".html","") + "/" + encodeURIComponent(id);
  } catch (e) {}
}
  // Turns a YouTube or Vimeo link into an embeddable player address (or "" if it can't be embedded).
  function toEmbed(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\.|^m\./, "");
      let id = "";
      if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
      else if (host === "youtube.com" || host === "music.youtube.com") {
        if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
        else {
          const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{6,})/);
          if (m) id = m[2];
        }
      }
      if (id && /^[\w-]{6,}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`;
      if (host === "vimeo.com") {
        const m = u.pathname.match(/^\/(\d+)/);
        if (m) return `https://player.vimeo.com/video/${m[1]}`;
      }
    } catch (e) {}
    return "";
  }
  const postedDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  function renderSong() {
    const s = currentSong;
    const releaseAt = s.release_date ? new Date(s.release_date).getTime() : 0;
    const locked = releaseAt > Date.now();
    const hasFile = !locked && Boolean(s.file_url);
    const ytLink = locked ? "" : (s.youtube_url || (/youtu\.?be/i.test(s.streaming_link || "") ? s.streaming_link : "") || s.video_url || "");
    const spLink = locked ? "" : (s.spotify_url || (/spotify\.com/i.test(s.streaming_link || "") ? s.streaming_link : ""));
    const amLink = locked ? "" : (s.audiomack_url || (/audiomack\.com/i.test(s.streaming_link || "") ? s.streaming_link : ""));
    const otherLink = locked ? "" : ((s.streaming_link && !/youtu\.?be|spotify\.com|audiomack\.com/i.test(s.streaming_link)) ? s.streaming_link : "");
    const streamUrl = ytLink || otherLink;
    const embedSrc = toEmbed(streamUrl);

    document.getElementById("songContent").innerHTML = `
      <div class="np-bar">
        <button class="np-btn" id="npBack" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <span class="np-label">${locked ? "Coming soon" : "Now playing"}</span>
        <button class="np-btn" id="npMore" aria-label="Share"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
      </div>
      <div class="posted-by">Posted By: <strong>${escapeHtml(s.uploaded_by || "MyGospelHub")}</strong>${s.created_at ? `<span class="pb-dot">•</span><span>${postedDate(s.created_at)}</span>` : ""}</div>
      <div class="song-header">
        <div class="song-cover">${s.cover_url ? `<img src="${escapeHtml(s.cover_url)}" alt="">` : ""}</div>
        <div>
          <div class="song-tags">
            ${s.genre ? `<span class="song-tag">${escapeHtml(s.genre)}</span>` : ""}
            ${s.year ? `<span class="song-tag">${escapeHtml(String(s.year))}</span>` : ""}
            <span class="song-tag">${escapeHtml(s.type || "Audio")}</span>
          </div>
          <h1 class="song-title">${escapeHtml(s.title)}</h1>
          <div class="song-artist">${MGH.artistHtml(s.artist)}</div>
          ${s.description ? `<p class="song-desc">${MGH.linkText(s.description, s.artist)}</p>` : ""}
        </div>
      </div>

      ${embedSrc ? `
      <div class="yt-card">
        <iframe id="songFrame" src="${escapeHtml(embedSrc)}" title="${escapeHtml(s.title)}" style="width:100%;height:100%;border:0;display:block;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>
      </div>
      <p class="yt-note">Video not loading? <a href="${escapeHtml(streamUrl)}" target="_blank" rel="noopener">Open it on ${embedSrc.includes("vimeo") ? "Vimeo" : "YouTube"}</a></p>
      ` : ""}

      <div class="stats-row">
        <div class="stat"><div class="stat-value">${formatCount(s.views)}</div><div class="stat-label">Plays</div></div>
        <div class="stat"><div class="stat-value">${formatCount(s.downloads)}</div><div class="stat-label">Downloads</div></div>
        <div class="stat"><div class="stat-value" id="likeCount">${formatCount(s.likes)}</div><div class="stat-label">Likes</div></div>
      </div>

      ${locked ? `
      <div class="release-box" id="releaseBox">
        <div class="rb-pill"><i class="rb-dot"></i>Coming soon</div>
        <div class="release-label">Releases <em>in</em></div>
        <div class="countdown" id="countdown">
          <div class="cd-unit cd-days"><div class="cd-num" id="cdD">0</div><div class="cd-lbl">Days</div></div>
          <span class="cd-sep">:</span>
          <div class="cd-unit"><div class="cd-num" id="cdH">00</div><div class="cd-lbl">Hrs</div></div>
          <span class="cd-sep">:</span>
          <div class="cd-unit"><div class="cd-num" id="cdM">00</div><div class="cd-lbl">Min</div></div>
          <span class="cd-sep">:</span>
          <div class="cd-unit"><div class="cd-num" id="cdS">00</div><div class="cd-lbl">Sec</div></div>
        </div>
        ${s.created_at ? `<div class="rb-progress"><div class="rb-bar" id="cdBar"></div></div><div class="rb-progress-note" id="cdNote"></div>` : ""}
        <div class="release-date-text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>${escapeHtml(new Date(releaseAt).toLocaleString([], {dateStyle:"full", timeStyle:"short"}))}</div>
      </div>
      ` : ""}

      ${hasFile ? `
      <div class="inline-player" id="inlinePlayer">
        <button class="inline-play-btn" id="inlinePlayBtn">${ICON_STREAM}</button>
        <div class="inline-player-body">
          <div class="inline-progress wave" id="inlineProgress"><div class="inline-progress-fill" id="inlineProgressFill"></div></div>
          <div class="inline-time"><span id="inlineCurrentTime">0:00</span><span id="inlineDuration">0:00</span></div>
        </div>
      </div>
      <audio id="audioEl" src="${escapeHtml(s.file_url)}" preload="none"></audio>
      ` : ""}

      <div class="actions-row">
        ${locked ? `<button class="action-btn action-locked" disabled>${ICON_DOWNLOAD} Download unlocks on release</button>` : ""}
        ${hasFile ? `<button class="action-btn action-download" id="downloadBtn">${ICON_DOWNLOAD} Download</button>` : ""}
        <button class="action-like" id="likeBtn">${ICON_HEART} <span id="likeBtnCount">${formatCount(s.likes)}</span></button>
        <button class="action-share" id="shareBtn">${ICON_SHARE}<span class="al">Share</span></button>
      </div>

      ${(ytLink || spLink || amLink || otherLink) ? `<div class="platforms"><div class="pl-label">Listen on</div><div class="pl-row">
        ${ytLink ? `<a class="pl pl-yt" href="${escapeHtml(ytLink)}" target="_blank" rel="noopener"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2C.5 9.1.5 12 .5 12s0 2.9.5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.8.5-4.8s0-2.9-.5-4.8zM9.8 15.1V8.9l5.4 3.1-5.4 3.1z"/></svg>YouTube</a>` : ""}
        ${spLink ? `<a class="pl pl-sp" href="${escapeHtml(spLink)}" target="_blank" rel="noopener"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm4.8 15.1a.8.8 0 0 1-1.1.3c-3-1.8-6.7-2.2-11.1-1.2a.8.8 0 1 1-.35-1.6c4.8-1.1 8.9-.6 12.3 1.4.4.2.5.7.25 1.1zm1.3-2.9a1 1 0 0 1-1.4.3c-3.4-2.1-8.600-2.700-12.600-1.500a1 1 0 1 1-.6-1.900c4.600-1.400 10.300-.7 14.200 1.700.5.3.6.9.4 1.400zm.1-3.100C14.200 8.200 7.600 8 3.800 9.200a1.200 1.200 0 1 1-.7-2.300c4.400-1.300 11.700-1.100 16.300 1.600a1.200 1.200 0 1 1-1.200 2.100z"/></svg>Spotify</a>` : ""}
        ${amLink ? `<a class="pl pl-am" href="${escapeHtml(amLink)}" target="_blank" rel="noopener"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18 9.500 5h2.200L18 18h-2.600l-1.100-2.400H8.600L7.500 18H3zm6.600-4.500h3.700L11.500 9.300 9.600 13.500zM19 18V9h2.500v9H19z"/></svg>Audiomack</a>` : ""}
        ${otherLink ? `<a class="fanlink" href="${escapeHtml(otherLink)}" target="_blank" rel="noopener" aria-label="Choose where to stream this song">
          <span class="fl-top">
            <span class="fl-logos" aria-hidden="true"><i class="lg lg-sp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm4.8 15.1a.8.8 0 0 1-1.1.3c-3-1.8-6.7-2.2-11.1-1.2a.8.8 0 1 1-.35-1.6c4.8-1.1 8.9-.6 12.3 1.4.4.2.5.7.25 1.1zm1.3-2.9a1 1 0 0 1-1.4.3c-3.4-2.1-8.600-2.700-12.600-1.500a1 1 0 1 1-.6-1.900c4.600-1.400 10.300-.7 14.200 1.700.5.3.6.9.4 1.400zm.1-3.100C14.200 8.200 7.600 8 3.800 9.200a1.200 1.200 0 1 1-.7-2.300c4.400-1.300 11.700-1.100 16.300 1.600a1.200 1.200 0 1 1-1.200 2.100z"/></svg></i><i class="lg lg-am"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 18 9.500 5h2.200L18 18h-2.600l-1.100-2.400H8.600L7.500 18H3zm6.600-4.500h3.700L11.500 9.300 9.600 13.500zM19 18V9h2.500v9H19z"/></svg></i><i class="lg lg-yt"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2C.5 9.1.5 12 .5 12s0 2.9.5 4.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1c.5-1.9.5-4.8.5-4.8s0-2.9-.5-4.8zM9.8 15.1V8.9l5.4 3.1-5.4 3.1z"/></svg></i><i class="lg lg-ap"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 3v11.2a3.3 3.3 0 1 1-1.8-2.9V6.6l-6 1.3v8.3a3.3 3.3 0 1 1-1.8-2.9V6.4L16 3z"/></svg></i><i class="lg lg-more"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></i></span>
            <span class="fl-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg></span>
          </span>
          <strong>Stream everywhere</strong>
          <span class="fl-sub">One tap, then pick Spotify, Apple Music, Audiomack, YouTube and more.</span>
        </a>` : ""}
      </div></div>` : ""}

      ${s.description ? `<div class="about-card"><p>${MGH.linkText(s.description, s.artist)}</p></div>` : ""}

      <div class="details-card">
        <div class="details-head">Track Details</div>
        ${[
          ["Artist", s.artist, MGH.artistHtml(s.artist)],
          ["Title", s.title, MGH.nameLink(s.title)],
          ["Producer", s.producer],
          ["Genre", s.genre],
          ["Released", s.year],
          ["Category", s.type || "Audio"],
        ].filter(r => r[1]).map(r => `<div class="detail-row"><div class="detail-label">${r[0]}</div><div class="detail-value">${r[2] || escapeHtml(String(r[1]))}</div></div>`).join("")}
      </div>

      ${s.lyrics ? `
      <div class="lyrics-section">
        <button class="lyrics-toggle" id="lyricsToggle">
          <span>Lyrics</span>
          <svg id="lyricsChevron" style="transform:rotate(180deg)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
        <div class="lyrics-body open" id="lyricsBody">${MGH.richText(s.lyrics)}</div>
      </div>
      ` : ""}
    `;

    if (locked) {
      const pad = n => String(n).padStart(2, "0");
      const box = document.getElementById("releaseBox");
      if (s.cover_url && box) box.style.setProperty("--cover", 'url("' + encodeURI(s.cover_url).replace(/"/g, "%22") + '")');
      const createdAt = s.created_at ? new Date(s.created_at).getTime() : 0;
      const setNum = (id, v) => {
        const el = document.getElementById(id);
        if (!el || el.textContent === String(v)) return;
        el.textContent = v;
        el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick");
      };
      const tick = () => {
        const left = releaseAt - Date.now();
        if (left <= 0) { clearInterval(window.__cd); renderSong(); return; }
        setNum("cdD", Math.floor(left / 86400000));
        setNum("cdH", pad(Math.floor(left / 3600000) % 24));
        setNum("cdM", pad(Math.floor(left / 60000) % 60));
        setNum("cdS", pad(Math.floor(left / 1000) % 60));
        const bar = document.getElementById("cdBar");
        if (bar && createdAt && releaseAt > createdAt) {
          const pct = Math.max(2, Math.min(100, ((Date.now() - createdAt) / (releaseAt - createdAt)) * 100));
          bar.style.width = pct.toFixed(1) + "%";
          const note = document.getElementById("cdNote");
          if (note) note.textContent = Math.round(pct) + "% of the wait is over";
        }
      };
      clearInterval(window.__cd);
      tick();
      window.__cd = setInterval(tick, 1000);
    }

    if (s.lyrics) {
      const lyricsToggle = document.getElementById("lyricsToggle");
      const lyricsBody = document.getElementById("lyricsBody");
      const lyricsChevron = document.getElementById("lyricsChevron");
      lyricsToggle.addEventListener("click", () => {
        const isOpen = lyricsBody.classList.toggle("open");
        lyricsChevron.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
      });
    }

    document.getElementById("npBack").addEventListener("click", () => { if (history.length > 1) history.back(); else location.href = "music.html"; });
    document.getElementById("npMore").addEventListener("click", () => { const b = document.getElementById("shareBtn"); if (b) b.click(); });
    const waveEl = document.getElementById("inlineProgress"), waveAudio = document.getElementById("audioEl");
    if (waveEl && waveAudio) {
      const setP = () => waveEl.style.setProperty("--p", (waveAudio.duration ? (waveAudio.currentTime / waveAudio.duration) * 100 : 0) + "%");
      ["timeupdate", "seeked", "loadedmetadata", "ended"].forEach(ev => waveAudio.addEventListener(ev, setP));
    }

    // ---------- Real audio playback (only when a real file exists) ----------
    if (hasFile) {
      const audio = document.getElementById("audioEl");
      const playBtn = document.getElementById("inlinePlayBtn");
      const progress = document.getElementById("inlineProgress");
      const progressFill = document.getElementById("inlineProgressFill");
      const currentTimeEl = document.getElementById("inlineCurrentTime");
      const durationEl = document.getElementById("inlineDuration");
      let hasCountedPlay = false;

      function formatTime(sec) {
        if (!isFinite(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s2 = Math.floor(sec % 60).toString().padStart(2, "0");
        return `${m}:${s2}`;
      }

      audio.addEventListener("play", () => MGH.setMediaSession(s, audio));

      function togglePlay() {
        if (audio.paused) {
          audio.play();
        } else {
          audio.pause();
        }
      }

      playBtn.addEventListener("click", togglePlay);
      audio.addEventListener("play", () => {
        playBtn.innerHTML = ICON_PAUSE;
        if (!hasCountedPlay) {
          hasCountedPlay = true;
          supabaseRpc("increment_views", { row_id: s.id });
        }
      });
      audio.addEventListener("pause", () => { playBtn.innerHTML = ICON_STREAM; });
      audio.addEventListener("ended", () => { playBtn.innerHTML = ICON_STREAM; });
      audio.addEventListener("loadedmetadata", () => { durationEl.textContent = formatTime(audio.duration); });
      audio.addEventListener("timeupdate", () => {
        currentTimeEl.textContent = formatTime(audio.currentTime);
        if (audio.duration) progressFill.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
      });
      progress.addEventListener("click", (e) => {
        const rect = progress.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        if (audio.duration) audio.currentTime = ratio * audio.duration;
      });
    }

    const songFrame = document.getElementById("songFrame");
    if (songFrame) {
      let ytCounted = false;
      window.addEventListener("blur", () => {
        setTimeout(() => {
          if (!ytCounted && document.activeElement === songFrame) {
            ytCounted = true;
            supabaseRpc("increment_views", { row_id: s.id });
          }
        }, 0);
      });
    }

    const streamBtnEl = document.getElementById("streamBtn");
    if (streamBtnEl) {
      streamBtnEl.addEventListener("click", () => {
        supabaseRpc("increment_views", { row_id: s.id });
        window.open(streamUrl, "_blank", "noopener,noreferrer");
      });
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", async () => {
        supabaseRpc("increment_downloads", { row_id: s.id });
        // Force an actual file download instead of opening it in a new tab
        await MGH.downloadSong(s);
      });
    }

    document.getElementById("likeBtn").addEventListener("click", async (e) => {
      if (liked) return; // one like per page visit, keeps it simple and honest
      liked = true;
      const btn = e.currentTarget;
      btn.classList.add("liked");
      const newCount = (s.likes || 0) + 1;
      document.getElementById("likeCount").textContent = formatCount(newCount);
      document.getElementById("likeBtnCount").textContent = formatCount(newCount);
      s.likes = newCount;
      await supabaseRpc("increment_likes", { row_id: s.id });
    });

    document.getElementById("shareBtn").addEventListener("click", async () => {
      const shareUrl = s.slug ? `${window.location.origin}/song/${encodeURIComponent(s.slug)}` : `${window.location.origin}/song/${s.id}`;
      const shareData = { title: s.title, text: `${s.title} — ${s.artist} on MyGospelHub`, url: shareUrl };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) {}
      } else {
        await navigator.clipboard.writeText(shareUrl);
        const btn = document.getElementById("shareBtn");
        const original = btn.innerHTML;
        btn.innerHTML = "Link copied!";
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      }
    });
  }

  // Card used for "More like this" and "Recent Posts": same design as the Music page.
  function itemCardHtml(r, metaText) {
    const page = r.type === "Video" ? "/video/" : "/song/";
    const locked = r.release_date && new Date(r.release_date).getTime() > Date.now();
    const canDl = Boolean(r.file_url) && !locked;
    return `
      <div class="track-card" data-href="${page}${encodeURIComponent(r.slug || r.id)}" data-id="${escapeHtml(String(r.id))}">
        <div class="tc-art" style="${r.cover_url ? `background-image:url('${escapeHtml(r.cover_url)}')` : ""}"></div>
        <div class="tc-body">
          <div class="tc-title">${escapeHtml(r.title)}</div>
          <div class="tc-artist">${escapeHtml(r.artist || "")}</div>
          <div class="tc-meta">${escapeHtml(metaText)}</div>
          ${locked ? `<div class="tc-lock">Releases ${escapeHtml(new Date(r.release_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))}</div>` : ""}
        </div>
        <div class="tc-actions">
          <button class="tc-btn play" data-act="open" aria-label="Open ${escapeHtml(r.title)}">${ICON_STREAM}</button>
          <button class="tc-btn dl" data-act="download" aria-label="Download ${escapeHtml(r.title)}" ${canDl ? "" : "disabled"}>${ICON_DOWNLOAD}</button>
        </div>
      </div>`;
  }

  function wireItemCards(container, rows) {
    container.addEventListener("click", async (e) => {
      const card = e.target.closest(".track-card");
      if (!card) return;
      const btn = e.target.closest(".tc-btn");
      if (btn && btn.dataset.act === "download") {
        e.stopPropagation();
        const item = rows.find(x => String(x.id) === card.dataset.id);
        if (!item || !item.file_url) return;
        supabaseRpc("increment_downloads", { row_id: item.id });
        await MGH.downloadSong(item);
        return;
      }
      window.location.href = card.dataset.href;
    });
  }

  async function loadRelated() {
    try {
      const rows = await supabaseQuery(
        "content",
        `status=eq.Published&id=neq.${currentSong.id}&type=eq.${encodeURIComponent(currentSong.type || "Audio")}&genre=eq.${encodeURIComponent(currentSong.genre || "")}&order=views.desc&limit=4`
      );
      const wrap = document.createElement("section");
      wrap.className = "related";
      if (!rows || rows.length === 0) {
        wrap.innerHTML = `<div class="section-label"><small>Keep listening</small>More like this</div><div class="state-block">No related tracks yet.</div>`;
      } else {
        wrap.innerHTML = `
          <div class="section-label"><small>Keep listening</small>More like this</div>
          <div class="tc-list" id="relatedList">
            ${rows.map(r => itemCardHtml(r, [r.year, `${formatCount(r.views)} plays`].filter(Boolean).join(" • "))).join("")}
          </div>
        `;
        wireItemCards(wrap.querySelector("#relatedList"), rows);
      }
      document.getElementById("songContent").appendChild(wrap);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadFollowSection() {
    const wrap = document.createElement("section");
    wrap.className = "follow-section";
    wrap.innerHTML = `
      <div class="section-label">Recent Posts</div>
      <div id="recentPostsList"><div class="state-block">Loading…</div></div>

      <div class="follow-us">
        <div class="section-label">Follow Us On</div>
        <div class="follow-icons">
          <a href="https://www.facebook.com/share/1DyGHVpWsx/" target="_blank" rel="noopener noreferrer" class="follow-icon" aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
          </a>
          <a href="https://www.instagram.com/iam_davidfrank?igsh=cGlra3Rpb3FubW94" target="_blank" rel="noopener noreferrer" class="follow-icon" aria-label="Instagram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
          </a>
          <a href="https://vm.tiktok.com/ZS9hfCLFCGack-otoG1/" target="_blank" rel="noopener noreferrer" class="follow-icon" aria-label="TikTok">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 2h-3v13.5a2.5 2.5 0 11-2.5-2.5c.17 0 .34.02.5.05V10a5.5 5.5 0 105.5 5.5V9.2a6.5 6.5 0 003.5 1.02V7.2A4.5 4.5 0 0116.5 2z"/></svg>
          </a>
        </div>
      </div>
    `;
    document.getElementById("songContent").appendChild(wrap);

    try {
      const rows = await supabaseQuery(
        "content",
        `status=eq.Published&id=neq.${currentSong.id}&order=created_at.desc&limit=4&select=*`
      );
      const list = document.getElementById("recentPostsList");
      if (!rows || rows.length === 0) {
        list.innerHTML = `<div class="state-block">Nothing else posted yet.</div>`;
        return;
      }
      list.innerHTML = `
        <div class="tc-list" id="recentList">
          ${rows.map(r => itemCardHtml(r, `${r.type === "Video" ? "Video" : "Song"} • ${timeAgo(r.created_at)}`)).join("")}
        </div>
      `;
      wireItemCards(list.querySelector("#recentList"), rows);
    } catch (err) {
      console.error(err);
      document.getElementById("recentPostsList").innerHTML = `<div class="state-block">Couldn't load recent posts.</div>`;
    }
  }


  async function loadComments() {
    const wrap = document.createElement("section");
    wrap.className = "comments";
    wrap.innerHTML = `
      <div class="section-label">Comments <span class="comments-count" id="commentsCount"></span></div>
      <div class="comment-form">
        <div class="comment-form-row">
          <input type="text" id="commentName" placeholder="Your name" maxlength="60">
          <input type="email" id="commentEmail" placeholder="Email (optional)" maxlength="120">
        </div>
        <textarea id="commentText" rows="3" placeholder="Share your thoughts…" maxlength="600"></textarea>
        <div class="comment-form-foot">
          <span class="comment-form-hint">Your email is never shown publicly.</span>
          <button class="comment-submit" id="commentSubmit">Post comment</button>
        </div>
        <div id="commentMsg"></div>
      </div>
      <div id="commentsList"><div class="state-block">Loading comments…</div></div>
    `;
    document.getElementById("songContent").appendChild(wrap);

    document.getElementById("commentSubmit").addEventListener("click", submitComment);
    refreshComments();
  }

  async function refreshComments() {
    try {
      const rows = await supabaseQuery("comments", `content_id=eq.${currentSong.id}&status=eq.Visible&order=created_at.desc`);
      document.getElementById("commentsCount").textContent = `(${rows.length})`;
      const list = document.getElementById("commentsList");
      if (!rows || rows.length === 0) {
        list.innerHTML = `<div class="state-block">Be the first to comment on this one.</div>`;
        return;
      }
      list.innerHTML = rows.map(c => `
        <div class="comment-item">
          <div class="comment-avatar">${escapeHtml(initials(c.guest_name || "?"))}</div>
          <div>
            <span class="comment-name">${escapeHtml(c.guest_name || "Anonymous")}</span>
            <span class="comment-time">${timeAgo(c.created_at)}</span>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.error(err);
      document.getElementById("commentsList").innerHTML = `<div class="state-block">Couldn't load comments right now.</div>`;
    }
  }

  async function submitComment() {
    const nameEl = document.getElementById("commentName");
    const emailEl = document.getElementById("commentEmail");
    const textEl = document.getElementById("commentText");
    const msgEl = document.getElementById("commentMsg");
    const btn = document.getElementById("commentSubmit");

    const name = nameEl.value.trim();
    const email = emailEl.value.trim();
    const text = textEl.value.trim();

    msgEl.innerHTML = "";
    if (!name) { msgEl.innerHTML = `<div class="comment-error">Please add your name.</div>`; return; }
    if (!text) { msgEl.innerHTML = `<div class="comment-error">Write a comment before posting.</div>`; return; }

    btn.disabled = true;
    btn.textContent = "Posting…";

    try {
      await supabaseInsert("comments", {
        content_id: currentSong.id,
        guest_name: name,
        guest_email: email || null,
        text: text,
        status: "Visible",
      });
      nameEl.value = ""; emailEl.value = ""; textEl.value = "";
      msgEl.innerHTML = `<div class="comment-success">Comment posted!</div>`;
      refreshComments();
    } catch (err) {
      console.error(err);
      msgEl.innerHTML = `<div class="comment-error">Couldn't post your comment — try again in a moment.</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Post comment";
    }
  }

  loadSong();
