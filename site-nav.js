/* MyGospelHub shared header: logo + "Search post" pill + boxed menu button + slide-in menu.
   Loaded on every page except the homepage (which has its own live-search header). */
(function () {
  var LINKS = [
    ["Home", "index.html"],
    ["Videos", "browse-video.html"],
    ["Music", "music.html"],
    ["Gist", "browse-gist.html"],
    ["Genres", "index.html#genres"],
    ["About", "about.html"],
    ["Contact", "contact.html"]
  ];
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var pm = location.pathname.match(/^\/(song|video|gist)\/[^/]+\/?$/);
  if (pm) here = pm[1] === "gist" ? "gist-post.html" : pm[1] + ".html"; // clean links like /song/my-song

  var css = `
  nav.sn-nav{display:flex; align-items:center; gap:12px; padding:14px 5%; position:sticky; top:0; z-index:100;
    background:rgba(11,11,13,0.9); backdrop-filter:blur(10px); border-bottom:1px solid var(--line,#26262b);}
  .sn-logo{font-family:'Fraunces',serif; font-size:22px; font-weight:700; display:flex; align-items:baseline; gap:2px; color:var(--text,#f3f1ec); text-decoration:none; flex-shrink:0;}
  .sn-logo .sn-dot{color:var(--gold,#d9a441);}
  .sn-search{flex:1; max-width:340px; margin-left:auto; display:flex; align-items:center; gap:9px; min-width:0;
    background:var(--bg-raised,#161619); border:1px solid var(--line,#26262b); border-radius:100px; padding:10px 16px; transition:border-color .2s;}
  .sn-search:focus-within{border-color:var(--gold,#d9a441);}
  .sn-search svg{flex-shrink:0; color:var(--text-dim,#8c8a85);}
  .sn-search input{background:none; border:none; outline:none; color:var(--text,#f3f1ec); font-size:14px; font-family:'Inter',sans-serif; width:100%; min-width:0;}
  .sn-search input::placeholder{color:var(--text-dim,#8c8a85);}
  .sn-links{display:flex; gap:26px; font-size:14px; font-weight:500; margin-left:8px;}
  .sn-links a{color:var(--text-dim,#8c8a85); text-decoration:none; transition:color .2s;}
  .sn-links a:hover,.sn-links a.active{color:var(--text,#f3f1ec);}
  .sn-toggle{display:none; width:46px; height:46px; flex-shrink:0; border-radius:12px; border:1px solid var(--line,#26262b);
    background:var(--bg-raised,#161619); color:var(--text,#f3f1ec); align-items:center; justify-content:center; cursor:pointer; padding:0;}
  .sn-overlay{display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1099;}
  .sn-overlay.open{display:block;}
  .sn-menu{display:none; position:fixed; top:0; right:0; bottom:0; width:min(78vw,320px); background:var(--bg-raised,#161619);
    border-left:1px solid var(--line,#26262b); z-index:1100; padding:22px 24px 40px; flex-direction:column;
    overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; box-shadow:-20px 0 50px rgba(0,0,0,.4);}
  .sn-menu.open{display:flex;}
  .sn-menu-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; padding-bottom:18px; border-bottom:1px solid var(--line,#26262b); flex-shrink:0;}
  .sn-close{width:34px; height:34px; border-radius:50%; border:1px solid var(--line,#26262b); background:transparent; color:var(--text,#f3f1ec); font-size:16px; cursor:pointer;}
  .sn-menu a.sn-item{flex:0 0 auto; padding:14px 4px; font-size:16px; font-weight:600; color:var(--text-dim,#8c8a85); border-bottom:1px solid var(--line,#26262b); text-decoration:none;}
  .sn-menu a.sn-item:hover,.sn-menu a.sn-item.active{color:var(--gold,#d9a441);}
  .sn-menu a.sn-upload{color:var(--gold,#d9a441); border-bottom:none;}
  @media (max-width:900px){
    .sn-links{display:none;}
    .sn-toggle{display:flex;}
    .sn-search{max-width:none;}
  }
  @media (max-width:480px){ .sn-logo{font-size:18px;} nav.sn-nav{gap:10px;} .sn-search{padding:10px 12px; gap:7px;} .sn-toggle{width:44px; height:44px;} }

  .sn-header{position:sticky; top:0; z-index:100; background:rgba(11,11,13,0.96); backdrop-filter:blur(10px);}
  .sn-header > nav{position:static !important; top:auto !important;}

  .sn-sheet-bg{position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:2500; opacity:0; pointer-events:none; transition:opacity .25s;}
  .sn-sheet{position:fixed; left:0; right:0; bottom:0; z-index:2501; background:#141416; border:1px solid rgba(255,255,255,0.1); border-radius:30px 30px 0 0; padding:12px 18px 28px; transform:translateY(105%); transition:transform .3s cubic-bezier(.2,.8,.2,1);}
  .sn-sheet.open{transform:none;} .sn-sheet-bg.open{opacity:1; pointer-events:auto;}
  .sn-sheet i{display:block; width:42px; height:4px; border-radius:4px; background:rgba(255,255,255,0.2); margin:0 auto 16px;}
  .sn-sheet a{display:flex; align-items:center; justify-content:space-between; padding:16px 18px; margin-bottom:8px; border-radius:20px; background:#18181B; border:1px solid rgba(255,255,255,0.08); color:#F2EFE9; font-weight:600; font-size:15px; text-decoration:none;}
  .sn-sheet a.gold{background:linear-gradient(135deg,#F4CF85,#D9A441); color:#0B0B0D; border:none;}
  .sn-sheet a span{opacity:.5;}
  @media (min-width:901px){.sn-sheet,.sn-sheet-bg{display:none;}}
  .sn-tabs{display:none;}
  @media (max-width:900px){
    .sn-tabs{display:grid; grid-template-columns:repeat(5,1fr); gap:2px; position:fixed; left:50%; transform:translateX(-50%);
      bottom:calc(14px + env(safe-area-inset-bottom,0px)); width:min(calc(100% - 28px),420px); padding:7px; border-radius:34px; z-index:1001;
      background:rgba(28,28,32,0.95); border:1px solid rgba(255,255,255,0.12); box-shadow:0 14px 34px rgba(0,0,0,0.65);
      backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);}
    .sn-tab{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:8px 0 7px; min-width:0; border-radius:26px;
      color:#8A8780; text-decoration:none; font-size:10.5px; font-weight:600; -webkit-tap-highlight-color:transparent; transition:background .2s,color .2s;}
    .sn-tab svg{width:22px; height:22px;}
    .sn-tab{color:var(--c) !important;} .sn-tab span{color:var(--c); opacity:.9;} .sn-tab.active{background:var(--c); color:#0B0B0D !important;} .sn-tab.active span{color:#0B0B0D; opacity:1;}
    body{padding-bottom:104px;}
    html{scroll-padding-top:80px;}
    .submit-fab{display:none !important;}
    .now-playing-bar,.player-bar{bottom:84px !important; left:14px !important; right:14px !important; border-radius:20px; border:1px solid var(--line,#26262b) !important;}
  }

  /* ===== Shared mobile polish (matches the Figma redesign) ===== */
  @media (max-width:700px){
    .track-card{border-radius:24px !important; border-color:rgba(255,255,255,0.07) !important;}
    .tc-art{border-radius:18px !important; box-shadow:0 12px 26px -12px rgba(217,164,65,0.4);}
    .tc-btn{border-radius:50% !important; width:46px !important; height:46px !important;}
    .tc-actions .tc-btn:first-child:not([disabled]){background:var(--gold,#d9a441) !important; color:#0B0B0D !important; border-color:var(--gold,#d9a441) !important;}
    .gist-row,.gist-card{border-radius:24px !important;}
    .search-bar{border-radius:100px !important;}
    .video-wrap,.yt-card{border-radius:26px !important;}
    .stats-row{display:grid !important; grid-template-columns:repeat(3,1fr); gap:0 !important; padding:16px 6px !important; text-align:center;
      background:var(--bg-raised,#141416); border:1px solid var(--line,#26262b) !important; border-radius:26px; margin-bottom:20px;}
    .stats-row .stat{text-align:center !important;}
    .stats-row .stat + .stat{border-left:1px solid var(--line,#26262b);}
    .action-btn{border-radius:100px;}
  }
  `;

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var nav = document.querySelector("nav");
  if (!nav) return;
  var isHome = !!document.getElementById("mobileMenu"); // the homepage has its own header; we only add the tab bar there
  if (!isHome) {
  nav.className = "sn-nav";
  nav.removeAttribute("style");

  var linksHtml = LINKS.map(function (l) {
    var active = l[1].toLowerCase() === here ? " active" : "";
    return '<a href="' + l[1] + '" class="' + active.trim() + '">' + l[0] + "</a>";
  }).join("");
  var itemsHtml = LINKS.map(function (l) {
    var active = l[1].toLowerCase() === here ? " active" : "";
    return '<a href="' + l[1] + '" class="sn-item' + active + '">' + l[0] + "</a>";
  }).join("") + '<a href="submit.html" class="sn-item sn-upload">Upload Song/Video/Gist</a>';

  nav.innerHTML =
    '<a href="index.html" class="sn-logo">MyGospelHub<span class="sn-dot">.</span></a>' +
    '<form class="sn-search" id="snSearch" role="search" action="search.html" method="get">' +
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>' +
      '<input type="search" name="q" placeholder="Search post" autocomplete="off" enterkeyhint="search" aria-label="Search">' +
    "</form>" +
    '<div class="sn-links">' + linksHtml + "</div>" +
    '<button class="sn-toggle" id="snToggle" aria-label="Open menu">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
    "</button>";

  var overlay = document.createElement("div");
  overlay.className = "sn-overlay";
  var menu = document.createElement("div");
  menu.className = "sn-menu";
  menu.innerHTML =
    '<div class="sn-menu-head"><a href="index.html" class="sn-logo">MyGospelHub<span class="sn-dot">.</span></a>' +
    '<button class="sn-close" aria-label="Close menu">✕</button></div>' + itemsHtml;
  document.body.appendChild(overlay);
  document.body.appendChild(menu);

  function open() { menu.scrollTop = 0; menu.classList.add("open"); overlay.classList.add("open"); }
  function close() { menu.classList.remove("open"); overlay.classList.remove("open"); }
  document.getElementById("snToggle").addEventListener("click", open);
  overlay.addEventListener("click", close);
  menu.querySelector(".sn-close").addEventListener("click", close);

  document.getElementById("snSearch").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = this.q.value.trim();
    if (q) location.href = "search.html?q=" + encodeURIComponent(q);
  });
  }

  // ---- Floating tab bar: Home, Music, Video, Gist, More ----
  var TABS = [
    ["Home", "index.html", ["index.html", ""], '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
    ["Music", "music.html", ["music.html", "browse-music.html", "song.html"], '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'],
    ["Video", "browse-video.html", ["browse-video.html", "video.html", "watch.html"], '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'],
    ["Gist", "browse-gist.html", ["browse-gist.html", "gist-post.html"], '<path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M8 9h7M8 13h7M8 17h4"/>'],
    ["More", "#more", ["contact.html", "about.html", "submit.html", "privacy.html", "terms.html"], '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>']
  ];
  var tabs = document.createElement("div");
  tabs.className = "sn-tabs";
  tabs.innerHTML = TABS.map(function (t) {
    var on = t[2].indexOf(here) !== -1 ? " active" : "";
    var COL = {Home:"#D9A441", Music:"#F0708A", Video:"#5B9BF0", Gist:"#3FAE6A", More:"#A78BFA"}[t[0]];
    return '<a class="sn-tab' + on + '" style="--c:' + COL + '" href="' + t[1] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + t[3] + "</svg><span>" + t[0] + "</span></a>";
  }).join("");
  var wrap = document.createElement("div");
  wrap.className = "sn-header";
  nav.parentNode.insertBefore(wrap, nav);
  wrap.appendChild(nav);

  var bg = document.createElement("div"); bg.className = "sn-sheet-bg";
  var sheet = document.createElement("div"); sheet.className = "sn-sheet";
  sheet.innerHTML = '<i></i><a class="gold" href="submit.html">Upload song / video / gist<span>&rarr;</span></a><a href="about.html">About MyGospelHub<span>&rarr;</span></a><a href="contact.html">Contact us<span>&rarr;</span></a><a href="privacy.html">Privacy policy<span>&rarr;</span></a><a href="terms.html">Terms of service<span>&rarr;</span></a>';
  document.body.appendChild(bg); document.body.appendChild(sheet);
  function toggleSheet(on) { bg.classList.toggle("open", on); sheet.classList.toggle("open", on); }
  bg.addEventListener("click", function () { toggleSheet(false); });
  tabs.addEventListener("click", function (e) { var a = e.target.closest('a[href="#more"]'); if (a) { e.preventDefault(); toggleSheet(!sheet.classList.contains("open")); } });

  // ---- "Share your ministry" card on content pages ----
  if (/^(song|video|watch|gist-post|music|browse-music|browse-video|browse-gist|artist)\.html$/.test(here)) {
    var st = document.createElement("style");
    st.textContent = ".sn-share{max-width:760px; margin:10px auto 0; padding:0 5%;} .sn-share-card{border-radius:30px; padding:28px 24px; background:linear-gradient(135deg,#D9A441 0%,#B0602F 55%,#7A1F2B 100%); box-shadow:0 26px 50px -22px rgba(217,164,65,0.55); color:#fff;} .sn-share-card h2{font-family:'Fraunces',serif; font-size:26px; line-height:1.1; margin:0;} .sn-share-card p{color:rgba(255,255,255,0.85); font-size:14px; line-height:1.5; margin:10px 0 18px; max-width:320px;} .sn-share-card a{display:inline-flex; align-items:center; gap:8px; background:#0B0B0D; color:#F2EFE9; border-radius:100px; padding:13px 22px; font-weight:700; font-size:14px; text-decoration:none;}";
    document.head.appendChild(st);
    var sc = document.createElement("div"); sc.className = "sn-share";
    sc.innerHTML = '<div class="sn-share-card"><h2>Share your ministry</h2><p>Upload your song, video or gist and reach thousands of listeners.</p><a href="submit.html"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"/></svg>Upload now</a></div>';
    document.body.appendChild(sc);
  }
  document.body.appendChild(tabs); // outside the header: a blurred header would otherwise trap position:fixed
})();
