#!/usr/bin/env python3
"""Live end-to-end check of the Rvencis Forge Supabase integration.

  Run: python3 scripts/test-supabase-live.py [existing-mailbox@uberip.com]

  1. creates a throw-away mailbox on mail.tm
  2. signs that address up through the real /auth/v1/signup endpoint (what auth.html calls)
  3. reads the confirmation email and activates the account via /auth/v1/verify
  4. signs in with a password grant and uses the returned access token to write and
     read the `progress` table exactly like js/store.js does from the browser
  5. proves the upsert path (on_conflict) and RLS write access, then cleans up
"""
import json
import sys
import time
import urllib.error
import urllib.request
import urllib.parse

SUPABASE = 'https://llggzpjfmmcgsrhcabrh.supabase.co'
ANON = ('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsZ2d6cGpm'
        'bW1jZ3NyaGNhYnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwMTUxNDcsImV4cCI6MjEwNTU5MTE0N30.'
        'OUgzk9jkbKI8ZcLPN3RZaZr9CX-CdLmY0FI20uQcifw')
MAIL = 'https://api.mail.tm'
PASSWORD = 'Rvencis-Test-Pass-2026!'

checks = []
def ok(cond, msg):
    checks.append(bool(cond))
    print(('   ok  ' if cond else '   FAIL ') + msg)

def call(method, url, body=None, headers=None, raw=False):
    data = None
    hdrs = {'Accept': 'application/json', 'User-Agent': 'rvencis-forge-livetest/1.0'}
    if body is not None:
        data = json.dumps(body).encode()
        hdrs['Content-Type'] = 'application/json'
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            payload = r.read().decode('utf-8', 'replace')
            return r.status, (payload if raw else (json.loads(payload) if payload else None)), dict(r.headers)
    except urllib.error.HTTPError as e:
        payload = e.read().decode('utf-8', 'replace')
        try:
            parsed = json.loads(payload)
        except Exception:
            parsed = payload
        return e.code, parsed, dict(e.headers)

def auth_headers(token=None):
    h = {'apikey': ANON}
    h['Authorization'] = 'Bearer ' + (token or ANON)
    return h


print('\n1) throw-away mailbox on mail.tm (to read the real confirmation email)')
args = [a for a in sys.argv[1:] if not a.startswith('--')]
NO_CONFIRM = '--no-confirm' in sys.argv
if NO_CONFIRM:
    print('        --no-confirm: skipping the mailbox (Confirmation is off in the dashboard)')
    mail_hdr = None
    addr = args[0] if args else 'rvencis.forge.noconfirm.%d@uberip.com' % int(time.time())
    ok(True, 'testing without a mailbox: ' + addr)
else:
    mail_hdr = None
    if args:
        addr = args[0]
        print('        reusing existing mailbox: ' + addr)
    else:
        addr = 'rvencis.forge.%d@uberip.com' % int(time.time())
        st, acc, _ = call('POST', MAIL + '/accounts', {'address': addr, 'password': PASSWORD})
        for _try in range(4):
            if st in (200, 201):
                break
            print('        create retry %d -> HTTP %s' % (_try + 1, st))
            time.sleep(20)
            addr = 'rvencis.forge.%d@uberip.com' % int(time.time())
            st, acc, _ = call('POST', MAIL + '/accounts', {'address': addr, 'password': PASSWORD})
        if st not in (200, 201):
            print('   FAIL could not create mailbox: %s %s' % (st, acc))
            sys.exit(2)
    ok(True, 'mailbox ready: ' + addr)
    st, tok, _ = call('POST', MAIL + '/token', {'address': addr, 'password': PASSWORD})
    if not (st == 200 and isinstance(tok, dict) and tok.get('token')):
        print('   FAIL mail.tm refused a token (HTTP %s %s).' % (st, json.dumps(tok)[:120]))
        print('        mail.tm throttles free mailboxes per IP — retry later, pass an')
        print('        existing address as an argument, or run with --no-confirm.')
        sys.exit(2)
    mail_hdr = {'Authorization': 'Bearer ' + tok['token']}
    ok(True, 'mail.tm bearer token acquired')

print('\n2) real Supabase signup (exactly what auth.html signUp() hits)')
st, su, _ = call('POST', SUPABASE + '/auth/v1/signup',
                 {'email': addr, 'password': PASSWORD, 'data': {'display_name': 'Live Test'}},
                 auth_headers())
ok(st == 200, 'signup HTTP 200')
if st != 200:
    print('        -> signup rejected: %s' % json.dumps(su)[:300])
    code = (su or {}).get('code') or (su or {}).get('error_code') or ''
    if code in ('over_email_send_rate_limit', 'over_request_rate_limit'):
        print('        -> Supabase throttled the confirmation email for this IP (built-in SMTP).')
        print('           Wait a few minutes and rerun, or turn off "Confirm email" under')
        print('           Authentication -> Providers -> Email and rerun with --no-confirm.')
user_id = (su or {}).get('id')
ok(bool(user_id), 'auth user created with id ' + str(user_id))
if NO_CONFIRM:
    ok(bool((su or {}).get('access_token')), 'signup returned a live session (confirmation disabled in the dashboard)')
    access = (su or {}).get('access_token')
else:
    ok(not (su or {}).get('access_token'), 'no session returned — confirmation email is required (mailer_autoconfirm=false)')
    ok(bool((su or {}).get('confirmation_sent_at')), 'confirmation email sent at ' + str((su or {}).get('confirmation_sent_at')))

access = None
if not NO_CONFIRM:
    access = None          # the confirmed user's session comes from the verify call
    print('\n3) read the confirmation email and activate the account')
    link = None
    for attempt in range(20):
        st, msgs, _ = call('GET', MAIL + '/messages?page=1', headers=mail_hdr)
        if st == 200 and msgs:
            st2, full, _ = call('GET', MAIL + '/messages/' + msgs[0]['id'], headers=mail_hdr)
            blob = ''
            for k in ('text', 'html', 'content'):
                v = full.get(k)
                if isinstance(v, list):
                    blob += ' '.join(x.get('value', '') for x in v)
                elif isinstance(v, str):
                    blob += v
                elif isinstance(v, dict):
                    blob += json.dumps(v)
            blob = blob.replace('&amp;', '&').replace('\\u0026', '&').replace('\\/', '/')
            for part in blob.split('"'):
                if '/verify?token=' in part or 'token_hash=' in part:
                    link = part
                    break
            if link:
                break
        time.sleep(3)
    ok(bool(link), 'confirmation link found in the email')

    token_hash = None
    kind = 'signup'
    if link:
        q = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
        token_hash = (q.get('token') or q.get('token_hash') or [None])[0]
        kind = (q.get('type') or ['signup'])[0]
    st, ses, _ = call('POST', SUPABASE + '/auth/v1/verify', {'type': kind, 'token': token_hash}, auth_headers())
    ok(st == 200 and (ses or {}).get('access_token'), 'confirmation verified, session issued (HTTP %s)' % st)
    access = (ses or {}).get('access_token')

print('\n4) password sign-in (supabase.auth.signInWithPassword path)')
st, si, _ = call('POST', SUPABASE + '/auth/v1/token?grant_type=password',
                 {'email': addr, 'password': PASSWORD}, auth_headers())
ok(st == 200 and si.get('access_token'), 'signInWithPassword returns a session (HTTP %s)' % st)
access = si.get('access_token') or access
uid = si.get('user', {}).get('id')
ok(bool(user_id) and uid == user_id, 'signed in as the user created at signup')

if not access:
    print('\n   Cannot continue without an authenticated session.')
    print('   If the signup step was throttled (over_email_send_rate_limit), wait a few')
    print('   minutes — Supabase limits confirmation emails on the built-in SMTP — or')
    print('   turn off "Confirm email" in Authentication → Providers → Email while testing.')
    print('\n' + str(len(checks)) + ' checks, ' + str(checks.count(False)) + ' failures')
    sys.exit(2)
token_hdr = {'apikey': ANON, 'Authorization': 'Bearer ' + access}

print('\n5) write a progress row as the authenticated user (js/store.js upsert)')
row = {'user_id': uid, 'course_slug': 'n8n-fundamentals', 'lesson_slug': 'what-is-n8n',
       'completed': True, 'xp': 10, 'completed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
url = (SUPABASE + '/rest/v1/progress?on_conflict=' +
       urllib.parse.quote('user_id,course_slug,lesson_slug'))
hdr = dict(token_hdr)
hdr['Content-Type'] = 'application/json'
hdr['Prefer'] = 'resolution=merge-duplicates,return=representation'
st, ins, _ = call('POST', url, row, hdr)
ok(st in (200, 201), 'upsert accepted (HTTP %s) %s' % (st, '' if st in (200, 201) else ins))
composite_ok = st in (200, 201)
if st not in (200, 201):
    print('        -> on_conflict upsert unavailable: %s' % json.dumps(ins)[:300])
    st, ins, _ = call('POST', SUPABASE + '/rest/v1/progress', row, hdr)
    ok(st in (200, 201), 'plain insert fallback accepted (HTTP %s)' % st)

print('\n6) read it back — RLS allows the owner, and only the owner')
st, rows, _ = call('GET', SUPABASE + '/rest/v1/progress?select=id,user_id,course_slug,lesson_slug,completed,xp,completed_at&user_id=eq.' + uid,
                   None, token_hdr)
ok(st == 200 and len(rows) == 1, 'row visible to its owner (HTTP %s, %s row(s))' % (st, len(rows) if isinstance(rows, list) else '?'))
if isinstance(rows, list) and rows:
    r = rows[0]
    ok(r['user_id'] == uid and r['course_slug'] == 'n8n-fundamentals' and r['lesson_slug'] == 'what-is-n8n'
       and r['completed'] is True and r['xp'] == 10 and bool(r['completed_at']),
       'all seven columns round-trip: ' + json.dumps({k: r[k] for k in r if k != 'id'}))
st, anon_rows, _ = call('GET', SUPABASE + '/rest/v1/progress?select=user_id&limit=1', None, auth_headers())
ok(st == 200 and isinstance(anon_rows, list) and len(anon_rows) == 0,
   'anonymous key still sees nothing (RLS intact, HTTP %s)' % st)

print('\n7) second write for the same lesson must not duplicate (store.js relies on this)')
row2 = dict(row, xp=25)
st, ins2, _ = call('POST', url, row2, hdr)
if st not in (200, 201):
    st, ins2, _ = call('POST', SUPABASE + '/rest/v1/progress', row2, hdr)
st, rows2, _ = call('GET', SUPABASE + '/rest/v1/progress?select=xp&user_id=eq.' + uid, None, token_hdr)
ok(st == 200 and len(rows2) == 1 and rows2[0]['xp'] == 25, 'updated in place, still 1 row with xp=25')
ok(composite_ok, 'composite unique key (user_id, course_slug, lesson_slug) exists → upsert path used by store.js works')

print('\n8) progress survives a fresh sign-in (sign out, sign in, re-read)')
call('POST', SUPABASE + '/auth/v1/logout', None, token_hdr)
st, si2, _ = call('POST', SUPABASE + '/auth/v1/token?grant_type=password',
                  {'email': addr, 'password': PASSWORD}, auth_headers())
ok(st == 200 and si2.get('access_token'), 'signed back in (HTTP %s)' % st)
st, rows3, _ = call('GET', SUPABASE + '/rest/v1/progress?select=lesson_slug,xp,completed,completed_at&user_id=eq.' + uid,
                    None, {'apikey': ANON, 'Authorization': 'Bearer ' + si2.get('access_token', '')})
ok(st == 200 and rows3 and rows3[0]['lesson_slug'] == 'what-is-n8n' and rows3[0]['xp'] == 25,
   'progress restored after sign-out/sign-in: ' + json.dumps(rows3))

print('\n9) cleanup (delete the test rows)')
st, dele, _ = call('DELETE', SUPABASE + '/rest/v1/progress?user_id=eq.' + uid, None,
                   {'apikey': ANON, 'Authorization': 'Bearer ' + access})
st, rows4, _ = call('GET', SUPABASE + '/rest/v1/progress?select=user_id&user_id=eq.' + uid, None, token_hdr)
ok(st == 200 and rows4 == [], 'test rows deleted (HTTP %s)' % st)

print('\n' + str(len(checks)) + ' checks, ' + str(checks.count(False)) + ' failures')
print('test account: ' + addr + '  (id ' + str(uid) + ')')
sys.exit(1 if checks.count(False) else 0)
