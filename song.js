// This is a Vercel serverless function. It runs on Vercel's servers, not in
// the visitor's browser, and runs fresh on every request to /api/song.
//
// Purpose: when a link like /api/song?id=xyz is requested, this looks up the
// real song in Supabase and returns HTML with the correct title, description,
// and cover image already baked into the <head> — so link previews on
// WhatsApp, Facebook, etc. show the real song instead of a generic blank card.
//
// Real visitors (in an actual browser) still get the full working song page —
// this function's HTML includes the same content as song.html, plus a
// redirect so the browser settles on the real URL.

const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";

// A safe fallback image, used if a song has no cover art of its own.
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
  const id = req.query.id;

  // No id given — just send them to the real page, nothing to look up.
  if (!id) {
    res.writeHead(302, { Location: `${SITE_URL}/song.html` });
    res.end();
    return;
  }

  let song = null;
  try {
    const apiUrl = `${SUPABASE_URL}/rest/v1/content?id=eq.${encodeURIComponent(id)}&status=eq.Published&select=*&limit=1`;
    const response = await fetch(apiUrl, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const rows = await response.json();
    if (Array.isArray(rows) && rows.length > 0) {
      song = rows[0];
    }
  } catch (err) {
    // If Supabase is unreachable for any reason, fall through — we still
    // send a working page below, just with generic fallback details.
    song = null;
  }

  const title = song ? `${song.title} — ${song.artist} | MyGospelHub` : "MyGospelHub — Music. Videos. Gist.";
  const description = song
    ? (song.description || `Listen to "${song.title}" by ${song.artist} on MyGospelHub.`)
    : "Your home for gospel music, videos, and entertainment gist.";
  const image = (song && song.cover_url) ? song.cover_url : DEFAULT_IMAGE;
  const pageUrl = `${SITE_URL}/song.html?id=${encodeURIComponent(id)}`;

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
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="MyGospelHub">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">

<!-- Send real visitors straight to the actual working page -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}">
<script>window.location.replace(${JSON.stringify(pageUrl)});</script>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(pageUrl)}">${escapeHtml(title)}</a>…</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Cache this response for a few minutes so we're not hitting Supabase on
  // every single crawler request, but still refresh reasonably often.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(html);
};
