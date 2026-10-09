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
├── css/                    styles.css (design tokens), lms.css, mobile.css,
│                           steps.css (focus shell, step views, gate),
│                           simulator.css (practice canvas: nodes, wires, dots)
├── js/
│   ├── data.js             data-access layer over the course datasets
│   ├── ui.js               DOM helpers, icons, cards, toasts, diagrams
│   ├── supabase.js         Supabase client bootstrap + session facade (window.SB)
│   ├── store.js            progress store + pub/sub (Store.*) — Supabase when
│   │                       signed in, localStorage fallback for guests
│   ├── main.js             page shell (nav, scroll, reveal, toasts)
│   ├── course.js           course.html renderer (?slug=)
│   ├── lesson.js           lesson block/figure renderer (window.LessonContent)
│   ├── steps.js            step runner: focus bar + video/practice/quiz views,
│   │                       100%-quiz gate, lesson unlock, canvas mount
│   ├── exercises.js        5 exercise engines + shared expression evaluator
│   ├── simulator.js        practice canvas: node registry, graph model,
│   │                       verifier, n8n JSON export + swappable backends
│   ├── dashboard.js        dashboard renderer + export/import/reset tools
│   ├── auth.js             Supabase sign in / sign up / sign out (auth.html)
│   └── certificate.js      printable completion certificate
├── data/
│   ├── courses.js          course catalog + N8N_LESSONS registry root
│   ├── paths.js            learning paths (currently empty) + badge defs
│   └── lessons/*.js        authored lesson content, keyed '<course>/<lesson>';
│                           n8n-fundamentals-steps.js adds the video/practice/
│                           quiz step content per lesson
└── scripts/
    ├── build.py            regenerates all HTML pages (dev-time only)
    ├── validate.js         headless content/exercise/step-gate validator (node)
    ├── validate-lib.js     browser-globals shim for the validator
    ├── smoke-steps.html    headless browser walkthrough of the lesson flow
    ├── test-cloud-store.js headless Supabase-store harness (node, no creds)
    └── test-supabase-live.py  live signup → progress → sign-out round trip
```

Script load order on every page: `data.js → ui.js → supabase.js → store.js →
main.js`, then page-specific data/JS. The Supabase SDK itself is loaded from the
CDN (`@supabase/supabase-js@2`) immediately before `js/supabase.js`.
`lesson.html` loads `data/lessons/n8n-fundamentals.js` and its step companion
`data/lessons/n8n-fundamentals-steps.js` before `js/exercises.js`,
`js/simulator.js` (the practice canvas), `js/lesson.js` and finally
`js/steps.js` (the runner). `js/simulator.js` must come before `js/steps.js`
because the runner mounts the canvas while rendering the Practice view.

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
(detail, `?slug=`) · `lesson.html` (step runner,
`?course=&lesson=&step=watch|practice|quiz`) ·
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

## Lesson flow: Video, Practice, Quiz

Every lesson is three isolated views behind one focus shell (`css/steps.css`,
driven by `js/steps.js`). Which view renders comes from a query param, so the
flow works on static hosting and from `file://` without a router library:

```
lesson.html?course=n8n-fundamentals&lesson=what-is-n8n&step=watch
lesson.html?course=n8n-fundamentals&lesson=what-is-n8n&step=practice
lesson.html?course=n8n-fundamentals&lesson=what-is-n8n&step=quiz
```

1. **Video** - takeaways, a 16:9 player card (poster + provider hint) and the
   lesson's reading blocks, behind a "Continue to practice" button.
2. **Practice** - objective, numbered build steps, the ticking self-check and,
   when the lesson has one, the mounted hands-on exercise.
3. **Quiz** - 2-3 questions graded by `Exercises.evaluateAnswer`. **100 % is
   required**: a miss reveals every "why", keeps the answers on screen and
   offers retry; only a perfect score calls `Store.markLessonComplete`, awards
   XP and unlocks the next lesson, which the syllabus shows as locked until then.

Guard rails behind the flow:

| Behaviour               | Where                                                          |
|-------------------------|----------------------------------------------------------------|
| Reached steps           | `Store.recordStep(...)` - watch/practice/quiz timestamps        |
| Self-check ticks        | `Store.recordChecklist(...)` - union merged when syncing        |
| Forward jump by URL     | `js/steps.js` clamps `?step=` to the furthest earned view       |
| Locked lesson deep link | redirect to the next incomplete lesson (`Store.nextIncomplete`) |
| In-page re-render       | `Store.on` refreshes the focus bar only, never the view         |

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

### Step content (`data/lessons/<course>-steps.js`)

`window.N8N_STEPS['<course>/<lesson>']` supplies the three step views and
merges into the same `N8N_LESSONS` key, so a lesson stays one object:

```js
window.N8N_STEPS['n8n-fundamentals/what-is-n8n'] = {
  video: {
    title, concept: '<p>HTML</p>', minutes: 6,
    takeaways: [html, html, html],        // 2-3 items
    embed: 'https://...'                  // optional
  },
  practice: {
    objective, steps: [{ title, detail, code }],   // code optional, >= 2 steps
    checklist: [html, ...],                        // >= 3 items
    workspace: { url: 'http://localhost:5678', label: '...' },
    canvas: { ... }                                 // optional — see below
  },
  quiz: {
    passPct: 100,                                  // enforced by the validator
    questions: [ ... ]
  }
};
```

Question shapes (`type`): **mcq** - `options`, `answer` (a list of indices, so
multi-select works), `q`, `hint`, `why`; Q1 of every lesson must be an mcq.
**expression** - `sample`, `expected`, `answer` (the reference expression),
graded through `Exercises.evaluateAnswer`, the same function the gate runs.
**text** - `accept` list for pasted variable names, JSON paths or node types.

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

### Interactive practice canvas (`js/simulator.js`)

`?step=practice` is a full-height, zero-scroll DataCamp-style IDE — the runner
owns the viewport, only the left rail scrolls. Nothing is stacked and nothing is
repeated:

```
+---------------------------------------------------------------------------+
| [Back to Video]          Lesson 1.1 · Step 2 of 3 · Practice    [stats]  |
+----------------------------------+----------------------------------------+
| LEFT RAIL  32% (never scrolls)    | RIGHT  68% — the canvas IDE            |
|  Build Your First 3-Node Workflow |  +------------------------------------+  |
|  Build a 3-node workflow using…   |  | toolbar: palette | counter | zoom  |  |
|                                  |  +------------------------------------+  |
|  BUILD                    2 links |  |                                    |  |
|   (Manual Trigger) (Set) (HTTP)   |  |   canvas (dot grid, nodes, wires)  |  |
|   → Manual Trigger → Edit Fields  |  |                                    |  |
|   → Edit Fields → HTTP Request    |  +------------------------------------+  |
|                                  |  | console: run output | requirements  |  |
|  REQUIREMENTS           2/4       |  +------------------------------------+  |
|   [x] Manual Trigger is connected |  | [Reset] [View JSON] [Run] [Quiz→] |  |
|       CANVAS                      |  +------------------------------------+  |
|   [ ] HTTP Request is connected   |  | ▸ Do it in your own n8n             |  |
|                                  |  +------------------------------------+  |
|  [Hint]                  100 XP   |                                        |
+----------------------------------+----------------------------------------+
```

The learner drops nodes from the toolbar palette, drags handle-to-handle to
connect them, presses **Execute run** to watch a run animate while mock n8n items
stream into the console, and reads **View JSON** to copy the workflow into their
own n8n. The toolbar counter tracks requirements met and opens the requirements
tab; the left rail's checklist ticks itself in real time and badges the
auto-satisfied items **Canvas**.

The rail shows only what is relevant to the canvas in front of you: the
objective, a **Build** list derived from the spec (which nodes to place, which
links to make) and the **Requirements** checklist. It never scrolls — the blocks
are packed and centred, so short lessons read as calm rather than empty. The
authored `practice.steps` ("open the node panel", "flip the Active toggle") are
about the learner's *own* n8n window and were the main source of overflow, so
they live in the **Do it in your own n8n** drawer under the canvas, together with
any second exercise type.

A lesson with a second exercise type (`expression`, `nodeconfig`, `code`) gets it
in a collapsed drawer under the canvas, so it can never squeeze the canvas to
zero height. A lesson with no canvas at all falls back to a panel pointing at the
learner's local n8n, and completes on the plain checklist exactly as before.

Authored per lesson as `practice.canvas`:

```js
canvas: {
  brief: 'Wire trigger → transform → send.',
  palette: ['manualTrigger', 'set', 'httpRequest', 'webhook'],  // webhook = decoy
  required: {
    nodes: ['manualTrigger', 'set', 'httpRequest'],
    edges: [['manualTrigger', 0, 'set', 0], ['set', 0, 'httpRequest', 0]]
  },                                  // edge = [fromKey, outPort, toKey, inPort]
  allowExtras: false,                 // false also rejects extra nodes AND edges
  checklist: [0, 1, 3]                // self-check items the verified topology proves
}
```

The **gate** is now *(topology verified ∨ no canvas spec) ∧ every checklist item
ticked*. Because the `no canvas spec` term is vacuously true, a lesson without a
`canvas` key completes exactly as it did before, and the items in
`canvas.checklist` are auto-ticked (and badged *Verified by canvas*) once the
graph verifies — the learner only has to tick what the canvas cannot prove.

The graph persists as a draft under `rvencisforge.canvas.draft.<course>/<lesson>`,
so a half-built workflow survives a reload. **View JSON** emits the real n8n
shape (`nodes[]` + `connections{ "<name>": { main: [[{ node, type, index }]] } }`),
with named outputs such as If's `true`/`false` becoming separate `main` entries.

### Swapping the canvas engine

`js/simulator.js` is split into three layers, and the middle one is the contract.
A renderer is swappable without touching a single authored spec, verify rule,
validator or test:

```
Layer 1  DATA     Simulator.registry  node types, colours, ports  (pure)
Layer 2  DOMAIN   Simulator.graph    model · verify · serialize  (pure, Node-safe)
Layer 3  BACKEND  Simulator.backends swappable renderer          (DOM)
```

Layers 1-2 never touch the DOM, so `scripts/validate.js` loads them in plain
Node and checks every spec — including that each spec's own reference graph
satisfies `verifyGraph`, the same self-check pattern used for quiz answers.

A backend implements four members:

```js
Simulator.registerBackend('rete', function (ctx) {
  const area = new NodeEditor('100%', '100%');   // may return a Promise
  return {
    name: 'rete',
    mount(rootEl, ctx) { rootEl.appendChild(area); /* ctx = { graph, spec, registry,
                                                        lessonKey, emit } */ },
    sync(graph) { /* diff graph.nodes / graph.edges by id */ },
    viewport: { zoom(z), panTo(x, y), fit() },
    destroy() { area.destroy(); }
  };
});

Simulator.useBackend('rete');   // default is 'vanilla'
```

`ctx.emit({ type: 'change' | 'verify' | 'run', … })` is how the host re-gates the
lesson without knowing which engine is live. The model speaks n8n's own
vocabulary, so the mapping is mechanical — one Rete `NodeEditor` node per graph
node, one `Socket` per port, one `Connection` per edge; for Baklava, one
interface-bearing node per graph node with outputs grouped by interface.

## Authoring a lesson

1. Add the lesson to the course outline in `data/courses.js`
   (slug/title/type/minutes).
2. Add a `window.N8N_LESSONS['<course>/<lesson>']` entry in
   `data/lessons/<course>.js`.
3. Add the matching `window.N8N_STEPS['<course>/<lesson>']` entry
   (video / practice / quiz) in `data/lessons/<course>-steps.js`.
4. Validate: `node scripts/validate.js` — it checks block presence, exercise
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
node scripts/validate.js      # content + exercises + step gates (0 failures)
python3 scripts/build.py      # regenerate pages after shell edits
```

`validate.js` covers the course outline, every content block, every exercise
schema, that each code exercise's reference solution passes its own tests (and
that its starter does *not*), and all of the step data above - video/practice/
quiz presence, takeaway/checklist/step counts, `passPct: 100`, the question
shapes, and every quiz's reference expression graded through the same evaluator
the browser gate runs.

It finishes with a **practice canvas** section that loads `js/simulator.js` and
checks, for every authored spec: node keys and palette entries exist in the
registry, edge endpoints are declared in `required.nodes` and the port indices
are real, `checklist` indices address the practice checklist, and — the important
one — that each spec's own reference graph satisfies `Simulator.verifyGraph`,
so an unsatisfiable spec fails on the command line rather than in the browser.

The step flow itself is verified headlessly by `scripts/smoke-steps.html`, which
walks Video -> Practice -> Quiz and prints `PASS ...` lines plus a `SMOKE OK`
document title. The main scenario runs 36 assertions (the self-check gate, a
failed attempt that leaves the lesson incomplete and the next lesson locked, a
retry at 100 % that unlocks it, XP award and persistence):

```bash
python3 -m http.server 8123 &               # from the repo root
chromium --headless=new --window-size=1280,1400 --dump-dom \
  'http://localhost:8123/scripts/smoke-steps.html?course=n8n-fundamentals&lesson=what-is-n8n' \
  | grep -A36 'smoke-report'
```

Append `&seed=two` to pre-complete lessons 1.1-1.2 and inspect lesson 1.3. That
branch drives the practice canvas end to end (49 assertions): it builds a
**wrong** graph and asserts the quiz gate stays shut, then the **right** graph
and asserts the gate opens, the canvas auto-ticks its own checklist items, the
JSON export is real n8n workflow JSON, and the draft survives a destroy/remount.
It then checks the IDE layout itself — the shell fills the viewport with no page
scroll, the rail holds the 32% split, the action bar sits on the bottom edge, and
opening the console drawer takes height from the canvas rather than the page —
and finally rebuilds the chain with synthetic `PointerEvent`s, covering the real
mouse path rather than just the API.
`&step=practice` watches a forward jump get clamped back to the first unfinished
view.

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


