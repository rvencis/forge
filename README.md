# Rvencis Forge (formerly n8n Academy)

A static, browser-only learning management system that teaches n8n workflow
automation the hands-on way: short readings, five interactive exercise engines,
XP/streaks/badges, and a printable certificate of completion.

No server, no database, no build step required. All data is plain JavaScript
loaded with `<script>` tags, so every page works from `file://` and on GitHub
Pages. Learner progress is stored entirely in the browser's `localStorage`.

## Quick start

```bash
# open directly
open index.html            # or just double-click it

# or serve locally
python3 -m http.server 8000
# → http://localhost:8000
```

## Architecture

```
n8n-academy/
├── index.html … 404.html   10 static pages (generated — see "Pages")
├── css/                    styles.css (design tokens), lms.css, mobile.css
├── js/
│   ├── data.js             data-access layer over the course datasets
│   ├── ui.js               DOM helpers, icons, cards, toasts, diagrams
│   ├── supabase.js         Supabase client bootstrap + session facade (window.SB)
│   ├── store.js            progress store + pub/sub (Store.*) — Supabase when
│   │                       signed in, localStorage fallback for guests
│   ├── main.js             page shell (nav, scroll, reveal, toasts)
│   ├── course.js           course.html renderer (?slug=)
│   ├── lesson.js           lesson runner: sidebar, block renderer, completion
│   ├── exercises.js        5 exercise engines (quiz/expression/nodeconfig/…)
│   ├── dashboard.js        dashboard renderer + export/import/reset tools
│   ├── auth.js             Supabase sign in / sign up / sign out (auth.html)
│   └── certificate.js      printable completion certificate
├── data/
│   ├── courses.js          course catalog + N8N_LESSONS registry root
│   ├── paths.js            learning paths (currently empty) + badge defs
│   └── lessons/*.js        authored lesson content, keyed '<course>/<lesson>'
└── scripts/
    ├── build.py            regenerates all HTML pages (dev-time only)
    ├── validate.js         headless content/exercise validator (node)
    ├── validate-lib.js     browser-globals shim for the validator
    ├── test-cloud-store.js headless Supabase-store harness (node, no creds)
    └── test-supabase-live.py  live signup → progress → sign-out round trip
```

Script load order on every page: `data.js → ui.js → supabase.js → store.js →
main.js`, then page-specific data/JS. The Supabase SDK itself is loaded from the
CDN (`@supabase/supabase-js@2`) immediately before `js/supabase.js`.
`lesson.html` loads `data/lessons/n8n-fundamentals.js` (the active course's
authored lessons) before `js/exercises.js` and `js/lesson.js`.

## Auth & progress backend (Supabase)

`js/supabase.js` creates the client from the project URL + anon key and exposes
`SB.client`, `SB.user`, `SB.onReady(fn)` and `SB.onAuth(fn)`. `js/store.js`
subscribes to that session:

* **signed in** — `Store` hydrates from the `progress` table
  (`id, user_id, course_slug, lesson_slug, completed, xp, completed_at`):
  completions come from the rows, XP is the sum of `xp`, streaks are recomputed
  from `completed_at` and badges are re-evaluated on every fetch. Marking a
  lesson complete, passing a quiz or solving an exercise writes that lesson's
  row (lesson XP accumulates on the row, including the +200 course bonus on the
  final lesson). Quiz scores, exercise attempts and earned badges cannot be
  derived from those columns, so they ride along in the user's Supabase auth
  metadata (`user_metadata.forge`).
* **guest** — behaviour is unchanged: progress stays in `localStorage`
  (`n8nacademy.v1`), so the site still works for visitors without an account.

The table ships **without** a composite unique key, so the atomic
`upsert(..., { onConflict: 'user_id,course_slug,lesson_slug' })` is not
available (Postgres `42P10`). `js/store.js` detects that response and rewrites
the row with a delete→insert instead; writes for one lesson are chained so the
fallback can never create duplicates. Adding the constraint makes the fast path
active again:

```sql
alter table public.progress
  add constraint progress_user_course_lesson_key
  unique (user_id, course_slug, lesson_slug);
```

Row-level security must allow members to touch only their own rows (the
unauthenticated REST probe is correctly refused with `42501`):

```sql
alter table public.progress enable row level security;
create policy "own progress" on public.progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`auth.html` performs real `signInWithPassword` / `signUp` calls. Email
confirmation is enabled on the project, so sign-up shows a "check your email"
notice and the confirmation link activates the account; a throttled
confirmation mail (`over_email_send_rate_limit`) gets a plain-language
explanation plus a resend button. `dashboard.html` redirects guests to
`auth.html?next=dashboard.html`, and `certificate.html` tells guests to sign in
so a certificate can be retrieved permanently (the deterministic credential ID
is unchanged — it is hashed from course + name + the course's completion date,
which now comes from the progress rows).

## Testing the integration

```bash
node scripts/test-cloud-store.js      # 65 checks against a fake Supabase client
python3 scripts/test-supabase-live.py # real signup → confirm → progress → sign-out
python3 scripts/test-supabase-live.py --no-confirm  # when Confirm email is off
```

`test-cloud-store.js` needs no credentials: it boots the real `js/supabase.js`
and `js/store.js` (plus `js/certificate.js` for the certificate checks) against
an in-memory Supabase stand-in and asserts hydration, row payloads, the
single-row rewrite, badge/metadata sync, sign-out, guest mode and stable
credential IDs. `test-supabase-live.py` drives the real project: signup, email
confirmation via a throw-away mail.tm mailbox, password sign-in, an
authenticated `progress` write/read, and a sign-out that leaves guest mode
working. Supabase's built-in SMTP throttles confirmation mail
(`over_email_send_rate_limit`, HTTP 429) after a couple of signups per hour —
the script says so and exits honestly instead of pretending to pass; wait, or
temporarily switch off *Authentication → Providers → Email → Confirm email* and
rerun with `--no-confirm`.

## Pages

`index.html` · `courses.html` (catalog with search/filters) · `course.html`
(detail, `?slug=`) · `lesson.html` (runner, `?course=&lesson=`) ·
`dashboard.html` (progress, heatmap, export/import/reset — members only) ·
`certificate.html` (`?course=` preselect; guests are asked to sign in) ·
`auth.html` (Supabase sign in / sign up) · `about.html` ·
`contact.html` (form that opens the visitor's mail app addressed to
`rvencisofficial@gmail.com` — no backend) ·
`404.html`.

**Do not edit HTML by hand** — every page is generated by `scripts/build.py`
from one shared nav/footer shell. Edit `build.py`, then:

```bash
python3 scripts/build.py
```

## Data model

### Course (`data/courses.js`)

```js
{
  slug: 'n8n-fundamentals', title: '…', tagline: '…',
  track: 'foundations',            // TRACK_META key in js/data.js
  level: 'beginner',               // beginner | intermediate | advanced
  rating: 4.9, students: 12480, updated: '2026-08-14',
  glyph: 'n8n', tags: […], instructor: { name, role, bio },
  outcomes: […], prerequisites: [],   // course slugs
  chapters: [
    { id: 'c1', title: 'Getting started', lessons: [
      { slug: 'what-is-n8n', title: 'What is n8n?', type: 'reading', minutes: 6 }
    ]}
  ]
}
```

Lesson `type` drives the catalog chips and exercise mounting:
`reading · video · workflow · expression · code · nodeconfig · quiz`.

### Lesson content (`data/lessons/<course>.js`)

Registry key is `'<course-slug>/<lesson-slug>'`:

```js
window.N8N_LESSONS['n8n-fundamentals/what-is-n8n'] = {
  blocks: [ … ],        // content blocks, in order
  exercise: { … }       // optional; omit for pure readings
};
```

**Block types** (rendered by `js/lesson.js`):

| `t`         | fields                                                 |
|-------------|--------------------------------------------------------|
| `p`         | `html` (inline HTML allowed)                           |
| `h`         | `text`                                                 |
| `list`      | `items: [html, …]`                                     |
| `table`     | `head: […], rows: [[…], …]`                            |
| `callout`   | `variant: 'info' \| 'tip' \| 'warn'`, `title`, `html`  |
| `checklist` | `items: [html, …]`                                     |
| `code`      | `lang`, `code` (escaped text)                          |
| `figure`    | `svg` (inline diagram key in js/lesson.js), `caption`  |

### Exercise types (`js/exercises.js`, schemas enforced by the validator)

- **quiz** — `questions: [{ q, options: […], answer: <index|text>, why }]`
- **expression** — `prompt`, `hint`, `sample` (item json), `expected`,
  optional `validators: [{ label, mustMatch|mustContain|mustNotContain }]`
- **nodeconfig** — `nodeLabel`, `nodeType`, `spec: [{ key, label, type:
  'text'|'select'|'toggle', options?, solution }]`
- **workflow** — `brief`, `palette: [{ key, type, label }]`, `target:
  { nodes: [keys], edges: [[a, b]] }`, `flow: { key: { in, out } }`
- **code** — `mode: 'per-item' | 'all-items'`, `starter`, `solution`,
  `tests: [{ input, expect }]`, optional `hiddenTest`

## Authoring a lesson

1. Add the lesson to the course outline in `data/courses.js`
   (slug/title/type/minutes).
2. Add a `window.N8N_LESSONS['<course>/<lesson>']` entry in
   `data/lessons/<course>.js`.
3. Validate: `node scripts/validate.js` — it checks block presence, exercise
   schemas, and that every code exercise's reference solution passes its own
   tests (and that its starter does *not*).

## Disabling / re-enabling courses and paths

Seven courses and three learning paths ship **commented out** (nothing
deleted) because the public catalog currently features one flagship course.
To re-enable: remove only the `TEMPORARILY DISABLED` comment blocks in
`data/courses.js` / `data/paths.js`. All pages, badges and progress wiring
already handle any number of courses/paths — no code changes needed.
Re-run `python3 scripts/build.py` afterwards so the catalog chips and stats
pick up the new data (chips are generated from the active catalog).

## Validation & checks

```bash
node scripts/validate.js      # content + exercise integrity (0 failures expected)
python3 scripts/build.py      # regenerate pages after shell edits
```

## Deployment

Static hosting only (GitHub Pages works out of the box — `.nojekyll` is
committed). Update `robots.txt`, `sitemap.xml` and the canonical URLs in
`scripts/build.py` if the site moves to a different domain or path.

## Branding, SEO & crawler info

- **Brand:** Rvencis Forge (an educational initiative by Rvencis). The
  `n8n` in the copy refers to the subject being taught — the "not affiliated
  with n8n GmbH" disclaimer stays everywhere.
- **Per-page head** (emitted by `scripts/build.py`): description, explicit
  `robots: index, follow`, canonical URL, `theme-color`, Open Graph
  (`og:type/site_name/title/description/url/image` incl. dimensions), and
  Twitter `summary_large_image` card. `404.html` is `noindex, follow`.
- **Structured data:** `index.html` carries WebSite + publisher Organization
  JSON-LD with a `SearchAction` targeting `courses.html?q=…` (the catalog
  honors `?q=` on load); `about.html` carries the Organization graph;
  `course.html` injects per-course `Course` schema (name, description, level,
  `timeRequired`, provider) dynamically in `js/course.js`.
- **Social image:** `assets/og-image.png` (1200×630) and app icon
  `assets/icon-512.png` are committed PNGs (generated with Pillow); the
  wordmark lives in `assets/logo.svg`.
- **Crawler files:** `robots.txt` allows everything and points to
  `sitemap.xml`, which lists the 9 indexable pages with `lastmod` dates.
  `site.webmanifest` (linked from every page) carries the PWA-lite metadata
  and icons.
- **Storage keys:** learner progress stays under the legacy key
  `n8nacademy.v1` (renaming it would wipe existing progress); newer data uses
  `rvencisforge.*` keys.
- **Repo rename caveat:** the deployment path `/n8n-academy/` comes from the
  GitHub repo name. If you rename the repo, update `SITE_URL` in
  `scripts/build.py`, the URLs in `sitemap.xml`/`site.webmanifest`/`README`,
  and the path segment matched by the rebase script in the 404 page template.

## Notes

- Progress/profile/contact data live in the visitor's browser only; there is
  no backend. Export/import (dashboard → Tools) is the transport mechanism.
- Not affiliated with n8n GmbH; node names/syntax follow the official n8n
  documentation.


