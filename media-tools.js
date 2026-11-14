/* MyGospelHub media helpers: phone lock-screen artwork + downloads with embedded cover art */
(function () {
  const enc16 = (str) => {
    const out = new Uint8Array(2 + str.length * 2);
    out[0] = 0xff; out[1] = 0xfe;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out[2 + i * 2] = c & 0xff;
      out[3 + i * 2] = c >> 8;
    }
    return out;
  };
  const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const syncsafe = (n) => new Uint8Array([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
  const ascii = (s) => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
  const concat = (parts) => {
    const len = parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach((p) => { out.set(p, o); o += p.length; });
    return out;
  };
  const frame = (id, body) => concat([ascii(id), u32(body.length), new Uint8Array([0, 0]), body]);
  const textFrame = (id, text) => frame(id, concat([new Uint8Array([1]), enc16(String(text))]));

  function buildTag(meta, cover) {
    const frames = [];
    if (meta.title) frames.push(textFrame("TIT2", meta.title));
    if (meta.artist) frames.push(textFrame("TPE1", meta.artist));
    frames.push(textFrame("TALB", meta.album || "MyGospelHub"));
    if (meta.year) frames.push(textFrame("TYER", meta.year));
    if (meta.genre) frames.push(textFrame("TCON", meta.genre));
    if (cover) {
      const body = concat([new Uint8Array([0]), ascii(cover.mime), new Uint8Array([0, 3, 0]), cover.bytes]);
      frames.push(frame("APIC", body));
    }
    const all = concat(frames);
    return concat([ascii("ID3"), new Uint8Array([3, 0, 0]), syncsafe(all.length), all]);
  }

  async function fetchCover(url) {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let mime = null;
      if (bytes[0] === 0xff && bytes[1] === 0xd8) mime = "image/jpeg";
      else if (bytes[0] === 0x89 && bytes[1] === 0x50) mime = "image/png";
      if (!mime) return null; // only JPEG/PNG are widely supported inside MP3 tags
      return { bytes, mime };
    } catch (e) { return null; }
  }

  async function tagMp3(blob, meta, coverUrl) {
    const cover = await fetchCover(coverUrl);
    const head = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
    let offset = 0;
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) { // existing ID3v2 tag: replace it
      const size = ((head[6] & 127) << 21) | ((head[7] & 127) << 14) | ((head[8] & 127) << 7) | (head[9] & 127);
      offset = 10 + size + ((head[5] & 0x10) ? 10 : 0);
    }
    return new Blob([buildTag(meta, cover), blob.slice(offset)], { type: "audio/mpeg" });
  }

  function extFromUrl(url) {
    const m = String(url || "").split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  // Small message at the bottom of the screen so the visitor always sees a reaction.
  function toast(msg, ms) {
    let el = document.getElementById("mghToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "mghToast";
      el.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);max-width:90%;background:#17171a;color:#fff;border:1px solid rgba(217,164,65,.6);padding:11px 18px;border-radius:12px;font:600 14px system-ui,sans-serif;z-index:99999;box-shadow:0 8px 30px rgba(0,0,0,.5);text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = "block";
    clearTimeout(el._t);
    if (ms) el._t = setTimeout(() => { el.style.display = "none"; }, ms);
  }

  function cleanName(t, ext) {
    const clean = (v) => String(v || "").replace(/[^\w\s&-]/g, "").replace(/\s+/g, " ").trim();
    const name = t.artist ? `${clean(t.artist)} - ${clean(t.title)}` : clean(t.title);
    const base = `${name || "Song"} [MyGospelHub.com.ng]`;
    return ext ? `${base}.${ext}` : base;
  }

  // Fallback that always reacts: the browser itself downloads the file (no memory, no CORS).
  function directDownload(t) {
    const ext = extFromUrl(t.file_url);
    let href = t.file_url;
    if (href.indexOf("/storage/v1/object/public/") !== -1) {
      href += (href.indexOf("?") === -1 ? "?" : "&") + "download=" + encodeURIComponent(cleanName(t, ext));
    }
    const a = document.createElement("a");
    a.href = href;
    a.download = cleanName(t, ext);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Downloads a song file; MP3s get title, artist and cover art written into them.
  // Always gives feedback and never fails silently.
  async function downloadSong(t) {
    if (!t || !t.file_url) { toast("This song has no file to download.", 3000); return; }
    toast("Preparing your download…");
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000); // slow network: switch to the direct download
      const res = await fetch(t.file_url, { signal: ctrl.signal });
      if (!res.ok) throw new Error("download failed");
      const total = Number(res.headers.get("content-length")) || 0;
      let blob;
      if (res.body && total) {
        const reader = res.body.getReader();
        const parts = []; let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value); got += value.length;
          toast("Downloading… " + Math.min(99, Math.round(got / total * 100)) + "%");
        }
        blob = new Blob(parts);
      } else {
        blob = await res.blob();
      }
      clearTimeout(timer);
      let ext = extFromUrl(t.file_url);
      const isMp3 = ext === "mp3" || blob.type === "audio/mpeg";
      if (isMp3) {
        try {
          blob = await tagMp3(blob, { title: `${t.title || "Song"} [MyGospelHub.com.ng]`, artist: t.artist, year: t.year, genre: t.genre }, t.cover_url);
        } catch (e) { /* keep the untouched file */ }
        ext = "mp3";
      }
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = cleanName(t, ext);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
      toast("Download started ✓ Check your downloads.", 3500);
    } catch (e) {
      toast("Starting download…", 3000);
      directDownload(t);
    }
  }

  // Shows cover art, title and artist on the phone lock screen / notification while playing.
  function setMediaSession(t, el) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.title || "MyGospelHub",
        artist: t.artist || "MyGospelHub",
        album: "MyGospelHub",
        artwork: t.cover_url ? [96, 128, 192, 256, 384, 512].map((n) => ({ src: t.cover_url, sizes: `${n}x${n}` })) : []
      });
      if (el) {
        navigator.mediaSession.setActionHandler("play", () => el.play());
        navigator.mediaSession.setActionHandler("pause", () => el.pause());
        navigator.mediaSession.setActionHandler("seekto", (d) => { if (d.seekTime != null) el.currentTime = d.seekTime; });
      }
    } catch (e) { /* not supported */ }
  }

  // ---------- Clickable artist / title names ----------
  const _esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const _re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function nameUrl(name) { return "artist.html?name=" + encodeURIComponent(String(name).trim()); }
  function nameLink(name) {
    const n = String(name == null ? "" : name).trim();
    return n ? `<a class="name-link" href="${nameUrl(n)}">${_esc(n)}</a>` : "";
  }
  // "Kirk Franklin Ft Davido" -> two separate clickable names, separators kept as plain text
  function artistHtml(str) {
    const parts = String(str || "").split(/(\s+(?:ft\.?|feat\.?|featuring|x|and|\+)\s+|\s*[,&]\s*)/i);
    return parts.map((p, i) => (i % 2 ? _esc(p) : nameLink(p))).join("");
  }
  function artistNames(str) {
    return String(str || "").split(/\s+(?:ft\.?|feat\.?|featuring|x|and|\+)\s+|\s*[,&]\s*/i).map((s) => s.trim()).filter(Boolean);
  }
  // Safe text -> html. [[Any Name]] becomes a link; the song's own artist names are linked automatically.
  function linkText(text, artistStr) {
    let html = _esc(text || "");
    const holds = [];
    html = html.replace(/\[\[([^\]\n]+?)\]\]/g, (m, n) => { holds.push(nameLink(n.replace(/&#39;/g, "'").replace(/&amp;/g, "&"))); return "\u0001" + (holds.length - 1) + "\u0002"; });
    artistNames(artistStr).sort((a, b) => b.length - a.length).forEach((n) => {
      const safe = _esc(n);
      html = html.replace(new RegExp("(^|[^\\w\u0001])(" + _re(safe) + ")(?![\\w\u0002])", "gi"), (m, pre, name) => { holds.push(nameLink(n)); return pre + "\u0001" + (holds.length - 1) + "\u0002"; });
    });
    return bold(html.replace(/\u0001(\d+)\u0002/g, (m, i) => holds[+i]));
  }
  // *text* and **text** become bold (works in song/video descriptions, lyrics and articles)
  function bold(html) {
    return html.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>").replace(/\*([^*\n]+?)\*/g, "<strong>$1</strong>");
  }
  function richText(text) { return bold(_esc(text || "")); }
  (function () {
    const st = document.createElement("style");
    st.textContent = ".name-link{color:inherit;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;text-decoration-color:rgba(217,164,65,.7)}.name-link:hover{color:var(--gold,#d9a441)}.song-desc,.about-card p,.video-desc{white-space:pre-wrap}.song-desc strong,.about-card strong,.video-desc strong,.lyrics-body strong{color:#F2EFE9;font-weight:700}";
    document.head.appendChild(st);
  })();

  window.MGH = { downloadSong, setMediaSession, nameLink, artistHtml, linkText, richText, nameUrl };
})();
