// Cloudflare Worker: serves the static site and handles share-preview links
// (/api/song, /api/video, /api/gist-post) so WhatsApp/Facebook show the real
// title, description and cover image.

const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";
const DEFAULT_IMAGE = "https://kqgnpryubgdtmtcjtasi.supabase.co/storage/v1/object/public/covers/file_00000000a20081f48e8855cb4ade1850.png";

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

async function preview(route, url) {
  const origin = url.origin;
  const slug = url.searchParams.get("slug");
  const id = url.searchParams.get("id");
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

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:type" content="${route.ogType}">
<meta property="og:site_name" content="MyGospelHub">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(pageUrl)}">
<script>window.location.replace(${JSON.stringify(pageUrl)});</script>
</head><body><p>Redirecting to <a href="${esc(pageUrl)}">${esc(title)}</a>…</p></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = ROUTES[url.pathname.replace(/\/$/, "")];
    if (route) return preview(route, url);
    return env.ASSETS.fetch(request);
  },
};
