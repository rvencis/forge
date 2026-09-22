/* Rvencis Forge — ui.js
   Small DOM/render helpers shared by every page: element builder, icon set,
   course cards, progress widgets, accordion, tabs, toasts, inline diagrams.
   Depends on: Data (for cards). Scripts load order: data.js, ui.js. */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- icon set (24px, stroke style like the reference site) ---------- */
  var ICONS = {
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none"/>',
    workflow: '<circle cx="5" cy="12" r="2.4"/><circle cx="19" cy="6" r="2.4"/><circle cx="19" cy="18" r="2.4"/><path d="M7.2 10.9L16.8 6.9M7.2 13.1l9.6 4"/>',
    braces: '<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-1 2.5-2 3 1 .5 2 1.5 2 3v2c0 2 1 3 3 3"/><path d="M16 4c2 0 3 1 3 3v2c0 1.5 1 2.5 2 3-1 .5-2 1.5-2 3v2c0 2-1 3-3 3"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13 5l-2 14"/>',
    node: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.8 2.8 0 1 1 4 2.6c-.9.5-1.2 1-1.2 1.9M12 17h.01"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
    plug: '<path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V8zM12 16v6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    brain: '<rect x="7" y="7" width="10" height="10" rx="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M18 6l-2.5 2.5M6 18l2.5-2.5M18 18l-2.5-2.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 3.5a3.4 3.4 0 0 1 0 9M17.5 14.7c2.1.6 3.5 2.4 3.5 5.3"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" fill="currentColor" stroke="none"/>',
    check: '<path d="M4.5 12.5l5 5 10-11"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    flame: '<path d="M12 2s5 4.5 5 10a5 5 0 0 1-10 0c0-2 1-3.6 2-5 .3 1.4 1 2 2 2.4C10.4 7 11 4 12 2z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/>',
    download: '<path d="M12 3v11M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 15V4M7 8l5-5 5 5M4 20h16"/>',
    home: '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9z"/>'
  };

  function icon(name, size, cls) {
    var body = ICONS[name] || ICONS.book;
    return '<svg class="icon ' + (cls || '') + '" width="' + (size || 20) + '" height="' + (size || 20) +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  /* ---------- formatting helpers ---------- */
  function fmtMinutes(m) {
    if (!m && m !== 0) return '';
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + 'h' + (r ? ' ' + r + 'm' : '');
  }

  function lessonHref(courseSlug, lessonSlug) {
    return 'lesson.html?course=' + encodeURIComponent(courseSlug) + '&lesson=' + encodeURIComponent(lessonSlug);
  }

  function progressBar(pct, cls) {
    return '<div class="progress ' + (cls || '') + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100">' +
             '<div class="progress-fill" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></div>' +
           '</div>';
  }

  function ring(pct, size, label) {
    size = size || 56;
    var r = (size / 2) - 5, c = 2 * Math.PI * r;
    var off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
    return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-track"/>' +
        '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" class="ring-fill" ' +
          'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/>' +
      '</svg><span class="ring-label">' + (label != null ? label : pct + '%') + '</span></div>';
  }

  function typeChip(type) {
    var meta = (global.Data && Data.TYPE_META[type]) || { label: type, icon: 'book', color: '#814ac8' };
    return '<span class="type-chip" style="color:' + meta.color + '">' + icon(meta.icon, 14) + esc(meta.label) + '</span>';
  }

  function levelPill(level) {
    var meta = (global.Data && Data.LEVEL_META[level]) || { label: level, color: '#814ac8' };
    var cls = level === 'beginner' ? 'pill-success' : (level === 'advanced' ? 'pill-danger' : 'pill-warn');
    return '<span class="pill ' + cls + '">' + esc(meta.label) + '</span>';
  }

  var TRACK_GRADIENTS = {
    foundations:  'linear-gradient(135deg,#814ac8 0%,#df7afe 100%)',
    integrations: 'linear-gradient(135deg,#09f 0%,#814ac8 100%)',
    data:         'linear-gradient(135deg,#2fbf71 0%,#814ac8 100%)',
    ai:           'linear-gradient(135deg,#ea4b71 0%,#df7afe 100%)',
    ops:          'linear-gradient(135deg,#f0a72a 0%,#814ac8 100%)'
  };

  function trackIcon(name) {
    return (global.Data && Data.TRACK_META[name]) || { icon: 'bolt', label: name };
  }
  /* ---------- course card ---------- */
  function courseCard(course) {
    var progress = (global.Store && Store.courseProgress(course)) || { pct: 0, done: 0, total: 0 };
    var track = trackIcon(course.track);
    var lessons = global.Data ? Data.flatten(course).length : (course.lessonCount || 0);
    return '' +
    '<a class="course-card" href="course.html?slug=' + encodeURIComponent(course.slug) + '">' +
      '<div class="course-thumb" style="background:' + (TRACK_GRADIENTS[course.track] || TRACK_GRADIENTS.foundations) + '">' +
        icon(track.icon, 26) +
        '<span class="course-thumb-glyph">' + esc(course.glyph || 'n8n') + '</span>' +
      '</div>' +
      '<div class="course-body">' +
        '<div class="course-pills">' +
          '<span class="pill pill-purple">' + icon(track.icon, 12) + esc(track.label) + '</span>' +
          levelPill(course.level) +
        '</div>' +
        '<h3 class="course-title">' + esc(course.title) + '</h3>' +
        '<p class="course-tagline">' + esc(course.tagline) + '</p>' +
        '<div class="course-meta">' +
          '<span>' + icon('doc', 14) + lessons + ' lessons</span>' +
          '<span>' + icon('clock', 14) + (global.Data ? fmtMinutes(Data.totalMinutes(course)) : '') + '</span>' +
        '</div>' +
        (progress.done > 0
          ? '<div class="course-progress"><span>' + progress.done + '/' + progress.total + '</span>' + progressBar(progress.pct) + '</div>'
          : '') +
      '</div>' +
    '</a>';
  }

  function courseGrid(courses) {
    var wrap = el('<div class="courses-grid"></div>');
    (courses || []).forEach(function (c) { wrap.appendChild(el(courseCard(c))); });
    return wrap;
  }
  /* ---------- accordion ---------- */
  function accordion(items, opts) {
    opts = opts || {};
    var root = el('<div class="accordion" data-single="' + (opts.single !== false ? '1' : '0') + '"></div>');
    items.forEach(function (item) {
      var section = el(
        '<div class="accordion-item">' +
          '<button class="accordion-header" type="button" aria-expanded="' + (item.open ? 'true' : 'false') + '">' +
            '<span class="accordion-title">' + item.title + '</span>' +
            '<span class="accordion-meta">' + (item.meta || '') + '</span>' +
            '<span class="accordion-chevron">' + icon('chevron', 18) + '</span>' +
          '</button>' +
          '<div class="accordion-body" ' + (item.open ? '' : 'hidden') + '></div>' +
        '</div>'
      );
      var body = qs('.accordion-body', section);
      if (item.render) body.appendChild(item.render());
      else body.innerHTML = item.html || '';
      qs('.accordion-header', section).addEventListener('click', function () {
        var isOpen = this.getAttribute('aria-expanded') === 'true';
        if (root.getAttribute('data-single') === '1') {
          qsa('.accordion-header', root).forEach(function (h) {
            h.setAttribute('aria-expanded', 'false');
            qs('.accordion-body', h.parentElement).hidden = true;
          });
        }
        this.setAttribute('aria-expanded', String(!isOpen));
        body.hidden = isOpen;
      });
      root.appendChild(section);
    });
    return root;
  }

  /* ---------- tabs ---------- */
  function tabsInit(root) {
    if (!root) return;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (!btn) return;
      qsa('[data-tab]', root).forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      var target = btn.getAttribute('data-tab');
      qsa('[data-panel]', root).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== target; });
    });
  }

  /* ---------- toasts ---------- */
  var toastHost = null;
  function toastContainerInit() {
    toastHost = el('<div class="toast-host" aria-live="polite"></div>');
    document.body.appendChild(toastHost);
  }
  function toast(message, variant, ms) {
    if (!toastHost) toastContainerInit();
    var node = el('<div class="toast toast-' + (variant || 'info') + '">' +
      icon(variant === 'success' ? 'check' : (variant === 'danger' ? 'x' : 'bolt'), 16) +
      '<span>' + message + '</span></div>');
    toastHost.appendChild(node);
    requestAnimationFrame(function () { node.classList.add('show'); });
    setTimeout(function () {
      node.classList.remove('show');
      setTimeout(function () { node.remove(); }, 350);
    }, ms || 3200);
  }
  /* ---------- exports ---------- */
  global.UI = {
    esc: esc, el: el, qs: qs, qsa: qsa, icon: icon,
    fmtMinutes: fmtMinutes, lessonHref: lessonHref,
    progressBar: progressBar, ring: ring, typeChip: typeChip, levelPill: levelPill,
    trackIcon: trackIcon, TRACK_GRADIENTS: TRACK_GRADIENTS,
    courseCard: courseCard, courseGrid: courseGrid,
    accordion: accordion, tabsInit: tabsInit,
    toastContainerInit: toastContainerInit, toast: toast
  };
})(window);




