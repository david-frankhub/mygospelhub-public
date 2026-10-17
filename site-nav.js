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
  `;

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var nav = document.querySelector("nav");
  if (!nav) return;
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
})();
