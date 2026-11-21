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

  const ICON_HEART = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-6.7-4.35-9.3-8.1C.8 10.1 1.4 6.6 4.4 5.1c2.3-1.2 4.9-.4 6.3 1.4l1.3 1.6 1.3-1.6c1.4-1.8 4-2.6 6.3-1.4 3 1.5 3.6 5 1.7 7.8C18.7 16.65 12 21 12 21z"/></svg>`;
  const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>`;

  // Bold: wrap words in *stars* or **double stars** in the article text.
  function formatBody(text) {
    return (window.MGH ? MGH.linkText(text || "", "") : escapeHtml(text || ""))
      .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*\n]+?)\*/g, "<strong>$1</strong>");
  }
  const params = new URLSearchParams(window.location.search);
  if (window.__PRETTY) params.set(window.__PRETTY.k, window.__PRETTY.v);
  const gistSlug = params.get("slug");
  const gistIdParam = params.get("id");
  const wrap = document.getElementById("articleWrap");
  let currentPost = null;
  let liked = false;

  function renderNotFound() {
    wrap.innerHTML = `
      <div class="page-empty">
        <h2>Article not found</h2>
        <p>This story may have been removed, or the link is incorrect.</p>
      </div>`;
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
  function renderArticle(post) {
    currentPost = post;
    document.title = `${post.title} — MyGospelHub`;
    setSeo(document.title, String(post.body || post.title).replace(/\*/g, ""), "gist-post.html", post.slug || post.id);

    wrap.innerHTML = `
      <div class="np-bar">
        <button class="np-btn" id="npBack" aria-label="Back"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
        <span class="np-label">Gist</span>
        <button class="np-btn" id="npMore" aria-label="Share"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
      </div>
      <div class="breadcrumb"><a href="/">Home</a> / <a href="/browse-gist">Gist</a> / ${escapeHtml(post.category || "Gist")}</div>

      <span class="article-cat">${escapeHtml(post.category || "Gist")}</span>
      <h1 class="article-title">${escapeHtml(post.title)}</h1>
      <div class="article-meta">
        <span>Posted By: ${escapeHtml(post.uploaded_by || "MyGospelHub")}</span>
        <span class="dot-sep">·</span>
        <span>${timeAgo(post.created_at)}</span>
      </div>

      ${post.cover_url ? `<div class="article-cover"><img src="${escapeHtml(post.cover_url)}" alt=""></div>` : ""}

      <div class="article-body">${formatBody(post.body)}</div>

      <div class="stats-row">
        <div class="stat"><div class="stat-value" id="statReads">${formatCount(post.reads)}</div><div class="stat-label">Reads</div></div>
        <div class="stat"><div class="stat-value" id="statLikes">${formatCount(post.likes)}</div><div class="stat-label">Likes</div></div>
      </div>

      <div class="article-actions">
        <button class="action-like" id="likeBtn">${ICON_HEART} <span id="likeBtnCount">${formatCount(post.likes)}</span></button>
        <button class="action-share" id="shareBtn">${ICON_SHARE} Share</button>
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
          <textarea id="commentText" placeholder="What do you think about this story?" maxlength="600"></textarea>
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

    wireActions(post);
    loadRelated(post);
    loadComments(post.id);
    wireCommentForm(post.id);
    loadFollowSection(post);
  }

  function wireActions(post) {
    document.getElementById("npBack").addEventListener("click", () => { if (history.length > 1) history.back(); else location.href = "browse-gist.html"; });
    document.getElementById("npMore").addEventListener("click", () => document.getElementById("shareBtn").click());
    document.getElementById("likeBtn").addEventListener("click", async (e) => {
      if (liked) return; // one like per page visit, keeps it simple and honest
      liked = true;
      e.currentTarget.classList.add("liked");
      const newCount = (post.likes || 0) + 1;
      post.likes = newCount;
      document.getElementById("statLikes").textContent = formatCount(newCount);
      document.getElementById("likeBtnCount").textContent = formatCount(newCount);
      await supabaseRpc("increment_gist_likes", { row_id: post.id });
    });

    document.getElementById("shareBtn").addEventListener("click", async () => {
      const url = post.slug ? `${window.location.origin}/gist/${encodeURIComponent(post.slug)}` : `${window.location.origin}/gist/${post.id}`;
      const shareData = { title: post.title, text: post.title, url };
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

  async function loadRelated(post) {
    const relWrap = document.getElementById("relatedWrap");
    try {
      const results = await supabaseQuery(
        "gist_articles",
        `status=eq.Published&category=eq.${encodeURIComponent(post.category || "")}&id=neq.${post.id}&order=created_at.desc&limit=4`
      );
      if (!results || results.length === 0) { relWrap.innerHTML = ""; return; }
      relWrap.innerHTML = `
        <div class="related-label">More in ${escapeHtml(post.category || "Gist")}</div>
        <div class="tc-list" id="relatedList">
          ${results.map(r => `
            <div class="gist-row" data-href="/gist/${encodeURIComponent(r.slug || r.id)}">
              <div class="gr-art" style="${r.cover_url ? `background-image:url('${escapeHtml(r.cover_url)}')` : ""}"></div>
              <div class="gr-body">
                <span class="gr-cat">${escapeHtml(r.category || "Gist")}</span>
                <div class="gr-title">${escapeHtml(r.title)}</div>
                <div class="gr-meta">${timeAgo(r.created_at)}${r.reads != null ? ` · ${formatCount(r.reads)} reads` : ""}</div>
              </div>
              <div class="gr-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
            </div>
          `).join("")}
        </div>
      `;
      relWrap.querySelector("#relatedList").addEventListener("click", (e) => {
        const row = e.target.closest(".gist-row");
        if (row) window.location.href = row.dataset.href;
      });
    } catch (e) {
      relWrap.innerHTML = "";
    }
  }

  async function loadComments(gistId) {
    const list = document.getElementById("commentList");
    const countEl = document.getElementById("commentCount");
    try {
      const comments = await supabaseQuery(
        "comments",
        `gist_id=eq.${gistId}&status=eq.Visible&order=created_at.desc`
      );
      countEl.textContent = comments.length ? `(${comments.length})` : "";
      if (!comments || comments.length === 0) {
        list.innerHTML = `<div class="state-block">Be the first to comment on this story.</div>`;
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

  // Related Posts: other news, most-read first.
  async function loadRelatedNews(post) {
    const wrap = document.getElementById("relatedNewsWrap");
    if (!wrap) return;
    try {
      const rows = await supabaseQuery(
        "gist_articles",
        `status=eq.Published&id=neq.${post.id}&order=reads.desc.nullslast,created_at.desc&limit=5`
      );
      if (!rows || rows.length === 0) { wrap.innerHTML = ""; return; }
      wrap.innerHTML = `
        <div class="related-label">Related Posts</div>
        <div class="tc-list" id="relatedNewsList">
          ${rows.map(r => `
            <div class="gist-row" data-href="/gist/${encodeURIComponent(r.slug || r.id)}">
              <div class="gr-art" style="${r.cover_url ? `background-image:url('${escapeHtml(r.cover_url)}')` : ""}"></div>
              <div class="gr-body">
                <span class="gr-cat">${escapeHtml(r.category || "Gist")}</span>
                <div class="gr-title">${escapeHtml(r.title)}</div>
                <div class="gr-meta">${timeAgo(r.created_at)} · ${formatCount(r.reads || 0)} reads</div>
              </div>
              <div class="gr-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
            </div>
          `).join("")}
        </div>`;
    } catch (e) {
      wrap.innerHTML = "";
    }
  }

  async function loadFollowSection(post) {
    const wrap = document.getElementById("followWrap");
    wrap.innerHTML = `
      <div class="related-label">Recent Posts</div>
      <div id="recentPostsList"><div class="state-block">Loading…</div></div>

      <div id="relatedNewsWrap"></div>

      <div class="follow-us">
        <div class="related-label">Follow Us On</div>
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

    loadRelatedNews(post);

    try {
      const rows = await supabaseQuery(
        "content",
        `status=eq.Published&order=created_at.desc&limit=4&select=*`
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

  function wireCommentForm(gistId) {
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
          gist_id: gistId,
          guest_name: name,
          guest_email: email || null,
          text: text,
          status: "Visible",
        });
        nameInput.value = "";
        emailInput.value = "";
        textInput.value = "";
        msg.innerHTML = `<div class="comment-success">Comment posted!</div>`;
        loadComments(gistId);
      } catch (e) {
        msg.innerHTML = `<div class="comment-error">Couldn't post your comment. Please try again.</div>`;
      }

      submitBtn.disabled = false;
      submitBtn.textContent = "Post comment";
    });
  }

  async function init() {
    if (!gistSlug && !gistIdParam) {
      renderNotFound();
      return;
    }
    try {
      const filter = gistSlug ? `slug=eq.${encodeURIComponent(gistSlug)}` : `id=eq.${gistIdParam}`;
      const results = await supabaseQuery("gist_articles", `${filter}&status=eq.Published&limit=1`);
      if (!results || results.length === 0) {
        renderNotFound();
        return;
      }
      renderArticle(results[0]);
      supabaseRpc("increment_gist_reads", { row_id: results[0].id }); // count the visit as a read
    } catch (e) {
      renderNotFound();
    }
  }

  init();
