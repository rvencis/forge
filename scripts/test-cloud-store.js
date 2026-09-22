#!/usr/bin/env node
/* Headless harness for the Supabase-backed progress store: boots the real
   js/supabase.js + js/store.js against a fake Supabase client (in-memory
   `progress` table + auth) and checks hydration, upserts, the single-row
   rewrite fallback, badge/metadata sync, sign-out and guest mode.
   Run: node scripts/test-cloud-store.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let checks = 0, fails = 0;
function ok(cond, msg) { checks++; if (cond) { console.log('   ok  ' + msg); } else { fails++; console.log('   FAIL ' + msg); } }
const tick = (ms) => new Promise(r => setTimeout(r, ms || 5));

/* ---------- fake Supabase project (shared "server side") ---------- */
function project() {
  return { rows: [], seq: 0, session: null, users: {}, selects: 0, upserts: 0, inserts: 0, deletes: 0, failUpsert: false, listeners: [] };
}
function rowKey(r) { return [r.user_id, r.course_slug, r.lesson_slug].join('|'); }

function runQuery(st, db) {
  const rows = db.rows;
  const match = (r) => st.filters.every((f) => r[f[0]] === f[1]);
  if (st.op === 'select') {
    db.selects++;
    let out = rows.filter(match).map((r) => Object.assign({}, r));
    if (st.order && st.order[0] === 'completed_at') out.sort((a, b) => String(a.completed_at || '').localeCompare(String(b.completed_at || '')));
    if (st.limit) out = out.slice(0, st.limit);
    return { data: out, error: null };
  }
  if (st.op === 'upsert') {
    db.upserts++;
    db.lastUpsert = { payload: st.payload, opts: st.opts };
    if (db.failUpsert) return { data: null, error: { message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' } };
    const found = rows.find((r) => rowKey(r) === rowKey(st.payload));
    if (found) Object.assign(found, st.payload);
    else rows.push(Object.assign({ id: 'row-' + (++db.seq) }, st.payload));
    return { data: [st.payload], error: null };
  }
  if (st.op === 'insert') {
    db.inserts++;
    const row = Object.assign({ id: 'row-' + (++db.seq) }, st.payload);
    rows.push(row);
    return { data: [row], error: null };
  }
  if (st.op === 'update') { rows.filter(match).forEach((r) => Object.assign(r, st.payload)); return { data: [], error: null }; }
  if (st.op === 'delete') { db.deletes++; for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); return { data: [], error: null }; }
  return { data: null, error: { message: 'unknown op ' + st.op } };
}

function makeQuery(db) {
  const st = { filters: [], op: 'select', payload: null, opts: null, order: null, limit: null };
  const q = {
    select() { return q; },
    eq(c, v) { st.filters.push([c, v]); return q; },
    order(c, o) { st.order = [c, o]; return q; },
    limit(n) { st.limit = n; return q; },
    upsert(p, o) { st.op = 'upsert'; st.payload = p; st.opts = o; return q; },
    insert(p) { st.op = 'insert'; st.payload = p; return q; },
    update(p) { st.op = 'update'; st.payload = p; return q; },
    delete() { st.op = 'delete'; return q; },
    then(res, rej) { return Promise.resolve().then(() => runQuery(st, db)).then(res, rej); }
  };
  q._state = st;
  return q;
}

function makeClient(db, page) {
  let cb = null;
  return {
    auth: {
      onAuthStateChange(fn) {
        cb = fn;
        db.listeners.push(fn);
        if (page.eager) fn(db.session ? 'INITIAL_SESSION' : 'SIGNED_OUT', db.session || null);
        else setTimeout(() => fn(db.session ? 'INITIAL_SESSION' : 'SIGNED_OUT', db.session || null), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut() {
        return Promise.resolve({ error: null }).then((r) => {
          db.session = null;
          db.listeners.forEach((f) => f('SIGNED_OUT', null));
          return r;
        });
      },
      updateUser(arg) {
        const u = db.session && db.session.user;
        if (u) u.user_metadata = Object.assign({}, u.user_metadata, arg.data);
        page.metaWrites = (page.metaWrites || 0) + 1;
        return Promise.resolve({ data: { user: u }, error: null }).then((r) => {
          db.listeners.forEach((f) => f('USER_UPDATED', db.session));
          return r;
        });
      }
    },
    from() { return makeQuery(db); }
  };
}


/* ---------- boot a page: fresh window + real scripts + fake Supabase ---------- */
const SCRIPTS = ['js/data.js', 'js/ui.js', 'js/supabase.js', 'js/store.js'];
const DATA_SCRIPTS = ['data/courses.js', 'data/paths.js',
  'data/lessons/n8n-fundamentals.js', 'data/lessons/expressions-data-mapping.js',
  'data/lessons/http-and-apis.js', 'data/lessons/webhooks-and-forms.js',
  'data/lessons/data-pipelines.js', 'data/lessons/ai-agents-n8n.js',
  'data/lessons/misc-courses.js'];

function makeElement(id) {
  return {
    id: id, innerHTML: '', textContent: '', disabled: false, value: '',
    handlers: {},
    addEventListener: function (ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
    click: function () { (this.handlers.click || []).forEach(function (f) { f({}); }); },
    scrollIntoView: function () {},
    querySelector: function () { return { textContent: 'CREDENTIAL-ID' }; }
  };
}

function boot(db, opts) {
  opts = opts || {};
  const win = {};
  win.window = win;
  const els = {};
  const readyFns = [];
  win.document = {
    addEventListener(ev, fn) { if (ev === 'DOMContentLoaded') readyFns.push(fn); },
    /* mkNode() gives every fake element the surface the real code touches.
       'template' additionally emulates <template>.content so UI.el() (used by
       UI.toast) can resolve t.content.firstElementChild like a browser does. */
    createElement: (tag) => {
      const mkNode = () => ({
        style: {}, classList: { add() {}, remove() {} }, setAttribute() {},
        appendChild() {}, querySelector: () => null, addEventListener() {},
        remove() {}, innerHTML: '', textContent: ''
      });
      const n = mkNode();
      if (tag === 'template') n.content = { firstElementChild: mkNode() };
      return n;
    },
    getElementById(id) { return els[id] || (els[id] = makeElement(id)); },
    querySelector: () => null,
    querySelectorAll: () => [],
    body: { appendChild() {}, classList: { add() {}, remove() {} } }
  };
  win.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, clear() { this._d = {}; } };
  win.console = { log: console.log, warn: () => {}, error: () => {} };
  win.setTimeout = setTimeout; win.clearTimeout = clearTimeout;
  win.Math = Math; win.Date = Date; win.JSON = JSON; win.Promise = Promise;
  win.Array = Array; win.Object = Object; win.String = String; win.Number = Number;
  win.URLSearchParams = URLSearchParams;
  win.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  win.location = { pathname: opts.path || '/lesson.html', search: '', origin: 'http://localhost', replace() {}, href: '' };
  win.navigator = { clipboard: null };

  const page = { win, els, db, metaWrites: 0, eager: !!opts.eager, fire: () => readyFns.forEach(function (f) { f({}); }) };
  /* the CDN SDK that js/supabase.js expects */
  win.supabase = { createClient: () => (page.client = makeClient(db, page)) };

  const ctx = vm.createContext(win);
  SCRIPTS.concat(DATA_SCRIPTS).forEach((rel) => {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, ctx, { filename: rel });
  });
  (opts.scripts || []).forEach((rel) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/exercises.js'), 'utf8'), ctx, { filename: 'js/exercises.js' });
  /* every real page boots the navbar chip from main.js */
  if (win.Store && win.Store.initNav) win.Store.initNav();
  return page;
}

/* Seed a signed-in user on the fake project (the same object survives reloads,
   so metadata written by updateUser() persists like a real session). */
function signUser(db, metadata) {
  const user = db.user || (db.user = { id: 'user-1', email: 'ada@example.com', user_metadata: { display_name: 'Ada Lovelace' } });
  if (metadata) user.user_metadata = Object.assign({}, user.user_metadata, metadata);
  db.session = { user: user, access_token: 'fake-token' };
  return user;
}

function courseOf(win, slug) {
  const course = win.Data.getCourse(slug);
  return { course: course, flat: win.Data.flatten(course) };
}

/* ---------- the tests ---------- */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

(async function main() {
  const COURSE = 'n8n-fundamentals';
  const db = project();
  const user = signUser(db);

  console.log('\n1) signed-in boot — hydrates from Supabase, navbar shows the account');
  let page = boot(db, {});
  await tick(40);
  let win = page.win;
  let ctx = courseOf(win, COURSE);
  const L0 = ctx.flat[0].lesson.slug;
  const COLS = 'completed,completed_at,course_slug,lesson_slug,user_id,xp';
  ok(win.SB.user && win.SB.user.email === 'ada@example.com', 'SB.user is the signed-in Supabase user');
  ok(win.Store.sessionUser() && win.Store.sessionUser().id === 'user-1', 'Store.sessionUser() returns the Supabase user');
  ok(db.selects >= 1, 'boot fetched rows from the progress table (' + db.selects + ' select)');
  ok(win.Store.read().xp === 0, 'empty table hydrates to 0 XP');
  win.Store.initNav();
  ok(/ada@example\.com/.test(page.els['nav-user'].innerHTML), 'navbar chip shows the logged-in email');
  ok(/Sign out/.test(page.els['nav-user'].innerHTML), 'navbar chip offers Sign out');
  ok(/Lv 1 · 0 XP/.test(page.els['nav-user'].innerHTML), 'navbar XP chip renders');

  console.log('\n2) marking a lesson complete upserts one progress row');
  const before = db.upserts;
  win.Store.markLessonComplete(COURSE, L0);
  await tick(40);
  ok(db.upserts === before + 1, 'exactly one upsert issued');
  const r0 = db.rows.find((r) => r.lesson_slug === L0);
  ok(!!r0, 'row exists in progress');
  ok(r0.user_id === 'user-1' && r0.course_slug === COURSE, 'row carries user_id + course_slug');
  ok(r0.completed === true && r0.xp === 10, 'row: completed=true, xp=10');
  ok(typeof r0.completed_at === 'string' && !isNaN(Date.parse(r0.completed_at)), 'row: completed_at is an ISO timestamp');
  ok(Object.keys(db.lastUpsert.payload).sort().join(',') === COLS, 'payload uses exactly the progress table columns');
  ok(db.lastUpsert.opts && db.lastUpsert.opts.onConflict === 'user_id,course_slug,lesson_slug', 'upsert keys on (user_id, course_slug, lesson_slug)');
  ok(win.Store.read().days[todayStr()] === 1, 'activity day recorded for today');

  console.log('\n3) reload in a new browser session restores progress from the rows');
  page = boot(db, {}); await tick(40); win = page.win; ctx = courseOf(win, COURSE);
  const reloaded = win.Store.read();
  ok(reloaded.xp === 10, 'XP restored from the row (10)');
  ok(!!reloaded.completed[COURSE + '/' + L0], 'completion restored');
  ok(reloaded.streak.count === 1 && reloaded.streak.best === 1, 'streak recomputed from completed_at');
  ok(reloaded.badges.indexOf('first-lesson') !== -1, 'first-lesson badge re-awarded on fetch');
  ok(win.Store.isComplete(COURSE, L0) === true, 'Store.isComplete() true after reload');

  console.log('\n4) finishing the course rolls the 200 XP bonus onto the last lesson row');
  ctx.flat.forEach((e) => win.Store.markLessonComplete(COURSE, e.lesson.slug));
  await tick(40);
  const total = ctx.flat.length * 10 + 200;
  ok(db.rows.length === ctx.flat.length, 'one row per lesson (' + db.rows.length + ')');
  ok(win.Store.read().xp === total, 'XP = lessons*10 + 200 bonus (' + win.Store.read().xp + ')');
  const lastRow = db.rows.find((r) => r.lesson_slug === ctx.flat[ctx.flat.length - 1].lesson.slug);
  ok(lastRow.xp === 210, 'last lesson row carries 10 + 200 (xp=' + lastRow.xp + ')');
  ok(win.Store.courseProgress(ctx.course).pct === 100, 'course progress is 100%');

  console.log('\n5) quiz + exercise detail persists to Supabase auth metadata (badges restore)');
  win.Store.recordQuiz(COURSE, L0, 100);
  win.Store.recordExercise(COURSE, L0, { correct: true, firstTry: true });
  const wf = ctx.flat.find((e) => e.lesson.type === 'workflow');
  win.Store.recordExercise(COURSE, wf.lesson.slug, { correct: true, firstTry: true });
  await tick(40);
  const st = win.Store.read();
  ok(st.xp === total + 25 + 15 + 15, 'quiz +25, two exercises +15 each (' + st.xp + ')');
  ok(st.scores[COURSE + '/' + L0].pct === 100, 'quiz score kept in state');
  ok(st.badges.indexOf('quiz-ace') !== -1 && st.badges.indexOf('workflow-builder') !== -1, 'quiz-ace + workflow-builder awarded');
  await tick(1400);
  const meta = user.user_metadata.forge || {};
  ok(page.metaWrites === 1, 'one debounced metadata write to Supabase auth (got ' + page.metaWrites + ')');
  ok(meta.scores && meta.scores[COURSE + '/' + L0].pct === 100, 'quiz score stored server-side');
  ok(meta.attempts && meta.attempts[COURSE + '/' + wf.lesson.slug].correct === true, 'exercise attempts stored server-side');
  ok(Array.isArray(meta.badges) && meta.badges.indexOf('quiz-ace') !== -1, 'earned badges stored server-side');

  console.log('\n6) sign out → guest fallback; sign back in → everything restored');
  await page.client.auth.signOut();
  await tick(40);
  ok(win.Store.sessionUser() === null, 'session cleared');
  ok(win.Store.read().xp === 0, 'guest state is the local (empty) store');
  ok(/Sign in/.test(page.els['nav-user'].innerHTML) && !/Sign out/.test(page.els['nav-user'].innerHTML), 'navbar switches back to the Sign in link');
  win.Store.markLessonComplete(COURSE, L0);
  await tick(40);
  ok(db.rows.length === ctx.flat.length, 'guest progress never touches the progress table');
  ok(win.Store.read().xp === 10, 'guest progress still works locally');
  signUser(db);
  page = boot(db, {}); await tick(60); win = page.win; ctx = courseOf(win, COURSE);
  const back = win.Store.read();
  ok(back.xp === total + 55, 'all XP restored after signing back in (' + back.xp + ')');
  ok(Object.keys(back.completed).length === ctx.flat.length, 'all ' + ctx.flat.length + ' completions restored');
  ok(back.scores[COURSE + '/' + L0].pct === 100, 'quiz scores restored from metadata');
  ok(back.attempts[COURSE + '/' + wf.lesson.slug].correct === true, 'exercise attempts restored from metadata');
  ok(['first-lesson', 'course-complete', 'quiz-ace', 'workflow-builder'].every((b) => back.badges.indexOf(b) !== -1), 'badges restored: ' + back.badges.join(', '));
  ok(win.Store.isComplete(COURSE, wf.lesson.slug), 'individual lesson lookups work');

  console.log('\n7) reset() clears the cloud rows');
  win.Store.reset();
  await tick(60);
  ok(db.rows.length === 0, 'all progress rows deleted from the table');
  ok(win.Store.read().xp === 0 && Object.keys(win.Store.read().completed).length === 0, 'in-memory state reset');
  ok(page.metaWrites >= 1, 'reset pushed a metadata clear to Supabase auth (writes: ' + page.metaWrites + ')');
  ok(user.user_metadata.forge && Object.keys(user.user_metadata.forge.scores).length === 0 && user.user_metadata.forge.badges.length === 0, 'metadata cleared as well');



  console.log('\n8) no composite unique key on the table: guaranteed single-row rewrite + late auth replay');
  const db2 = project(); db2.failUpsert = true; signUser(db2);
  const p2 = boot(db2, { eager: true });
  await tick(60);
  ok(p2.win.SB.user && p2.win.SB.user.email === 'ada@example.com', 'auth replay delivered the session to a late subscriber');
  ok(p2.win.Store.sessionUser() !== null, 'store picked up the session it missed');
  p2.win.Store.markLessonComplete(COURSE, L0);
  await tick(60);
  ok(db2.inserts === 1 && db2.rows.length === 1, 'row inserted via the fallback path after the upsert error');
  ok(db2.rows[0].xp === 10, 'fallback row carries the XP');
  p2.win.Store.markLessonComplete(COURSE, L0);
  p2.win.Store.recordQuiz(COURSE, L0, 80);
  await tick(60);
  ok(db2.rows.length === 1 && db2.rows[0].xp === 35, 'repeat writes rewrite the single row instead of duplicating (xp=' + db2.rows[0].xp + ')');
  db2.rows.push(Object.assign({}, db2.rows[0], { id: 'dup' }));
  db2.rows[0].xp = 1;
  const p2b = boot(db2, { eager: true });
  await tick(60);
  ok(p2b.win.Store.read().xp === 35, 'duplicate rows in the table still hydrate to the right total (' + p2b.win.Store.read().xp + ')');

  console.log('\n9) signed-out visitors stay fully functional on localStorage');
  const db3 = project();
  const p3 = boot(db3, {});
  await tick(40);
  ok(p3.win.Store.sessionUser() === null, 'no session → guest mode');
  p3.win.Store.markLessonComplete(COURSE, L0);
  await tick(30);
  ok(db3.upserts === 0 && db3.rows.length === 0, 'no Supabase writes for guests');
  ok(!!p3.win.localStorage.getItem('n8nacademy.v1'), 'progress written to localStorage instead');
  ok(p3.win.Store.read().xp === 10, 'guest XP works');

  console.log('\n10) certificate.html — guest prompt, then a permanently reprintable certificate');
  const db4 = project();
  const pg = boot(db4, { path: '/certificate.html', scripts: ['js/certificate.js'] });
  await tick(50);
  pg.fire();
  ok(/Sign in to save and retrieve your certificate permanently/.test(pg.els['cert-out'].innerHTML),
    'guests are told to sign in to keep the certificate');
  ok(/auth\.html\?next=certificate\.html/.test(pg.els['cert-out'].innerHTML), 'guest prompt links to auth.html with a return path');
  ok(pg.els['cert-go'].disabled === true, 'guest cannot generate a certificate');

  /* a member who finished the course (rows written the way the store writes them) */
  signUser(db4);
  const flat = win.Data.flatten(win.Data.getCourse(COURSE));
  flat.forEach((e, i) => db4.rows.push({
    id: 'row-' + i, user_id: 'user-1', course_slug: COURSE, lesson_slug: e.lesson.slug,
    completed: true, xp: 10, completed_at: '2026-03-0' + ((i % 9) + 1) + 'T10:00:00Z'
  }));
  const c1 = boot(db4, { path: '/certificate.html', scripts: ['js/certificate.js'] });
  await tick(60);
  c1.fire();
  const html1 = c1.els['cert-out'].innerHTML;
  ok(/class="cert"/.test(html1), 'signed-in member gets a rendered certificate');
  ok(/Credential ID/.test(html1), 'certificate shows a credential ID');
  ok(c1.els['cert-go'].disabled === false, 'the generate button is enabled for members');

  const id1 = (html1.match(/<b>([A-Z0-9]{10})<\/b>/) || [])[1];
  ok(!!id1, 'credential ID parsed: ' + id1);

  const c2 = boot(db4, { path: '/certificate.html', scripts: ['js/certificate.js'] });
  await tick(60);
  c2.fire();
  const id2 = (c2.els['cert-out'].innerHTML.match(/<b>([A-Z0-9]{10})<\/b>/) || [])[1];
  ok(id1 === id2, 'the credential ID is identical on a later visit (' + id2 + ')');

  c2.els['cert-name'].value = 'Someone Else';
  c2.els['cert-go'].click();
  const id3 = (c2.els['cert-out'].innerHTML.match(/<b>([A-Z0-9]{10})<\/b>/) || [])[1];
  ok(id3 && id3 !== id1, 'a different name produces a different credential ID');

  console.log('\n11) guest progress is offered for merge on sign-in — never dropped silently');
  const db5 = project();
  const p11 = boot(db5, {});                 /* boots with no session → guest mode */
  await tick(40);
  const w11 = p11.win;
  const flat11 = w11.Data.flatten(w11.Data.getCourse(COURSE));
  const g1 = flat11[0].lesson.slug;
  const g2 = flat11[1].lesson.slug;
  w11.Store.markLessonComplete(COURSE, g1);
  w11.Store.recordQuiz(COURSE, g1, 100);     /* +25 */
  w11.Store.markLessonComplete(COURSE, g2);  /* +10 */
  await tick(40);
  ok(!w11.Store.pendingGuestMerge(), 'no merge question while signed out');
  ok(!!w11.localStorage.getItem('n8nacademy.v1'), 'guest progress exists in local storage');
  ok(w11.Store.read().xp === 45, 'guest XP is 45 (10 + 25 quiz + 10), got ' + w11.Store.read().xp);

  signUser(db5);
  db5.listeners.forEach((f) => f('SIGNED_IN', db5.session));
  await tick(60);
  const pend = w11.Store.pendingGuestMerge();
  ok(!!pend && pend.lessons === 2 && pend.xp === 45, 'sign-in offers the merge prompt (2 lessons, 45 XP)');
  ok(w11.Store.read().xp === 0, 'nothing merged automatically — cloud state untouched until answered');
  ok(!!w11.localStorage.getItem('n8nacademy.v1'), 'local progress still intact while unanswered');

  w11.Store.mergeGuestProgress();
  await tick(80);
  const merged = w11.Store.read();
  ok(merged.xp === 45, 'merged XP equals the guest total exactly (' + merged.xp + ')');
  ok(!!merged.completed[COURSE + '/' + g1] && !!merged.completed[COURSE + '/' + g2],
    'both guest completions now live in the account');
  ok(w11.Store.pendingGuestMerge() === null, 'prompt cleared after the answer');
  ok(w11.localStorage.getItem('n8nacademy.v1') === null, 'local storage cleared only after an explicit Yes');
  await tick(80);
  ok(db5.rows.length === 2, 'rows written for the merged lessons (' + db5.rows.length + ')');
  const sumXp = db5.rows.reduce((s, r) => s + r.xp, 0);
  ok(sumXp === 45, 'row XP adds up to the guest total (' + sumXp + ')');
  const rowG1 = db5.rows.find((r) => r.lesson_slug === g1);
  ok(rowG1 && rowG1.xp === 35 && rowG1.completed === true, 'quiz XP rides on its lesson row (35)');
  await tick(1400);
  const meta5 = (db5.session && db5.session.user.user_metadata.forge) || {};
  ok(Array.isArray(meta5.badges) && meta5.badges.indexOf('first-lesson') !== -1,
    'badges derived from the merged progress reach Supabase metadata');

  console.log('\n12) answering No discards local progress — explicitly, never silently');
  const db6 = project();
  const p12 = boot(db6, {});
  await tick(40);
  const w12 = p12.win;
  w12.Store.markLessonComplete(COURSE, g1);
  await tick(30);
  ok(!!w12.localStorage.getItem('n8nacademy.v1'), 'local progress exists before sign-in');
  signUser(db6);
  db6.listeners.forEach((f) => f('SIGNED_IN', db6.session));
  await tick(60);
  ok(!!w12.Store.pendingGuestMerge(), 'prompt offered again in this window');
  w12.Store.discardGuestProgress();
  await tick(50);
  ok(w12.localStorage.getItem('n8nacademy.v1') === null, 'local progress cleared on an explicit No');
  ok(db6.rows.length === 0, 'nothing was written to the progress table');
  ok(w12.Store.pendingGuestMerge() === null, 'prompt cleared after No');

  console.log('\n13) a lesson completed on both sides is never double-counted');
  const db7 = project();
  const p13 = boot(db7, {});                 /* guest window first */
  await tick(40);
  const w13 = p13.win;
  w13.Store.markLessonComplete(COURSE, g1);
  w13.Store.recordQuiz(COURSE, g1, 100);     /* guest earns 35 on g1 */
  await tick(40);
  ok(w13.Store.read().xp === 35, 'guest XP on that lesson is 35');
  signUser(db7);
  db7.rows.push({ id: 'r-cloud', user_id: 'user-1', course_slug: COURSE, lesson_slug: g1,
    completed: true, xp: 10, completed_at: '2026-03-01T10:00:00Z' });
  db7.listeners.forEach((f) => f('SIGNED_IN', db7.session));
  await tick(60);
  ok(!!w13.Store.pendingGuestMerge(), 'prompt offered');
  ok(w13.Store.read().xp === 10, 'the account row wins before answering (10 XP)');
  w13.Store.mergeGuestProgress();
  await tick(80);
  ok(w13.Store.read().xp === 35, 'merged to 35 — the lesson is never counted twice (' + w13.Store.read().xp + ')');
  const row13 = db7.rows.find((r) => r.lesson_slug === g1);
  ok(row13 && row13.xp === 35, 'the row was rewritten with the higher XP (35)');
  ok(w13.localStorage.getItem('n8nacademy.v1') === null, 'local storage cleared after the merge');

  console.log('\n' + checks + ' checks, ' + fails + ' failures');
  process.exit(fails ? 1 : 0);
})();


