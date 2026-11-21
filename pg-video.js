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
    if (!res.ok) throw new Error(`Failed to save to ${table}`);
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

  function timeAgo(dateString) {
    if (!dateString) return "";
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    return days + "d ago";
  }

  function initials(name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"/></svg>`;
  const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_HEART = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.1 1.4 6.6 4.4 5.1c2.3-1.2 4.9-.4 6.3 1.4l1.3 1.6 1.3-1.6c1.4-1.8 4-2.6 6.3-1.4 3 1.5 3.6 5 1.7 7.8C18.7 16.65 12 21 12 21z"/></svg>`;
  const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`;

  const params = new URLSearchParams(window.location.search);
  if (window.__PRETTY) params.set(window.__PRETTY.k, window.__PRETTY.v);
  const videoSlug = params.get("slug");
  const videoId = params.get("id");
  const wrap = document.getElementById("videoWrap");
  let currentVideo = null;
  let liked = false;

  function renderNotFound() {
    wrap.innerHTML = `
      <div class="page-empty">
        <h2>Video not found</h2>
        <p>This video may have been removed, or the link is incorrect.</p>
      </div>`;
  }

  const postedDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
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

  function renderVideo(v) {
    currentVideo = v;
    document.title = `${v.title} — MyGospelHub`;
    setSeo(document.title, v.description || `Watch "${v.title}" by ${v.artist} on MyGospelHub.`, "video.html", v.slug || v.id);

    const hasFile = Boolean(v.file_url);
    const externalUrl = v.video_url || v.streaming_link || "";
    const hasExternal = !hasFile && Boolean(externalUrl);
    const embedSrc = hasExternal ? toEmbed(externalUrl) : "";

    wrap.innerHTML = `
      <div class="np-bar">
        <button class="np-btn" id="npBack" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <span class="np-label">Now watching</span>
        <button class="np-btn" id="npMore" aria-label="Share"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
      </div>
      <div class="breadcrumb"><a href="/">Home</a> / <a href="/browse-video">Videos</a> / ${escapeHtml(v.title)}</div>

      <div class="posted-by">Posted By: <strong>${escapeHtml(v.uploaded_by || "MyGospelHub")}</strong>${v.created_at ? `<span class="pb-dot">•</span><span>${postedDate(v.created_at)}</span>` : ""}</div>

      ${hasFile ? `
        <div class="video-player">
          <video id="videoEl" src="${escapeHtml(v.file_url)}" controls preload="metadata" playsinline></video>
        </div>
      ` : embedSrc ? `
        ${v.cover_url ? `<div class="video-cover"><img src="${escapeHtml(v.cover_url)}" alt="${escapeHtml(v.title)}"></div>` : ""}
      ` : hasExternal ? `
        <div class="video-placeholder" id="videoPlaceholder">
          ${v.cover_url ? `<img src="${escapeHtml(v.cover_url)}" alt="">` : ""}
          <div class="video-placeholder-content">
            <p>This video plays on an external platform</p>
            <button class="watch-btn" id="externalWatchBtn">${ICON_PLAY} Watch Now</button>
          </div>
        </div>
      ` : `
        <div class="video-placeholder">
          <div class="video-placeholder-content"><p>No video source available yet</p></div>
        </div>
      `}

      <div class="video-tags">
        ${v.genre ? `<span class="video-tag">${escapeHtml(v.genre)}</span>` : ""}
        ${v.year ? `<span class="video-tag">${escapeHtml(String(v.year))}</span>` : ""}
      </div>
      <h1 class="video-title">${escapeHtml(v.title)}</h1>
      <div class="video-artist">${MGH.artistHtml(v.artist)}</div>

      ${v.description ? `<p class="video-desc">${MGH.linkText(v.description, v.artist)}</p>` : ""}

      ${embedSrc ? `
        <div class="video-player">
          <iframe id="videoFrame" src="${escapeHtml(embedSrc)}" title="${escapeHtml(v.title)}" style="width:100%;height:100%;border:0;display:block;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>
        </div>
        <p style="font-size:12px;color:var(--text-dim);margin:-10px 0 18px;">Video not loading? <a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener" style="color:var(--gold);">Open it on ${embedSrc.includes("vimeo") ? "Vimeo" : "YouTube"}</a></p>
      ` : ""}

      <div class="stats-row">
        <div class="stat"><div class="stat-value">${formatCount(v.views)}</div><div class="stat-label">Views</div></div>
        <div class="stat"><div class="stat-value">${formatCount(v.downloads)}</div><div class="stat-label">Downloads</div></div>
        <div class="stat"><div class="stat-value" id="likeCount">${formatCount(v.likes)}</div><div class="stat-label">Likes</div></div>
      </div>

      <div class="actions-row">
        ${hasFile ? `<button class="action-btn action-download" id="downloadBtn">${ICON_DOWNLOAD} Download</button>` : ""}
        <button class="action-btn action-like" id="likeBtn">${ICON_HEART} <span id="likeBtnCount">${formatCount(v.likes)}</span></button>
        <button class="action-btn action-share" id="shareBtn">${ICON_SHARE}<span class="al">Share</span></button>
      </div>

      <div id="relatedWrap"></div>

      <div class="comments-section">
        <div class="comments-head">Comments <span class="count" id="commentCount"></span></div>

        <div class="comment-form">
          <div id="commentMsg"></div>
          <div class="comment-form-row">
            <input type="text" id="commentName" placeholder="Your name" maxlength="60">
            <input type="email" id="commentEmail" placeholder="Email (optional)" maxlength="120">
          </div>
          <textarea id="commentText" placeholder="Share your thoughts on this video…" maxlength="600"></textarea>
          <div class="comment-form-foot">
            <span class="comment-hint">No account needed</span>
            <button class="comment-submit" id="commentSubmit">Post comment</button>
          </div>
        </div>

        <div class="comment-list" id="commentList">
          <div class="state-block">Loading comments…</div>
        </div>
      </div>

      <div id="followWrap"></div>
    `;

    wireActions(v, hasFile, hasExternal, externalUrl);
    loadRelated(v);
    loadComments(v.id);
    wireCommentForm(v.id);
    loadFollowSection(v);
  }

  function wireActions(v, hasFile, hasExternal, externalUrl) {
    if (hasFile) {
      const videoEl = document.getElementById("videoEl");
      let hasCountedView = false;
      videoEl.addEventListener("play", () => {
        if (!hasCountedView) {
          hasCountedView = true;
          supabaseRpc("increment_views", { row_id: v.id });
        }
      });
    }

    const frame = document.getElementById("videoFrame");
    if (frame) {
      // Count one view the first time the viewer taps inside the embedded player.
      let counted = false;
      window.addEventListener("blur", () => {
        setTimeout(() => {
          if (!counted && document.activeElement === frame) {
            counted = true;
            supabaseRpc("increment_views", { row_id: v.id });
          }
        }, 0);
      });
    }

    if (hasExternal && document.getElementById("externalWatchBtn")) {
      document.getElementById("externalWatchBtn").addEventListener("click", () => {
        supabaseRpc("increment_views", { row_id: v.id });
        window.open(externalUrl, "_blank", "noopener,noreferrer");
      });
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", async () => {
        supabaseRpc("increment_downloads", { row_id: v.id });
        try {
          const res = await fetch(v.file_url);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `${v.title} - ${v.artist}`.replace(/[^\w\s-]/g, "") || "video";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(blobUrl);
        } catch (err) {
          window.open(v.file_url, "_blank");
        }
      });
    }
    const nb = document.getElementById("npBack"); if (nb) nb.addEventListener("click", () => { if (history.length > 1) history.back(); else location.href = "browse-video.html"; });
    const nm = document.getElementById("npMore"); if (nm) nm.addEventListener("click", () => { const b = document.getElementById("shareBtn"); if (b) b.click(); });


    document.getElementById("likeBtn").addEventListener("click", async (e) => {
      if (liked) return; // one like per page visit, keeps it simple and honest
      liked = true;
      e.currentTarget.classList.add("liked");
      const newCount = (v.likes || 0) + 1;
      v.likes = newCount;
      document.getElementById("likeCount").textContent = formatCount(newCount);
      document.getElementById("likeBtnCount").textContent = formatCount(newCount);
      await supabaseRpc("increment_likes", { row_id: v.id });
    });

    document.getElementById("shareBtn").addEventListener("click", async () => {
const url = v.slug ? `${window.location.origin}/video/${encodeURIComponent(v.slug)}` : `${window.location.origin}/video/${v.id}`;
      const shareData = { title: v.title, text: `${v.title} — ${v.artist} on MyGospelHub`, url };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) {}
      } else {
        await navigator.clipboard.writeText(url);
        const btn = document.getElementById("shareBtn");
        const original = btn.innerHTML;
        btn.textContent = "✓ Link copied";
        setTimeout(() => { btn.innerHTML = original; }, 1800);
      }
    });
  }

  const ICON_OPEN = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const ICON_DL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

  // Card for a song or video in "More ..." / "Recent Posts": same design as the Music page.
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
          <button class="tc-btn play" data-act="open" aria-label="Open ${escapeHtml(r.title)}">${ICON_OPEN}</button>
          <button class="tc-btn dl" data-act="download" aria-label="Download ${escapeHtml(r.title)}" ${canDl ? "" : "disabled"}>${ICON_DL}</button>
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
        try { supabaseRpc("increment_downloads", { row_id: item.id }); } catch (err) {}
        await MGH.downloadSong(item);
        return;
      }
      window.location.href = card.dataset.href;
    });
  }

  async function loadRelated(v) {
    const relWrap = document.getElementById("relatedWrap");
    try {
      const results = await supabaseQuery(
        "content",
        `status=eq.Published&type=eq.Video&id=neq.${v.id}&order=views.desc&limit=4`
      );
      if (!results || results.length === 0) { relWrap.innerHTML = ""; return; }
      relWrap.innerHTML = `
        <div class="related-label">More videos</div>
        <div class="tc-list" id="relatedList">
          ${results.map(r => itemCardHtml(r, [r.year, `${formatCount(r.views)} views`].filter(Boolean).join(" • "))).join("")}
        </div>
      `;
      wireItemCards(relWrap.querySelector("#relatedList"), results);
    } catch (e) {
      relWrap.innerHTML = "";
    }
  }

  async function loadComments(contentId) {
    const list = document.getElementById("commentList");
    const countEl = document.getElementById("commentCount");
    try {
      const comments = await supabaseQuery(
        "comments",
        `content_id=eq.${contentId}&status=eq.Visible&order=created_at.desc`
      );
      countEl.textContent = comments.length ? `(${comments.length})` : "";
      if (!comments || comments.length === 0) {
        list.innerHTML = `<div class="state-block">Be the first to comment on this video.</div>`;
        return;
      }
      list.innerHTML = comments.map(c => `
        <div class="comment">
          <div class="comment-avatar">${escapeHtml(initials(c.guest_name))}</div>
          <div class="comment-body">
            <div class="comment-name">${escapeHtml(c.guest_name || "Anonymous")} <span>${timeAgo(c.created_at)}</span></div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
          </div>
        </div>
      `).join("");
    } catch (e) {
      list.innerHTML = `<div class="state-block">Couldn't load comments right now.</div>`;
    }
  }

  async function loadFollowSection(v) {
    const wrap = document.getElementById("followWrap");
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

    try {
      const rows = await supabaseQuery(
        "content",
        `status=eq.Published&id=neq.${v.id}&order=created_at.desc&limit=4&select=*`
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
    } catch (e) {
      document.getElementById("recentPostsList").innerHTML = `<div class="state-block">Couldn't load recent posts.</div>`;
    }
  }

  function wireCommentForm(contentId) {
    const submitBtn = document.getElementById("commentSubmit");
    const nameInput = document.getElementById("commentName");
    const emailInput = document.getElementById("commentEmail");
    const textInput = document.getElementById("commentText");
    const msg = document.getElementById("commentMsg");

    submitBtn.addEventListener("click", async () => {
      msg.innerHTML = "";
      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const text = textInput.value.trim();

      if (!name || !text) {
        msg.innerHTML = `<div class="comment-error">Please add your name and a comment.</div>`;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Posting…";

      try {
        await supabaseInsert("comments", {
          content_id: contentId,
          guest_name: name,
          guest_email: email || null,
          text: text,
          status: "Visible",
        });
        nameInput.value = "";
        emailInput.value = "";
        textInput.value = "";
        msg.innerHTML = `<div class="comment-success">Comment posted!</div>`;
        loadComments(contentId);
      } catch (e) {
        msg.innerHTML = `<div class="comment-error">Couldn't post your comment. Please try again.</div>`;
      }

      submitBtn.disabled = false;
      submitBtn.textContent = "Post comment";
    });
  }

  async function init() {
    if (!videoSlug && !videoId) {
      renderNotFound();
      return;
    }
    try {
      const filter = videoSlug ? `slug=eq.${encodeURIComponent(videoSlug)}` : `id=eq.${videoId}`;
      const results = await supabaseQuery("content", `${filter}&status=eq.Published&type=eq.Video&limit=1`);
      if (!results || results.length === 0) {
        renderNotFound();
        return;
      }
      renderVideo(results[0]);
    } catch (e) {
      renderNotFound();
    }
  }

  init();
