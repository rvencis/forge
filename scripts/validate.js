/* Headless validator: content, exercises, courses, paths and badges.
   Run: node scripts/validate.js */
'use strict';
const { Data, Lessons, Exercises, TYPES, win } = require('./validate-lib.js');

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

