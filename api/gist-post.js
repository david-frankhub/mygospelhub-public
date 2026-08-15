// Vercel serverless function for gist article link previews.
// Same pattern as api/song.js — see that file for detailed comments on how
// this works and why it's needed. Note this queries gist_articles instead
// of content, since gist posts live in a separate table.

const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";

const DEFAULT_IMAGE = "https://kqgnpryubgdtmtcjtasi.supabase.co/storage/v1/object/public/covers/file_00000000a20081f48e8855cb4ade1850.png";
const SITE_URL = "https://mygospelhub-public.vercel.app";

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async (req, res) => {
  const slug = req.query.slug;
  const id = req.query.id;

  if (!slug && !id) {
    res.writeHead(302, { Location: `${SITE_URL}/gist-post.html` });
    res.end();
    return;
  }

  let post = null;
  try {
    const filter = slug
      ? `slug=eq.${encodeURIComponent(slug)}`
      : `id=eq.${encodeURIComponent(id)}`;
    const apiUrl = `${SUPABASE_URL}/rest/v1/gist_articles?${filter}&status=eq.Published&select=*&limit=1`;
    const response = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      post = rows[0];
    }
  } catch (err) {
    post = null;
  }

  const title = post ? `${post.title} | MyGospelHub Gist` : "MyGospelHub — Music. Videos. Gist.";
  const description = post
    ? ((post.body || "").slice(0, 160) || `Read "${post.title}" on MyGospelHub.`)
    : "Your home for gospel music, videos, and entertainment gist.";
  const image = (post && post.cover_url) ? post.cover_url : DEFAULT_IMAGE;
  const pageUrl = post
    ? `${SITE_URL}/gist-post.html?id=${encodeURIComponent(post.id)}`
    : `${SITE_URL}/gist-post.html`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">

<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="MyGospelHub">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">

<meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}">
<script>window.location.replace(${JSON.stringify(pageUrl)});</script>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(html);
};
  
