/* Rvencis Forge — js/exercises.js
   The five exercise engines: quiz, expression, node-config, workflow, code.
   Each render(root, ex, ctx) builds its own UI and calls ctx.onResult(result)
   with { correct, firstTry } so Store can award XP.

   Safety notes (static site, learner's own browser):
   - Expression answers are evaluated with new Function against the lesson's
     sample item — the same trust model as any client-side playground.
   - Code exercises run learner JS in a Function sandbox with a try/catch;
     nothing executes server-side. */
(function (global) {
  'use strict';

  var CHECK = '<span class="ex-ico ok">' + (global.UI ? UI.icon('check', 16) : '✓') + '</span>';
  var CROSS = '<span class="ex-ico err">' + (global.UI ? UI.icon('x', 16) : '✗') + '</span>';

  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function feedback(root, ok, message, extra) {
    var box = root.querySelector('.ex-feedback');
    box.innerHTML = (ok ? CHECK : CROSS) + '<div><strong>' + (ok ? 'Correct!' : 'Not quite.') + '</strong>' +
      (message ? '<div class="ex-msg">' + message + '</div>' : '') + (extra || '') + '</div>';
    box.className = 'ex-feedback ' + (ok ? 'is-ok' : 'is-err');
    box.hidden = false;
  }

  /* ================= 1. QUIZ ================= */
  function renderQuiz(root, ex, ctx) {
    var qs = ex.questions;
    var i = 0, score = 0, wrongOnce = false;
    var qEl = document.createElement('div');
    root.appendChild(qEl);

    function showQuestion() {
      var q = qs[i];
      qEl.innerHTML =
        '<div class="quiz-q"><span class="quiz-n">Q' + (i + 1) + '/' + qs.length + '</span>' + UI.esc(q.q) + '</div>' +
        '<div class="quiz-opts">' + q.options.map(function (opt, oi) {
          return '<button type="button" class="quiz-opt" data-i="' + oi + '">' +
            '<span class="quiz-letter">' + String.fromCharCode(65 + oi) + '</span>' + UI.esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div class="ex-feedback" hidden></div>' +
        '<button class="btn btn-secondary btn-sm ex-next" hidden>' + (i === qs.length - 1 ? 'See results' : 'Next question') + '</button>';

      qEl.querySelectorAll('.quiz-opt').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var pick = parseInt(btn.getAttribute('data-i'), 10);
          var right = q.answer.indexOf(pick) !== -1;
          qEl.querySelectorAll('.quiz-opt').forEach(function (b) {
            b.disabled = true;
            var bi = parseInt(b.getAttribute('data-i'), 10);
            if (q.answer.indexOf(bi) !== -1) b.classList.add('is-right');
            if (bi === pick && !right) b.classList.add('is-wrong');
          });
          if (right) score++; else wrongOnce = true;
          feedback(qEl, right, q.why);
          qEl.querySelector('.ex-next').hidden = false;
        });
      });
      qEl.querySelector('.ex-next').addEventListener('click', function () {
        i++;
        if (i < qs.length) showQuestion();
        else finish();
      });
    }

    function finish() {
      var pct = Math.round((score / qs.length) * 100);
      qEl.innerHTML =
        '<div class="quiz-result ' + (pct >= 80 ? 'is-ok' : '') + '">' +
          '<div class="quiz-score">' + score + '/' + qs.length + '</div>' +
          '<strong>' + (pct === 100 ? 'Perfect!' : pct >= 80 ? 'Passed' : 'Keep practising') + '</strong>' +
          '<p class="muted">You scored ' + pct + '%.' + (pct < 80 ? ' Retake any time — only your best score counts.' : '') + '</p>' +
          '<button class="btn btn-secondary btn-sm" id="quiz-retry">Retake quiz</button>' +
        '</div>';
      ctx.onResult({ correct: pct >= 80, quizPct: pct, firstTry: !wrongOnce });
      qEl.querySelector('#quiz-retry').addEventListener('click', function () {
        i = 0; score = 0; wrongOnce = false; showQuestion();
      });
    }
    showQuestion();
  }
  /* ================= 2. EXPRESSION ================= */
  function normalizeExpr(raw) {
    return raw.replace(/\s+/g, '').replace(/["']/g, '"').replace(/^\{\{/, '').replace(/\}\}$/, '');
  }

  function evaluateExpression(exprBody, sample) {
    var fn = new Function('$json', '$now', '$today', '$vars', '$env', 'return (' + exprBody + ');');
    return fn(sample, new Date(), new Date(), {}, {});
  }

  function renderExpression(root, ex, ctx) {
    var code = ex.solution || '';
    root.innerHTML =
      '<div class="ex-brief">' + UI.esc(ex.prompt || '') + '</div>' +
      '<div class="ex-sample"><span class="muted">Sample item:</span><code>' + UI.esc(JSON.stringify(ex.sample)) + '</code></div>' +
      '<textarea class="ex-input" rows="2" spellcheck="false" placeholder="{{ … }}"></textarea>' +
      '<div class="ex-actions">' +
        '<button class="btn btn-primary btn-sm ex-check">Check answer</button>' +
        '<button class="btn btn-ghost btn-sm ex-hint">Hint</button>' +
      '</div>' +
      '<div class="ex-feedback" hidden></div>';

    var input = root.querySelector('.ex-input');

    root.querySelector('.ex-hint').addEventListener('click', function () {
      feedback(root, false, ex.hint || 'Re-read the expressions reference above.');
      this.disabled = true;
    });

    function check() {
      var raw = input.value.trim();
      if (!raw) { feedback(root, false, 'Write an expression first — wrap it in <code>{{ }}</code>.'); return; }
      var body = normalizeExpr(raw);
      var ok = true, msg = '';
      try {
        var value = evaluateExpression(body, ex.sample);
        ok = String(value) === String(ex.expected);
        if (!ok) msg = 'Expected <code>' + UI.esc(String(ex.expected)) + '</code> but got <code>' + UI.esc(String(value)) + '</code>.';
      } catch (e) {
        ok = false; msg = 'That expression threw an error: <code>' + UI.esc(e.message) + '</code>';
      }
      if (ok && ex.validators) {
        (ex.validators || []).some(function (v) {
          if (v.mustMatch && normalizeExpr('{{' + v.mustMatch + '}}') !== body) {
            ok = false; msg = 'Close — but use ' + UI.esc(v.label) + '.'; return true;
          }
          if (v.mustContain && body.indexOf(v.mustContain) === -1) {
            ok = false; msg = 'Almost! ' + UI.esc(v.label) + '.'; return true;
          }
          return false;
        });
      }
      feedback(root, ok, msg);
      if (ok) ctx.onResult({ correct: true });
      input.focus();
    }

    /* Keyboard-first: Enter evaluates, like the n8n expression editor. */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(); }
    });
    input.addEventListener('input', function () { input.classList.remove('is-wrong', 'is-right'); });
    root.querySelector('.ex-check').addEventListener('click', check);
  }
  /* ================= 3. NODE CONFIG ================= */
  function renderNodeConfig(root, ex, ctx) {
    var fields = ex.spec.map(function (f, fi) {
      var control;
      if (f.type === 'select') {
        control = '<select class="ex-field" data-key="' + f.key + '">' +
          '<option value="">— choose —</option>' +
          f.options.map(function (o) { return '<option value="' + UI.esc(o) + '">' + UI.esc(o) + '</option>'; }).join('') +
          '</select>';
      } else if (f.type === 'toggle') {
        control = '<label class="toggle"><input type="checkbox" class="ex-field" data-key="' + f.key + '"><span></span> ' + UI.esc(f.label) + '</label>';
      } else {
        control = '<input type="text" class="ex-field" data-key="' + f.key + '" placeholder="' + UI.esc(f.placeholder || '') + '">';
      }
      return '<div class="ex-row' + (f.type === 'toggle' ? ' ex-row-toggle' : '') + '">' +
        (f.type === 'toggle' ? '' : '<label class="ex-label">' + UI.esc(f.label) + '</label>') + control + '</div>';
    }).join('');

    root.innerHTML =
      '<div class="node-mock">' +
        '<div class="node-mock-head"><span class="node-mock-dot"></span>' + UI.esc(ex.nodeLabel) + '</div>' +
        '<div class="ex-brief">' + UI.esc(ex.brief) + '</div>' +
        fields +
      '</div>' +
      '<div class="ex-actions">' +
        '<button class="btn btn-primary btn-sm ex-check">Check configuration</button>' +
        '<button class="btn btn-ghost btn-sm ex-json">Show node JSON</button>' +
      '</div>' +
      '<pre class="code ex-json-view" hidden></pre>' +
      '<div class="ex-feedback" hidden></div>';

    function collect() {
      var values = {};
      root.querySelectorAll('.ex-field').forEach(function (field) {
        values[field.getAttribute('data-key')] = field.type === 'checkbox' ? field.checked : field.value.trim();
      });
      return values;
    }

    root.querySelector('.ex-json').addEventListener('click', function () {
      var view = root.querySelector('.ex-json-view');
      var values = collect();
      var params = {};
      ex.spec.forEach(function (f) { if (values[f.key] !== '' && values[f.key] !== false) params[f.key] = values[f.key]; });
      view.textContent = JSON.stringify({
        parameters: params, id: 'demo-node', name: ex.nodeLabel,
        type: ex.nodeType, typeVersion: 1, position: [450, 300]
      }, null, 2);
      view.hidden = !view.hidden;
    });

    root.querySelector('.ex-check').addEventListener('click', function () {
      var values = collect();
      var wrong = [];
      ex.spec.forEach(function (f) {
        var got = values[f.key];
        var want = f.solution;
        var ok = (f.type === 'toggle') ? got === want : String(got).replace(/\s+/g, '') === String(want).replace(/\s+/g, '');
        if (!ok) wrong.push(f.label);
      });
      var ok = wrong.length === 0;
      feedback(root, ok,
        ok ? (ex.explanation || '') :
        'Check these fields: ' + UI.esc(wrong.join(', ')) + '.');
      if (ok) ctx.onResult({ correct: true });
    });
  }
  /* ================= 4. WORKFLOW BUILDER ================= */
  function renderWorkflow(root, ex, ctx) {
    var placed = [];   /* [{ key, label }] in placement order */
    var edges = [];    /* [fromKey, toKey] */
    var selected = null;

    root.innerHTML =
      '<div class="ex-brief">' + UI.esc(ex.brief) + '</div>' +
      '<div class="wf-layout">' +
        '<div class="wf-palette"><h4>Nodes</h4><div class="wf-palette-list">' +
          ex.palette.map(function (n) {
            return '<button type="button" class="wf-node-btn" data-key="' + n.key + '">' + UI.icon('node', 14) + ' ' + UI.esc(n.label) + '</button>';
          }).join('') +
        '</div><button class="btn btn-ghost btn-sm wf-clear">' + UI.icon('reset', 14) + ' Reset</button></div>' +
        '<div class="wf-canvas" aria-label="Workflow canvas">' +
          '<svg class="wf-wires" aria-hidden="true"></svg>' +
          '<p class="wf-tip">Click a node to place it · then click two nodes to connect</p>' +
        '</div>' +
      '</div>' +
      '<div class="ex-actions">' +
        '<button class="btn btn-primary btn-sm ex-check">Check workflow</button>' +
        '<button class="btn btn-secondary btn-sm ex-run">Test run ▶</button>' +
      '</div>' +
      '<div class="wf-runlog" hidden></div>' +
      '<div class="ex-feedback" hidden></div>';

    var canvas = root.querySelector('.wf-canvas');
    var svg = root.querySelector('.wf-wires');
    function nodeEl(key, label) {
      var n = document.createElement('div');
      n.className = 'wf-node';
      n.setAttribute('data-key', key);
      n.innerHTML = '<span class="wf-node-dot"></span>' + UI.esc(label) + '<span class="wf-node-x">' + UI.icon('x', 12) + '</span>';
      n.querySelector('.wf-node-x').addEventListener('click', function (e) {
        e.stopPropagation();
        placed = placed.filter(function (p) { return p.key !== key; });
        edges = edges.filter(function (ed) { return ed[0] !== key && ed[1] !== key; });
        redraw();
      });
      n.addEventListener('click', function () {
        if (!selected) { selected = key; n.classList.add('is-selected'); return; }
        if (selected === key) { selected = null; n.classList.remove('is-selected'); return; }
        edges.push([selected, key]);
        selected = null;
        redraw();
      });
      return n;
    }

    function redraw() {
      canvas.querySelectorAll('.wf-node').forEach(function (n) { n.remove(); });
      placed.forEach(function (p) { canvas.appendChild(nodeEl(p.key, p.label)); });
      svg.innerHTML = '';
      var map = {};
      canvas.querySelectorAll('.wf-node').forEach(function (n) {
        map[n.getAttribute('data-key')] = {
          x: n.offsetLeft + n.offsetWidth / 2,
          y: n.offsetTop + n.offsetHeight / 2
        };
      });
      edges.forEach(function (ed) {
        var a = map[ed[0]], b = map[ed[1]];
        if (!a || !b) return;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var mx = (a.x + b.x) / 2;
        path.setAttribute('d', 'M' + a.x + ',' + a.y + ' C' + mx + ',' + a.y + ' ' + mx + ',' + b.y + ' ' + b.x + ',' + b.y);
        path.setAttribute('class', 'wf-wire');
        svg.insertBefore(path, svg.firstChild);
      });
      canvas.querySelectorAll('.wf-node').forEach(function (n) { n.classList.remove('is-selected'); });
    }

    root.querySelectorAll('.wf-node-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        if (placed.some(function (p) { return p.key === key; })) return;
        var def = ex.palette.find(function (p) { return p.key === key; });
        placed.push({ key: key, label: def.label });
        redraw();
      });
    });
    root.querySelector('.wf-clear').addEventListener('click', function () {
      placed = []; edges = []; selected = null; redraw();
      root.querySelector('.wf-runlog').hidden = true;
    });
    function graphOf() {
      return {
        nodes: placed.map(function (p) { return p.key; }).sort(),
        edges: edges.slice().sort(function (a, b) { return (a[0] + a[1]).localeCompare(b[0] + b[1]); })
      };
    }
    function targetOf() {
      return {
        nodes: ex.target.nodes.slice().sort(),
        edges: ex.target.edges.slice().sort(function (a, b) { return (a[0] + a[1]).localeCompare(b[0] + b[1]); })
      };
    }

    root.querySelector('.ex-check').addEventListener('click', function () {
      var g = graphOf(), t = targetOf();
      var sameNodes = deepEqual(g.nodes, t.nodes);
      var sameEdges = deepEqual(g.edges, t.edges);
      var ok = sameNodes && sameEdges;
      var msg;
      if (!sameNodes) {
        var missing = t.nodes.filter(function (n) { return g.nodes.indexOf(n) === -1; });
        var extra = g.nodes.filter(function (n) { return t.nodes.indexOf(n) === -1; });
        msg = (missing.length ? 'Missing nodes: ' + UI.esc(missing.join(', ')) + '. ' : '') +
              (extra.length ? 'Remove: ' + UI.esc(extra.join(', ')) + '.' : '');
      } else if (!sameEdges) {
        msg = 'Nodes are right, but connections differ. Expected: ' +
          UI.esc(t.edges.map(function (e) { return e[0] + ' → ' + e[1]; }).join(', ')) + '.';
      } else {
        msg = ex.explanation || '';
      }
      feedback(root, ok, msg);
      if (ok) ctx.onResult({ correct: true });
    });

    root.querySelector('.ex-run').addEventListener('click', function () {
      var log = root.querySelector('.wf-runlog');
      if (placed.length === 0) { log.hidden = false; log.innerHTML = '<p class="muted">Place some nodes first.</p>'; return; }
      var out = ['<div class="wf-run-title">Simulated execution</div>'];
      placed.forEach(function (p, idx) {
        var f = (ex.flow && ex.flow[p.key]) || { in: 1, out: 1 };
        out.push('<div class="wf-run-step"><span class="wf-run-n">' + (idx + 1) + '</span>' +
          '<strong>' + UI.esc(p.label) + '</strong>' +
          '<span class="muted">in: ' + f.in + ' item' + (f.in === 1 ? '' : 's') + ' · out: ' + f.out + '</span>' +
          (idx === 0 ? ' <span class="pill pill-purple">trigger</span>' : '') + '</div>');
      });
      out.push('<p class="fineprint muted">Simulation only — real n8n executes the same logical flow with your credentials and live APIs.</p>');
      log.innerHTML = out.join('');
      log.hidden = false;
    });

    redraw();
  }
  /* ================= 5. CODE (JavaScript, all-items) ================= */
  /* Deterministic stringify: key order never matters, missing keys do. */
  function stableStringify(value) {
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (k) {
        return JSON.stringify(k) + ':' + stableStringify(value[k]);
      }).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }

  /* Accept what n8n accepts: [{ json:{…} }] — but be kind to plain objects. */
  function normalizeItems(value) {
    if (value == null) return [];
    var list = Array.isArray(value) ? value : [value];
    return list.map(function (v) {
      if (v && typeof v === 'object' && !Array.isArray(v) && 'json' in v) return v;
      return { json: v };
    });
  }

  /* Runs learner code. Nothing leaves the browser; a try/catch turns any
     throw (including infinite-recursion) into readable feedback. */
  function runCode(ex, body, items) {
    if (ex.mode === 'per-item') {
      var per = new Function('item', '$json', '$index', '$items', '$now', '$today', body);
      return items.map(function (it, i) {
        var r = per(it, it.json, i, items, new Date(), new Date());
        return normalizeItems(r)[0] || { json: null };
      });
    }
    var fn = new Function('items', '$json', '$now', '$today', body);
    var out = fn(items, items[0] ? items[0].json : null, new Date(), new Date());
    if (out === undefined) {
      /* the learner typed an expression instead of a full body */
      out = (new Function('items', '$json', '$now', '$today', 'return (' + body + ');'))(
        items, items[0] ? items[0].json : null, new Date(), new Date());
    }
    return normalizeItems(out);
  }

  function renderCode(root, ex, ctx) {
    var fails = 0;
    root.innerHTML =
      '<div class="ex-brief">' + UI.esc(ex.brief) + '</div>' +
      '<div class="code-editor">' +
        '<div class="code-editor-head">' + UI.icon('code', 14) + '<span>Code node</span>' +
          '<span class="pill pill-n8n">Run Once for All Items</span></div>' +
        '<textarea class="ex-code" rows="10" spellcheck="false"></textarea>' +
      '</div>' +
      '<div class="ex-actions">' +
        '<button class="btn btn-primary btn-sm ex-run">Run tests</button>' +
        '<button class="btn btn-ghost btn-sm ex-hint">Hint</button>' +
        '<button class="btn btn-ghost btn-sm ex-reset">Reset code</button>' +
        '<button class="btn btn-secondary btn-sm ex-solution" disabled>Show solution</button>' +
      '</div>' +
      '<div class="code-tests" hidden></div>' +
      '<div class="ex-feedback" hidden></div>';





var editor = root.querySelector('.ex-code');
    var testsBox = root.querySelector('.code-tests');
    editor.value = ex.starter || (ex.mode === 'per-item' ? 'return { json: $json };' : 'return items;');

    root.querySelector('.ex-hint').addEventListener('click', function () {
      feedback(root, false, ex.hint || 'Work one item at a time first, then map over the array.');
      this.disabled = true;
    });
    root.querySelector('.ex-reset').addEventListener('click', function () {
      editor.value = ex.starter || '';
      testsBox.hidden = true;
      editor.focus();
    });
    root.querySelector('.ex-solution').addEventListener('click', function () {
      editor.value = ex.solution || '';
      this.disabled = true;
      feedback(root, false, 'Solution loaded — read it, then reset and retype it from memory.');
    });

    root.querySelector('.ex-run').addEventListener('click', function () {
      var body = editor.value;
      var cases = (ex.tests || []).slice();
      var rows = [];
      var allOk = true;

      cases.forEach(function (tc, ti) {
        var actual, ok = false, error = null;
        try {
          actual = runCode(ex, body, tc.input);
          ok = stableStringify(actual) === stableStringify(normalizeItems(tc.expect));
        } catch (e) {
          error = e.message;
        }
        if (!ok) allOk = false;
        rows.push('<div class="code-test ' + (ok ? 'is-ok' : 'is-err') + '">' +
          '<span class="code-test-n">Test ' + (ti + 1) + '</span>' +
          (ok ? CHECK + '<span class="code-test-msg">passed</span>'
              : CROSS + '<span class="code-test-msg">' + UI.esc(error || 'output did not match') + '</span>') +
          '<button class="btn btn-ghost btn-sm code-test-toggle" type="button">Data</button>' +
          '<pre class="code code-test-data" hidden>' +
            UI.esc('input:    ' + stableStringify(normalizeItems(tc.input)) + '\n' +
                   'expected: ' + stableStringify(normalizeItems(tc.expect)) + '\n' +
                   'actual:   ' + (error ? 'threw ' + error : stableStringify(actual))) +
          '</pre></div>');
      });

      /* Hidden case: the learner never sees its shape — only pass/fail, so
         hardcoding the visible expectations is not enough. */
      if (ex.hiddenTest) {
        var hiddenOk = false, hiddenErr = null;
        try {
          hiddenOk = stableStringify(runCode(ex, body, ex.hiddenTest.input)) ===
                     stableStringify(normalizeItems(ex.hiddenTest.expect));
        } catch (e2) { hiddenErr = e2.message; }
        if (!hiddenOk) allOk = false;
        rows.push('<div class="code-test ' + (hiddenOk ? 'is-ok' : 'is-err') + '">' +
          '<span class="code-test-n">Hidden test</span>' +
          (hiddenOk ? CHECK + '<span class="code-test-msg">passed</span>'
                    : CROSS + '<span class="code-test-msg">' + UI.esc(hiddenErr || 'a different input still fails') + '</span>') +
          '<span class="muted code-test-hint">unseen input — write general code</span></div>');
      }

      testsBox.innerHTML = rows.join('');
      testsBox.hidden = false;
      testsBox.querySelectorAll('.code-test-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var pre = btn.parentElement.querySelector('.code-test-data');
          pre.hidden = !pre.hidden;
        });
      });

      feedback(root, allOk, allOk
        ? (ex.explanation || 'All tests pass — that is production-shaped code.')
        : 'Some tests failed. Open <em>Data</em> on a failing test to compare input, expected and actual.');

      if (allOk) ctx.onResult({ correct: true, firstTry: fails === 0 });
      else { fails++; root.querySelector('.ex-solution').disabled = false; }
    });
  }

  /* ================= dispatcher ================= */
  var ENGINES = {
    quiz: renderQuiz,
    expression: renderExpression,
    nodeconfig: renderNodeConfig,
    workflow: renderWorkflow,
    code: renderCode
  };

  function render(root, exercise, ctx) {
    if (!root) return;
    if (!exercise || !exercise.type) { root.innerHTML = '<p class="empty">This lesson has no exercise.</p>'; return; }
    var engine = ENGINES[exercise.type];
    if (!engine) {
      root.innerHTML = '<p class="empty">Exercise type <code>' + UI.esc(exercise.type) + '</code> is not supported yet.</p>';
      return;
    }
    engine(root, exercise, ctx || { onResult: function () {} });
  }

  global.Exercises = {
    render: render,
    TYPES: Object.keys(ENGINES),
    evaluateExpression: evaluateExpression,
    normalizeExpr: normalizeExpr
  };
})(window);
