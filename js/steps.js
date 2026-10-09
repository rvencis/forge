/* Rvencis Forge — js/steps.js
   The DataCamp-style step runner: one lesson = three isolated views
   (Video ➔ Practice ➔ Quiz) behind a distraction-free focus shell.

   Routes (query params keep GitHub Pages + file:// happy):
     lesson.html?course=<course>&lesson=<lesson>&step=watch|practice|quiz

   Gating:
     * watch    — always open; recording it unlocks practice
     * practice — unlocks after watch; completes when every self-check is ticked
     * quiz     — unlocks after practice; only a 100% pass calls
                  Store.markLessonComplete(), which unlocks the next lesson
   Depends on: Data, UI, Store, LessonContent (js/lesson.js), Exercises (optional). */
(function () {
  'use strict';

  var STEP_ORDER = ['watch', 'practice', 'quiz'];
  var STEP_LABEL = { watch: 'Video', practice: 'Practice', quiz: 'Quiz' };

  /* The mounted practice canvas (js/simulator.js), if any. render() replaces
     #step-main wholesale, so the previous backend is destroyed here rather
     than left holding document-level listeners. */
  var activeSim = null;
  function destroySim() {
    if (activeSim && typeof activeSim.destroy === 'function') {
      try { activeSim.destroy(); } catch (e) { /* teardown must never throw */ }
    }
    activeSim = null;
  }

  /* ---------- route ---------- */
  function route() {
    var p = new URLSearchParams(window.location.search);
    return { course: p.get('course'), lesson: p.get('lesson'), step: p.get('step') };
  }

  function hrefFor(courseSlug, lessonSlug, step) {
    return UI.lessonStepHref(courseSlug, lessonSlug, step);
  }

  function go(entry, step, replace) {
    var url = hrefFor(entry.course.slug, entry.lesson.slug, step);
    if (replace) window.history.replaceState({ step: step }, '', url);
    else window.history.pushState({ step: step }, '', url);
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- step resolution ---------- */
  /* Furthest step the learner has earned: watch → practice → quiz chain. */
  function furthestIndex(entry) {
    var s = Store.stepState(entry.course.slug, entry.lesson.slug);
    var i = 0;
    if (s.watch) i = 1;
    if (s.practice) i = 2;
    return i;
  }

  function resolveStep(entry, requested) {
    var max = furthestIndex(entry);
    if (!requested) {
      /* no ?step= → resume where they left off (or review at the video) */
      return Store.isComplete(entry.course.slug, entry.lesson.slug) ? 'watch' : STEP_ORDER[max];
    }
    var idx = STEP_ORDER.indexOf(requested);
    if (idx === -1) return 'watch';
    if (idx > max) return STEP_ORDER[max]; /* silently clamp forward jumps */
    return STEP_ORDER[idx];
  }

  /* ---------- step content ---------- */
  /* Authoring guarantees video/practice/quiz for every lesson (validate.js
     enforces it); this fallback keeps any hand-made or stub lesson renderable. */
  function stepsFor(entry) {
    var key = entry.course.slug + '/' + entry.lesson.slug;
    var authored = (window.N8N_STEPS || {})[key];
    var content = entry.content || {};
    if (authored) return authored;
    var firstP = (content.blocks || []).filter(function (b) { return b.t === 'p'; })[0];
    var check = (content.blocks || []).filter(function (b) { return b.t === 'checklist'; })[0];
    return {
      video: {
        title: entry.lesson.title,
        concept: '<p>' + (firstP ? firstP.html : 'This lesson has no recorded video notes yet — the concept is below.') + '</p>',
        minutes: entry.lesson.minutes || 5,
        takeaways: (check && check.items ? check.items : ['Read the concept, complete the task, then prove it in the quiz.']).slice(0, 3)
      },
      practice: {
        objective: 'Open your local n8n canvas and work through the lesson task.',
        steps: [{ title: 'Read the concept', detail: 'Expand "Read the concept" under the video and work through it.' }],
        checklist: ['I worked through the task in my local canvas'],
        workspace: { url: 'http://localhost:5678', label: 'Open Local n8n Canvas' }
      },
      quiz: {
        passPct: 100,
        questions: [{
          type: 'mcq', q: 'Did you work through this lesson in your local n8n canvas?',
          options: ['Yes', 'Not yet'], answer: [0],
          why: 'The gate asks you to confirm the hands-on task before moving on.',
          hint: 'Complete the practice step first.'
        }]
      }
    };
  }

  /* ---------- focus bar (the only chrome inside a lesson) ----------
     The practice view is a full-height IDE, so its bar carries an explicit
     step navigation instead of only the course exit. */
  function focusBarHtml(entry, stepIdx) {
    var course = entry.course, lesson = entry.lesson;
    var num = Data.lessonNumber(course, lesson.slug);
    var st = Store.stepState(course.slug, lesson.slug);
    var state = Store.read();
    var lvl = Store.levelFor(state.xp);
    var done = Store.isComplete(course.slug, lesson.slug);
    var step = STEP_ORDER[stepIdx];
    var back = stepIdx > 0
      ? '<a class="focus-back" href="' + hrefFor(course.slug, lesson.slug, STEP_ORDER[stepIdx - 1]) +
        '" data-step="' + STEP_ORDER[stepIdx - 1] + '">' + UI.icon('arrow', 16) +
        '<span>Back to ' + STEP_LABEL[STEP_ORDER[stepIdx - 1]] + '</span></a>'
      : '<a class="focus-exit" href="course.html?slug=' + encodeURIComponent(course.slug) + '">' +
        UI.icon('arrow', 16) + '<span>Back to course</span></a>';
    return '' +
      back +
      '<div class="focus-mid">' +
        '<span class="focus-label">Lesson ' + UI.esc(num.display || '—') +
          ' <span class="focus-sep">·</span> Step ' + (stepIdx + 1) + ' of 3' +
          ' <span class="focus-sep">·</span> ' + STEP_LABEL[step] +
          (done ? ' <span class="focus-done">' + UI.icon('check', 12) + 'Completed</span>' : '') +
        '</span>' +
        UI.stepProgress(stepIdx, [st.watch, st.practice, st.quiz]) +
      '</div>' +
      '<div class="focus-stats">' +
        '<span class="focus-chip" title="Day streak">' + UI.icon('flame', 14) + (state.streak.count || 0) + '</span>' +
        '<span class="focus-chip" title="Level ' + lvl.level + '">' + UI.icon('bolt', 14) + 'Lv ' + lvl.level + ' · ' + state.xp + ' XP</span>' +
      '</div>';
  }

  function renderFocusBar(entry, stepIdx) {
    var bar = document.getElementById('focus-bar');
    if (bar) bar.innerHTML = focusBarHtml(entry, stepIdx);
  }

  /* ---------- shared view helpers ---------- */
  function backLink(entry, step, label) {
    return '<a class="step-back" href="' + hrefFor(entry.course.slug, entry.lesson.slug, step) + '" data-step="' + step + '">' +
      UI.icon('arrow', 14) + UI.esc(label) + '</a>';
  }

  /* Intercept same-lesson step links so navigation stays pushState-driven. */
  function wireStepLinks(root, entry) {
    root.querySelectorAll('a[data-step]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        go(entry, a.getAttribute('data-step'));
      });
    });
  }

  /* ---------- render ---------- */
  function render() {
    destroySim();
    var r = route();
    var course = Data.getCourse(r.course);
    if (!course) { renderPick(); return; }

    var lessonSlug = r.lesson;
    var entry = lessonSlug ? Data.getLessonOrStub(course.slug, lessonSlug) : null;
    if (!entry) {
      var start = Store.nextIncomplete(course) || Data.firstLesson(course);
      window.location.replace(UI.lessonHref(course.slug, start.lesson.slug));
      return;
    }

    /* Lesson lock: only the first lesson and any lesson after a completed
       one are reachable; everyone else lands on the next open lesson. */
    if (!Store.isUnlocked(course.slug, entry.lesson.slug)) {
      var target = Store.nextIncomplete(course) || Data.firstLesson(course);
      if (UI.toast) UI.toast('Finish the previous lesson to unlock this one.', 'info');
      window.location.replace(UI.lessonStepHref(course.slug, target.lesson.slug, 'watch'));
      return;
    }

    var step = resolveStep(entry, r.step);
    var idx = STEP_ORDER.indexOf(step);
    if (r.step !== step) {
      window.history.replaceState({ step: step }, '', hrefFor(course.slug, entry.lesson.slug, step));
    }

    document.title = entry.lesson.title + ' — ' + STEP_LABEL[step] + ' | Rvencis Forge';
    renderFocusBar(entry, idx);
    /* the practice view is a full-height IDE: no page scroll, only the left
       rail scrolls. The class is what css/steps.css keys its height off. */
    document.body.classList.toggle('is-ide', step === 'practice');

    if (step === 'watch') renderWatch(entry);
    else if (step === 'practice') renderPractice(entry);
    else renderQuiz(entry);
  }

  function renderPick() {
    var alt = Data.courses()[0];
    var main = document.getElementById('step-main');
    if (!main) return;
    main.innerHTML = '<div class="empty-state">' +
      '<h2>Pick a lesson first</h2>' +
      '<p>This runner needs <code>?course=</code> and <code>?lesson=</code> in the URL — start from the catalog.</p>' +
      '<a class="btn btn-primary" href="courses.html">Browse courses</a>' +
      (alt ? ' <a class="btn btn-secondary" href="' + UI.lessonHref(alt.slug, Data.firstLesson(alt).lesson.slug) + '">Jump into ' + UI.esc(alt.title) + '</a>' : '') +
      '</div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('step-main')) return;
    render();
    window.addEventListener('popstate', render);
    /* Stats in the focus bar track XP/streak without re-rendering the view
       (a full re-render mid-quiz would wipe the learner's answers). */
    Store.on(function () {
      var r = route();
      var course = Data.getCourse(r.course);
      var entry = course && r.lesson ? Data.getLessonOrStub(course.slug, r.lesson) : null;
      if (!entry) return;
      renderFocusBar(entry, STEP_ORDER.indexOf(resolveStep(entry, r.step)));
    });
  });

  /* ================= Page A: Video View ================= */
  function renderWatch(entry) {
    var main = document.getElementById('step-main');
    var content = entry.content || {};
    var v = stepsFor(entry).video;
    var course = entry.course, lesson = entry.lesson;

    main.innerHTML =
      '<section class="step-view step-watch">' +
        '<header class="step-head">' +
          '<span class="pill pill-purple">' + UI.icon('play', 12) + 'Video</span>' +
          '<h1 class="step-title">' + UI.esc(v.title) + '</h1>' +
          '<div class="step-concept">' + v.concept + '</div>' +
        '</header>' +

        '<div class="video-card">' +
          '<div class="video-frame">' +
            '<button class="video-play" type="button" aria-label="Play the lesson video">' +
              UI.icon('play', 40) +
            '</button>' +
            '<span class="video-caption">' +
              (v.embed ? 'Lesson video' : 'Video placeholder — ready for a YouTube embed') +
            '</span>' +
            '<span class="video-duration">' + UI.icon('clock', 13) + UI.fmtMinutes(v.minutes) + '</span>' +
          '</div>' +
        '</div>' +

        '<aside class="takeaways">' +
          '<h2>' + UI.icon('check', 16) + ' Key takeaways</h2>' +
          '<ul>' + (v.takeaways || []).map(function (t) {
            return '<li>' + UI.icon('check', 14) + '<span>' + t + '</span></li>';
          }).join('') + '</ul>' +
        '</aside>' +

        ((content.blocks || []).length
          ? '<details class="concept-more"><summary>Read the concept</summary>' +
              '<div class="lesson-body">' + (window.LessonContent ? LessonContent.blocksHtml(content) : '') + '</div>' +
            '</details>'
          : '') +

        '<footer class="step-actions">' +
          '<a class="btn btn-ghost" href="course.html?slug=' + encodeURIComponent(course.slug) + '">Course overview</a>' +
          '<button class="btn btn-primary" id="cta-practice" type="button">Continue to Practice ' + UI.icon('arrow', 16) + '</button>' +
        '</footer>' +
      '</section>';

    var play = main.querySelector('.video-play');
    if (play) play.addEventListener('click', function () {
      UI.toast(v.embed
        ? 'Playing the lesson video.'
        : 'Video placeholder — the YouTube embed drops into this frame.', 'info');
    });

    /* Continue records the watch step, which is what unlocks practice. */
    main.querySelector('#cta-practice').addEventListener('click', function () {
      Store.recordStep(course.slug, lesson.slug, 'watch');
      go(entry, 'practice');
    });
  }

  /* ---------- practice view helpers ---------- */

  /* The rail's build list is derived from the canvas spec, so it always
     describes exactly what to place on THIS canvas. The authored
     `practice.steps` are deliberately not used here: they are written for the
     learner's own n8n window ("open the node panel", "flip the Active
     toggle"), which is both irrelevant beside a live canvas and the reason
     the rail used to overflow. They are still reachable, one click away, in
     the "do it in your own n8n" drawer under the canvas. */
  function buildList(spec) {
    if (!spec || !spec.required) return null;
    var S = window.Simulator;

    var names = (spec.required.nodes || []).map(function (k) {
      var d = S && S.def(k);
      return d ? d.name : k;
    });
    var links = (spec.required.edges || []).map(function (e) {
      return S ? S.graph.edgeLabel(e) : e[0] + ' → ' + e[2];
    });
    if (!names.length) return null;
    return { names: names, links: links };
  }

  /* ================= Page B: Practice View ================= */
  function renderPractice(entry) {
    var main = document.getElementById('step-main');
    var content = entry.content || {};
    var p = stepsFor(entry).practice;
    var course = entry.course, lesson = entry.lesson;
    var saved = Store.checklistState(course.slug, lesson.slug);
    var practiceDone = Store.stepState(course.slug, lesson.slug).practice;
    var total = (p.checklist || []).length;

    /* The practice canvas (js/simulator.js) is optional: a lesson without a
       `canvas` spec behaves exactly as before. Its checklist indices are the
       items the verified topology can prove on the learner's behalf. */
    var hasCanvas = !!(p.canvas && window.Simulator);
    var autoTicks = hasCanvas ? (p.canvas.checklist || []) : [];
    var canvasVerified = false;
    var sim = null;
    var build = hasCanvas ? buildList(p.canvas) : null;
    var hasExercise = !!(content.exercise && content.exercise.type !== 'quiz' && window.Exercises);
    var hasSteps = !!(p.steps && p.steps.length);

    /* a previously completed practice restores fully ticked */
    if (practiceDone && saved.length < total) {
      saved = p.checklist.map(function (_, i) { return i; });
    }

    main.innerHTML =
      '<section class="step-view step-practice">' +
        '<div class="practice-ide">' +

          /* ---------- LEFT RAIL ---------- */
          '<aside class="practice-rail">' +
            '<header class="practice-brief">' +
              '<h1 class="practice-title">' + UI.esc(lesson.title) + '</h1>' +
              '<p class="practice-objective">' + UI.esc(p.objective) + '</p>' +
            '</header>' +

            /* What to build, derived from the spec — never contradicts the
               canvas, and never asks the learner to drive a window they are
               not looking at. Sparse specs (a single node, no links) get a
               one-line note instead of an empty-looking block. */
            '<div class="practice-rail-body">' +
            (build
              ? '<section class="practice-block practice-build">' +
                  '<h2 class="practice-block-title">' + UI.icon('workflow', 14) + 'Build' +
                    (build.links.length
                      ? '<span class="practice-build-sub">' + build.links.length + ' link' +
                        (build.links.length === 1 ? '' : 's') + '</span>'
                      : '') +
                  '</h2>' +
                  '<ul class="build-nodes">' + build.names.map(function (n) {
                    return '<li>' + UI.esc(n) + '</li>';
                  }).join('') + '</ul>' +
                  (build.links.length
                    ? '<ul class="build-links">' + build.links.map(function (l) {
                        return '<li>' + UI.icon('arrow', 11) + UI.esc(l) + '</li>';
                      }).join('') + '</ul>'
                    : '<p class="practice-build-note">' + (build.names.length === 1
                        ? 'Drop this node on the canvas and configure it — the rest is a lesson read, not a build.'
                        : 'Place these nodes; the settings are covered in the lesson text.') + '</p>') +
                '</section>'
              : '') +

            /* One unified checklist: the learner ticks what the canvas cannot
               prove; the canvas ticks and badges the rest. */
            '<section class="practice-block practice-req-block">' +
              '<h2 class="practice-block-title">' + UI.icon('check', 14) + 'Requirements' +
                '<span class="check-meter"><span id="check-count">' + saved.length + '</span>/' + total + '</span>' +
              '</h2>' +
              '<ul class="self-check">' + (p.checklist || []).map(function (item, i) {
                var on = saved.indexOf(i) !== -1;
                var auto = autoTicks.indexOf(i) !== -1;
                return '<li class="self-check-item' + (auto ? ' is-auto' : '') + '"><label>' +
                  '<input type="checkbox" data-i="' + i + '"' + (on ? ' checked' : '') + '>' +
                  '<span class="check-box">' + UI.icon('check', 11) + '</span>' +
                  '<span class="check-text">' + UI.esc(item) + '</span></label>' +
                  (auto ? '<span class="check-auto">' + UI.icon('check', 9) + 'Canvas</span>' : '') +
                  '</li>';
              }).join('') + '</ul>' +
            '</section>' +
            '</div>' +

            '<div class="practice-rail-foot">' +
              '<button class="btn btn-ghost btn-sm" type="button" id="practice-hint">' +
                UI.icon('bolt', 13) + 'Hint</button>' +
              '<span class="practice-xp">' + UI.icon('bolt', 12) + '100 XP</span>' +
            '</div>' +
          '</aside>' +

          /* ---------- RIGHT: the canvas IDE ---------- */
          '<div class="practice-ide-main">' +
            (hasCanvas
              ? '<div id="canvas-mount"></div>'
              : '<div class="practice-no-canvas"><p>No canvas for this lesson — build it in your own n8n, ' +
                'then tick each requirement.</p>' +
                '<a class="btn btn-secondary btn-sm" href="' + UI.esc((p.workspace || {}).url || 'http://localhost:5678') +
                '" target="_blank" rel="noopener">' + UI.icon('workflow', 15) +
                UI.esc((p.workspace || {}).label || 'Open n8n') + '</a></div>') +

            /* The authored steps and any second exercise type live in a
               collapsed drawer: both are written for the learner's own n8n
               window, so they belong beside the canvas rather than in the
               rail, and must never compete with it for height. */
            (hasSteps || hasExercise
              ? '<details class="practice-drawer"' + (hasCanvas ? '' : ' open') + '>' +
                  '<summary>' + UI.icon('chevron', 14) +
                    '<span>Do it in your own n8n</span>' +
                    (hasExercise ? '<em>' + UI.esc(content.exercise.type) + '</em>' : '') +
                  '</summary>' +
                  '<div class="practice-drawer-body">' +
                    (hasSteps && hasCanvas
                      ? '<div class="ex-block"><div class="ex-head">' + UI.icon('doc', 16) +
                        '<h2>Step by step</h2></div><ol class="task-steps task-steps-tight">' +
                        p.steps.map(function (st) {
                          return '<li><strong>' + UI.esc(st.title) + '</strong>' +
                            '<span>' + UI.esc(st.detail) + '</span>' +
                            (st.code ? '<code class="task-code">' + UI.esc(st.code) + '</code>' : '') +
                            '</li>';
                        }).join('') + '</ol></div>'
                      : '') +
                    (hasExercise
                      ? '<div class="ex-block" id="exercise"><div class="ex-head">' + UI.icon('bolt', 18) +
                        '<h2>Build it in the playground</h2><span class="pill pill-purple">' +
                        UI.esc(content.exercise.type) + '</span></div><div id="ex-mount"></div></div>'
                      : '') +
                  '</div>' +
                '</details>'
              : '') +
          '</div>' +
        '</div>' +
      '</section>';

    wireStepLinks(main, entry);

    /* The gate button is created here (not in the markup) so it can be handed
       straight to the canvas action bar — one gate, always in the same place. */
    var cta = document.createElement('button');
    cta.className = 'btn btn-primary sim-gate';
    cta.id = 'cta-quiz';
    cta.type = 'button';
    cta.disabled = true;
    cta.innerHTML = 'Ready for Quiz ' + UI.icon('arrow', 16);

    /* ---- self-check wiring ---- */
    var boxes = main.querySelectorAll('.self-check input[type="checkbox"]');
    var countEl = main.querySelector('#check-count');

    function ticked() {
      return Array.prototype.slice.call(boxes)
        .filter(function (b) { return b.checked; })
        .map(function (b) { return parseInt(b.getAttribute('data-i'), 10); });
    }
    function refresh() {
      var idx = ticked();
      /* The gate is (topology verified ∨ no canvas spec) ∧ everything ticked.
         With no spec the first term is vacuously true, so lessons without a
         canvas complete exactly as they did before. */
      var all = total > 0 && idx.length === total && (!hasCanvas || canvasVerified);
      countEl.textContent = idx.length;
      cta.disabled = !all;
      Store.recordChecklist(course.slug, lesson.slug, idx);
      if (all) {
        var was = Store.stepState(course.slug, lesson.slug).practice;
        Store.recordStep(course.slug, lesson.slug, 'practice');
        if (!was) UI.toast('Practice complete — the quiz gate is open.', 'success');
      }
    }

    /* A verified topology ticks the items the spec claimed it could prove and
       marks them, so the learner can see which ones were automatic. */
    function onVerify(res) {
      var was = canvasVerified;
      canvasVerified = !!(res && res.ok);
      if (canvasVerified === was) return;
      if (canvasVerified) {
        autoTicks.forEach(function (i) {
          var box = main.querySelector('.self-check input[data-i="' + i + '"]');
          if (box) box.checked = true;
        });
        UI.toast('Topology verified — the matching self-check items are ticked for you.', 'success');
      }
      refresh();
    }

    boxes.forEach(function (b) { b.addEventListener('change', refresh); });
    if (saved.length === total && total > 0) cta.disabled = false; /* finished before */
    cta.addEventListener('click', function () {
      if (cta.disabled) return;
      go(entry, 'quiz');
    });

    /* ---- hint: the next unmet requirement, so the hint stays useful rather
       than restating the objective (which is already in the brief) ---- */
    var hintBtn = main.querySelector('#practice-hint');
    if (hintBtn) hintBtn.addEventListener('click', function () {
      if (hasCanvas && sim && typeof sim.then !== 'function') {
        var unmet = sim.verify().checks.filter(function (c) { return !c.ok; });
        UI.toast(unmet.length
          ? 'Next: ' + unmet[0].label + (unmet[0].note ? ' — ' + unmet[0].note : '')
          : 'Every requirement is met. Execute the run, then head to the quiz.', 'info');
        return;
      }
      var next = (p.checklist || []).map(function (item, i) { return { item: item, i: i }; })
        .filter(function (x) { return saved.indexOf(x.i) === -1; })[0];
      UI.toast(next
        ? 'Next: ' + next.item
        : 'Every requirement is ticked — you are ready for the quiz.', 'info');
    });

    /* ---- the practice canvas (optional — see js/simulator.js) ---- */
    if (hasCanvas) {
      var mount = main.querySelector('#canvas-mount');
      try {
        sim = Simulator.mount(mount, {
          spec: p.canvas,
          lessonKey: course.slug + '/' + lesson.slug,
          actionSlot: cta,          /* the gate lives in the canvas action bar */
          emit: function (evt) {
            if (evt.type === 'verify') onVerify(evt.result);
          }
        });
        activeSim = sim && typeof sim.then === 'function' ? null : sim;
        /* mount() may resolve asynchronously (an engine loading its bundle),
           so apply its verdict once the backend is live */
        if (sim && typeof sim.then === 'function') {
          sim.then(function (backend) { activeSim = backend; onVerify(backend.verify()); });
        } else if (sim) {
          onVerify(sim.verify());
        }
      } catch (err) {
        hasCanvas = false;   /* a broken backend must never block the lesson */
        autoTicks = [];
        console.warn('Practice canvas unavailable:', err);
      }
    }
    /* no canvas (or it failed): the gate still needs a home */
    if (!hasCanvas) {
      var noCan = main.querySelector('.practice-ide-main');
      if (noCan) noCan.appendChild(cta);
    }

    /* ---- optional hands-on build (feedback only — never completes) ---- */
    if (content.exercise && content.exercise.type !== 'quiz' && document.getElementById('ex-mount') && window.Exercises) {
      Exercises.render(document.getElementById('ex-mount'), content.exercise, {
        onResult: function (res) {
          Store.recordExercise(course.slug, lesson.slug, res);
          if (res.correct) UI.toast('Build matches the target — tick off your self-check too.', 'success');
        }
      });
    }
  }

  /* ================= Page C: Quiz & Verification Gate ================= */

  /* Answers are compared loosely: case-insensitive, braces and trailing
     punctuation forgiven, whitespace collapsed. */
  function normalizeText(s) {
    return String(s == null ? '' : s)
      .trim().toLowerCase()
      .replace(/\{\{\s*/g, '').replace(/\s*\}\}/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[.,;:]+$/, '');
  }

  function kindLabel(q) {
    if (q.type === 'expression') return 'Expression';
    if (q.type === 'text') return 'Short answer';
    return 'Multiple choice';
  }

  function questionHtml(q, i) {
    var head = '<div class="quiz-item-head">' +
      '<span class="quiz-num">Q' + (i + 1) + '</span>' +
      '<span class="quiz-kind">' + kindLabel(q) + '</span></div>';

    if (q.type === 'mcq') {
      return '<div class="quiz-item" data-q="' + i + '">' + head +
        '<p class="quiz-q">' + UI.esc(q.q) + '</p>' +
        '<div class="quiz-opts">' + (q.options || []).map(function (opt, oi) {
          return '<button type="button" class="quiz-opt" data-opt="' + oi + '">' +
            '<span class="quiz-letter">' + String.fromCharCode(65 + oi) + '</span>' +
            UI.esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<p class="quiz-feedback" hidden></p></div>';
    }

    var isExpr = q.type === 'expression';
    return '<div class="quiz-item" data-q="' + i + '">' + head +
      '<p class="quiz-q">' + UI.esc(q.q) + '</p>' +
      (isExpr && q.sample
        ? '<div class="quiz-sample-wrap"><span class="quiz-sample-label">Input item</span>' +
          '<pre class="code quiz-sample">' + UI.esc(JSON.stringify(q.sample, null, 2)) + '</pre></div>'
        : '') +
      '<textarea class="quiz-input" rows="2" spellcheck="false" placeholder="' +
        (isExpr ? '{{ … }}' : 'Type or paste your answer') + '"></textarea>' +
      '<p class="quiz-feedback" hidden></p></div>';
  }

  function renderQuiz(entry) {
    var main = document.getElementById('step-main');
    var quiz = stepsFor(entry).quiz;
    var questions = quiz.questions || [];
    var course = entry.course, lesson = entry.lesson;
    var answers = questions.map(function (q) { return q.type === 'mcq' ? null : ''; });

    main.innerHTML =
      '<section class="step-view step-quiz">' +
        backLink(entry, 'practice', 'Back to practice') +
        '<header class="step-head">' +
          '<span class="pill pill-purple">' + UI.icon('quiz', 12) + 'Quiz · Verification gate</span>' +
          '<h1 class="step-title">' + UI.esc(lesson.title) + '</h1>' +
          '<div class="spec-box">' +
            '<span class="spec-label">' + UI.icon('lock', 14) + ' Gate</span>' +
            '<p>Answer <strong>every</strong> question correctly to complete this lesson and unlock the next one. You can retry as often as you need.</p>' +
          '</div>' +
        '</header>' +

        '<div class="quiz-list">' + questions.map(questionHtml).join('') + '</div>' +

        '<div class="quiz-actions">' +
          '<button class="btn btn-primary" id="quiz-submit" type="button">Check answers</button>' +
        '</div>' +
        '<div id="quiz-result" hidden></div>' +
      '</section>';

    wireStepLinks(main, entry);

    main.querySelectorAll('.quiz-item').forEach(function (item) {
      var qi = parseInt(item.getAttribute('data-q'), 10);
      var q = questions[qi];
      if (q.type === 'mcq') {
        item.querySelectorAll('.quiz-opt').forEach(function (btn) {
          btn.addEventListener('click', function () {
            if (item.classList.contains('is-graded')) return;
            answers[qi] = parseInt(btn.getAttribute('data-opt'), 10);
            item.querySelectorAll('.quiz-opt').forEach(function (b) {
              b.classList.toggle('is-selected', b === btn);
            });
            item.classList.remove('is-fail');
          });
        });
      } else {
        var input = item.querySelector('.quiz-input');
        input.addEventListener('input', function () {
          answers[qi] = input.value;
          input.classList.remove('is-wrong', 'is-right');
          item.classList.remove('is-fail');
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            main.querySelector('#quiz-submit').click();
          }
        });
      }
    });

    main.querySelector('#quiz-submit').addEventListener('click', function () {
      grade(entry, questions, answers, main);
    });
  }

  /* Grading reuses the shared n8n-style evaluator from js/exercises.js
     (Exercises.evaluateAnswer), so {{ a }} {{ b }} concatenations, bare
     expressions and literals all behave exactly like the real editor. */
  function gradeOne(q, answer) {
    if (q.type === 'mcq') {
      return { ok: answer !== null && answer !== undefined && (q.answer || []).indexOf(answer) !== -1 };
    }
    if (q.type === 'expression') {
      if (!window.Exercises || !Exercises.evaluateAnswer) {
        /* engine unavailable: fall back to a loose text match on the reference */
        return { ok: normalizeText(q.answer) === normalizeText(answer) };
      }
      var res = Exercises.evaluateAnswer(answer, q.sample);
      if (res.empty) return { ok: false, note: 'Write an expression first — wrap it in {{ … }}.' };
      if (res.error) return { ok: false, note: 'That expression threw an error: ' + res.error };
      return { ok: String(res.value) === String(q.expected) };
    }
    /* text: accept list, compared loosely (case, braces, whitespace) */
    return { ok: (q.accept || []).some(function (a) { return normalizeText(a) === normalizeText(answer); }) };
  }

  function paintQuestion(main, q, answer, r, i) {
    var item = main.querySelector('.quiz-item[data-q="' + i + '"]');
    if (!item) return;
    item.classList.add('is-graded');
    var fb = item.querySelector('.quiz-feedback');

    if (q.type === 'mcq') {
      item.querySelectorAll('.quiz-opt').forEach(function (b) {
        var bi = parseInt(b.getAttribute('data-opt'), 10);
        if ((q.answer || []).indexOf(bi) !== -1) b.classList.add('is-right');
        else if (bi === answer) b.classList.add('is-wrong');
        b.disabled = true;
      });
    } else {
      var input = item.querySelector('.quiz-input');
      if (input) input.classList.add(r.ok ? 'is-right' : 'is-wrong');
    }

    if (fb) {
      fb.hidden = false;
      if (r.ok) {
        fb.className = 'quiz-feedback is-ok';
        fb.innerHTML = UI.icon('check', 15) + '<span>Correct.</span>';
      } else {
        item.classList.add('is-fail');
        fb.className = 'quiz-feedback is-err';
        fb.innerHTML = UI.icon('x', 15) +
          '<div><strong>Not quite.</strong> ' + UI.esc(r.note || q.hint || '') +
          '<span class="fb-why">' + UI.esc(q.why || '') + '</span></div>';
      }
    }
  }

  function grade(entry, questions, answers, main) {
    var course = entry.course, lesson = entry.lesson;
    var results = questions.map(function (q, i) { return gradeOne(q, answers[i]); });
    var correct = results.filter(function (r) { return r.ok; }).length;
    var pct = questions.length ? Math.round((correct * 100) / questions.length) : 0;
    var pass = correct === questions.length; /* the gate is 100% */

    Store.recordQuiz(course.slug, lesson.slug, pct);
    results.forEach(function (r, i) { paintQuestion(main, questions[i], answers[i], r, i); });

    var actions = main.querySelector('.quiz-actions');
    if (actions) actions.hidden = true;
    var box = main.querySelector('#quiz-result');
    box.hidden = false;

    if (pass) {
      /* the gate: this is the only place a lesson is marked complete */
      Store.recordStep(course.slug, lesson.slug, 'quiz');
      Store.markLessonComplete(course.slug, lesson.slug);

      var next = Data.next(course, lesson.slug);
      var nextHref = next
        ? UI.lessonStepHref(course.slug, next.lesson.slug, 'watch')
        : 'course.html?slug=' + encodeURIComponent(course.slug);
      box.innerHTML =
        '<div class="gate-pass" role="status">' +
          '<span class="gate-icon">' + UI.icon('check', 30) + '</span>' +
          '<div class="gate-copy">' +
            '<h3>Passed — 100%</h3>' +
            '<p>Lesson complete. ' + (next
              ? '<strong>' + UI.esc(next.lesson.title) + '</strong> is now unlocked.'
              : 'You finished the course — the certificate is yours.') + '</p>' +
          '</div>' +
          '<div class="gate-actions">' +
            '<a class="btn btn-primary" href="' + nextHref + '">' +
              (next ? 'Unlock Next Lesson ' + UI.icon('arrow', 16) : 'Back to course ' + UI.icon('arrow', 16)) + '</a>' +
            '<a class="btn btn-ghost" href="course.html?slug=' + encodeURIComponent(course.slug) + '">Course overview</a>' +
          '</div>' +
        '</div>';
      UI.toast('Quiz passed — lesson complete!', 'success');
    } else {
      box.innerHTML =
        '<div class="gate-fail" role="alert">' +
          '<span class="gate-icon">' + UI.icon('x', 26) + '</span>' +
          '<div class="gate-copy">' +
            '<h3>' + correct + ' of ' + questions.length + ' correct — not enough to pass</h3>' +
            '<p>Each missed question shows its hint above. Fix them and retake — the quiz resets.</p>' +
          '</div>' +
          '<button class="btn btn-primary" id="quiz-retry" type="button">' + UI.icon('reset', 16) + ' Try Again</button>' +
        '</div>';
      var retry = box.querySelector('#quiz-retry');
      retry.addEventListener('click', function () {
        renderQuiz(entry);
        window.scrollTo(0, 0);
      });
      UI.toast('Not quite — ' + (questions.length - correct) + ' to fix, then try again.', 'danger');
    }
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();
