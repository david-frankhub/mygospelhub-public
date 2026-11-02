// Cloudflare Worker: serves the static site and handles share-preview links
// (/song/<slug>, /video/<slug>, /gist/<slug>, plus the old /api/... links) so WhatsApp/Facebook show the real
// title, description and cover image.

const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";
const DEFAULT_IMAGE = "https://mygospelhub.com.ng/og-image.jpg";

const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ROUTES = {
  "/api/song": {
    table: "content", extra: "", page: "song.html", ogType: "music.song",
    title: (r) => `${r.title} — ${r.artist} | MyGospelHub`,
    desc: (r) => r.description || `Listen to "${r.title}" by ${r.artist} on MyGospelHub.`,
  },
  "/api/video": {
    table: "content", extra: "&type=eq.Video", page: "video.html", ogType: "video.other",
    title: (r) => `${r.title} — ${r.artist} | MyGospelHub`,
    desc: (r) => r.description || `Watch "${r.title}" by ${r.artist} on MyGospelHub.`,
  },
  "/api/gist-post": {
    table: "gist_articles", extra: "", page: "gist-post.html", ogType: "article",
    title: (r) => `${r.title} | MyGospelHub Gist`,
    desc: (r) => (r.body || "").slice(0, 160) || `Read "${r.title}" on MyGospelHub.`,
  },
};

// Clean share links: /song/<slug>, /video/<slug>, /gist/<slug> (an id also works).
// The old /api/... links keep working too.
const PRETTY = { "/song": "/api/song", "/video": "/api/video", "/gist": "/api/gist-post" };
const looksLikeId = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) || /^\d+$/.test(v);

async function preview(route, url, pretty) {
  const origin = url.origin;
  let slug = url.searchParams.get("slug");
  let id = url.searchParams.get("id");
  if (pretty) {
    if (looksLikeId(pretty)) id = pretty; else slug = pretty;
  }
  if (!slug && !id) return Response.redirect(`${origin}/${route.page}`, 302);

  let row = null;
  try {
    const filter = slug ? `slug=eq.${encodeURIComponent(slug)}` : `id=eq.${encodeURIComponent(id)}`;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${route.table}?${filter}&status=eq.Published${route.extra}&select=*&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) row = rows[0];
  } catch (e) { row = null; }

  const title = row ? route.title(row) : "MyGospelHub — Music. Videos. Gist.";
  const description = row ? route.desc(row) : "Your home for gospel music, videos, and entertainment gist.";
  const image = row && row.cover_url ? row.cover_url : DEFAULT_IMAGE;
  const pageUrl = row ? `${origin}/${route.page}?id=${encodeURIComponent(row.id)}` : `${origin}/${route.page}`;

  // Facebook treats og:url as the page to scrape, so it must be THIS link, not the song page.
  const shareUrl = pretty
    ? url.origin + url.pathname
    : url.origin + url.pathname + (slug ? `?slug=${encodeURIComponent(slug)}` : `?id=${encodeURIComponent(id)}`);

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(shareUrl)}">
<link rel="canonical" href="${esc(shareUrl)}">
<meta property="og:type" content="${route.ogType}">
<meta property="og:site_name" content="MyGospelHub">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<script>window.location.replace(${JSON.stringify(pageUrl)});</script>
</head><body><p>Redirecting to <a href="${esc(pageUrl)}">${esc(title)}</a>…</p></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const route = ROUTES[path];
    if (route) return preview(route, url, null);
    const m = path.match(/^(\/song|\/video|\/gist)\/([^/]+)$/);
    if (m) return preview(ROUTES[PRETTY[m[1]]], url, decodeURIComponent(m[2]));
    return env.ASSETS.fetch(request);
  },
};
