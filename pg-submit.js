const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";
  const ADMIN_WHATSAPP = "2348123530801";

  let currentType = "song";

  document.querySelectorAll(".type-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".type-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentType = chip.dataset.type;
      updateFieldsForType();
    });
  });

  function updateFieldsForType() {
    const isGist = currentType === "gist";
    document.getElementById("musicFields").style.display = isGist ? "none" : "block";
    document.getElementById("gistFields").style.display = isGist ? "block" : "none";
    document.getElementById("mediaFileField").style.display = isGist ? "none" : "block";
    document.getElementById("lyricsField").style.display = currentType === "song" ? "block" : "none";
    document.getElementById("mediaLabel").textContent = currentType === "video" ? "Video file *" : "Audio file *";
  }

  document.getElementById("f_cover").addEventListener("change", e => {
    document.getElementById("coverName").textContent = e.target.files[0]?.name || "";
  });
  // No "accept" filter on purpose: phones (especially iPhones) grey out audio files they don't recognise.
  // We check the file ourselves instead.
  const NOT_MEDIA = /\.(jpe?g|png|gif|webp|heic|pdf|docx?|xlsx?|pptx?|txt|zip|rar|apk)$/i;
  document.getElementById("f_media").addEventListener("change", e => {
    const f = e.target.files[0];
    const nameEl = document.getElementById("mediaName");
    if (!f) { nameEl.textContent = ""; return; }
    if ((f.type && f.type.startsWith("image/")) || NOT_MEDIA.test(f.name)) {
      e.target.value = "";
      nameEl.textContent = "";
      alert("That file is not an audio or video file. Please choose your song or video file.");
      return;
    }
    nameEl.textContent = f.name;
  });
  const MIME = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", amr: "audio/amr", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", "3gp": "video/3gpp" };

  // Shrink big cover photos before upload (saves storage + bandwidth; phone photos are often 3MB+).
  async function shrinkImage(file) {
    try {
      if (!file.type || file.type.indexOf("image/") !== 0 || file.size < 300 * 1024) return file;
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], (file.name || "cover").replace(/\.[a-z0-9]+$/i, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { return file; }
  }

  async function uploadFile(file, bucket) {
    if (bucket === "covers") file = await shrinkImage(file);
    const m = /\.([a-z0-9]{2,5})$/i.exec(file.name || "");
    let ext = m ? m[1].toLowerCase() : "";
    if (!ext) ext = file.type ? (file.type.split("/")[1] || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin" : (bucket === "covers" ? "jpg" : "mp3");
    const mime = file.type || MIME[ext] || "application/octet-stream";
    const path = `submissions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": mime
      },
      body: file
    });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Upload to "${bucket}" failed (${res.status}): ${t.slice(0, 200)}`); }
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  }

  document.getElementById("submitForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("submitBtn");
    const errEl = document.getElementById("errorMsg");
    errEl.style.display = "none";

    const title = document.getElementById("f_title").value.trim();
    const name = document.getElementById("f_name").value.trim();
    const phone = document.getElementById("f_phone").value.trim();
    const coverFile = document.getElementById("f_cover").files[0];
    const mediaFile = document.getElementById("f_media").files[0];
    const yt = document.getElementById("f_youtube").value.trim(), sp = document.getElementById("f_spotify").value.trim(), am = document.getElementById("f_audiomack").value.trim();
    const streaming = yt || sp || am;
    const body = document.getElementById("f_body").value.trim();

    if (!title || !name || !phone) {
      errEl.textContent = "Please fill all required fields.";
      errEl.style.display = "block";
      return;
    }
    if (currentType === "gist" && !body) {
      errEl.textContent = "Please write the gist article.";
      errEl.style.display = "block";
      return;
    }
    if (currentType !== "gist" && !mediaFile && !streaming) {
      errEl.textContent = "Upload a file or add at least one link (YouTube, Spotify or Audiomack).";
      errEl.style.display = "block";
      return;
    }
    if (!coverFile) {
      errEl.textContent = "Cover image is required.";
      errEl.style.display = "block";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {
      const coverUrl = await uploadFile(coverFile, "covers");
      let fileUrl = null;
      if (mediaFile) fileUrl = await uploadFile(mediaFile, "media");

      const payload = {
        type: currentType,
        title,
        artist: document.getElementById("f_artist").value.trim() || null,
        genre: document.getElementById("f_genre").value.trim() || null,
        year: document.getElementById("f_year").value.trim() || null,
        producer: document.getElementById("f_producer").value.trim() || null,
        description: document.getElementById("f_description").value.trim() || null,
        lyrics: document.getElementById("f_lyrics").value.trim() || null,
        category: document.getElementById("f_category").value.trim() || null,
        body: body || null,
        cover_url: coverUrl,
        file_url: fileUrl,
        streaming_link: streaming || null,
        youtube_url: yt || null, spotify_url: sp || null, audiomack_url: am || null,
        submitter_name: name,
        submitter_phone: phone,
        submitter_email: document.getElementById("f_email").value.trim() || null,
        status: "awaiting_payment"
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/pending_submissions`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Saving submission failed (${res.status}): ${t.slice(0, 200)}`); }

      const waText = encodeURIComponent(`Hello MyGospelHub, I just submitted "${title}" (${currentType}). Please review and publish.`);
      document.getElementById("waLink").href = `https://wa.me/${ADMIN_WHATSAPP}?text=${waText}`;

      document.getElementById("formView").style.display = "none";
      document.getElementById("confirmView").classList.add("show");

    } catch (err) {
      console.error(err);
      errEl.textContent = "Something went wrong. Please try again. (" + (err && err.message ? err.message : "unknown error") + ")";
      errEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Submit";
    }
  });
