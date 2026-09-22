/* Rvencis Forge — store.js
   Progress store with two backends:
   • guest  — localStorage-backed (unchanged behaviour: works on file://,
     private windows and offline; data stays in this browser)
   • member — Supabase-backed. When signed in, the user's rows are fetched
     from the `progress` table on page load: completion timestamps, XP (each
     row's xp column), activity days and streaks are recomputed from the rows,
     badges re-evaluate, and every XP event upserts the affected lesson row
     { user_id, course_slug, lesson_slug, completed, xp, completed_at } so
     progress survives browsers and devices.
   Tiny pub/sub keeps the navbar XP chip, lesson sidebar and dashboard in sync.
   All access is guarded: some browsers (e.g. Safari on file://) throw on
   localStorage, in which case an in-memory fallback keeps pages working; if
   Supabase is unreachable the store simply keeps guest behaviour. */
(function (global) {
  'use strict';

  var KEY = 'n8nacademy.v1'; /* legacy storage key (pre-rebrand) kept so existing learners keep their guest progress */
  var listeners = [];
  var memory = null;         /* fallback when storage is unavailable */

  var cloudUser = null;      /* Supabase user when signed in */
  var cloudState = null;     /* hydrated state for the signed-in user */
  var cloudLoaded = false;
  var cloudLoading = false;
  var lessonXp = {};         /* '<course>/<lesson>' -> xp carried by that lesson's row */
  var syncToastShown = false;
  var mergePending = null;   /* { lessons, xp } while the guest-merge question is open */

  function defaults() {
    return {
      user: null,            /* { name, email, guest:bool } */
      xp: 0,
      completed: {},         /* { '<course>/<lesson>': timestamp } */
      scores: {},            /* { '<course>/<lesson>': { pct, attempts } } */
      attempts: {},          /* { '<course>/<lesson>': { correct, firstTryCorrect } } */
      badges: [],            /* [badgeId,...] */
      days: {},              /* { 'YYYY-MM-DD': activityCount } */
      streak: { count: 0, best: 0, lastDay: null },
      lastLesson: null       /* '<course>/<lesson>' for "Continue" */
    };
  }

  function sb() { return (global.SB && global.SB.client) || null; }

  function notify(s) {
    listeners.forEach(function (fn) { try { fn(s); } catch (err) { /* keep others alive */ } });
  }

  /* ---------- guest backend (localStorage) ---------- */
  function readGuest() {
    if (memory) return memory;
    try {
      var raw = global.localStorage.getItem(KEY);
      return raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
    } catch (e) {
      memory = defaults();
      return memory;
    }
  }

  function writeGuest(state) {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { memory = state; }
  }

  function read() {
    if (cloudUser) return cloudState || defaults();
    return readGuest();
  }

  function on(fn) { listeners.push(fn); }
  function off(fn) { listeners = listeners.filter(function (f) { return f !== fn; }); }

  /* ---------- state mutation ---------- */
  /* fn mutates the state; dirtyKey ('course/lesson') marks the lesson whose
     progress row must be re-saved — its row xp absorbs any XP the event adds. */
  function patch(fn, dirtyKey) {
    var state = read();
    var xpBefore = state.xp;
    fn(state);
    evaluateBadges(state);
    if (cloudUser) {
      if (dirtyKey && state.xp !== xpBefore) {
        lessonXp[dirtyKey] = (lessonXp[dirtyKey] || 0) + (state.xp - xpBefore);
      }
      cloudState = state;
      if (dirtyKey) flushRow(dirtyKey);
      persistMeta();
      notify(state);
    } else {
      writeGuest(state);
      notify(state);
    }
    return state;
  }

  /* ---------- cloud backend (Supabase `progress` table) ---------- */
  function syncWarn(err) {
    var msg = (err && (err.message || err)) || 'unknown error';
    if (global.console) console.error('[store] Supabase write failed:', msg);
    if (global.UI && UI.toast && !syncToastShown) {
      syncToastShown = true;
      UI.toast(/row-level security|permission denied/i.test(String(msg))
        ? 'Cloud sync blocked — the progress table needs an RLS policy for auth.uid() = user_id.'
        : 'Cloud sync failed — progress stays on this device for now.', 'danger', 6000);
    }
  }

  /* Writes for one lesson are chained so they can never interleave: the last
     state always wins and a lesson can never end up with two rows. `epoch`
     invalidates in-flight work when the user signs out or resets progress. */
  var queues = {}, epoch = 0;

  function flushRow(key) {
    var client = sb();
    if (!client || !cloudUser || !cloudState) return;
    var parts = key.split('/');
    var userId = cloudUser.id;
    var row = {
      user_id: userId,
      course_slug: parts[0],
      lesson_slug: parts[1],
      completed: !!cloudState.completed[key],
      completed_at: cloudState.completed[key] ? new Date(cloudState.completed[key]).toISOString() : null,
      xp: lessonXp[key] || 0
    };
    var mine = epoch;
    queues[key] = (queues[key] || Promise.resolve())
      .then(function () {
        var c = sb();
        if (mine !== epoch || !c || !cloudUser || cloudUser.id !== userId) return;
        return c.from('progress')
          .upsert(row, { onConflict: 'user_id,course_slug,lesson_slug' })
          .then(function (res) {
            /* no composite unique key on the table? rewrite the row instead */
            if (res.error) repairRow(row, res.error, mine);
          });
      })
      .catch(function (e) { syncWarn(e); });
  }

  /* The deployed `progress` table has no composite unique key (Postgres answers
     42P10 for the atomic upsert above), so the fallback rewrites the row: it
     deletes anything already stored for this lesson and inserts exactly one.
     Same end state as an upsert, and repeated writes cannot inflate XP. */
  function repairRow(row, err, mine) {
    var client = sb();
    if (!client || !cloudUser) return;
    if (global.console) console.warn('[store] upsert unavailable, rewriting row via delete→insert:', err && err.message);
    client.from('progress').delete()
      .eq('user_id', row.user_id).eq('course_slug', row.course_slug).eq('lesson_slug', row.lesson_slug)
      .then(function (del) {
        if (del.error) return syncWarn(del.error);
        if (mine !== epoch) return;
        client.from('progress').insert(row).then(function (r2) { if (r2.error) syncWarn(r2.error); });
      });
  }

  /* Quiz scores, exercise attempts and earned badges cannot be derived from the
     `progress` rows alone (the table only carries completion + xp per lesson),
     so they ride along in the user's Supabase auth metadata — still
     server-side, still restored on any device. Debounced to one write per
     burst of activity, and fails soft if the call is unavailable. */
  var metaTimer = null;
  function persistMeta() {
    var client = sb();
    if (!client || !cloudUser || !cloudState) return;
    if (!client.auth || typeof client.auth.updateUser !== 'function') return;
    if (metaTimer) clearTimeout(metaTimer);
    metaTimer = setTimeout(function () {
      metaTimer = null;
      if (!cloudUser || !cloudState) return;
      var res = client.auth.updateUser({
        data: {
          forge: {
            scores: cloudState.scores,
            attempts: cloudState.attempts,
            badges: cloudState.badges,
            lastLesson: cloudState.lastLesson
          }
        }
      });
      if (res && res.then) res.then(function (r) { if (r && r.error) syncWarn(r.error); });
    }, 1200);
  }

  /* ---------- hydration: rebuild state from the user's rows ---------- */
  function dayStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayDiff(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
  }

  /* Streaks come from the completion days on the rows. */
  function recomputeStreak(state) {
    var keys = Object.keys(state.days).sort();
    var best = 0, run = 0, prev = null;
    keys.forEach(function (k) {
      run = (prev !== null && dayDiff(prev, k) === 1) ? run + 1 : 1;
      prev = k;
      if (run > best) best = run;
    });
    var cursor = new Date();
    if (!state.days[dayStr(cursor)]) cursor.setDate(cursor.getDate() - 1); /* yesterday keeps a streak alive */
    var count = 0;
    while (state.days[dayStr(cursor)]) { count++; cursor.setDate(cursor.getDate() - 1); }
    state.streak = { count: count, best: Math.max(best, count), lastDay: keys.length ? keys[keys.length - 1] : null };
  }

  function hydrateFromRows(rows, user) {
    var state = defaults();
    lessonXp = {};
    /* Collapse to one entry per lesson first — highest XP, newest timestamp win
       — so a table holding duplicate rows (possible until the composite unique
       key is added) still hydrates to exactly the same totals as a clean one. */
    var byKey = {};
    (rows || []).forEach(function (r) {
      if (!r || !r.course_slug || !r.lesson_slug) return;
      var key = r.course_slug + '/' + r.lesson_slug;
      var ts = r.completed && r.completed_at ? new Date(r.completed_at).getTime() : NaN;
      var e = byKey[key] || (byKey[key] = { xp: 0, ts: NaN });
      e.xp = Math.max(e.xp, r.xp || 0);
      if (!isNaN(ts) && (isNaN(e.ts) || ts > e.ts)) e.ts = ts;
    });
    var total = 0, latestTs = 0, latestKey = null;
    Object.keys(byKey).forEach(function (key) {
      var e = byKey[key];
      lessonXp[key] = e.xp;
      total += e.xp;
      if (!isNaN(e.ts)) {
        state.completed[key] = e.ts;
        state.days[dayStr(new Date(e.ts))] = 1;
        if (e.ts > latestTs) { latestTs = e.ts; latestKey = key; }
      }
    });
    state.xp = total;
    var meta = user.user_metadata || {};
    state.user = {
      name: meta.display_name || meta.name || meta.full_name || (user.email ? String(user.email).split('@')[0] : 'Learner'),
      email: user.email || '',
      guest: false
    };
    recomputeStreak(state);
    state.lastLesson = latestKey;

    /* Merge the non-derivable detail (scores, attempts, badges) kept in the
       user's auth metadata, then let evaluateBadges() top it up from rows. */
    var fmeta = meta.forge || {};
    if (fmeta.scores && typeof fmeta.scores === 'object') state.scores = fmeta.scores;
    if (fmeta.attempts && typeof fmeta.attempts === 'object') state.attempts = fmeta.attempts;
    if (Array.isArray(fmeta.badges)) state.badges = fmeta.badges.slice();
    if (!state.lastLesson && fmeta.lastLesson) state.lastLesson = fmeta.lastLesson;

    return state;
  }

  function loadCloud() {
    var client = sb();
    if (!client || !cloudUser || cloudLoading) return;
    cloudLoading = true;
    client.from('progress').select('*').eq('user_id', cloudUser.id).order('completed_at', { ascending: true })
      .then(function (res) {
        cloudLoading = false;
        if (res.error && global.console) console.error('[store] progress fetch failed:', res.error.message);
        cloudState = hydrateFromRows(res.error ? [] : (res.data || []), cloudUser);
        cloudLoaded = true;
        var badgesBefore = cloudState.badges.length;
        evaluateBadges(cloudState);
        /* first sign-in on a fresh device: badges derived from the rows need to
           reach the auth metadata once, so other devices see them too */
        if (cloudState.badges.length !== badgesBefore) persistMeta();
        notify(cloudState);
        /* Sign-in finished — if this browser still holds guest progress, ask
           the learner what to do with it instead of dropping it silently. */
        maybeOfferMerge();
      });
  }

  function applySession(user) {
    var prevId = cloudUser ? cloudUser.id : null;
    var nextId = user ? user.id : null;
    if (prevId === nextId) {
      /* same session (INITIAL_SESSION / TOKEN_REFRESHED) — hydrate once if needed */
      if (nextId && !cloudLoaded && !cloudLoading) loadCloud();
      return;
    }
    cloudUser = user || null;
    cloudState = null;
    cloudLoaded = false;
    cloudLoading = false;
    lessonXp = {};
    epoch += 1;          /* pending writes belong to the previous session */
    queues = {};
    mergePending = null;   /* an open question belongs to the previous session */
    removeMergeBanner();
    if (cloudUser) loadCloud();
    else notify(readGuest());      /* signed out: the local store is live again */
  }

  /* ---------- guest → account merge ----------
     A learner who built up progress as a guest may later create an account.
     On sign-in we detect that local history and ask explicitly:
       Yes → merge it into the account (rows + metadata) and clear local storage
       No  → discard local storage — but only after that explicit answer
     Nothing local is ever dropped without the learner's choice. */
  function guestSummary() {
    var local;
    try { local = readGuest(); } catch (e) { return null; }
    var lessons = Object.keys((local && local.completed) || {}).length;
    if (!lessons) return null;
    return { lessons: lessons, xp: (local && local.xp) || 0 };
  }

  function clearGuestProgress() {
    try { global.localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
    memory = null;
  }

  /* Per-lesson XP implied by a guest state, using the same rules as
     markLessonComplete(), recordQuiz() and recordExercise(). The guest state
     keeps only the total, so re-derive the split and reconcile the remainder
     against local.xp — no XP is lost and none is invented. */
  function deriveGuestXp(local) {
    var per = {};
    Object.keys(local.completed || {}).forEach(function (key) { per[key] = 10; });
    Object.keys(local.scores || {}).forEach(function (key) {
      var s = local.scores[key];
      if (s && s.pct >= 80) per[key] = (per[key] || 0) + 25;
    });
    Object.keys(local.attempts || {}).forEach(function (key) {
      var a = local.attempts[key];
      if (a && a.correct) per[key] = (per[key] || 0) + (a.firstTryCorrect ? 15 : 8);
    });
    if (global.Data) {
      Data.courses().forEach(function (course) {
        var list = Data.flatten(course);
        var allDone = list.length > 0 && list.every(function (e) {
          return local.completed && local.completed[course.slug + '/' + e.lesson.slug];
        });
        if (allDone) {
          var lastKey = course.slug + '/' + list[list.length - 1].lesson.slug;
          if (per[lastKey]) per[lastKey] += 200;
        }
      });
    }
    var keys = Object.keys(per);
    var derived = keys.reduce(function (sum, k) { return sum + per[k]; }, 0);
    var diff = (local.xp || 0) - derived;
    if (diff !== 0 && keys.length) {
      var last = keys[keys.length - 1];
      if (per[last] + diff >= 0) {
        per[last] += diff;
      } else {
        var n = keys.length;
        var base = Math.floor((local.xp || 0) / n);
        var rem = (local.xp || 0) % n;
        keys.forEach(function (k, i) { per[k] = base + (i < rem ? 1 : 0); });
      }
    }
    return per;
  }

  function maybeOfferMerge() {
    if (!cloudUser) return;
    var summary = guestSummary();
    if (!summary) return;
    mergePending = summary;
    renderMergeBanner();
  }

  function removeMergeBanner() {
    if (!global.document || !document.getElementById) return;
    var el = document.getElementById('guest-merge-banner');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* Banner reuses the existing .callout/.btn classes — no CSS changes. */
  function renderMergeBanner() {
    if (!mergePending || !global.document || !document.getElementById) return;
    if (document.getElementById('guest-merge-banner')) return;
    var mount = document.getElementById('main');
    if (!mount || typeof mount.insertBefore !== 'function') return;
    var esc = (global.UI && UI.esc) || function (s) { return String(s); };
    var box = document.createElement('div');
    box.className = 'callout callout-info';
    box.id = 'guest-merge-banner';
    box.setAttribute('role', 'status');
    box.innerHTML = '<strong>You have local progress from before signing in.</strong> ' +
      esc(String(mergePending.lessons)) + ' completed lesson' + (mergePending.lessons === 1 ? '' : 's') +
      ' (' + esc(String(mergePending.xp)) + ' XP) live in this browser — ' +
      'would you like to sync it to your account? ' +
      '<button class="btn btn-primary btn-sm" id="guest-merge-yes" type="button">Yes, sync it</button> ' +
      '<button class="btn btn-ghost btn-sm" id="guest-merge-no" type="button">No, discard local progress</button>';
    mount.insertBefore(box, mount.firstChild);
    var yes = document.getElementById('guest-merge-yes');
    var no = document.getElementById('guest-merge-no');
    if (yes) yes.addEventListener('click', mergeGuestProgress);
    if (no) no.addEventListener('click', discardGuestProgress);
  }

  function mergeGuestProgress() {
    if (!cloudUser || !mergePending || !cloudState) return;
    var local;
    try { local = readGuest(); } catch (e) { local = null; }
    if (!local) return;
    var state = cloudState;
    var per = deriveGuestXp(local);
    var keys = Object.keys(per);

    keys.forEach(function (key) {
      /* completions: union — cloud timestamp wins, local fills the gaps */
      if (!state.completed[key] && local.completed[key]) state.completed[key] = local.completed[key];
      /* XP: keep the higher side per lesson, so a lesson completed on both
         sides is never inflated and nothing the guest earned is dropped */
      lessonXp[key] = Math.max(lessonXp[key] || 0, per[key]);
    });

    Object.keys(local.scores || {}).forEach(function (key) {
      var ls = local.scores[key];
      var cs = state.scores[key];
      if (!cs) { state.scores[key] = Object.assign({}, ls); return; }
      state.scores[key] = {
        pct: Math.max(cs.pct || 0, ls.pct || 0),
        attempts: Math.max(cs.attempts || 0, ls.attempts || 0)
      };
    });
    Object.keys(local.attempts || {}).forEach(function (key) {
      var la = local.attempts[key] || {};
      var ca = state.attempts[key];
      if (!ca) { state.attempts[key] = Object.assign({}, la); return; }
      ca.correct = !!(ca.correct || la.correct);
      ca.everWrong = !!(ca.everWrong || la.everWrong);
      if (typeof la.firstTryCorrect === 'boolean') {
        ca.firstTryCorrect = (typeof ca.firstTryCorrect === 'boolean')
          ? (ca.firstTryCorrect && la.firstTryCorrect) : la.firstTryCorrect;
      }
    });
    (local.badges || []).forEach(function (id) {
      if (state.badges.indexOf(id) === -1) state.badges.push(id);
    });
    Object.keys(local.days || {}).forEach(function (key) {
      state.days[key] = Math.max(state.days[key] || 0, local.days[key] || 0);
    });
    if (!state.lastLesson && local.lastLesson) state.lastLesson = local.lastLesson;

    recomputeStreak(state);
    /* state.xp must stay equal to the sum of every row's xp */
    var total = 0;
    Object.keys(lessonXp).forEach(function (k) { total += lessonXp[k] || 0; });
    state.xp = total;
    evaluateBadges(state);

    cloudState = state;
    keys.forEach(function (key) { flushRow(key); });
    persistMeta();
    clearGuestProgress();
    mergePending = null;
    removeMergeBanner();
    notify(state);
    if (global.UI && UI.toast) {
      UI.toast('Local progress synced — ' + keys.length + ' lesson' +
        (keys.length === 1 ? '' : 's') + ' merged into your account.', 'success');
    }
  }

  function discardGuestProgress() {
    if (!cloudUser || !mergePending) return;
    clearGuestProgress();
    mergePending = null;
    removeMergeBanner();
    notify(read());
    if (global.UI && UI.toast) UI.toast('Local progress discarded.', 'info');
  }

  /* Wire the store to the auth lifecycle as soon as scripts load. */
  if (global.SB && global.SB.onAuth) global.SB.onAuth(applySession);

  /* ---------- XP / levels ---------- */
  /* level n starts at 60 * (n-1)^2 XP */
  function levelFor(xp) {
    var lvl = Math.floor(Math.sqrt(xp / 60)) + 1;
    var start = 60 * Math.pow(lvl - 1, 2);
    var nextAt = 60 * Math.pow(lvl, 2);
    return { level: lvl, start: start, nextAt: nextAt, pct: Math.min(100, Math.round(((xp - start) / (nextAt - start)) * 100)) };
  }

  function addXp(state, amount) { state.xp += amount; }

  /* ---------- streaks (local calendar days) ---------- */
  function todayStr() { return dayStr(new Date()); }
  function yesterdayStr() {
    var d = new Date(); d.setDate(d.getDate() - 1);
    return dayStr(d);
  }

  function touchDay(state) {
    var today = todayStr();
    state.days[today] = (state.days[today] || 0) + 1;
    if (state.streak.lastDay !== today) {
      state.streak.count = (state.streak.lastDay === yesterdayStr()) ? state.streak.count + 1 : 1;
      state.streak.lastDay = today;
      state.streak.best = Math.max(state.streak.best, state.streak.count);
    }
  }

  /* ---------- completion ---------- */
  function markLessonComplete(courseSlug, lessonSlug) {
    return patch(function (state) {
      var key = courseSlug + '/' + lessonSlug;
      var firstTime = !state.completed[key];
      if (firstTime) {
        state.completed[key] = Date.now();
        addXp(state, 10);
        touchDay(state);
        state.lastLesson = key;
        var course = (global.Data && Data.getCourse(courseSlug)) || null;
        if (course) {
          var all = Data.flatten(course);
          var done = all.filter(function (e) { return state.completed[courseSlug + '/' + e.lesson.slug]; }).length;
          if (done === all.length) addXp(state, 200); /* course finished bonus — carried by this lesson's row */
        }
      }
    }, courseSlug + '/' + lessonSlug);
  }

  function recordExercise(courseSlug, lessonSlug, result) {
    return patch(function (state) {
      var key = courseSlug + '/' + lessonSlug;
      var prevAttempt = state.attempts[key] || {};
      var firstTryCorrect = !!result.correct && !prevAttempt.everWrong && !(prevAttempt.correct === true && prevAttempt.firstTryCorrect === false);
      if (result.correct && !prevAttempt.correct) addXp(state, result.firstTry === false ? 8 : 15);
      if (!result.correct) prevAttempt.everWrong = true;
      state.attempts[key] = Object.assign({}, prevAttempt, { correct: !!result.correct || !!prevAttempt.correct, firstTryCorrect: firstTryCorrect });
      if (result.correct) touchDay(state);
    }, courseSlug + '/' + lessonSlug);
  }

  function recordQuiz(courseSlug, lessonSlug, pct) {
    return patch(function (state) {
      var key = courseSlug + '/' + lessonSlug;
      var entry = state.scores[key] || { pct: 0, attempts: 0 };
      entry.attempts += 1;
      entry.pct = Math.max(entry.pct, pct);
      state.scores[key] = entry;
      if (pct >= 80) { addXp(state, 25); touchDay(state); state.lastLesson = key; }
    }, courseSlug + '/' + lessonSlug);
  }

  function isComplete(courseSlug, lessonSlug) {
    return !!read().completed[courseSlug + '/' + lessonSlug];
  }

  function courseProgress(course) {
    var all = (global.Data && Data.flatten(course)) || [];
    var state = read();
    var done = all.filter(function (e) { return state.completed[course.slug + '/' + e.lesson.slug]; }).length;
    return { done: done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  }

  function nextIncomplete(course) {
    var state = read();
    var list = (global.Data && Data.flatten(course)) || [];
    for (var i = 0; i < list.length; i++) {
      if (!state.completed[course.slug + '/' + list[i].lesson.slug]) return list[i];
    }
    return null;
  }

  /* ---------- badges ---------- */
  function pathComplete(state, path) {
    var courseSlugs = path.courses || [];
    var course = null;
    for (var ci = 0; ci < courseSlugs.length; ci++) {
      course = (global.Data && Data.getCourse(courseSlugs[ci])) || null;
      if (!course) continue;
      var list = Data.flatten(course);
      for (var i = 0; i < list.length; i++) {
        if (!state.completed[course.slug + '/' + list[i].lesson.slug]) return false;
      }
    }
    return courseSlugs.length > 0;
  }

  function evaluateBadges(state) {
    var earned = state.badges || [];
    function give(id) { if (earned.indexOf(id) === -1) earned.push(id); }

    var completedCount = Object.keys(state.completed).length;
    if (completedCount >= 1) give('first-lesson');
    if (state.streak.count >= 3 || state.streak.best >= 3) give('streak-3');
    if (state.streak.count >= 7 || state.streak.best >= 7) give('streak-7');
    if (Object.keys(state.scores).some(function (k) { return state.scores[k].pct === 100; })) give('quiz-ace');
    if (state.xp >= 1000) give('xp-1000');

    if (global.Data) {
      Object.keys(state.attempts).forEach(function (key) {
        var a = state.attempts[key];
        if (!a.correct) return;
        var parts = key.split('/');
        var lesson = Data.getLesson(parts[0], parts[1]);
        if (lesson && lesson.lesson.type === 'workflow') give('workflow-builder');
      });
      Data.courses().forEach(function (course) {
        var list = Data.flatten(course);
        var allDone = list.length > 0 && list.every(function (e) { return state.completed[course.slug + '/' + e.lesson.slug]; });
        if (allDone) give('course-complete');
      });
      (global.N8N_PATHS || []).forEach(function (p) {
        if (pathComplete(state, p)) give('path-complete');
      });
    }
    state.badges = earned;
  }

  function earnedBadges() {
    var state = read();
    var defs = global.N8N_BADGES || [];
    return defs.map(function (b) {
      return Object.assign({}, b, { earned: state.badges.indexOf(b.id) !== -1 });
    });
  }

  /* ---------- import / export / reset ---------- */
  function exportData() {
    var s = read();
    if (cloudUser) {
      /* include the per-lesson xp split so a re-import can restore rows exactly */
      var copy = JSON.parse(JSON.stringify(s));
      copy.lessonXp = JSON.parse(JSON.stringify(lessonXp));
      return JSON.stringify(copy, null, 2);
    }
    return JSON.stringify(s, null, 2);
  }

  function importData(json) {
    var parsed = JSON.parse(json);
    var state = Object.assign(defaults(), parsed);
    evaluateBadges(state);
    if (cloudUser) {
      cloudState = state;
      lessonXp = {};
      Object.keys(state.completed).forEach(function (key) {
        lessonXp[key] = (parsed.lessonXp && parsed.lessonXp[key]) || 10;
      });
      Object.keys(lessonXp).forEach(function (k) { flushRow(k); });
      persistMeta();
      notify(state);
    } else {
      writeGuest(state);
      notify(state);
    }
    return true;
  }

  function reset() {
    if (cloudUser) {
      var client = sb();
      epoch += 1;        /* drop any writes still queued for the old progress */
      queues = {};
      lessonXp = {};
      cloudState = defaults();
      var meta = cloudUser.user_metadata || {};
      cloudState.user = {
        name: meta.display_name || meta.name || (cloudUser.email || '').split('@')[0],
        email: cloudUser.email || '',
        guest: false
      };
      if (client) {
        client.from('progress').delete().eq('user_id', cloudUser.id)
          .then(function (res) { if (res.error) syncWarn(res.error); });
        /* wipe the badge / quiz detail kept in the user's auth metadata too */
        if (client.auth && typeof client.auth.updateUser === 'function') {
          var clear = client.auth.updateUser({ data: { forge: { scores: {}, attempts: {}, badges: [], lastLesson: null } } });
          if (clear && clear.then) clear.then(function (r) { if (r && r.error) syncWarn(r.error); });
        }
      }
      notify(cloudState);
    } else {
      writeGuest(defaults());
      notify(readGuest());
    }
  }

  /* ---------- navbar user chip ---------- */
  function initNav() {
    var mount = document.getElementById('nav-user');
    if (!mount || !global.UI) return;
    function render() {
      var state = read();
      if (cloudUser) {
        var lvl = levelFor(state.xp);
        var email = (cloudUser.email || '').trim();
        var label = email || (state.user && state.user.name) || 'Account';
        mount.innerHTML =
          '<a class="nav-xp" href="dashboard.html" title="Level ' + lvl.level + ' · ' + state.xp + ' XP">' +
            '<span class="nav-xp-dot"></span>Lv ' + lvl.level + ' · ' + state.xp + ' XP' +
          '</a>' +
          '<a class="btn btn-ghost btn-sm" href="dashboard.html" title="Signed in as ' + UI.esc(email || label) + '">' + UI.esc(label) + '</a>' +
          '<button class="btn btn-ghost btn-sm" id="nav-signout" type="button">Sign out</button>';
        var btn = document.getElementById('nav-signout');
        if (btn && global.SB && global.SB.client) {
          btn.addEventListener('click', function () {
            var memberPage = /dashboard\.html$|certificate\.html$/.test(location.pathname);
            global.SB.client.auth.signOut().then(function () {
              if (memberPage) location.replace('index.html');
            });
          });
        }
      } else {
        mount.innerHTML = '<a class="btn btn-primary btn-sm" href="auth.html">Sign in</a>';
      }
    }
    render();
    on(render);
  }

  /* ---------- public API ---------- */
  global.Store = {
    on: on, off: off, read: read, update: patch,
    markLessonComplete: markLessonComplete,
    recordExercise: recordExercise,
    recordQuiz: recordQuiz,
    isComplete: isComplete,
    courseProgress: courseProgress,
    nextIncomplete: nextIncomplete,
    levelFor: levelFor,
    earnedBadges: earnedBadges,
    exportData: exportData,
    importData: importData,
    reset: reset,
    initNav: initNav,
    pendingGuestMerge: function () { return mergePending; },
    mergeGuestProgress: mergeGuestProgress,
    discardGuestProgress: discardGuestProgress,
    sessionUser: function () { return cloudUser; }  /* Supabase user or null */
  };
})(window);
