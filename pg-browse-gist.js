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

  function highlight(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    const idx = safe.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return safe;
    return safe.slice(0, idx) + "<mark>" + safe.slice(idx, idx + q.length) + "</mark>" + safe.slice(idx + q.length);
  }

  const PAGE_SIZE = 10;
  let allPosts = [];
  let query = "";
  let activeCategory = "All";
  let sort = "newest";
  let visibleCount = PAGE_SIZE;

  function getFiltered() {
    let list = allPosts.filter(p => {
      const matchesCategory = activeCategory === "All" || (p.category || "") === activeCategory;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || p.title.toLowerCase().includes(q) || (p.body || "").toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
    if (sort === "newest") list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (sort === "reads") list.sort((a, b) => (b.reads || 0) - (a.reads || 0));
    else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }

  function postDest(p) {
    return `/gist/${p.slug || p.id}`;
  }

  function render() {
    const filtered = getFiltered();
    const visible = filtered.slice(0, visibleCount);
    const countEl = document.getElementById("resultsCount");
    const grid = document.getElementById("gistGrid");
    const loadMoreWrap = document.getElementById("loadMoreWrap");

    countEl.innerHTML = `<strong>${filtered.length}</strong> article${filtered.length !== 1 ? "s" : ""}`;

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="state-block-inner" style="grid-column:1/-1;">No articles found. Try a different search or filter.</div>`;
      loadMoreWrap.style.display = "none";
      return;
    }

    grid.innerHTML = visible.map(p => `
      <div class="gist-row" data-id="${p.id}">
        <div class="gr-art" style="${p.cover_url ? `background-image:url('${escapeHtml(p.cover_url)}')` : ""}"></div>
        <div class="gr-body">
          <span class="gr-cat">${escapeHtml(p.category || "Gist")}</span>
          <div class="gr-title">${highlight(p.title, query)}</div>
          <div class="gr-meta">${timeAgo(p.created_at)} · ${formatCount(p.reads)} reads</div>
        </div>
        <div class="gr-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
      </div>
    `).join("");

    grid.querySelectorAll(".gist-row").forEach(card => {
      card.addEventListener("click", () => {
        const post = allPosts.find(p => String(p.id) === card.dataset.id);
        if (post) window.location.href = postDest(post);
      });
    });

    document.getElementById("loadMoreBtn").textContent = `See More (${Math.max(filtered.length - visibleCount, 0)} remaining)`;

    loadMoreWrap.style.display = visibleCount < filtered.length ? "block" : "none";
  }

  function renderCategoryChips() {
    const categories = Array.from(new Set(allPosts.map(p => (p.category || "").trim()).filter(Boolean)));
    const wrap = document.getElementById("categoryChips");
    wrap.innerHTML = `<button class="chip active" data-category="All">All</button>` +
      categories.map(c => `<button class="chip" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join("");

    wrap.querySelectorAll(".chip").forEach(chip => {
      chip.addEventListener("click", () => {
        wrap.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        activeCategory = chip.dataset.category;
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

  async function loadPosts() {
    try {
      const rows = await supabaseQuery("gist_articles", "status=eq.Published&select=*");
      allPosts = rows || [];
      renderCategoryChips();
      render();
    } catch (err) {
      console.error(err);
      document.getElementById("resultsCount").textContent = "";
      document.getElementById("gistGrid").innerHTML = `<div class="state-block-inner" style="grid-column:1/-1;">Couldn't load gist right now. Refresh to try again.</div>`;
    }
  }

  loadPosts();
