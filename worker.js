// Cloudflare Worker: serves the static site and handles share-preview links
// (/song/<slug>, /video/<slug>, /gist/<slug>, plus the old /api/... links) so WhatsApp/Facebook show the real
// title, description and cover image.

const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";
const DEFAULT_IMAGE = "https://mygospelhub.com.ng/og-image.jpg";

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const looksLikeId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || /^\d+$/.test(v);

// ---------- Server-rendered song / video / gist pages (so Google sees real content) ----------
const PAGES = {
  song:  { table: "content", extra: "", file: "/song", loading: '<div class="state-block">Loading song…</div>', ogType: "music.song" },
  video: { table: "content", extra: "&type=eq.Video", file: "/video", loading: '<div class="state-block">Loading video…</div>', ogType: "video.other" },
  gist:  { table: "gist_articles", extra: "", file: "/gist-post", loading: '<div class="state-block">Loading article…</div>', ogType: "article" },
};
const API_KIND = { "/api/song": "song", "/api/video": "video", "/api/gist-post": "gist" };

async function fetchRow(kind, slug, id) {
  const cfg = PAGES[kind];
  const filter = slug ? `slug=eq.${encodeURIComponent(slug)}` : `id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${cfg.table}?${filter}&status=eq.Published${cfg.extra}&select=*&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getAsset(env, origin, file) {
  let res = await env.ASSETS.fetch(new Request(origin + file));
  for (let i = 0; i < 2 && res.status >= 300 && res.status < 400 && res.headers.get("location"); i++) {
    res = await env.ASSETS.fetch(new Request(new URL(res.headers.get("location"), origin)));
  }
  return res;
}

const cut = (s, n) => String(s || "").replace(/\*|\[\[|\]\]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const nameLinks = (h) => h.replace(/\[\[([^\]\n]+?)\]\]/g, (m, n) => `<a href="/artist.html?name=${encodeURIComponent(n.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim())}">${n}</a>`);
const bold = (h) => h.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>").replace(/\*([^*\n]+?)\*/g, "<strong>$1</strong>");
const nl2p = (s) => String(s || "").split(/\n{2,}/).map((p) => `<p>${nameLinks(bold(esc(p.trim()))).replace(/\n/g, "<br>")}</p>`).join("");

function seoParts(kind, row, canonical) {
  const by = row.artist ? ` — ${row.artist}` : "";
  let title, desc, body, ld;
  const image = row.cover_url || row.thumbnail_url || DEFAULT_IMAGE;
  if (kind === "gist") {
    title = `${row.title} | MyGospelHub`;
    desc = cut(row.meta_description, 160) || cut(row.body, 155) || `Read "${row.title}" on MyGospelHub.`;
    body = `<article class="seo-article"><h1>${esc(row.title)}</h1><p><em>${esc(row.category)}${row.uploaded_by ? " · By " + esc(row.uploaded_by) : ""}</em></p>${nl2p(row.body)}</article>`;
    ld = { "@context": "https://schema.org", "@type": "Article", headline: row.title, image: [image], datePublished: row.created_at, author: { "@type": "Organization", name: row.uploaded_by || "MyGospelHub" }, publisher: { "@type": "Organization", name: "MyGospelHub" }, mainEntityOfPage: canonical };
  } else if (kind === "video") {
    title = `${row.title}${by} | MyGospelHub`;
    desc = cut(row.description, 155) || `Watch "${row.title}"${row.artist ? " by " + row.artist : ""} on MyGospelHub.`;
    body = `<article class="seo-article"><h1>${esc(row.title)}</h1><p><em>${esc(row.artist)}${row.genre ? " · " + esc(row.genre) : ""}</em></p>${nl2p(row.description)}</article>`;
    ld = { "@context": "https://schema.org", "@type": "VideoObject", name: row.title, description: desc, thumbnailUrl: [image], uploadDate: row.created_at, url: canonical };
  } else {
    title = `${row.title}${by} | MyGospelHub`;
    desc = cut(row.description, 155) || `Listen to and download "${row.title}"${row.artist ? " by " + row.artist : ""} on MyGospelHub.`;
    body = `<article class="seo-article"><h1>${esc(row.title)}</h1><p><em>${esc(row.artist)}${row.genre ? " · " + esc(row.genre) : ""}${row.year ? " · " + esc(row.year) : ""}</em></p>${nl2p(row.description)}${row.lyrics ? "<h2>Lyrics</h2>" + nl2p(row.lyrics) : ""}</article>`;
    ld = { "@context": "https://schema.org", "@type": "MusicRecording", name: row.title, byArtist: { "@type": "MusicGroup", name: row.artist || "Unknown" }, image: [image], datePublished: row.created_at, description: desc, url: canonical, genre: row.genre || undefined };
  }
  return { title, desc, body, image, ld };
}

async function renderPage(kind, request, env, slug, id) {
  const url = new URL(request.url);
  const cfg = PAGES[kind];
  const assetRes = await getAsset(env, url.origin, cfg.file);
  let row = null;
  try { row = await fetchRow(kind, slug, id); } catch (e) { row = null; }
  if (!row || !assetRes.ok) {
    // Not found: show the normal page (it explains), but tell Google it is gone.
    return new Response(assetRes.body, { status: row ? assetRes.status : 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": row ? "all" : "noindex" } });
  }
  const canonical = `${url.origin}/${kind}/${encodeURIComponent(row.slug || row.id)}`;
  const p = seoParts(kind, row, canonical);
  let html = await assetRes.text();
  const head = `<base href="/">
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:image" content="${esc(p.image)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="${cfg.ogType}">
<meta property="og:site_name" content="MyGospelHub">
<meta property="og:image:alt" content="${esc(p.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.desc)}">
<meta name="twitter:image" content="${esc(p.image)}">
<script type="application/ld+json">${JSON.stringify(p.ld).replace(/</g, "\\u003c")}</script>
<script>window.__PRETTY=${JSON.stringify({ k: "id", v: row.id }).replace(/</g, "\\u003c")};</script>
<style>.seo-article{max-width:760px;margin:0 auto;padding:8px 4px;line-height:1.7}.seo-article h1{font-size:28px;margin:0 0 6px}.seo-article p{margin:0 0 14px}</style>`;
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(p.title)}</title>`)
    .replace(/<meta\s+(?:name|property)="(?:description|og:[^"]*|twitter:[^"]*)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "")
    .replace(/<head>/i, `<head>\n${head}`)
    .replace(cfg.loading, p.body);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

// Old links (/api/song?id=..., /song.html?...) go to the new clean address.
async function legacyRedirect(kind, url) {
  const slug = url.searchParams.get("slug");
  const id = url.searchParams.get("id");
  if (!slug && !id) return Response.redirect(`${url.origin}/${kind === "gist" ? "browse-gist.html" : kind === "video" ? "browse-video.html" : "music.html"}`, 302);
  let row = null;
  try { row = await fetchRow(kind, slug, id); } catch (e) {}
  const target = row ? `${url.origin}/${kind}/${encodeURIComponent(row.slug || row.id)}` : `${url.origin}/${kind === "gist" ? "gist-post" : kind}.html?${slug ? "slug=" + encodeURIComponent(slug) : "id=" + encodeURIComponent(id)}`;
  return Response.redirect(target, 301);
}

// Sitemap for Google: static pages + every published song, video and gist.
const SITE = "https://mygospelhub.com.ng";
const STATIC_PAGES = ["", "music", "browse-video", "browse-gist", "about", "contact", "privacy", "terms"];

async function sbList(table, select) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?status=eq.Published&select=${select}&order=created_at.desc&limit=1000`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const rows = await r.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) { return []; }
}

async function sitemap() {
  const [content, gist] = await Promise.all([
    sbList("content", "id,slug,type,created_at,artist"),
    sbList("gist_articles", "id,slug,created_at"),
  ]);
  const day = (iso) => (iso ? `<lastmod>${String(iso).slice(0, 10)}</lastmod>` : "");
  const urls = [];
  STATIC_PAGES.forEach((p) => urls.push(`<url><loc>${SITE}/${p}</loc></url>`));
  content.forEach((c) => {
    const kind = c.type === "Video" ? "video" : "song";
    urls.push(`<url><loc>${SITE}/${kind}/${encodeURIComponent(c.slug || c.id)}</loc>${day(c.created_at)}</url>`);
  });
  gist.forEach((g) => urls.push(`<url><loc>${SITE}/gist/${encodeURIComponent(g.slug || g.id)}</loc>${day(g.created_at)}</url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}


// Storage proxy: song files and cover images are served through Cloudflare's cache, so Supabase
// only sends each file once instead of on every visit (saves Supabase egress).
async function storageProxy(request, url) {
  const m = url.pathname.match(/^\/s\/(covers|media)\/(.+)$/);
  if (!m || (request.method !== "GET" && request.method !== "HEAD")) return new Response("Not found", { status: 404 });
  const upstream = `${SUPABASE_URL}/storage/v1/object/public/${m[1]}/${m[2]}`;
  const headers = {};
  const range = request.headers.get("Range");
  if (range) headers["Range"] = range;
  const res = await fetch(upstream, { method: request.method, headers, cf: { cacheEverything: true, cacheTtl: 2592000, cacheTtlByStatus: { "200-299": 2592000, "404": 60, "500-599": 0 } } });
  const out = new Response(res.body, res);
  out.headers.set("Cache-Control", "public, max-age=2592000, immutable");
  out.headers.set("Access-Control-Allow-Origin", "*");
  out.headers.delete("Set-Cookie");
  return out;
}

// ---------- AI Content Studio (admin only, Cloudflare Workers AI, free tier) ----------
// Swap AI_MODEL to change model; no API key needed (uses the env.AI binding).
const AI_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const ADMIN_ORIGINS = ["https://mygospelhub-admin-2n9k-six.vercel.app"];
const AI_CATEGORIES = ["Concert","Rumor","Community","Release","Church Life","Music Tips","Worship","Devotional","Faith and Encouragement","Artist Spotlight","Entertainment","Sports","Politics","Health and Well-being","General"];
const aiHits = new Map(); // best-effort per-isolate rate limit

function aiCors(request) {
  const o = request.headers.get("Origin");
  const h = { "Vary": "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400" };
  if (ADMIN_ORIGINS.includes(o)) h["Access-Control-Allow-Origin"] = o;
  return h;
}
const aiJson = (request, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...aiCors(request) } });

async function aiAdmin(request, env) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return aiJson(request, { error: "Please sign in again." }, 401);
  const auth = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: auth });
  if (!ur.ok) return aiJson(request, { error: "Please sign in again." }, 401);
  const user = await ur.json();
  const pr = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role&limit=1`, { headers: auth });
  const prof = pr.ok ? await pr.json() : [];
  if (!prof[0] || !["admin", "super_admin"].includes(prof[0].role)) return aiJson(request, { error: "Admins only." }, 403);
  return { user };
}

async function aiDraft(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: aiCors(request) });
  if (request.method !== "POST") return aiJson(request, { error: "Method not allowed" }, 405);
  if (!ADMIN_ORIGINS.includes(request.headers.get("Origin"))) return aiJson(request, { error: "Forbidden" }, 403);
  if (!env.AI) return aiJson(request, { error: "AI is not set up on this Worker yet (add the AI binding)." }, 503);

  const who = await aiAdmin(request, env);
  if (who instanceof Response) return who;
  const user = who.user;

  const now = Date.now();
  const hits = (aiHits.get(user.id) || []).filter((t) => now - t < 3600000);
  if (hits.length >= 20) return aiJson(request, { error: "Too many requests. Try again in a while." }, 429);
  hits.push(now); aiHits.set(user.id, hits);

  let b; try { b = await request.json(); } catch { return aiJson(request, { error: "Bad request" }, 400); }
  const facts = String(b.facts || "").replace(/https?:\/\/\S+/g, "").trim().slice(0, 8000);
  if (facts.length < 20) return aiJson(request, { error: "Paste the facts or notes first (at least a couple of sentences)." }, 400);
  const tone = String(b.tone || "warm, clear, professional").slice(0, 80);

  const system = "You are an editor for MyGospelHub, a Nigerian gospel music and entertainment website. Write an original article using ONLY the facts supplied by the editor. Never invent facts, names, dates, numbers or quotes. If something is not in the facts, leave it out. Do not copy sentences from the source; rewrite in your own words. No clickbait. You cannot open links or browse the web, so ignore any mention of links or sources you cannot read. NEVER refuse and never ask for more information: if the facts are thin, write a shorter careful news brief (120-200 words) using only what is given, and keep a neutral tone. Body: plain text paragraphs separated by blank lines, up to 450 words, no markdown, no headings. Reply in EXACTLY this format and nothing else:\nTITLE: <headline, max 70 characters>\nCATEGORY: <one of: " + AI_CATEGORIES.join(", ") + ">\nMETA: <Google description, max 155 characters>\nBODY:\n<the article>";
  let out;
  try {
    out = await env.AI.run(AI_MODEL, {
      messages: [{ role: "system", content: system }, { role: "user", content: `Tone: ${tone}\n\nFACTS / NOTES FROM EDITOR:\n${facts}` }],
      max_tokens: 1600,
      chat_template_kwargs: { enable_thinking: false },
    });
  } catch (e) { return aiJson(request, { error: "AI is busy or the free daily limit is used up. Try again later." }, 502); }

  let text = out?.choices?.[0]?.message?.content ?? out?.response ?? out?.result?.response ?? "";
  if (Array.isArray(text)) text = text.map((x) => x?.text || "").join("");
  text = String(text).replace(/^```[a-z]*\n?|```$/gim, "").trim();
  const g = (re) => { const m = text.match(re); return m ? m[1].trim() : ""; };
  const title = g(/^\s*\**TITLE\**:\**\s*(.+)$/im);
  const category = g(/^\s*\**CATEGORY\**:\**\s*(.+)$/im).replace(/[*"]/g, "");
  const meta = g(/^\s*\**META\**:\**\s*(.+)$/im);
  const bm = text.match(/^\s*\**BODY\**:\**\s*\n?([\s\S]+)$/im);
  const body = bm ? bm[1].trim() : "";
  if (!title || body.length < 100) return aiJson(request, { error: "The AI reply was not usable. Please try again.", debug: text.slice(0, 300) }, 502);
  return aiJson(request, {
    title: title.replace(/^["*]+|["*]+$/g, "").slice(0, 120),
    category: AI_CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase()) || "General",
    body,
    meta_description: meta.replace(/^["*]+|["*]+$/g, "").slice(0, 160),
  });
}


// ---------- News leads collector (daily cron + admin "Fetch now") ----------
const LEAD_QUERIES = [
  "Nigerian gospel music", "Nigerian gospel artist new song", "gospel music Nigeria concert",
  "Nigerian gospel singer", "Christian music Nigeria", "Nigeria entertainment gospel",
];
const decodeXml = (t) => String(t || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
const tagText = (x, tag) => { const m = x.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return m ? decodeXml(m[1]).trim() : ""; };

async function collectLeads(env) {
  const seen = new Set(), items = [], diag = [];
  const feeds = (q) => [
    ["google", `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-NG&gl=NG&ceid=NG:en`],
    ["bing", `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&cc=NG`],
  ];
  const cutoff = Date.now() - 10 * 86400000;
  for (const q of LEAD_QUERIES) {
    for (const [name, feed] of feeds(q)) {
      let got = 0, status = 0;
      try {
        const r = await fetch(feed, { headers: { "User-Agent": "Mozilla/5.0 (compatible; MyGospelHubBot/1.0)", "Accept": "application/rss+xml, text/xml, */*" } });
        status = r.status;
        if (r.ok) {
          const xml = await r.text();
          for (const it of xml.split("<item>").slice(1, 13)) {
            const url = tagText(it, "link"), title = tagText(it, "title");
            if (!url || !title || seen.has(url)) continue;
            const d = tagText(it, "pubDate"), ts = d ? new Date(d).getTime() : NaN;
            if (!isNaN(ts) && ts < cutoff) continue;
            seen.add(url); got++;
            const snippet = tagText(it, "description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            items.push({ title, url, source: tagText(it, "source") || tagText(it, "News:Source") || name, snippet, published_at: isNaN(ts) ? "" : new Date(ts).toISOString() });
          }
        }
      } catch (e) { status = -1; }
      diag.push(`${name}:${status}:${got}`);
      if (got > 0) break; // this feed worked for the query; skip the fallback
    }
  }
  if (!items.length) return { added: 0, found: 0, diag };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ai_ingest`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: env.INGEST_KEY, p_items: items }),
  });
  return { added: r.ok ? await r.json() : -1, found: items.length, diag, dbStatus: r.status };
}

async function aiFetchLeads(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: aiCors(request) });
  if (request.method !== "POST") return aiJson(request, { error: "Method not allowed" }, 405);
  if (!ADMIN_ORIGINS.includes(request.headers.get("Origin"))) return aiJson(request, { error: "Forbidden" }, 403);
  const who = await aiAdmin(request, env);
  if (who instanceof Response) return who;
  if (!env.INGEST_KEY) return aiJson(request, { error: "INGEST_KEY secret is not set on the Worker yet." }, 503);
  const res = await collectLeads(env);
  if (res.added < 0) return aiJson(request, { error: "Could not save leads (check that INGEST_KEY matches). DB status " + res.dbStatus }, 502);
  return aiJson(request, res);
}

// ---------- Post to the Facebook Page (admin only): cover photo + caption with the link ----------
const FB_GRAPH = "v22.0";
async function fbPost(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: aiCors(request) });
  if (request.method !== "POST") return aiJson(request, { error: "Method not allowed" }, 405);
  if (!ADMIN_ORIGINS.includes(request.headers.get("Origin"))) return aiJson(request, { error: "Forbidden" }, 403);
  const who = await aiAdmin(request, env);
  if (who instanceof Response) return who;
  if (!env.FB_PAGE_ID || !env.FB_PAGE_TOKEN) return aiJson(request, { error: "Facebook is not set up yet (FB_PAGE_ID and FB_PAGE_TOKEN missing on the Worker)." }, 503);
  let b; try { b = await request.json(); } catch { return aiJson(request, { error: "Bad request" }, 400); }
  const message = String(b.message || "").trim().slice(0, 5000);
  const image = String(b.image_url || "");
  if (message.length < 10) return aiJson(request, { error: "Write the caption first." }, 400);
  if (!image.startsWith(SUPABASE_URL + "/storage/") && !image.startsWith("https://mygospelhub.com.ng/")) return aiJson(request, { error: "This article needs a cover image from MyGospelHub first." }, 400);
  const body = new URLSearchParams({ url: image, caption: message, access_token: env.FB_PAGE_TOKEN, published: "true" });
  const r = await fetch(`https://graph.facebook.com/${FB_GRAPH}/${encodeURIComponent(env.FB_PAGE_ID)}/photos`, { method: "POST", body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) return aiJson(request, { error: "Facebook said: " + (d.error?.message || r.status) }, 502);
  return aiJson(request, { id: d.post_id || d.id });
}

export default {
  async scheduled(event, env, ctx) { if (env.INGEST_KEY) ctx.waitUntil(collectLeads(env)); },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/ai/draft") return aiDraft(request, env);
    if (url.pathname === "/api/ai/fetch-leads") return aiFetchLeads(request, env);
    if (url.pathname === "/api/fb/post") return fbPost(request, env);
    if (url.pathname === "/sitemap.xml") return sitemap();
    if (url.pathname.startsWith("/s/")) return storageProxy(request, url);
    const path = url.pathname.replace(/\/$/, "");
    try {
      if (API_KIND[path]) return await legacyRedirect(API_KIND[path], url);
      const m = path.match(/^\/(song|video|gist)\/([^/]+)$/);
      if (m) {
        const v = decodeURIComponent(m[2]);
        return await renderPage(m[1], request, env, looksLikeId(v) ? null : v, looksLikeId(v) ? v : null);
      }
      // Old page links like /song?id=... or /song.html?slug=... -> clean address
      const old = path.match(/^\/(song|video)(\.html)?$/) || path.match(/^\/(gist)-post(\.html)?$/);
      if (old && (url.searchParams.get("id") || url.searchParams.get("slug"))) return await legacyRedirect(old[1], url);
    } catch (e) { /* fall through to the normal site */ }
    return env.ASSETS.fetch(request);
  },
};
