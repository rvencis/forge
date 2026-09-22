/* Rvencis Forge — js/dashboard.js
   Renders dashboard.html entirely from the Store: greeting, stat cards,
   "continue where you left off", per-course progress, badge grid, an
   eight-week activity heatmap and the export / import / reset tools.
   Depends on: Data, UI, Store. */
(function () {
  'use strict';

  function greetingFor(name) {
    var h = new Date().getHours();
    var part = h < 5 ? 'Still up' : (h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening'));
    return part + (name ? ', ' + name : '');
  }

  /* ---------- stat cards ---------- */
  function renderStats(state) {
    var lvl = Store.levelFor(state.xp);
    var done = Object.keys(state.completed).length;
    var scores = Object.keys(state.scores).map(function (k) { return state.scores[k].pct; });
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    var cards = [
      { label: 'Total XP', value: state.xp, sub: 'Level ' + lvl.level + ' · next at ' + lvl.nextAt + ' XP' },
      { label: 'Lessons done', value: done, sub: done === 1 ? 'lesson completed' : 'lessons completed' },
      { label: 'Day streak', value: state.streak.count, sub: 'best ' + state.streak.best + ' day' + (state.streak.best === 1 ? '' : 's') },
      { label: 'Quiz average', value: avg + '%', sub: scores.length + ' quiz' + (scores.length === 1 ? '' : 'zes') + ' attempted' },
      { label: 'Badges', value: state.badges.length + '/' + (window.N8N_BADGES || []).length, sub: 'earned so far' }
    ];
    document.getElementById('dash-stats').innerHTML = cards.map(function (c) {
      return '<div class="dash-stat"><span class="dash-stat-label">' + UI.esc(c.label) + '</span>' +
        '<b class="dash-stat-value">' + UI.esc(String(c.value)) + '</b>' +
        '<span class="dash-stat-sub">' + UI.esc(c.sub) + '</span>' +
        (c.label === 'Total XP' ? UI.progressBar(lvl.pct, 'progress-sm') : '') +
        '</div>';
    }).join('');
  }

  /* ---------- continue where you left off ---------- */
  function renderContinue(state) {
    var mount = document.getElementById('dash-continue');
    var entry = null;
    if (state.lastLesson) {
      var parts = state.lastLesson.split('/');
      entry = Data.getLesson(parts[0], parts[1]);
    }
    if (!entry) entry = Data.firstLesson(Data.courses()[0]);
    if (!entry) { mount.innerHTML = '<p class="empty">No courses published yet.</p>'; return; }

    var done = Store.isComplete(entry.course.slug, entry.lesson.slug);
    var upNext = Store.nextIncomplete(entry.course) || entry;
    mount.innerHTML =
      '<div class="continue-card">' +
        '<div class="continue-main">' +
          '<span class="dash-stat-label">' + (done ? 'Next up' : 'In progress') + '</span>' +
          '<h4>' + UI.esc(upNext.lesson.title) + '</h4>' +
          '<p class="muted">' + UI.esc(upNext.course.title) + ' · ' + UI.esc(upNext.chapter.title) +
            ' · ' + UI.fmtMinutes(upNext.lesson.minutes) + '</p>' +
        '</div>' +
        '<a class="btn btn-primary btn-sm" href="' + UI.lessonHref(upNext.course.slug, upNext.lesson.slug) + '">' +
          (done ? 'Keep going' : 'Resume') + '</a>' +
      '</div>';
  }
  /* ---------- per-course progress ---------- */
  function renderCourses() {
    var rows = Data.courses().map(function (course) {
      var p = Store.courseProgress(course);
      var next = Store.nextIncomplete(course);
      var label = p.pct === 100 ? 'Completed' : (p.done ? p.done + '/' + p.total : 'Not started');
      return '<div class="dash-course">' +
        '<div class="dash-course-head">' +
          '<a href="course.html?slug=' + encodeURIComponent(course.slug) + '">' + UI.esc(course.title) + '</a>' +
          '<span class="' + (p.pct === 100 ? 'pill pill-success' : 'pill pill-purple') + '">' + label + '</span>' +
        '</div>' +
        UI.progressBar(p.pct) +
        (next && p.pct !== 100
          ? '<a class="dash-course-next muted" href="' + UI.lessonHref(course.slug, next.lesson.slug) + '">' +
            UI.icon('play', 13) + 'Continue: ' + UI.esc(next.lesson.title) + '</a>'
          : '') +
      '</div>';
    });
    document.getElementById('dash-courses').innerHTML = rows.length
      ? rows.join('')
      : '<p class="empty">No courses yet.</p>';
  }

  /* ---------- badges ---------- */
  function renderBadges() {
    document.getElementById('dash-badges').innerHTML = Store.earnedBadges().map(function (b) {
      return '<div class="badge ' + (b.earned ? 'is-earned' : '') + '" title="' + UI.esc(b.desc) + '">' +
        '<span class="badge-ico">' + UI.icon(b.icon, 20) + '</span>' +
        '<span class="badge-title">' + UI.esc(b.title) + '</span>' +
        '<span class="badge-desc">' + UI.esc(b.desc) + '</span>' +
      '</div>';
    }).join('');
  }

  /* ---------- 8-week activity heatmap ---------- */
  function renderHeatmap(state) {
    var DAYS = 7, WEEKS = 8;
    var cells = [];
    var today = new Date();
    /* walk back to the most recent Monday so columns are whole weeks */
    var start = new Date(today);
    start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);

    for (var w = 0; w < WEEKS; w++) {
      for (var d = 0; d < DAYS; d++) {
        var day = new Date(start);
        day.setDate(day.getDate() + w * 7 + d);
        var key = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' +
                  String(day.getDate()).padStart(2, '0');
        var count = (state.days && state.days[key]) || 0;
        cells.push('<span class="heat-cell heat-' + Math.min(4, count) + (day > today ? ' is-future' : '') +
          '" title="' + key + ' · ' + count + ' activit' + (count === 1 ? 'y' : 'ies') + '"></span>');
      }
    }
    document.getElementById('dash-heatmap').innerHTML =
      '<div class="heat-grid">' + cells.join('') + '</div>' +
      '<div class="heat-legend muted"><span>less</span>' +
        [0, 1, 2, 3, 4].map(function (n) { return '<span class="heat-cell heat-' + n + '"></span>'; }).join('') +
        '<span>more</span></div>';
  }

  /* ---------- tools ---------- */
  function initTools() {
    document.getElementById('dash-export').addEventListener('click', function () {
      var blob = new Blob([Store.exportData()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'rvencis-forge-progress.json';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      UI.toast('Progress exported', 'success');
    });

    document.getElementById('dash-import').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          Store.importData(String(reader.result));
          render();
          UI.toast('Progress imported', 'success');
        } catch (err) {
          UI.toast('That file is not valid progress JSON', 'danger');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('dash-cert').addEventListener('click', function () {
      location.href = 'certificate.html';
    });

    document.getElementById('dash-reset').addEventListener('click', function () {
      if (!window.confirm('Reset all XP, badges and completions? This cannot be undone.')) return;
      Store.reset();
      render();
      UI.toast('Progress reset', 'info');
    });
  }

  /* ---------- boot ---------- */
  function render() {
    var state = Store.read();
    document.getElementById('dash-greeting').textContent = greetingFor(state.user ? state.user.name : '');
    renderStats(state);
    renderContinue(state);
    renderCourses();
    renderBadges();
    renderHeatmap(state);
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    initTools();
    Store.on(render);
  });
})();