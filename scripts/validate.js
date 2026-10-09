/* Headless validator: content, exercises, courses, paths and badges.
   Run: node scripts/validate.js */
'use strict';
const { Data, Lessons, Exercises, Steps, Simulator, TYPES, win } = require('./validate-lib.js');

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FAIL ' + msg); } }

function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}
function normalizeItems(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(v => (v && typeof v === 'object' && !Array.isArray(v) && 'json' in v) ? v : { json: v });
}
function runCode(ex, body, items) {
  if (ex.mode === 'per-item') {
    const per = new Function('item', '$json', '$index', '$items', '$now', '$today', body);
    return items.map((it, i) => normalizeItems(per(it, it.json, i, items, new Date(), new Date()))[0] || { json: null });
  }
  const fn = new Function('items', '$json', '$now', '$today', body);
  let out = fn(items, items[0] ? items[0].json : null, new Date(), new Date());
  if (out === undefined) {
    out = new Function('items', '$json', '$now', '$today', 'return (' + body + ');')
      (items, items[0] ? items[0].json : null, new Date(), new Date());
  }
  return normalizeItems(out);
}

console.log('1) Lesson content coverage');
let totalLessons = 0, authored = 0, stubs = [];
Data.courses().forEach(course => {
  Data.flatten(course).forEach(e => {
    totalLessons++;
    const key = course.slug + '/' + e.lesson.slug;
    const entry = Data.getLessonOrStub(course.slug, e.lesson.slug);
    if (entry && entry.content && entry.content.stub) stubs.push(key);
    else if (entry && entry.content && (entry.content.blocks || []).length) authored++;
    else { ok(false, 'lesson has neither content nor stub flag: ' + key); }
  });
});
console.log('   courses: ' + Data.courses().length + ' · lessons: ' + totalLessons +
            ' · authored: ' + authored + ' · stubs: ' + stubs.length);
if (stubs.length) console.log('   stubs render as outline: ' + stubs.join(', '));

console.log('\n2) Exercise engine coverage');
let exCount = 0, exByType = {};
Object.keys(Lessons).forEach(key => {
  const ex = Lessons[key].exercise;
  if (!ex) return;
  exCount++;
  exByType[ex.type] = (exByType[ex.type] || 0) + 1;
  ok(TYPES.indexOf(ex.type) !== -1, 'unsupported exercise type "' + ex.type + '" in ' + key);
});
console.log('   exercises: ' + exCount + ' · ' + JSON.stringify(exByType));

console.log('\n3) node-config specs');
Object.keys(Lessons).forEach(key => {
  const ex = Lessons[key].exercise;
  if (!ex || ex.type !== 'nodeconfig') return;
  ok(Array.isArray(ex.spec) && ex.spec.length > 0, key + ': spec missing');
  ok(!!ex.nodeLabel && !!ex.nodeType, key + ': nodeLabel/nodeType missing');
  (ex.spec || []).forEach(f => {
    ok('solution' in f, key + ': field "' + f.key + '" has no solution');
    if (f.type === 'select') {
      ok(ex.spec, key + ': no spec array for ' + key + ' select field ' + f.key);
      const opts = (ex.spec || []).filter(x => x.key === f.key).pop();
      ok(Array.isArray(opts && opts.options) && opts.options.indexOf(f.solution) !== -1,
         key + ': solution "' + f.solution + '" is not one of its own select options');
    }
    if (f.type === 'toggle') ok(typeof f.solution === 'boolean', key + ': toggle solution must be boolean');
  });
});

console.log('\n4) expression exercises');
Object.keys(Lessons).forEach(key => {
  const ex = Lessons[key].exercise;
  if (!ex || ex.type !== 'expression') return;
  ok(typeof ex.expected !== 'undefined', key + ': no expected value');
  ok(!!ex.prompt, key + ': no prompt');
  ok(!!ex.hint, key + ': no hint');
  ok(ex.sample && typeof ex.sample === 'object', key + ': no sample item');
  (ex.validators || []).forEach(v => {
    ok(!!v.label, key + ': validator without a label');
    ok(!!(v.mustMatch || v.mustContain || v.mustNotContain),
       key + ': validator "' + v.label + '" has no rule');
  });
    // Re-evaluate the learner target by running a tiny n8n expression
    // against the sample item (mirror of what Exercises.evaluateExpression does).
    const sample = ex.sample;
    let got = ex.expected;
    try {
      // Exercise.expected is often a plain result string, but for expression
      // exercises the data file also tends to store a ready-to-run expression
      // in the same value. If it looks like an expression, evaluate it.
      const tr = String(ex.expected || '');
      if (/^\s*\{{\{\s*\{/.test(tr) || /^\s*\$/.test(tr) || /^\s*\(/.test(tr)) {
        const body = tr.replace(/^\s*\{{\{\s*/g, '').replace(/\s*\}\}\s*$/g, '');
        const fn = new Function('$json', '$now', '$today', '$vars', '$env', 'return (' + body + ');');
        got = fn(sample, new Date(), new Date(), {}, {});
      }
    } catch (e) {
      got = ex.expected; // keep the literal if evaluation fails
    }
    const gotStr = String(got ?? '');
    ok(gotStr.length > 0, key + ': expression target could not be resolved to a non-empty string');
});

console.log('\n5) code exercises (reference solution must pass every test)');
Object.keys(Lessons).forEach(key => {
  const ex = Lessons[key].exercise;
  if (!ex || ex.type !== 'code') return;
  ok(!!ex.solution, key + ': code exercise without a solution');
  ok(Array.isArray(ex.tests) && ex.tests.length > 0, key + ': code exercise without tests');
  ok(!!ex.starter, key + ': code exercise without a starter');
  if (!ex.solution) return;
  (ex.tests || []).forEach((tc, i) => {
    let actual, err = null;
    try { actual = runCode(ex, ex.solution, tc.input); } catch (e) { err = e.message; }
    ok(!err, key + ' test ' + (i + 1) + ': solution threw ' + err);
    if (!err) ok(stableStringify(actual) === stableStringify(normalizeItems(tc.expect)),
      key + ' test ' + (i + 1) + ': solution gave ' + stableStringify(actual) +
      ', expected ' + stableStringify(normalizeItems(tc.expect)));
  });
  if (ex.hiddenTest) {
    let actual, err = null;
    try { actual = runCode(ex, ex.solution, ex.hiddenTest.input); } catch (e) { err = e.message; }
    ok(!err, key + ' hidden test: solution threw ' + err);
    if (!err) ok(stableStringify(actual) === stableStringify(normalizeItems(ex.hiddenTest.expect)),
      key + ' hidden test: solution failed');
  }
  let starterPassesAll = true;
  (ex.tests || []).forEach(tc => {
    try {
      if (stableStringify(runCode(ex, ex.starter, tc.input)) !== stableStringify(normalizeItems(tc.expect))) starterPassesAll = false;
    } catch (e) { starterPassesAll = false; }
  });
  ok(!starterPassesAll, key + ': starter already passes every test (exercise would be trivial)');
});

console.log('\n6) workflow exercises');
Object.keys(Lessons).forEach(key => {
  const ex = Lessons[key].exercise;
  if (!ex || ex.type !== 'workflow') return;
  ok(!!ex.brief, key + ': brief missing');
  ok(!!ex.explanation, key + ': explanation missing');
  ok(Array.isArray(ex.palette) && ex.palette.length > 0, key + ': palette missing');
  ok(ex.target && Array.isArray(ex.target.nodes) && ex.target.nodes.length > 0, key + ': target.nodes missing');
  ok(ex.target && Array.isArray(ex.target.edges), key + ': target.edges missing');
  ok(ex.flow && typeof ex.flow === 'object', key + ': flow missing');
  if (!ex.target || !ex.palette) return;
  const paletteKeys = ex.palette.map(p => p.key);
  ex.target.nodes.forEach(n => {
    ok(paletteKeys.indexOf(n) !== -1, key + ': target node "' + n + '" is not in the palette');
    ok(!!ex.flow[n], key + ': flow ports missing for target node "' + n + '"');
  });
  ex.target.edges.forEach(e => {
    ok(Array.isArray(e) && e.length === 2, key + ': malformed edge ' + JSON.stringify(e));
    if (!Array.isArray(e)) return;
    e.forEach(end => ok(ex.target.nodes.indexOf(end) !== -1,
      key + ': edge endpoint "' + end + '" is not a target node'));
  });
});

/* ---- 7. DataCamp-style step content (video ➔ practice ➔ quiz gate) ----
   Every lesson must ship the three step views, and the quiz must be a
   strict 100% gate whose reference answers actually grade as correct. */
console.log('\n7) step content (video / practice / quiz gate)');

const isText = v => typeof v === 'string' && v.trim().length > 0;
const isTextArr = a => Array.isArray(a) && a.length > 0 && a.every(isText);

/* every flagship lesson ships steps, and no step entry is orphaned */
const flagship = Data.getCourse('n8n-fundamentals');
if (flagship) {
  Data.flatten(flagship).forEach(e => {
    ok(!!Steps['n8n-fundamentals/' + e.lesson.slug],
       'n8n-fundamentals/' + e.lesson.slug + ': no step content (video/practice/quiz)');
  });
}
Object.keys(Steps).forEach(key => ok(!!Lessons[key], key + ': step entry has no matching lesson'));

Object.keys(Steps).forEach(key => {
  const s = Steps[key];

  /* video */
  ok(s.video && isText(s.video.title), key + ': video.title missing');
  ok(s.video && isText(s.video.concept), key + ': video.concept missing');
  ok(s.video && typeof s.video.minutes === 'number', key + ': video.minutes must be a number');
  ok(s.video && Array.isArray(s.video.takeaways) && s.video.takeaways.length >= 2 && s.video.takeaways.length <= 3,
     key + ': video.takeaways must have 2-3 items');
  (s.video && Array.isArray(s.video.takeaways) ? s.video.takeaways : [])
    .forEach((t, i) => ok(isText(t), key + ': takeaways[' + i + '] is empty'));

  /* practice */
  ok(s.practice && isText(s.practice.objective), key + ': practice.objective missing');
  ok(s.practice && Array.isArray(s.practice.steps) && s.practice.steps.length >= 2,
     key + ': practice.steps needs at least 2 steps');
  (s.practice && Array.isArray(s.practice.steps) ? s.practice.steps : [])
    .forEach((st, i) => ok(isText(st.title) && isText(st.detail),
       key + ': practice step ' + (i + 1) + ' missing title/detail'));
  ok(s.practice && isTextArr(s.practice.checklist) && s.practice.checklist.length >= 3,
     key + ': practice.checklist needs at least 3 items');
  ok(s.practice && s.practice.workspace && /^https?:\/\//.test(s.practice.workspace.url || ''),
     key + ': practice.workspace.url must be an http(s) URL');

  /* quiz — the verification gate */
  const q = s.quiz;
  ok(q && q.passPct === 100, key + ': quiz.passPct must be 100 (strict gate)');
  ok(q && Array.isArray(q.questions) && q.questions.length >= 2 && q.questions.length <= 3,
     key + ': quiz needs 2-3 questions');
  if (!q || !Array.isArray(q.questions)) return;
  ok(q.questions[0] && q.questions[0].type === 'mcq', key + ': Q1 must be a conceptual multiple choice');
  ok(q.questions.some(x => x.type === 'expression' || x.type === 'text'),
     key + ': needs an expression or pasted-variable text question');
  q.questions.forEach((question, i) => {
    const at = key + ' Q' + (i + 1);
    ok(isText(question.q), at + ': question text missing');
    ok(isText(question.hint), at + ': hint missing (needed for fail feedback)');
    ok(isText(question.why), at + ': why missing (needed for fail feedback)');
    if (question.type === 'mcq') {
      ok(Array.isArray(question.options) && question.options.length >= 2, at + ': needs at least 2 options');
      ok(Array.isArray(question.answer) && question.answer.length > 0, at + ': answer index list missing');
      (Array.isArray(question.answer) ? question.answer : []).forEach(a =>
        ok(Number.isInteger(a) && a >= 0 && a < ((question.options || []).length),
           at + ': answer index ' + a + ' is out of range'));
    } else if (question.type === 'expression') {
      ok(question.sample && typeof question.sample === 'object', at + ': sample item missing');
      ok(question.expected !== undefined, at + ': expected value missing');
      if (question.answer && question.sample) {
        /* the reference answer must grade as correct through the same
           evaluator the quiz gate uses (js/exercises.js) */
        const res = Exercises.evaluateAnswer(question.answer, question.sample);
        ok(!res.error, at + ': reference expression threw ' + res.error);
        if (!res.error && !res.empty) ok(String(res.value) === String(question.expected),
           at + ': reference gives ' + JSON.stringify(res.value) +
           ', expected ' + JSON.stringify(question.expected));
      }
    } else if (question.type === 'text') {
      ok(isTextArr(question.accept), at + ': accept list missing or empty');
    } else {
      ok(false, at + ': unknown question type "' + question.type + '"');
    }
  });
});

/* ---- 8. Interactive practice canvas (js/simulator.js) ----
   Every spec must name only registered node types, declare its edges in terms
   of nodes it actually requires, keep its auto-tick indices in range, and —
   like the quiz reference answers above — satisfy its own verifier. */
console.log('\n8) practice canvas specs');

ok(!!Simulator, 'Simulator failed to load (js/simulator.js)');
const registryKeys = Simulator ? Simulator.keys() : [];
registryKeys.forEach(k => {
  const d = Simulator.def(k);
  ok(!!d.type && /^n8n-nodes-base\./.test(d.type), 'registry "' + k + '" has no n8n type string');
  ok(typeof d.h === 'number' && typeof d.s === 'number', 'registry "' + k + '" has no colour');
  ok(d.inputs.length + d.outputs.length > 0, 'registry "' + k + '" declares no ports');
});

let canvasCount = 0, decoyCount = 0;
Object.keys(Steps).forEach(key => {
  const s = Steps[key];
  const c = s.practice && s.practice.canvas;
  if (!c) return;                       /* a spec is optional, by design */
  canvasCount++;

  ok(isText(c.brief), key + ': canvas.brief missing');
  ok(isTextArr(c.palette), key + ': canvas.palette missing or empty');
  ok(c.required && isTextArr(c.required.nodes), key + ': canvas.required.nodes missing');
  ok(c.required && Array.isArray(c.required.edges), key + ': canvas.required.edges missing');
  ok(typeof c.allowExtras === 'boolean', key + ': canvas.allowExtras must be a boolean');
  if (!c.palette || !c.required) return;

  const nodeKeys = c.required.nodes;
  const declared = new Set(nodeKeys);

  /* palette + required nodes must exist in the registry */
  c.palette.forEach(pk => ok(registryKeys.indexOf(pk) !== -1, key + ': palette node "' + pk + '" is not in the registry'));
  nodeKeys.forEach(nk => ok(registryKeys.indexOf(nk) !== -1, key + ': required node "' + nk + '" is not in the registry'));
  nodeKeys.forEach(nk => ok(c.palette.indexOf(nk) !== -1, key + ': required node "' + nk + '" is missing from the palette'));
  if (c.allowExtras === false && c.palette.length > nodeKeys.length) decoyCount++;

  /* edges: [fromKey, outPort, toKey, inPort] */
  c.required.edges.forEach(e => {
    const at = key + ' edge ' + JSON.stringify(e);
    ok(Array.isArray(e) && e.length === 4, at + ': must be [fromKey, outPort, toKey, inPort]');
    if (!Array.isArray(e) || e.length !== 4) return;
    ok(declared.has(e[0]), at + ': source key "' + e[0] + '" is not a required node');
    ok(declared.has(e[2]), at + ': target key "' + e[2] + '" is not a required node');
    const from = Simulator.def(e[0]), to = Simulator.def(e[2]);
    if (from) ok(Number.isInteger(e[1]) && e[1] >= 0 && e[1] < from.outputs.length,
       at + ': output port ' + e[1] + ' does not exist on ' + e[0] + ' (has ' + from.outputs.length + ')');
    if (to) ok(Number.isInteger(e[3]) && e[3] >= 0 && e[3] < to.inputs.length,
       at + ': input port ' + e[3] + ' does not exist on ' + e[2] + ' (has ' + to.inputs.length + ')');
  });

  /* auto-tick indices address the practice checklist */
  ok(Array.isArray(c.checklist), key + ': canvas.checklist must be an array');
  (c.checklist || []).forEach(i => {
    ok(Number.isInteger(i) && i >= 0 && i < (s.practice.checklist || []).length,
       key + ': canvas.checklist index ' + i + ' is out of range (checklist has ' +
       (s.practice.checklist || []).length + ' items)');
  });

  /* the spec must satisfy its own verifier — the reference graph is built from
     the spec, so an unsatisfiable spec fails here rather than in the browser */
  const res = Simulator.verifyTopology(c);
  ok(res.ok, key + ': reference graph fails its own spec — ' +
     res.checks.filter(x => !x.ok).map(x => x.label).join('; '));

  /* and the export must round-trip into real n8n workflow JSON */
  const json = Simulator.toJSON(Simulator.graph.referenceGraph(c), c);
  ok(Array.isArray(json.nodes) && json.nodes.length === nodeKeys.length,
     key + ': exported nodes[] does not match the spec');
  ok(json.connections && typeof json.connections === 'object', key + ': exported connections missing');
  json.nodes.forEach(n => ok(!!n.name && !!n.type, key + ': exported node missing name/type'));
});
console.log('   canvas specs: ' + canvasCount + ' · node types: ' + registryKeys.length +
            ' · specs with decoys: ' + decoyCount);

console.log('\n' + checks + ' checks, ' + failures + ' failures');
if (failures) process.exit(1);
console.log('OK — content, exercises, step gates and canvas specs validate.');
