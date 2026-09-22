/* Rvencis Forge — js/auth.js
   Real authentication through Supabase (GoTrue):
   • sign in  → supabase.auth.signInWithPassword()
   • sign up  → supabase.auth.signUp(), with a "check your email" notice while
                the confirmation link is pending (email confirmation enabled)
   • sign out → supabase.auth.signOut()
   Session changes flow into the Store (which switches between the cloud
   progress backend and the guest localStorage fallback) and into the navbar
   chip rendered by Store.initNav(). */
(function () {
  'use strict';

  function safeNext() {
    var next = new URLSearchParams(location.search).get('next') || 'dashboard.html';
    return /^[a-z0-9-]+\.html$/i.test(next) ? next : 'dashboard.html';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var stateEl = document.getElementById('auth-state');
    var msgEl = document.getElementById('auth-msg');
    var signinForm = document.getElementById('signin-form');
    var signupForm = document.getElementById('signup-form');

    function showMsg(html, variant) {
      if (msgEl) msgEl.innerHTML = html ? '<div class="callout callout-' + (variant || 'info') + '">' + html + '</div>' : '';
    }

    function setBusy(form, on) {
      if (!form) return;
      var btn = form.querySelector('button[type="submit"]');
      if (!btn) return;
      if (on && !btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
      btn.disabled = !!on;
      btn.textContent = on ? 'Working…' : (btn.getAttribute('data-label') || btn.textContent);
    }

    function renderState(user) {
      if (user) {
        var meta = user.user_metadata || {};
        var name = meta.display_name || meta.name || user.email || 'Learner';
        stateEl.innerHTML = '<div class="callout callout-tip"><strong>Signed in as ' + UI.esc(name) + '</strong>' +
          (user.email ? ' (' + UI.esc(user.email) + ')' : '') + '.' +
          ' <a class="btn btn-primary btn-sm" href="dashboard.html">Go to dashboard</a>' +
          ' <button class="btn btn-ghost btn-sm" id="signout" type="button">Sign out</button></div>';
        var so = document.getElementById('signout');
        if (so && window.SB && SB.client) {
          so.addEventListener('click', function () {
            SB.client.auth.signOut().then(function () {
              UI.toast('Signed out', 'info');
              renderState(null);
            });
          });
        }
      } else {
        stateEl.innerHTML = '<p class="muted">No active session.</p>';
      }
    }

    if (!(window.SB && SB.client)) {
      stateEl.innerHTML = '<p class="muted">Authentication is unavailable right now — you can keep learning as a guest; progress stays in this browser.</p>';
      if (signinForm) { var b1 = signinForm.querySelector('button[type="submit"]'); if (b1) b1.disabled = true; }
      if (signupForm) { var b2 = signupForm.querySelector('button[type="submit"]'); if (b2) b2.disabled = true; }
      return;
    }

    SB.onAuth(renderState);

    /* Supabase speaks plainly, but a couple of messages deserve a next step:
       the shared mailer can throttle confirmation emails, and an account that
       already exists must be signed in rather than signed up again. */
    function explain(error, email) {
      var code = (error && error.code) || '';
      var msg = (error && error.message) || 'Unknown error';
      if (code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
        return '<strong>Too many confirmation emails.</strong> Supabase is throttling mail from this project for a few minutes' +
          (email ? ' (the account for <strong>' + UI.esc(email) + '</strong> may already exist)' : '') +
          '. Please wait a little, then try again — or sign in if you already confirmed.';
      }
      if (code === 'user_already_exists' || /already registered/i.test(msg)) {
        return '<strong>That email already has an account.</strong> Use <em>Sign in</em> instead — and if you never confirmed it, ' +
          'check your inbox for the activation link.';
      }
      if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) {
        return '<strong>Email not confirmed yet.</strong> Open the confirmation link we emailed you, then sign in again.' +
          ' <button class="btn btn-ghost btn-sm" id="resend-confirm" type="button">Resend link</button>';
      }
      return null;
    }

    function afterError(form, error, email) {
      setBusy(form, false);
      var extra = explain(error, email);
      showMsg(extra || '<strong>That did not work.</strong> ' + UI.esc((error && error.message) || 'Unknown error'),
        extra ? 'info' : 'warn');
      var resend = document.getElementById('resend-confirm');
      if (resend && email) {
        resend.addEventListener('click', function () {
          resend.disabled = true;
          SB.client.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: location.origin + location.pathname } })
            .then(function (r) {
              showMsg(r.error
                ? '<strong>Could not resend.</strong> ' + UI.esc(r.error.message)
                : '<strong>Confirmation email sent again.</strong> Check <strong>' + UI.esc(email) + '</strong>.', r.error ? 'warn' : 'tip');
            });
        });
      }
    }

    /* ---------- sign in ---------- */
    signinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('si-email').value.trim();
      var password = document.getElementById('si-password').value;
      setBusy(signinForm, true);
      showMsg('Signing you in…', 'info');
      SB.client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
        if (res.error) {
          afterError(signinForm, res.error, email);
          return;
        }
        setBusy(signinForm, false);
        UI.toast('Welcome back!', 'success');
        setTimeout(function () { location.replace(safeNext()); }, 350);
      });
    });

    /* ---------- sign up ---------- */
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('su-name').value.trim();
      var email = document.getElementById('su-email').value.trim();
      var password = document.getElementById('su-password').value;
      setBusy(signupForm, true);
      showMsg('Creating your account…', 'info');
      SB.client.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { display_name: name || 'Learner' },
          emailRedirectTo: location.origin + location.pathname
        }
      }).then(function (res) {
        if (res.error) {
          afterError(signupForm, res.error, email);
          return;
        }
        setBusy(signupForm, false);
        if (!res.data.session) {
          /* Email confirmation is enabled: the account exists but must be activated. */
          showMsg('<strong>Almost there — check your email!</strong> We sent a confirmation link to <strong>' +
            UI.esc(email) + '</strong>. Click it to activate your account, then come back here and sign in.', 'info');
          signupForm.reset();
        } else {
          UI.toast('Account created — welcome, ' + UI.esc(name || 'builder') + '!', 'success');
          setTimeout(function () { location.replace(safeNext()); }, 350);
        }
      });
    });
  });
})();
