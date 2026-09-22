#!/usr/bin/env python3
"""Rvencis Forge — page generator (dev-time only; outputs are committed static files).

Run from the project root:  python3 scripts/build.py
Generates the HTML pages sharing one nav/footer shell, so shell edits only
happen here. Per-page content lives in PAGES below.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

BRAND = "Rvencis Forge"
SITE_URL = "https://rvencis.github.io/n8n-academy"
BASE = BRAND + " — Learn n8n by building"
FAVICON = """<link rel="icon" type="image/svg+xml" href="assets/ficon.svg">
<link rel="icon" type="image/png" sizes="512x512" href="assets/icon-512.png">
<link rel="apple-touch-icon" href="assets/icon-512.png">"""

NAV = """    <a class="skip-link" href="#main">Skip to content</a>
    <nav class="navbar">
      <div class="nav-container">
        <a href="index.html" class="nav-logo">
          <span class="logo-icon"><img src="assets/logo.svg" width="32" height="32" alt="Rvencis Forge logo"></span>
          <span class="logo-text">Rvencis Forge</span>
        </a>
        <ul class="nav-menu">
          <li><a class="nav-link" href="index.html">Home</a></li>
          <li><a class="nav-link" href="courses.html">Course</a></li>
          <li><a class="nav-link" href="dashboard.html">Dashboard</a></li>
          <li><a class="nav-link" href="about.html">About</a></li>
          <li><a class="nav-link" href="contact.html">Contact</a></li>
        </ul>
        <div class="nav-actions" id="nav-user"></div>
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </nav>"""

FOOTER = """    <footer class="footer">
      <div class="container">
        <div class="footer-logo">
          <img src="assets/logo.svg" width="30" height="30" alt="">
          <span>Rvencis Forge</span>
        </div>
        <p class="footer-tagline">Learn n8n the builder's way — read a little, build a lot.</p>
        <div class="footer-content">
          <div class="footer-section">
            <h4>Learn</h4>
            <ul>
              <li><a href="courses.html">All courses</a></li>
              <li><a href="dashboard.html">Your progress</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Company</h4>
            <ul>
              <li><a href="about.html">About</a></li>
              <li><a href="contact.html">Contact</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Reference</h4>
            <ul>
              <li><a href="https://docs.n8n.io/" target="_blank" rel="noopener">Official n8n docs</a></li>
              <li><a href="https://community.n8n.io/" target="_blank" rel="noopener">n8n community</a></li>
            </ul>
          </div>
          <div class="footer-section">
            <h4>Account</h4>
            <ul>
              <li><a href="auth.html">Sign in</a></li>
              <li><a href="certificate.html">Certificate</a></li>
              <li><a href="dashboard.html">Dashboard</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">© <span id="year"></span> Rvencis Forge · An educational initiative by Rvencis — not affiliated with n8n GmbH<br>Your progress and account details are stored securely — <a href="about.html#privacy">read our privacy policy</a>.</div>
      </div>
    </footer>
    <script src="js/data.js"></script>
    <script src="js/ui.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabase.js"></script>
    <script src="js/store.js"></script>
    <script src="js/main.js"></script>"""

STARS = """        <div class="animated-stars" aria-hidden="true">
          <div class="star" style="top:12%;left:10%;animation-delay:0s"></div>
          <div class="star" style="top:22%;left:28%;animation-delay:1s"></div>
          <div class="star" style="top:34%;left:46%;animation-delay:2s"></div>
          <div class="star" style="top:44%;left:64%;animation-delay:1.5s"></div>
          <div class="star" style="top:55%;left:82%;animation-delay:.5s"></div>
          <div class="star" style="top:66%;left:18%;animation-delay:2.5s"></div>
          <div class="star" style="top:76%;left:40%;animation-delay:.8s"></div>
          <div class="star" style="top:86%;left:58%;animation-delay:1.8s"></div>
          <div class="star" style="top:28%;left:88%;animation-delay:2.2s"></div>
          <div class="star" style="top:48%;left:6%;animation-delay:1.2s"></div>
        </div>"""


LD_WEBSITE = '<script type="application/ld+json">\n' + json.dumps({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": BRAND,
    "alternateName": "n8n Academy",
    "url": SITE_URL + "/",
    "inLanguage": "en",
    "publisher": {"@type": "Organization", "name": "Rvencis", "url": "https://rvencis.github.io/"},
    "potentialAction": {
        "@type": "SearchAction",
        "target": {"@type": "EntryPoint", "urlTemplate": SITE_URL + "/courses.html?q={search_term_string}"},
        "query-input": "required name=search_term_string"
    }
}, indent=2) + "\n  </script>"

LD_ORG = '<script type="application/ld+json">\n' + json.dumps({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": BRAND,
    "url": SITE_URL + "/",
    "logo": SITE_URL + "/assets/icon-512.png",
    "parentOrganization": {"@type": "Organization", "name": "Rvencis", "url": "https://rvencis.github.io/"},
    "description": "Rvencis Forge is an educational initiative by Rvencis teaching n8n workflow automation through interactive, exercise-first courses."
}, indent=2) + "\n  </script>"


def page(name, title, desc, body, extra_js="", jsonld="", body_class="", head_extra=""):
    # A page may override the indexing default via head_extra (e.g. 404 →
    # noindex). Emit the default robots meta only when head_extra doesn't
    # already carry a robots directive, so no page ever ships two conflicting
    # tags.
    robots = "" if 'name="robots"' in (head_extra or "") else '\n  <meta name="robots" content="index, follow">'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <meta name="description" content="{desc}">{robots}
  <meta name="theme-color" content="#0d0d0d">
  <link rel="canonical" href="{SITE_URL}/{name}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{BRAND}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{SITE_URL}/{name}">
  <meta property="og:image" content="{SITE_URL}/assets/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="{BRAND} — Learn n8n by building">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{SITE_URL}/assets/og-image.png">
  <link rel="manifest" href="site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
  {FAVICON}
  <link rel="stylesheet" href="css/styles.css">
  <link rel="stylesheet" href="css/lms.css">
  <link rel="stylesheet" href="css/mobile.css">
  {head_extra}
  {jsonld}
</head>
<body{' class="' + body_class + '"' if body_class else ''}>
{NAV}
  <main id="main">
{body}
  </main>
{FOOTER}
{extra_js}
</body>
</html>
"""


PAGES = {}  # name -> dict(title, desc, body, extra_js, jsonld, body_class, head_extra)
INDEX_BODY = """    <section class="hero">
      <div class="hero-container">
        <div class="hero-badge"><span class="dot"></span>Learn n8n by building</div>
        <h1 class="hero-title">Automate anything. <span class="gradient-text">Master n8n.</span></h1>
        <p class="hero-subtitle">Interactive courses, real exercises and a built-in workflow builder — the hands-on way to learn n8n, from your first node to AI agents.</p>
        <div class="hero-buttons">
          <a class="btn btn-primary btn-lg" href="courses.html">Browse courses</a>
          <a class="btn btn-secondary btn-lg" href="about.html">Learn more</a>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>1</b><span>Course</span></div>
          <div class="stat"><b>16</b><span>Lessons</span></div>
          <div class="stat"><b>5</b><span>Exercise types</span></div>
          <div class="stat"><b>Free</b><span>To start</span></div>
        </div>
      </div>
      <div class="hero-background">
        <div class="gradient-orb"></div>
        <div class="gradient-orb-2"></div>
""" + STARS + """
      </div>
    </section>

    <section class="feature-strip">
      <div class="container">
        <div class="section-header">
          <div class="hero-badge1">How you'll learn</div>
          <h2 class="section-title">Read a little, build a lot</h2>
          <p class="section-subtitle">Every concept is followed by an exercise — write expressions, configure nodes, assemble workflows and run code, all inside your browser.</p>
        </div>
        <div class="forge-flow">
          <svg class="flow-h" viewBox="0 0 1040 230" role="img" aria-label="How the academy works: learn, practice, build, then earn your certificate">
            <title>Learn, practice, build — then earn your certificate</title>
            <g>
              <rect x="29" y="24" width="214" height="182" rx="16" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <text x="136" y="50" text-anchor="middle" font-size="10" letter-spacing="3" style="fill:var(--text-muted)">01</text>
              <circle cx="136" cy="86" r="24" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(124.96 74.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </g>
              <text x="136" y="134" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Learn</text>
              <text x="136" y="157" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">Bite-sized lessons that explain concepts</text>
              <text x="136" y="175" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">clearly before you touch anything</text>
            </g>
            <line x1="251" y1="115" x2="270" y2="115" style="stroke:var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
            <polygon points="272,109 282,115 272,121" style="fill:var(--primary-color)"/>
            <g>
              <rect x="285" y="24" width="214" height="182" rx="16" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <text x="392" y="50" text-anchor="middle" font-size="10" letter-spacing="3" style="fill:var(--text-muted)">02</text>
              <circle cx="392" cy="86" r="24" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(380.96 74.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3"/>
                <path d="M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3"/>
              </g>
              <text x="392" y="134" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Practice</text>
              <text x="392" y="157" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">Hands-on exercises after every concept —</text>
              <text x="392" y="175" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">expressions, node config, real workflows</text>
            </g>
            <line x1="507" y1="115" x2="526" y2="115" style="stroke:var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
            <polygon points="528,109 538,115 528,121" style="fill:var(--primary-color)"/>
            <g>
              <rect x="541" y="24" width="214" height="182" rx="16" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <text x="648" y="50" text-anchor="middle" font-size="10" letter-spacing="3" style="fill:var(--text-muted)">03</text>
              <circle cx="648" cy="86" r="24" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(636.96 74.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="5" cy="12" r="2.4"/>
                <circle cx="19" cy="6" r="2.4"/>
                <circle cx="19" cy="18" r="2.4"/>
                <path d="M7.2 10.9L16.8 6.9M7.2 13.1l9.6 4"/>
              </g>
              <text x="648" y="134" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Build</text>
              <text x="648" y="157" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">Assemble actual n8n automation workflows</text>
              <text x="648" y="175" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">inside your browser, no setup needed</text>
            </g>
            <line x1="763" y1="115" x2="782" y2="115" style="stroke:var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
            <polygon points="784,109 794,115 784,121" style="fill:var(--primary-color)"/>
            <g>
              <rect x="797" y="24" width="214" height="182" rx="16" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <text x="904" y="50" text-anchor="middle" font-size="10" letter-spacing="3" style="fill:var(--text-muted)">04</text>
              <circle cx="904" cy="86" r="24" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(892.96 74.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8.5" r="5.5"/>
                <path d="M8.5 13.2L7 22l5-2.8L17 22l-1.5-8.8"/>
              </g>
              <text x="904" y="134" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Earn Certificate</text>
              <text x="904" y="157" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">Complete all lessons and exercises to</text>
              <text x="904" y="175" text-anchor="middle" font-size="10" style="fill:var(--text-muted)">unlock your Rvencis Forge certificate</text>
            </g>
          </svg>
          <svg class="flow-v" viewBox="0 0 340 694" aria-hidden="true" focusable="false">
            <g>
              <rect x="20" y="10" width="300" height="140" rx="14" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <circle cx="170" cy="46" r="22" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(158.96 34.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </g>
              <text x="170" y="92" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Learn</text>
              <text x="170" y="110" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">Bite-sized lessons that explain concepts</text>
              <text x="170" y="126" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">clearly before you touch anything</text>
            </g>
            <line x1="170" y1="156" x2="170" y2="170" style="stroke:var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
            <polygon points="170,184 164,172 176,172" style="fill:var(--primary-color)"/>
            <g>
              <rect x="20" y="188" width="300" height="140" rx="14" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <circle cx="170" cy="224" r="22" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(158.96 212.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3"/>
                <path d="M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3"/>
              </g>
              <text x="170" y="270" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Practice</text>
              <text x="170" y="288" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">Hands-on exercises after every concept —</text>
              <text x="170" y="304" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">expressions, node config, real workflows</text>
            </g>
            <line x1="170" y1="334" x2="170" y2="348" style="stroke:var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
            <polygon points="170,362 164,350 176,350" style="fill:var(--primary-color)"/>
            <g>
              <rect x="20" y="366" width="300" height="140" rx="14" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <circle cx="170" cy="402" r="22" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(158.96 390.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="5" cy="12" r="2.4"/>
                <circle cx="19" cy="6" r="2.4"/>
                <circle cx="19" cy="18" r="2.4"/>
                <path d="M7.2 10.9L16.8 6.9M7.2 13.1l9.6 4"/>
              </g>
              <text x="170" y="448" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Build</text>
              <text x="170" y="466" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">Assemble actual n8n automation workflows</text>
              <text x="170" y="482" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">inside your browser, no setup needed</text>
            </g>
            <line x1="170" y1="512" x2="170" y2="526" style="stroke:var(--primary-color)" stroke-width="2" stroke-linecap="round"/>
            <polygon points="170,540 164,528 176,528" style="fill:var(--primary-color)"/>
            <g>
              <rect x="20" y="544" width="300" height="140" rx="14" style="fill:var(--dark-surface-2);stroke:var(--dark-border)"/>
              <circle cx="170" cy="580" r="22" style="fill:var(--primary-color)" fill-opacity="0.13"/>
              <g transform="translate(158.96 568.96) scale(0.92)" style="stroke:var(--secondary-color)" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="8.5" r="5.5"/>
                <path d="M8.5 13.2L7 22l5-2.8L17 22l-1.5-8.8"/>
              </g>
              <text x="170" y="626" text-anchor="middle" font-size="17" font-weight="600" style="fill:var(--text-primary)">Earn Certificate</text>
              <text x="170" y="644" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">Complete all lessons and exercises to</text>
              <text x="170" y="660" text-anchor="middle" font-size="12.5" style="fill:var(--text-muted)">unlock your Rvencis Forge certificate</text>
            </g>
          </svg>
        </div>
      </div>
    </section>

    <section class="section-alt">
      <div class="container">
        <div class="section-header">
          <div class="hero-badge1">Featured course</div>
          <h2 class="section-title">Start here</h2>
        </div>
        <div id="popular-courses" class="courses-grid"></div>
        <div class="center"><a class="btn btn-secondary" href="courses.html">Browse the full catalog</a></div>
      </div>
    </section>

    <div class="container"><div class="cta">
      <h2>Your first automation is 20 minutes away</h2>
      <p>Read a little, build a lot — start the flagship course today.</p>
      <a href="courses.html" class="btn btn-primary btn-lg">Start learning free</a>
    </div></div>"""

INDEX_JS = """    <script src="data/courses.js"></script>
    <script src="data/paths.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        /* One active course: render the single featured card (n8n Fundamentals). */
        var featured = Data.getCourse('n8n-fundamentals') || Data.courses()[0];
        document.getElementById('popular-courses').innerHTML = featured ? UI.courseCard(featured) : '';
      });
    </script>"""

PAGES["index.html"] = dict(
    title=BASE,
    desc="Interactive n8n courses with hands-on exercises: build workflows, write expressions and master automation in your browser.",
    body=INDEX_BODY, extra_js=INDEX_JS, jsonld=LD_WEBSITE
)
# ---- courses.html ----
COURSES_BODY = """    <section class="page-hero">
      <div class="container">
        <div class="hero-badge"><span class="dot"></span>Course catalog</div>
        <h1 class="hero-title small">Pick your next skill</h1>
        <p class="hero-subtitle">Every course blends short readings with interactive exercises. Progress syncs to Supabase when you're signed in — or stays in this browser if you're learning as a guest.</p>
      </div>
""" + STARS + """    </section>

    <section class="catalog-section">
      <div class="container">
        <div class="catalog-bar" id="catalog-bar">
          <div class="searchbox">
            <input type="search" id="q" placeholder="Search courses…" aria-label="Search courses">
          </div>
          <div class="filters" role="group" aria-label="Filter by track" id="track-filters">
            <button class="chip active" data-track="">All</button>
          </div>
          <div class="filters" role="group" aria-label="Filter by level" id="level-filters">
            <button class="chip active" data-level="">Any level</button>
          </div>
          <select id="sort" aria-label="Sort courses">
            <option value="default">Default order</option>
            <option value="new">Recently updated</option>
            <option value="duration">Shortest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
        <p class="result-count" id="result-count" aria-live="polite"></p>
        <div id="catalog" class="courses-grid"></div>
      </div>
    </section>"""

COURSES_JS = """    <script src="data/courses.js"></script>
    <script src="data/paths.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        var state = { q: '', track: '', level: '', sort: 'default' };
        /* Deep link: courses.html?q=… — also wired to the site's SearchAction. */
        var initialQ = new URLSearchParams(location.search).get('q');
        if (initialQ) {
          state.q = initialQ;
          document.getElementById('q').value = initialQ;
        }
        function render() {
          var list = Data.search(state);
          document.getElementById('catalog').innerHTML = list.length
            ? list.map(UI.courseCard).join('')
            : '<p class="empty">No courses match those filters — try clearing something.</p>';
          document.getElementById('result-count').textContent =
            list.length + ' course' + (list.length === 1 ? '' : 's');
        }
        function chipHandler(groupSel, key) {
          UI.qs(groupSel).addEventListener('click', function (e) {
            var chip = e.target.closest('.chip'); if (!chip) return;
            UI.qsa('.chip', this).forEach(function (c) { c.classList.toggle('active', c === chip); });
            state[key] = chip.getAttribute('data-' + key) || '';
            render();
          });
        }
        /* Filter chips are generated from the active catalog (in data order) so
           the UI can never offer a track or level that has no course behind it. */
        function fillChips(groupSel, key, meta) {
          var present = [];
          Data.courses().forEach(function (c) {
            if (c[key] && present.indexOf(c[key]) === -1) present.push(c[key]);
          });
          var group = UI.qs(groupSel);
          present.forEach(function (v) {
            var label = (meta && meta[v] && meta[v].label) || v.charAt(0).toUpperCase() + v.slice(1);
            group.appendChild(UI.el('<button class="chip" data-' + key + '="' + UI.esc(v) + '">' + UI.esc(label) + '</button>'));
          });
        }
        fillChips('#track-filters', 'track', Data.TRACK_META);
        fillChips('#level-filters', 'level', Data.LEVEL_META);
        chipHandler('#track-filters', 'track');
        chipHandler('#level-filters', 'level');
        document.getElementById('q').addEventListener('input', function () { state.q = this.value; render(); });
        document.getElementById('sort').addEventListener('change', function () { state.sort = this.value; render(); });
        render();
      });
    </script>"""

PAGES["courses.html"] = dict(
    title="Courses — " + BASE,
    desc="Browse all Rvencis Forge courses: fundamentals, expressions, HTTP & APIs, webhooks, data pipelines, AI agents, error handling and self-hosting.",
    body=COURSES_BODY, extra_js=COURSES_JS
)
# ---- course.html (detail, rendered client-side from ?slug=) ----
COURSE_BODY = """    <section class="page-hero slim">
      <div class="container">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="courses.html">Courses</a> <span>/</span> <span id="crumb-title">…</span></nav>
        <div id="course-head" class="course-head"></div>
      </div>
    </section>
    <section class="course-detail">
      <div class="container course-detail-grid">
        <div class="course-main">
          <div id="course-outcomes"></div>
          <div id="course-syllabus"></div>
          <div id="course-instructor"></div>
        </div>
        <aside class="course-side">
          <div class="side-card" id="course-side"></div>
          <div class="side-card" id="course-related"></div>
        </aside>
      </div>
    </section>"""

COURSE_JS = """    <script src="data/courses.js"></script>
    <script src="data/paths.js"></script>
    <script src="js/course.js"></script>"""

PAGES["course.html"] = dict(
    title="Course — " + BASE,
    desc="Course detail: outcomes, full syllabus, instructor and enrollment.",
    body=COURSE_BODY, extra_js=COURSE_JS
)

# ---- lesson.html (runner, client-side) ----
LESSON_BODY = """    <div class="lesson-shell container">
      <aside class="lesson-sidebar" id="lesson-sidebar" aria-label="Course lessons"></aside>
      <article class="lesson-main" id="lesson-main">
        <noscript><p class="empty">This course requires JavaScript.</p></noscript>
      </article>
    </div>"""

LESSON_JS = """    <script src="data/courses.js"></script>
    <script src="data/paths.js"></script>
    <script src="data/lessons/n8n-fundamentals.js"></script>
    <script src="js/exercises.js"></script>
    <script src="js/lesson.js"></script>"""

PAGES["lesson.html"] = dict(
    title="Lesson — " + BASE,
    desc="Interactive lesson runner with exercises: quiz, expression, node-config, workflow builder and code.",
    body=LESSON_BODY, extra_js=LESSON_JS
)

# ---- dashboard.html ----
DASH_BODY = """    <section class="page-hero slim">
      <div class="container">
        <div class="hero-badge"><span class="dot"></span>Your progress</div>
        <h1 class="hero-title small" id="dash-greeting">Welcome back</h1>
        <p class="hero-subtitle">Signed-in progress syncs to Supabase so it follows you to any device — as a guest, progress stays in this browser. Export it any time from the tools panel.</p>
      </div>
""" + STARS + """    </section>
    <section><div class="container">
      <div class="dash-stats" id="dash-stats"></div>
      <div class="dash-grid">
        <div class="panel">
          <h3>Continue where you left off</h3>
          <div id="dash-continue"></div>
        </div>
        <div class="panel">
          <h3>Course progress</h3>
          <div id="dash-courses"></div>
        </div>
        <div class="panel">
          <h3>Badges</h3>
          <div id="dash-badges" class="badge-grid"></div>
        </div>
        <div class="panel">
          <h3>Activity (last 8 weeks)</h3>
          <div id="dash-heatmap" class="heatmap"></div>
        </div>
        <div class="panel">
          <h3>Tools</h3>
          <div class="dash-tools">
            <button class="btn btn-secondary btn-sm" id="dash-export">Export progress</button>
            <label class="btn btn-ghost btn-sm">Import progress<input type="file" id="dash-import" accept="application/json" hidden></label>
            <button class="btn btn-ghost btn-sm" id="dash-cert">My certificate</button>
            <button class="btn btn-ghost btn-sm" id="dash-reset">Reset all progress</button>
          </div>
          <p class="fineprint">Reset clears XP, badges and completions. Export first if you might want them back.</p>
        </div>
      </div>
    </div></section>"""

DASH_JS = """    <script src="data/courses.js"></script>
    <script src="data/paths.js"></script>
    <script src="js/dashboard.js"></script>
    <script>
      /* Dashboard is for signed-in members — guests are sent to auth.html.
         (If the SDK itself could not load there is no session to check, so the
         page stays usable in guest mode instead of bouncing forever.) */
      document.addEventListener('DOMContentLoaded', function () {
        if (window.SB && SB.client) SB.onReady(function (user) {
          if (!user) location.replace('auth.html?next=dashboard.html');
        });
      });
    </script>"""

PAGES["dashboard.html"] = dict(
    title="Dashboard — " + BASE,
    desc="Your learning progress: XP, streaks, badges, course completion and activity heatmap.",
    body=DASH_BODY, extra_js=DASH_JS
)

# ---- certificate.html ----
CERT_BODY = """    <section><div class="container center narrow">
      <h2>Your certificate</h2>
      <p class="section-subtitle">Complete all lessons of a course, then generate a printable certificate.</p>
      <div class="cert-picker panel">
        <label for="cert-course">Course</label>
        <select id="cert-course"></select>
        <label for="cert-name">Your name</label>
        <input id="cert-name" type="text" placeholder="Ada Lovelace">
        <button class="btn btn-primary" id="cert-go">Generate</button>
      </div>
      <div id="cert-out"></div>
    </div></section>"""

CERT_JS = """    <script src="data/courses.js"></script>
    <script src="js/certificate.js"></script>"""

PAGES["certificate.html"] = dict(
    title="Certificate — " + BASE,
    desc="Generate and print your Rvencis Forge course completion certificate.",
    body=CERT_BODY, extra_js=CERT_JS
)
# ---- auth.html ----
AUTH_BODY = """    <section class="page-hero slim">
      <div class="container">
        <div class="hero-badge"><span class="dot"></span>Account</div>
        <h1 class="hero-title small">Sign in</h1>
        <p class="hero-subtitle">Sign in to sync your progress and certificates to the cloud — or keep learning as a guest.</p>
      </div>
    </section>
    <section><div class="container narrow">
      <div class="panel">
        <div class="callout callout-info" role="note">
          <strong>Good to know:</strong> guests keep their progress in this browser's local storage.
          Sign in (or create an account) and your XP, streaks, badges and certificates are saved
          to your Rvencis Forge account and follow you to any device.
        </div>
        <div id="auth-msg" style="margin-bottom:1rem"></div>
        <div class="form-row">
          <form id="signin-form">
            <h3 style="margin-top:0">Sign in</h3>
            <div class="form-group"><label for="si-email">Email</label>
              <input id="si-email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
            <div class="form-group"><label for="si-password">Password</label>
              <input id="si-password" type="password" required autocomplete="current-password" placeholder="••••••••"></div>
            <button class="btn btn-primary btn-lg" type="submit">Sign in</button>
          </form>
          <form id="signup-form">
            <h3 style="margin-top:0">Create account</h3>
            <div class="form-group"><label for="su-name">Display name</label>
              <input id="su-name" type="text" required placeholder="Ada Lovelace"></div>
            <div class="form-group"><label for="su-email">Email</label>
              <input id="su-email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
            <div class="form-group"><label for="su-password">Password</label>
              <input id="su-password" type="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></div>
            <button class="btn btn-secondary btn-lg" type="submit">Sign up</button>
          </form>
        </div>
        <div id="auth-state" style="margin-top:1rem"></div>
      </div>
    </div></section>"""

AUTH_JS = """    <script src="data/courses.js"></script>
    <script src="js/auth.js"></script>"""

PAGES["auth.html"] = dict(
    title="Sign in — " + BASE,
    desc="Sign in to Rvencis Forge or create a free account — your progress syncs across devices.",
    body=AUTH_BODY, extra_js=AUTH_JS
)

# ---- about.html ----
ABOUT_BODY = """    <section class="page-hero slim">
      <div class="container">
        <div class="hero-badge1">About</div>
        <h1 class="hero-title small">Learn n8n the builder's way</h1>
        <p class="hero-subtitle">Rvencis Forge is a hands-on course for workflow automation — every lesson pairs a short read with something you actually build.</p>
      </div>
""" + STARS + """    </section>
    <section><div class="container">
      <div class="section-header">
        <div class="hero-badge1">The Academy</div>
        <h2 class="section-title">What Rvencis Forge is</h2>
        <p class="section-subtitle">An exercise-first course for learning n8n: no passive videos — you read a little, then build real workflows, expressions and node configs right in your browser, with progress that sticks.</p>
      </div>
      <div class="features-grid">
        <div class="feature-item"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5L13.4 13.4 8.5 15.5l2.1-4.9z"/></svg><h3>What it is</h3><p>A complete, self-paced n8n course: interactive lessons, exercise engines, XP, streaks, badges and a printable certificate of completion.</p></div>
        <div class="feature-item"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 3.5a3.4 3.4 0 0 1 0 9M17.5 14.7c2.1.6 3.5 2.4 3.5 5.3"/></svg><h3>Who it's for</h3><p>Automation newcomers, working engineers and educators. The flagship course assumes zero n8n experience and gets you shipping real workflows.</p></div>
        <div class="feature-item"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></svg><h3>Why it exists</h3><p>Reading about automation doesn't make you an automator. The academy exists so you practice on real exercises from lesson one.</p></div>
      </div>
    </div></section>
    <section class="section-alt"><div class="container">
      <div class="section-header">
        <h2 class="section-title">What makes it different</h2>
        <p class="section-subtitle">Built for people who learn by doing, with content that tracks the official n8n docs.</p>
      </div>
      <div class="features-grid">
        <div class="feature-item"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3"/></svg><h3>Exercise-first</h3><p>Five interactive exercise engines instead of passive videos.</p></div>
        <div class="feature-item"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg><h3>Docs-aligned</h3><p>Node names and syntax follow official n8n documentation, re-verified each release.</p></div>
        <div class="feature-item"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8.5h18"/><path d="M6 6.2h.01M9 6.2h.01"/><path d="M8.5 13.5l2.5 2.5 5-5.5"/></svg><h3>Zero setup</h3><p>Every exercise runs right in your browser — no installs, no configuration, nothing to host.</p></div>
      </div>
      <div class="cta"><h2>Ready to build?</h2><p>Start the flagship course and ship your first working automation today.</p><a class="btn btn-primary" href="courses.html">Start learning</a></div>
    </div></section>
    <section id="privacy"><div class="container">
      <div class="section-header">
        <div class="hero-badge1">Privacy</div>
        <h2 class="section-title">Your data</h2>
        <p class="section-subtitle">What we collect, where it lives, and what we never do with it.</p>
      </div>
      <div class="panel">
        <p>Rvencis Forge stores your <strong>display name</strong> and <strong>email address</strong> when you create an account, plus your <strong>course progress</strong> — completed lessons, exercise and quiz results, XP, streaks and badges. This data is kept with <strong>Supabase</strong> (our authentication and database provider) so your progress follows you to any device and your certificate can be reissued at any time. Visitors who never sign in keep their progress only in this browser's local storage.</p>
        <p>We use it solely to run your learning experience — <strong>we do not sell it, rent it or share it with anyone</strong>. You can wipe your stored progress at any time from <em>Dashboard → Reset all progress</em>, and to remove your account itself just ask — email us and it will be deleted. Questions? <a href="mailto:rvencisofficial@gmail.com">Email us at rvencisofficial@gmail.com</a>.</p>
      </div>
    </div></section>
    <section class="forge-final"><div class="container">
      <div class="section-header">
        <div class="hero-badge1">About <span class="forge-name">Rvencis</span></div>
        <h2 class="section-title">Part of something larger</h2>
      </div>
      <div class="panel">
        <p>Rvencis Forge is an educational initiative by <strong><span class="forge-name">Rvencis</span></strong>, an AI research and innovation organization dedicated to advancing practical AI implementation. This course is part of <span class="forge-name">Rvencis</span>'s commitment to building real-world AI capability through structured education and hands-on project work.</p>
      </div>
      <p class="center forge-final-cta"><a class="forge-pill" href="https://rvencis.github.io/" target="_blank" rel="noopener">Learn more about <span class="forge-name">Rvencis</span> <span class="forge-pill-arrow" aria-hidden="true">→</span></a></p>
    </div></section>"""

PAGES["about.html"] = dict(
    title="About — " + BASE,
    desc="About Rvencis Forge — an educational initiative by Rvencis: exercise-first, docs-aligned and hands-on.",
    body=ABOUT_BODY, jsonld=LD_ORG
)
# ---- contact.html ----
CONTACT_BODY = """    <section class="page-hero slim">
      <div class="container">
        <div class="hero-badge"><span class="dot"></span>Contact</div>
        <h1 class="hero-title small">Talk to us</h1>
        <p class="hero-subtitle">Questions, course requests, or teaching partnerships — drop a note.</p>
      </div>
    </section>
    <section><div class="container narrow">
      <div class="panel">
        <form class="contact-form" id="contact-form" action="mailto:rvencisofficial@gmail.com" method="post" enctype="text/plain">
          <div class="form-row">
            <div class="form-group"><label for="c-name">Name</label><input id="c-name" name="name" required placeholder="Your name"></div>
            <div class="form-group"><label for="c-email">Email</label><input id="c-email" name="email" type="email" required placeholder="you@example.com"></div>
          </div>
          <div class="form-group"><label for="c-topic">Topic</label>
            <select id="c-topic" name="topic"><option>Course request</option><option>Teaching partnership</option><option>Bug report</option><option>Other</option></select></div>
          <div class="form-group"><label for="c-msg">Message</label><textarea id="c-msg" name="message" rows="5" required placeholder="Tell us what you need…"></textarea></div>
          <button class="btn btn-primary btn-lg" type="submit">Send message</button>
        </form>
        <p class="muted center">No mail app? Email us directly at <a href="mailto:rvencisofficial@gmail.com">rvencisofficial@gmail.com</a></p>
      </div>
    </div></section>"""

# The card posts to the mailbox above. This handler opens the visitor's own
# mail app with subject and body prefilled — far more reliable across
# browsers than a native mailto POST — while the form's action stays intact
# as the no-JS fallback. Nothing is stored locally and nothing needs a server.
CONTACT_JS = """    <script>
      document.addEventListener('DOMContentLoaded', function () {
        var EMAIL = 'rvencisofficial@gmail.com';
        document.getElementById('contact-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var name = document.getElementById('c-name').value.trim();
          var topic = document.getElementById('c-topic').value;
          var subject = 'Rvencis Forge — ' + topic;
          var body = 'Name: ' + name + '\\n' +
                     'Email: ' + document.getElementById('c-email').value.trim() + '\\n' +
                     'Topic: ' + topic + '\\n\\n' +
                     document.getElementById('c-msg').value.trim();
          location.href = 'mailto:' + EMAIL +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);
          UI.toast('Thanks, ' + UI.esc(name || 'friend') +
            '! Your email app should open with the message ready to send.', 'success');
        });
      });
    </script>"""

PAGES["contact.html"] = dict(
    title="Contact — " + BASE,
    desc="Contact the Rvencis Forge team by email at rvencisofficial@gmail.com.",
    body=CONTACT_BODY, extra_js=CONTACT_JS
)

# ---- 404.html ----
ERR_BODY = """    <section class="error-page">
      <div class="hero-background"><div class="gradient-orb"></div><div class="gradient-orb-2"></div></div>
      <div class="error-content">
        <div class="error-code">404</div>
        <h1 class="error-title">Page not found</h1>
        <p class="error-message">That lesson doesn't exist — but plenty do. Get back to learning.</p>
        <div class="error-buttons">
          <a href="index.html" class="btn btn-primary">Go home</a>
          <a href="courses.html" class="btn btn-secondary">Browse courses</a>
        </div>
      </div>
    </section>"""

ERR_JS = """    <script>
      /* 404.html is served at arbitrary URL depths — rebase every internal link
         (navbar, logo, recovery buttons) onto the site root so they keep working. */
      (function () {
        var m = location.pathname.match(/^\\/(n8n-academy)\\//);
        var base = m ? '/' + m[1] + '/' : '/';
        document.querySelectorAll('a[href]').forEach(function (a) {
          var href = a.getAttribute('href') || '';
          if (/^[a-z][a-z0-9-]*\\.html(?:#.*)?$/.test(href)) a.setAttribute('href', base + href);
        });
      })();
    </script>"""

PAGES["404.html"] = dict(
    title="404 — " + BASE,
    desc="The page you're looking for doesn't exist.",
    body=ERR_BODY, extra_js=ERR_JS, body_class="error-body",
    head_extra='  <meta name="robots" content="noindex, follow">'
)









def main():
    for name, cfg in PAGES.items():
        out = page(name, cfg["title"], cfg["desc"], cfg["body"],
                   cfg.get("extra_js", ""), cfg.get("jsonld", ""), cfg.get("body_class", ""),
                   head_extra=cfg.get("head_extra", ""))
        (ROOT / name).write_text(out, encoding="utf-8")
        print(f"wrote {name}")


if __name__ == "__main__":
    main()
