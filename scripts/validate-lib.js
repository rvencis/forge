/* Headless validator for the Rvencis Forge content + exercise engines.
   Loads the data files in a fake `window`, then checks every authored lesson,
   exercise, course, path and badge for internal consistency — including that
   each code exercise's reference solution passes all of its own tests.
   Run: node scripts/validate.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; console.log('  FAIL ' + msg); } }

/* ---------- fake browser ---------- */
const win = {};
win.window = win;
win.document = {
  addEventListener() {},
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {}, querySelector: () => null, addEventListener() {} }),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
win.localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
win.setTimeout = setTimeout; win.Math = Math; win.Date = Date; win.JSON = JSON;
win.console = console;

const ctx = vm.createContext(win);
function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  try { vm.runInContext(code, ctx, { filename: rel }); }
  catch (e) { throw new Error('Failed to load ' + rel + ': ' + e.message); }
}

/* order matters: base libs, then data, then engines */
['js/data.js', 'js/ui.js', 'js/store.js'].forEach(load);
['data/courses.js', 'data/paths.js'].forEach(load);
['data/lessons/n8n-fundamentals.js', 'data/lessons/expressions-data-mapping.js',
 'data/lessons/http-and-apis.js', 'data/lessons/webhooks-and-forms.js',
 'data/lessons/data-pipelines.js', 'data/lessons/ai-agents-n8n.js',
 'data/lessons/misc-courses.js'].forEach(load);
load('js/exercises.js');

const Data = win.Data, Lessons = win.N8N_LESSONS, Exercises = win.Exercises;
const TYPES = Exercises.TYPES;
module.exports = { Data, Lessons, Exercises, TYPES, win };