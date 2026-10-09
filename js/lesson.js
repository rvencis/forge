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

  /* The step runner (focus bar, video/practice/quiz views, gate) lives in
     js/steps.js; this module only renders authored lesson blocks. */
  global.LessonContent = {
    blockHtml: blockHtml,
    blocksHtml: blocksHtml
  };
})(window);
