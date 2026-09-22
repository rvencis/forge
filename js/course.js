/* Rvencis Forge — js/course.js
   Renders course.html from ?slug=: head, outcomes, syllabus accordion,
   sticky side card (start/continue + progress), instructor, related courses. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var slug = new URLSearchParams(location.search).get('slug') || 'n8n-fundamentals';
    var course = Data.getCourse(slug);
    var head = document.getElementById('course-head');

    if (!course) {
      head.innerHTML = '<h1 class="hero-title small">Course not found</h1>' +
        '<p class="hero-subtitle"><a href="courses.html">Back to the catalog</a></p>';
      return;
    }

    document.title = course.title + ' — Rvencis Forge';
    document.getElementById('crumb-title').textContent = course.title;

    /* Structured data for crawlers (Course schema), built from the loaded course. */
    var totalMin = Data.totalMinutes(course);
    var ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: course.title,
      description: course.tagline,
      url: location.origin + location.pathname + '?slug=' + course.slug,
      inLanguage: 'en',
      educationalLevel: course.level,
      timeRequired: 'PT' + Math.floor(totalMin / 60) + 'H' + (totalMin % 60) + 'M',
      isAccessibleForFree: true,
      provider: { '@type': 'Organization', name: 'Rvencis', url: 'https://rvencis.github.io/' }
    });
    document.head.appendChild(ld);

    var lessons = Data.flatten(course);
    var progress = Store.courseProgress(course);
    var track = UI.trackIcon(course.track);
    var gradient = UI.TRACK_GRADIENTS[course.track] || UI.TRACK_GRADIENTS.foundations;

    /* --- head --- */
    head.innerHTML =
      '<div class="course-head-flex">' +
        '<div class="course-hero-thumb" style="background:' + gradient + '">' + UI.icon(track.icon, 34) + '<span>' + UI.esc(course.glyph || 'n8n') + '</span></div>' +
        '<div>' +
          '<div class="course-pills">' +
            '<span class="pill pill-purple">' + UI.icon(track.icon, 12) + UI.esc(track.label) + '</span>' +
            UI.levelPill(course.level) +
            '<span class="pill">' + UI.icon('clock', 12) + UI.fmtMinutes(Data.totalMinutes(course)) + '</span>' +
          '</div>' +
          '<h1 class="hero-title small" style="text-align:left">' + UI.esc(course.title) + '</h1>' +
          '<p class="hero-subtitle" style="text-align:left;max-width:none;margin-left:0">' + UI.esc(course.tagline) + '</p>' +
          '<div class="course-meta">' +
            '<span>' + UI.icon('doc', 14) + lessons.length + ' lessons · ' + course.chapters.length + ' chapters</span>' +
            '<span>Updated ' + UI.esc(course.updated) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    /* --- outcomes --- */
    document.getElementById('course-outcomes').innerHTML =
      '<h2 class="sub-title">What you\'ll learn</h2><ul class="outcome-list">' +
      course.outcomes.map(function (o) { return '<li>' + UI.icon('check', 16) + UI.esc(o) + '</li>'; }).join('') +
      '</ul>' +
      (course.prerequisites.length
        ? '<p class="prereq"><strong>Prerequisites:</strong> ' + course.prerequisites.map(function (p) {
            var c = Data.getCourse(p); return c ? '<a href="course.html?slug=' + p + '">' + UI.esc(c.title) + '</a>' : p;
          }).join(', ') + '</p>'
        : '<p class="prereq"><strong>Prerequisites:</strong> none — start here.</p>');

    /* --- syllabus accordion --- */
    var items = course.chapters.map(function (chapter, ci) {
      var rows = chapter.lessons.map(function (l) {
        var done = Store.isComplete(course.slug, l.slug);
        var meta = Data.TYPE_META[l.type] || {};
        return '<a class="syllabus-lesson' + (done ? ' done' : '') + '" href="' + UI.lessonHref(course.slug, l.slug) + '">' +
          '<span class="tick">' + (done ? UI.icon('check', 14) : '') + '</span>' +
          '<span class="s-title">' + UI.esc(l.title) + '</span>' +
          '<span class="type-chip" style="color:' + (meta.color || '#814ac8') + '">' + UI.icon(meta.icon || 'book', 13) + (meta.label || l.type) + '</span>' +
          '<span class="s-min">' + l.minutes + ' min</span></a>';
      }).join('');
      var chapterDone = chapter.lessons.filter(function (l) { return Store.isComplete(course.slug, l.slug); }).length;
      return {
        title: 'Ch ' + (ci + 1) + ' · ' + UI.esc(chapter.title),
        meta: chapterDone + '/' + chapter.lessons.length,
        html: '<div class="syllabus-list">' + rows + '</div>',
        open: ci === 0
      };
    });
    var syllabusTitle = document.createElement('h2');
    syllabusTitle.className = 'sub-title';
    syllabusTitle.textContent = 'Syllabus';
    document.getElementById('course-syllabus').replaceChildren(syllabusTitle, UI.accordion(items, { single: false }));

    /* --- instructor --- */
    document.getElementById('course-instructor').innerHTML =
      '<h2 class="sub-title">Instructor</h2><div class="instructor-card">' +
      '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" style="stroke:var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 3.5a3.4 3.4 0 0 1 0 9M17.5 14.7c2.1.6 3.5 2.4 3.5 5.3"/></svg>' +
      '<div><strong>' + UI.esc(course.instructor.name) + '</strong><span class="muted"> · ' + UI.esc(course.instructor.role) + '</span>' +
      '<p>' + UI.esc(course.instructor.bio) + '</p></div></div>';
    /* --- side card --- */
    var nextUp = Store.nextIncomplete(course);
    var first = Data.firstLesson(course);
    var target = nextUp ? nextUp.lesson.slug : (first ? first.lesson.slug : null);
    var startLabel = progress.done === 0 ? 'Start course' : (progress.pct === 100 ? 'Review course' : 'Continue');
    document.getElementById('course-side').innerHTML =
      '<div class="side-progress">' + UI.ring(progress.pct, 72) +
        '<div><strong>' + progress.done + ' of ' + progress.total + '</strong><br><span class="muted">lessons complete</span></div>' +
      '</div>' +
      (target ? '<a class="btn btn-primary btn-lg btn-block" href="' + UI.lessonHref(course.slug, target) + '">' + startLabel + '</a>' : '') +
      (progress.pct === 100 ? '<a class="btn btn-secondary btn-block" href="certificate.html?course=' + course.slug + '">Get certificate</a>' : '') +
      '<ul class="side-facts">' +
        '<li>' + UI.icon('doc', 14) + ' ' + lessons.length + ' lessons</li>' +
        '<li>' + UI.icon('clock', 14) + ' ' + UI.fmtMinutes(Data.totalMinutes(course)) + ' total</li>' +
        '<li>' + UI.icon('bolt', 14) + ' ' + lessons.filter(function (l) { return l.lesson.type !== 'reading'; }).length + ' interactive exercises</li>' +
        '<li>' + UI.icon('trophy', 14) + ' Certificate on completion</li>' +
      '</ul>';

    /* --- related (hidden entirely when the catalog has no other courses) --- */
    var related = Data.related(course, 3);
    document.getElementById('course-related').innerHTML = related.length
      ? '<h3 class="side-title">Related courses</h3>' +
        '<div class="related-list">' + related.map(function (c) {
          return '<a class="related-item" href="course.html?slug=' + c.slug + '">' +
            '<span class="related-glyph" style="background:' + (UI.TRACK_GRADIENTS[c.track] || '') + '">' + UI.esc((c.glyph || 'n8n').slice(0, 2)) + '</span>' +
            '<span><strong>' + UI.esc(c.title) + '</strong><br><span class="muted">' + UI.levelPill(c.level) + '</span></span></a>';
        }).join('') + '</div>'
      : '';
  });
})();


