/* Rvencis Forge — js/lesson.js
   The lesson runner: sidebar with the course tree, breadcrumbs, block renderer
   (p, h, list, table, callout, checklist, code, figure), exercise mount point,
   completion handling and prev/next navigation.
   Depends on: Data, UI, Store, Exercises. */
(function () {
  'use strict';

  /* Inline diagrams referenced by { t:'figure', svg:'…' } blocks. Kept as
     strings so lessons stay data-only and the SVGs stay themeable via currentColor. */
  var FIGURES = {
    'canvas-tour': '' +
      '<svg viewBox="0 0 640 260" role="img" aria-label="n8n editor layout" class="fig-svg">' +
        '<rect x="8" y="8" width="624" height="244" rx="10" class="fig-frame"/>' +
        '<rect x="24" y="24" width="150" height="212" rx="8" class="fig-panel"/>' +
        '<text x="40" y="46" class="fig-label strong">Node panel</text>' +
        '<rect x="40" y="60" width="118" height="20" rx="4" class="fig-chip"/>' +
        '<rect x="40" y="86" width="118" height="20" rx="4" class="fig-chip"/>' +
        '<rect x="40" y="112" width="118" height="20" rx="4" class="fig-chip"/>' +
        '<rect x="40" y="152" width="118" height="20" rx="4" class="fig-chip"/>' +
        '<text x="40" y="200" class="fig-label">Credentials</text>' +
        '<text x="40" y="220" class="fig-label">Executions</text>' +
        '<rect x="196" y="70" width="120" height="44" rx="8" class="fig-node"/>' +
        '<text x="256" y="97" class="fig-label on-node" text-anchor="middle">Trigger</text>' +
        '<rect x="368" y="70" width="120" height="44" rx="8" class="fig-node"/>' +
        '<text x="428" y="97" class="fig-label on-node" text-anchor="middle">Set</text>' +
        '<rect x="368" y="160" width="120" height="44" rx="8" class="fig-node"/>' +
        '<text x="428" y="187" class="fig-label on-node" text-anchor="middle">HTTP Request</text>' +
        '<path d="M316 92 H368" class="fig-wire"/>' +
        '<path d="M428 114 V160" class="fig-wire"/>' +
        '<text x="196" y="220" class="fig-label">Executions are recorded — click any run to inspect the data.</text>' +
      '</svg>',
    'flow-basic': '' +
      '<svg viewBox="0 0 640 160" role="img" aria-label="Trigger to Set to HTTP Request" class="fig-svg">' +
        '<rect x="16" y="52" width="150" height="52" rx="10" class="fig-node"/>' +
        '<text x="91" y="83" class="fig-label on-node" text-anchor="middle">Manual Trigger</text>' +
        '<path d="M166 78 H250" class="fig-wire"/><path d="M240 71 l10 7 -10 7" class="fig-arrow"/>' +
        '<rect x="250" y="52" width="150" height="52" rx="10" class="fig-node"/>' +
        '<text x="325" y="83" class="fig-label on-node" text-anchor="middle">Edit Fields (Set)</text>' +
        '<path d="M400 78 H484" class="fig-wire"/><path d="M474 71 l10 7 -10 7" class="fig-arrow"/>' +
        '<rect x="484" y="52" width="140" height="52" rx="10" class="fig-node"/>' +
        '<text x="554" y="83" class="fig-label on-node" text-anchor="middle">HTTP Request</text>' +
        '<text x="16" y="130" class="fig-label">one item in → reshaped → sent onward</text>' +
      '</svg>',
    'flow-webhook': '' +
      '<svg viewBox="0 0 640 160" role="img" aria-label="Webhook to parse to respond" class="fig-svg">' +
        '<rect x="16" y="52" width="150" height="52" rx="10" class="fig-node"/>' +
        '<text x="91" y="83" class="fig-label on-node" text-anchor="middle">Webhook</text>' +
        '<path d="M166 78 H250" class="fig-wire"/><path d="M240 71 l10 7 -10 7" class="fig-arrow"/>' +
        '<rect x="250" y="52" width="150" height="52" rx="10" class="fig-node"/>' +
        '<text x="325" y="83" class="fig-label on-node" text-anchor="middle">Edit Fields (Set)</text>' +
        '<path d="M400 78 H484" class="fig-wire"/><path d="M474 71 l10 7 -10 7" class="fig-arrow"/>' +
        '<rect x="484" y="52" width="140" height="52" rx="10" class="fig-node"/>' +
        '<text x="554" y="80" class="fig-label on-node" text-anchor="middle">Respond to</text>' +
        '<text x="554" y="96" class="fig-label on-node" text-anchor="middle">Webhook</text>' +
        '<text x="16" y="130" class="fig-label">HTTP request in → cleaned → HTTP response out</text>' +
      '</svg>'
  };

  var STUB_FIGURE = '<svg viewBox="0 0 640 120" role="img" aria-label="Diagram placeholder" class="fig-svg">' +
    '<rect x="8" y="8" width="624" height="104" rx="10" class="fig-frame" stroke-dasharray="6 6"/>' +
    '<text x="320" y="66" class="fig-label" text-anchor="middle">diagram</text></svg>';

  /* ---------- block renderer (authored HTML in lesson data is trusted) ---------- */
  function blockHtml(b) {
    switch (b.t) {
      case 'h':
        return '<h2 class="lesson-h">' + b.text + '</h2>';
      case 'p':
        return '<p class="lesson-p">' + b.html + '</p>';
      case 'list':
        return '<ul class="lesson-list">' + (b.items || []).map(function (i) {
          return '<li>' + i + '</li>';
        }).join('') + '</ul>';
      case 'table':
        return '<div class="lesson-table-wrap"><table class="lesson-table"><thead><tr>' +
          (b.head || []).map(function (h) { return '<th>' + h + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          (b.rows || []).map(function (row) {
            return '<tr>' + row.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>';
          }).join('') +
          '</tbody></table></div>';
      case 'callout':
        return '<div class="callout callout-' + (b.variant || 'info') + '">' +
          UI.icon(b.variant === 'tip' ? 'bolt' : (b.variant === 'warn' ? 'shield' : 'doc'), 18) +
          '<div>' + (b.title ? '<strong>' + b.title + '</strong>' : '') +
          (b.html ? '<div>' + b.html + '</div>' : '') + '</div></div>';
      case 'checklist':
        return '<div class="lesson-checklist-wrap">' +
          '<h3 class="lesson-h3">' + UI.icon('check', 16) + 'Check yourself</h3>' +
          '<ul class="lesson-checklist">' + (b.items || []).map(function (i) {
            return '<li><span class="box"></span><span>' + i + '</span></li>';
          }).join('') + '</ul></div>';
      case 'code':
        return '<figure class="lesson-code">' +
          (b.label ? '<figcaption>' + UI.esc(b.label) +
            '<span class="muted"> · ' + UI.esc(b.lang || 'text') + '</span></figcaption>' : '') +
          '<pre class="code"><code>' + UI.esc(b.code || '') + '</code></pre></figure>';
      case 'figure':
        return '<figure class="lesson-figure">' + (FIGURES[b.svg] || STUB_FIGURE) +
          (b.caption ? '<figcaption>' + UI.esc(b.caption) + '</figcaption>' : '') + '</figure>';
      default:
        return '<p class="muted">Unsupported block type: <code>' + UI.esc(b.t) + '</code></p>';
    }
  }

  function blocksHtml(content) {
    return (content.blocks || []).map(blockHtml).join('');
  }

  /* ---------- URL params ---------- */
  function params() {
    var out = {};
    window.location.search.replace(/^\?/, '').split('&').forEach(function (pair) {
      if (!pair) return;
      var bits = pair.split('=');
      out[decodeURIComponent(bits[0])] = decodeURIComponent((bits[1] || '').replace(/\+/g, ' '));
    });
    return out;
  }

  /* ---------- sidebar ---------- */
  function sidebarHtml(course, activeSlug) {
    var progress = Store.courseProgress(course);
    var html = '<div class="side-card">' +
      '<a class="side-title" href="course.html?slug=' + encodeURIComponent(course.slug) + '">' +
        UI.icon('arrow', 14) + 'Back to course</a>' +
      '<h3>' + UI.esc(course.title) + '</h3>' +
      '<div class="side-progress">' + UI.ring(progress.pct, 52) +
        '<div><b>' + progress.done + ' / ' + progress.total + '</b><span class="muted">lessons complete</span></div>' +
      '</div>' +
    '</div>';

    (course.chapters || []).forEach(function (ch, ci) {
      html += '<div class="side-card">' +
        '<h4 class="side-chapter">' + UI.esc('Chapter ' + (ci + 1) + ' · ' + ch.title) + '</h4>' +
        '<ol class="side-lessons">' +
        (ch.lessons || []).map(function (l) {
          var done = Store.isComplete(course.slug, l.slug);
          return '<li' + (l.slug === activeSlug ? ' class="is-active"' : '') + '>' +
            '<a href="' + UI.lessonHref(course.slug, l.slug) + '">' +
              '<span class="side-dot ' + (done ? 'is-done' : '') + '">' +
                (done ? UI.icon('check', 11) : (l.slug === activeSlug ? UI.icon('play', 11) : '')) + '</span>' +
              '<span class="side-lesson-title">' + UI.esc(l.title) + '</span>' +
              '<span class="side-mins">' + (l.minutes ? l.minutes + 'm' : '') + '</span>' +
            '</a></li>';
        }).join('') +
        '</ol></div>';
    });
    return html;
  }

  /* Mobile-only (≤1024px) collapse bar for the course tree. The button is
     hidden on desktop via css/mobile.css, so desktop markup is unchanged. */
  function sideToggleHtml(course) {
    var progress = Store.courseProgress(course);
    return '<button class="side-toggle" type="button" aria-expanded="false">' +
        '<span class="side-toggle-title">' + UI.esc(course.title) + '</span>' +
        '<span class="side-toggle-meta">' + progress.done + '/' + progress.total + '</span>' +
        '<span class="side-toggle-chevron">' + UI.icon('chevron', 16) + '</span>' +
      '</button>';
  }

  /* ---------- main column ---------- */
  function lessonHeadHtml(entry, content) {
    var course = entry.course, lesson = entry.lesson;
    var total = Data.flatten(course).length;
    return '<nav class="crumbs" aria-label="Breadcrumb">' +
        '<a href="index.html">Home</a><span>/</span>' +
        '<a href="courses.html">Courses</a><span>/</span>' +
        '<a href="course.html?slug=' + encodeURIComponent(course.slug) + '">' + UI.esc(course.title) + '</a>' +
      '</nav>' +
      '<header class="lesson-head">' +
        '<div class="lesson-pills">' + UI.typeChip(lesson.type) +
          '<span class="pill">' + UI.icon('doc', 12) + 'Lesson ' + (entry.index + 1) + ' of ' + total + '</span>' +
          '<span class="pill">' + UI.icon('clock', 12) + UI.fmtMinutes(lesson.minutes) + '</span>' +
          (content && content.stub ? '<span class="pill pill-warn">Outline</span>' : '') +
        '</div>' +
        '<h1 class="lesson-title">' + UI.esc(lesson.title) + '</h1>' +
        '<p class="lesson-chapter muted">' + UI.esc(entry.chapter.title) + '</p>' +
      '</header>';
  }

  function exerciseSectionHtml(exercise) {
    if (!exercise) return '';
    return '<section class="ex-block" id="exercise">' +
      '<div class="ex-head">' + UI.icon('bolt', 18) + '<h2>Exercise</h2>' +
        '<span class="pill pill-purple">' + UI.esc(exercise.type) + '</span></div>' +
      '<div id="ex-mount"></div>' +
    '</section>';
  }

  function navHtml(course, lesson) {
    var p = Data.prev(course, lesson.slug);
    var n = Data.next(course, lesson.slug);
    var last = Store.isComplete(course.slug, lesson.slug);
    return '<footer class="lesson-nav">' +
      (p ? '<a class="btn btn-secondary" href="' + UI.lessonHref(course.slug, p.lesson.slug) + '">← ' + UI.esc(p.lesson.title) + '</a>'
         : '<span></span>') +
      '<button class="btn ' + (last ? 'btn-ghost' : 'btn-primary') + '" id="lesson-complete" ' +
        (last ? 'disabled' : '') + '>' +
        (last ? UI.icon('check', 16) + ' Completed' : UI.icon('check', 16) + ' Mark lesson complete') +
      '</button>' +
      (n ? '<a class="btn btn-primary" href="' + UI.lessonHref(course.slug, n.lesson.slug) + '">' + UI.esc(n.lesson.title) + ' →</a>'
         : '<a class="btn btn-primary" href="' + 'course.html?slug=' + encodeURIComponent(course.slug) + '">Finish course →</a>') +
    '</footer>';
  }

  /* ---------- boot ---------- */
  function boot() {
    var p = params();
    var side = document.getElementById('lesson-sidebar');
    var main = document.getElementById('lesson-main');
    if (!side || !main) return;

    var course = Data.getCourse(p.course);
    if (!course) {
      var alt = Data.courses()[0];
      main.innerHTML = '<div class="empty-state">' +
        '<h2>Pick a lesson first</h2>' +
        '<p>This runner needs a <code>?course=</code> and <code>?lesson=</code> in the URL. ' +
        'Start from the catalog — progress is remembered per lesson.</p>' +
        '<a class="btn btn-primary" href="courses.html">Browse courses</a>' +
        (alt ? ' <a class="btn btn-secondary" href="' + UI.lessonHref(alt.slug, Data.firstLesson(alt).lesson.slug) + '">Jump into ' + UI.esc(alt.title) + '</a>' : '') +
      '</div>';
      side.innerHTML = '';
      return;
    }

    var lessonSlug = p.lesson;
    var entry = lessonSlug ? Data.getLessonOrStub(course.slug, lessonSlug) : null;
    if (!entry) {
      var start = Store.nextIncomplete(course) || Data.firstLesson(course);
      window.location.replace(UI.lessonHref(course.slug, start.lesson.slug));
      return;
    }

    sidebarHtmlRender(course, entry.lesson.slug);
    renderLesson(entry);
  }

  function sidebarHtmlRender(course, activeSlug) {
    var side = document.getElementById('lesson-sidebar');
    var mq = window.matchMedia('(max-width: 1024px)');
    var userToggled = false; /* the collapsed default applies once per mobile visit */

    function render() {
      side.innerHTML = sideToggleHtml(course) + sidebarHtml(course, activeSlug);
      var t = side.querySelector('.side-toggle');
      t.addEventListener('click', function () {
        userToggled = true;
        var collapsed = side.classList.toggle('is-collapsed');
        this.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
      t.setAttribute('aria-expanded', side.classList.contains('is-collapsed') ? 'false' : 'true');
    }

    /* Entering the mobile layout collapses the tree once so the lesson
       starts at the content; leaving it restores the always-open desktop
       sidebar (the toggle is hidden there by css/mobile.css). */
    function applyMode() {
      if (mq.matches) {
        if (!userToggled) side.classList.add('is-collapsed');
      } else {
        userToggled = false;
        side.classList.remove('is-collapsed');
      }
      var t = side.querySelector('.side-toggle');
      if (t) t.setAttribute('aria-expanded', side.classList.contains('is-collapsed') ? 'false' : 'true');
    }

    render();
    Store.on(render);
    if (mq.addEventListener) mq.addEventListener('change', applyMode);
    else if (mq.addListener) mq.addListener(applyMode); /* older Safari */
    applyMode();
  }

  function renderLesson(entry) {
    var course = entry.course, lesson = entry.lesson, content = entry.content || { blocks: [] };
    var main = document.getElementById('lesson-main');

    main.innerHTML = lessonHeadHtml(entry, content) +
      '<article class="lesson-body">' + blocksHtml(content) + '</article>' +
      (content.stub ? '' : '') +
      exerciseSectionHtml(content.exercise) +
      navHtml(course, lesson);

    document.title = lesson.title + ' — ' + course.title + ' | Rvencis Forge';

    /* completion button */
    var btn = document.getElementById('lesson-complete');
    btn.addEventListener('click', function () {
      var wasComplete = Store.isComplete(course.slug, lesson.slug);
      Store.markLessonComplete(course.slug, lesson.slug);
      if (!wasComplete) {
        UI.toast('Lesson complete · +10 XP', 'success');
        var nxt = Data.next(course, lesson.slug);
        if (Data.flatten(course).every(function (e) { return Store.isComplete(course.slug, e.lesson.slug); })) {
          UI.toast('Course finished — <strong>Course Graduate</strong> badge + 200 XP!', 'success', 5000);
        } else if (nxt) {
          UI.toast('Next up: ' + UI.esc(nxt.lesson.title), 'info');
        }
      }
      btn.disabled = true;
      btn.className = 'btn btn-ghost';
      btn.innerHTML = UI.icon('check', 16) + ' Completed';
    });

    /* exercise mount */
    if (content.exercise && document.getElementById('ex-mount')) {
      Exercises.render(document.getElementById('ex-mount'), content.exercise, {
        onResult: function (res) { onExerciseResult(entry, res); }
      });
    }

    /* reveal animation for long lessons */
    UI.qsa('.lesson-figure, .callout, .lesson-table-wrap', main).forEach(function (node, i) {
      node.classList.add('reveal');
      setTimeout(function () { node.classList.add('animate-in'); }, 60 * i);
    });
  }

  function onExerciseResult(entry, res) {
    var course = entry.course, lesson = entry.lesson;
    var ex = entry.content.exercise || {};
    if (ex.type === 'quiz' && typeof res.quizPct === 'number') {
      Store.recordQuiz(course.slug, lesson.slug, res.quizPct);
    }
    Store.recordExercise(course.slug, lesson.slug, res);
    if (!res.correct) {
      UI.toast('Not quite — fix the failing part and re-run.', 'danger');
      return;
    }
    var already = Store.isComplete(course.slug, lesson.slug);
    Store.markLessonComplete(course.slug, lesson.slug);
    if (!already) UI.toast('Correct! Lesson marked complete · +XP', 'success');
    var next = Data.next(course, lesson.slug);
    if (next) {
      setTimeout(function () { UI.toast('Next: <a href="' + UI.lessonHref(course.slug, next.lesson.slug) + '">' + UI.esc(next.lesson.title) + '</a>', 'info', 5000); }, 900);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
