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

  // Downloads a song file; MP3s get title, artist and cover art written into them.
  async function downloadSong(t) {
    const res = await fetch(t.file_url);
    if (!res.ok) throw new Error("download failed");
    let blob = await res.blob();
    let ext = extFromUrl(t.file_url);
    const isMp3 = ext === "mp3" || blob.type === "audio/mpeg";
    if (isMp3) {
      try {
        blob = await tagMp3(blob, { title: `${t.title || "Song"} (MyGospelHub)`, artist: t.artist, year: t.year, genre: t.genre }, t.cover_url);
      } catch (e) { /* keep the untouched file */ }
      ext = "mp3";
    }
    const clean = (v) => String(v || "").replace(/[^\w\s&-]/g, "").replace(/\s+/g, " ").trim();
    const name = t.artist ? `${clean(t.artist)} - ${clean(t.title)}` : clean(t.title);
    const base = `${name || "Song"} || MyGospelHub.com.ng`;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = ext ? `${base}.${ext}` : base;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
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

  window.MGH = { downloadSong, setMediaSession };
})();
