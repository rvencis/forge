/* Rvencis Forge — data/lessons/webhooks-and-forms.js (2 authored lessons) */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  L['webhooks-and-forms/webhook-trigger'] = {
    blocks: [
      { t: 'p', html: 'The <strong>Webhook</strong> node registers an HTTP endpoint for your workflow. While building you get a <em>test URL</em>; once Active, the <em>production URL</em> takes over.' },
      { t: 'code', lang: 'json', label: 'What arrives on the trigger item', code: '{\n  "json": {\n    "headers": { "content-type": "application/json" },\n    "params": {},\n    "query": {},\n    "body": { "event": "order.created", "id": 42 }\n  }\n}' },
      { t: 'callout', variant: 'tip', title: 'HTTP methods',
        html: 'Pick GET, POST or whatever the sender uses; for GET the payload arrives in <code>query</code>, for POST usually in <code>body</code>.' }
    ],
    exercise: {
      type: 'expression',
      prompt: 'Return the event name from an incoming webhook body.',
      sample: { headers: {}, query: {}, body: { event: 'order.created' } },
      expected: 'order.created',
      hint: 'The body is nested under $json.body.',
      validators: [
        { mustMatch: '$json.body.event', label: 'Use $json.body.event' }
      ]
    }
  };

  L['webhooks-and-forms/respond-to-webhook'] = {
    blocks: [
      { t: 'p', html: 'By default a webhook replies instantly with a 200. Use <strong>Respond to Webhook</strong> when the caller should receive your computed result instead.' },
      { t: 'list', items: [
        'Set the webhook\'s <strong>Respond</strong> option to "Using Respond to Webhook node".',
        'Place the Respond node wherever the answer is ready — mid-flow is fine.',
        'Configure status code and response body (JSON, text, or first incoming item).'
      ] },
      { t: 'callout', variant: 'warn', title: 'Timeouts cut both ways',
        html: 'The caller waits only as long as its own timeout. Put slow work (AI calls, big fetches) after the response, or return 202 + a job id pattern.' }
    ]
  };
  /*@@LESSONS@@*/
})(window);
