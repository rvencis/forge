/* Rvencis Forge — data.js
   Data-access layer over the global course/lesson datasets.
   Classic scripts only (no fetch, no modules) so every page works from file://
   and on GitHub Pages without a server. */
(function (global) {
  'use strict';

  var TYPE_META = {
    reading:    { label: 'Reading',    icon: 'book',     color: '#814ac8' },
    video:      { label: 'Video',      icon: 'play',     color: '#09f' },
    workflow:   { label: 'Workflow',   icon: 'workflow', color: '#ea4b71' },
    expression: { label: 'Expression', icon: 'braces',   color: '#df7afe' },
    code:       { label: 'Code',       icon: 'code',     color: '#2fbf71' },
    nodeconfig: { label: 'Node setup', icon: 'node',     color: '#f0a72a' },
    quiz:       { label: 'Quiz',       icon: 'quiz',     color: '#09f' }
  };

  var LEVEL_META = {
    beginner:     { label: 'Beginner',     color: '#2fbf71' },
    intermediate: { label: 'Intermediate', color: '#f0a72a' },
    advanced:     { label: 'Advanced',     color: '#ea4b71' }
  };

  var TRACK_META = {
    foundations:  { label: 'Foundations',  icon: 'bolt'  },
    integrations: { label: 'Integrations', icon: 'plug'  },
    data:         { label: 'Data Ops',     icon: 'chart' },
    ai:           { label: 'AI Agents',    icon: 'brain' },
    ops:          { label: 'Ops',          icon: 'shield'}
  };

  function courses() {
    return (global.N8N_COURSES || []).slice();
  }

  function getCourse(slug) {
    return courses().find(function (c) { return c.slug === slug; }) || null;
  }
  /* Flat list of { course, chapter, lesson, index } for a course. */
  function flatten(course) {
    var out = [];
    if (!course) return out;
    (course.chapters || []).forEach(function (chapter) {
      (chapter.lessons || []).forEach(function (lesson) {
        out.push({ course: course, chapter: chapter, lesson: lesson, index: out.length });
      });
    });
    return out;
  }

  function lessonEntry(course, lessonSlug) {
    return flatten(course).find(function (e) { return e.lesson.slug === lessonSlug; }) || null;
  }

  function getLesson(courseSlug, lessonSlug) {
    var course = getCourse(courseSlug);
    if (!course) return null;
    var entry = lessonEntry(course, lessonSlug);
    if (!entry) return null;
    var content = (global.N8N_LESSONS || {})[courseSlug + '/' + lessonSlug] || null;
    return { course: course, chapter: entry.chapter, lesson: entry.lesson, index: entry.index, content: content };
  }

  /* Authored content, or a friendly template placeholder so every outlined
     lesson in the catalog stays navigable in the demo. */
  function getLessonOrStub(courseSlug, lessonSlug) {
    var resolved = getLesson(courseSlug, lessonSlug);
    if (!resolved) return null;
    if (resolved.content) return resolved;
    resolved.content = {
      type: resolved.lesson.type,
      stub: true,
      blocks: [
        { t: 'callout', variant: 'info', title: 'Lesson coming soon',
          html: 'This lesson is part of the <strong>course outline</strong> but its content is still being written. ' +
                'The catalog, progress tracking and navigation all work around it.' },
        { t: 'h', text: 'How to author it' },
        { t: 'p', html: 'Add a <code>window.N8N_LESSONS["' + courseSlug + '/' + lessonSlug + '"]</code> entry to ' +
                '<code>data/lessons/' + courseSlug + '.js</code> using the block schema documented in <code>README.md</code>.' },
        { t: 'list', items: [
          'Compose blocks: p, h, list, table, callout, checklist, code, figure.',
          'Attach an exercise (quiz, expression, nodeconfig, workflow or code) to make it interactive.',
          'Keep <code>minutes</code> and <code>type</code> in data/courses.js in sync so the catalog stays accurate.'
        ] }
      ]
    };
    return resolved;
  }

  function next(course, lessonSlug) {
    var list = flatten(course);
    var i = list.findIndex(function (e) { return e.lesson.slug === lessonSlug; });
    return (i >= 0 && i < list.length - 1) ? list[i + 1] : null;
  }

  function prev(course, lessonSlug) {
    var list = flatten(course);
    var i = list.findIndex(function (e) { return e.lesson.slug === lessonSlug; });
    return i > 0 ? list[i - 1] : null;
  }

  function firstLesson(course) {
    return flatten(course)[0] || null;
  }

  function totalMinutes(course) {
    return flatten(course).reduce(function (sum, e) { return sum + (e.lesson.minutes || 0); }, 0);
  }

  /* Search + filters for the catalog. sort: default | new | duration | title */
  function search(opts) {
    opts = opts || {};
    var q = (opts.q || '').trim().toLowerCase();
    var list = courses().filter(function (c) {
      if (opts.track && c.track !== opts.track) return false;
      if (opts.level && c.level !== opts.level) return false;
      if (q) {
        var hay = (c.title + ' ' + c.tagline + ' ' + (c.tags || []).join(' ') + ' ' + (TRACK_META[c.track] ? TRACK_META[c.track].label : '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    var sort = opts.sort || 'default';
    list.sort(function (a, b) {
      if (sort === 'new') return (b.updated || '').localeCompare(a.updated || '');
      if (sort === 'duration') return totalMinutes(a) - totalMinutes(b);
      if (sort === 'title') return a.title.localeCompare(b.title);
      /* 'default' (and any unknown value) keeps the catalog's own order —
         popularity/rating were removed along with the fabricated stats. */
      return 0;
    });
    return list;
  }

  function related(course, n) {
    return courses()
      .filter(function (c) { return c.slug !== course.slug; })
      .sort(function (a, b) {
        var sa = (a.track === course.track ? 2 : 0) + (a.level === course.level ? 1 : 0);
        var sb = (b.track === course.track ? 2 : 0) + (b.level === course.level ? 1 : 0);
        return sb - sa || (b.updated || '').localeCompare(a.updated || '');
      })
      .slice(0, n || 3);
  }

  function getPath(slug) {
    return (global.N8N_PATHS || []).find(function (p) { return p.slug === slug; }) || null;
  }

  function getBadge(id) {
    return (global.N8N_BADGES || []).find(function (b) { return b.id === id; }) || null;
  }

  global.Data = {
    TYPE_META: TYPE_META, LEVEL_META: LEVEL_META, TRACK_META: TRACK_META,
    courses: courses, getCourse: getCourse, flatten: flatten, lessonEntry: lessonEntry,
    getLesson: getLesson, getLessonOrStub: getLessonOrStub,
    next: next, prev: prev, firstLesson: firstLesson, totalMinutes: totalMinutes,
    search: search, related: related, getPath: getPath, getBadge: getBadge
  };
})(window);

