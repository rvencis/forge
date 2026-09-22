/* Rvencis Forge — data/lessons/error-handling.js + self-hosting-n8n.js (5 authored lessons) */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  /* ---------- error-handling ---------- */
  L['error-handling/retries'] = {
    blocks: [
      { t: 'p', html: 'Transient failures (rate limits, blips) deserve retries; permanent failures deserve a clean fallback. n8n gives you both at the node level.' },
      { t: 'list', items: [
        '<strong>Retry on Fail</strong> — retry count + wait time between tries; perfect for 429s.',
        '<strong>Continue on Fail</strong> — the node "succeeds" with an error item, so one bad record does not kill a 10,000-item run.',
        '<strong>OnError output branch</strong> — route failed items to a dead-letter path for inspection.'
      ] },
      { t: 'callout', variant: 'warn', title: 'Fail fast vs. fail soft',
        html: 'Money-moving steps should fail loudly (Stop And Error); bulk syncs should fail soft and log. Choose per node, not per workflow.' }
    ],
    exercise: {
      type: 'nodeconfig',
      nodeLabel: 'HTTP Request',
      nodeType: 'n8n-nodes-base.httpRequest',
      brief: 'Retry up to 3 times, 2s apart, then continue on fail.',
      spec: [
        { key: 'retry',     label: 'Retry on Fail', type: 'toggle', solution: true },
        { key: 'maxTries',  label: 'Max tries', type: 'text', solution: '3' },
        { key: 'waitMs',    label: 'Wait between tries (ms)', type: 'text', solution: '2000' },
        { key: 'onFail',    label: 'On fail', type: 'select', options: ['Stop workflow', 'Continue (error item)'], solution: 'Continue (error item)' }
      ],
      sample: {},
      explanation: 'Retry handles the transient 429s; Continue on Fail keeps the bulk run alive and emits error items you can review afterwards.'
    }
  };

  L['error-handling/stop-and-error'] = {
    blocks: [
      { t: 'p', html: '<strong>Stop And Error</strong> fails the execution deliberately with your message — better than letting a null explode three nodes later.' },
      { t: 'p', html: 'Pair it with the <strong>Error Trigger</strong>: a separate workflow that starts whenever any workflow fails, receiving the error details so you can alert (Slack, email, ticketing).' },
      { t: 'code', lang: 'javascript', label: 'Guard clause pattern', code: 'if (!items[0].json.customerId) {\n  // Stop And Error node placed before the expensive call\n}\n// or inside the Code node:\nthrow new Error("Missing customerId on item " + itemIndex);' }
    ]
  };

  L['error-handling/debugging'] = {
    blocks: [
      { t: 'p', html: 'Every execution stores the input/output of each node. The debugging loop:' },
      { t: 'list', items: [
        'Open <strong>Executions</strong>, pick the failed run, click the red node.',
        'Compare INPUT vs OUTPUT — is the shape what you assumed?',
        '<strong>Pin</strong> a good input, fix the node, re-run only from there.',
        'Use <strong>mock data</strong> on triggers to replay webhooks without the source.'
      ] }
    ]
  };

  /* ---------- self-hosting ---------- */
  L['self-hosting-n8n/docker-setup'] = {
    blocks: [
      { t: 'p', html: 'The supported way to self-host is Docker with a mounted volume for <code>/home/node/.n8n</code> — that folder holds the database, credentials encryption key and uploaded files.' },
      { t: 'code', lang: 'yaml', label: 'docker-compose.yml (essentials)', code: 'services:\n  n8n:\n    image: docker.n8n.io/n8nio/n8n\n    ports: ["5678:5678"]\n    volumes: ["n8n_data:/home/node/.n8n"]\n    environment:\n      - N8N_ENCRYPTION_KEY=change-me\n      - WEBHOOK_URL=https://n8n.example.com/\nvolumes:\n  n8n_data:' },
      { t: 'callout', variant: 'warn', title: 'Back up the encryption key',
        html: 'Losing N8N_ENCRYPTION_KEY means losing access to every stored credential. Back it up with the data volume — they are a pair.' }
    ]
  };

  L['self-hosting-n8n/env-vars'] = {
    blocks: [
      { t: 'p', html: 'A handful of environment variables shape a production instance. The ones that matter first:' },
      { t: 'table', head: ['Variable', 'Why'], rows: [
        ['<code>N8N_ENCRYPTION_KEY</code>', 'Encrypts credentials — set it, back it up'],
        ['<code>WEBHOOK_URL</code>', 'Public URL so webhooks and OAuth callbacks resolve'],
        ['<code>N8N_HOST</code> / <code>N8N_PORT</code>', 'Where the editor listens'],
        ['<code>EXECUTIONS_DATA_PRUNE</code>', 'Keeps the execution database from growing forever'],
        ['<code>GENERIC_TIMEZONE</code>', 'Default timezone for schedules']
      ] },
      { t: 'p', html: 'Inside workflows, <code>$env</code> reads these values (when enabled), and <code>$vars</code> reads instance-level variables you manage in the UI — the right home for per-environment config like API base URLs.' }
    ]
  };
  /*@@LESSONS@@*/
})(window);
