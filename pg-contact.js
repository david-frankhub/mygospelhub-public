const SUPABASE_URL = "https://kqgnpryubgdtmtcjtasi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxZ25wcnl1YmdkdG10Y2p0YXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNTQ1NjQsImV4cCI6MjA5OTczMDU2NH0.T0y1CVCzIvfmK4vgczmlpiAFZP63MRLZT5eymu8R6jY";

  const form = document.getElementById("contactForm");
  const msgEl = document.getElementById("formMsg");
  const submitBtn = document.getElementById("submitBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.innerHTML = "";

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const subject = document.getElementById("subject").value.trim();
    const message = document.getElementById("message").value.trim();

    if (!name || !email || !message) {
      msgEl.innerHTML = `<div class="form-msg error">Please fill in your name, email, and message.</div>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> Sending...`;

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_messages`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, subject: subject || null, message }),
      });
      if (!res.ok) throw new Error("Failed to send");

      msgEl.innerHTML = `<div class="form-msg success">Thanks, ${name.split(" ")[0]}! Your message has been sent — we'll get back to you soon.</div>`;
      form.reset();
    } catch (err) {
      msgEl.innerHTML = `<div class="form-msg error">Something went wrong sending your message. Please try again.</div>`;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = "Send message";
  });
