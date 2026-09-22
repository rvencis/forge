/* Rvencis Forge — js/supabase.js
   Boots the Supabase client from the CDN SDK (loaded just before this file)
   and exposes a tiny facade on window.SB:
     SB.client  — the supabase-js client (null when the SDK failed to load)
     SB.user    — current auth user, or null
     SB.onReady — fn(user) once the initial session is known
     SB.onAuth  — fn(user) on every auth state change (including the first)
   If the SDK is unavailable (blocked CDN, offline) the site keeps working in
   guest mode: progress stays in localStorage via js/store.js. */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://llggzpjfmmcgsrhcabrh.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZ2d6cGpmbW1jZ3NyaGNhYnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTUxNDcsImV4cCI6MjEwNTU5MTE0N30.OUgzk9jkbKI8ZcLPN3RZaZr9CX-CdLmY0FI20uQcifw';

  var api = {
    client: null,
    user: null,
    onReady: function (fn) { fn(null); },
    onAuth: function () {}
  };

  if (!global.supabase || typeof global.supabase.createClient !== 'function') {
    global.SB = api;
    if (global.console && console.warn) console.warn('[supabase] SDK not loaded — running in guest mode.');
    return;
  }

  var client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  var readyDone = false;
  var listenerOk = false;
  var readyFns = [];
  var authFns = [];

  function setCurrent(user) {
    api.user = user || null;
    authFns.forEach(function (fn) { try { fn(api.user); } catch (e) { /* keep others alive */ } });
    if (!readyDone) {
      readyDone = true;
      readyFns.forEach(function (fn) { try { fn(api.user); } catch (e) { /* keep others alive */ } });
    }
  }

  try {
    client.auth.onAuthStateChange(function (event, session) {
      setCurrent(event === 'SIGNED_OUT' ? null : (session && session.user) || null);
    });
    listenerOk = true;
  } catch (e) {
    if (global.console && console.warn) console.warn('[supabase] auth listener unavailable:', e && e.message);
  }

  /* Safety net: if the listener never registered, don't hang onReady forever. */
  if (!listenerOk) {
    setTimeout(function () { if (!readyDone) setCurrent(null); }, 3000);
  }

  api.client = client;
  api.onReady = function (fn) { if (readyDone) fn(api.user); else readyFns.push(fn); };
  /* Late subscribers (store.js loads after this file) are replayed the session
     that was already resolved, so they never miss the initial state. */
  api.onAuth = function (fn) {
    authFns.push(fn);
    if (readyDone) { try { fn(api.user); } catch (e) { /* keep others alive */ } }
  };

  global.SB = api;
})(window);
