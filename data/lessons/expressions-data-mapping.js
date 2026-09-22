/* Rvencis Forge — data/lessons/expressions-data-mapping.js */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  L['expressions-data-mapping/expression-syntax'] = {
    blocks: [
      { t: 'p', html: 'Anything between <code>{{ }}</code> is JavaScript evaluated at runtime, with the current item pre-loaded as <code>$json</code>. The editor shows a live preview of the computed value against real input data.' },
      { t: 'code', lang: 'javascript', label: 'From simple to composed', code: '{{ $json.name }}\n{{ $json.name.toUpperCase() }}\n{{ "{{ }}" }}  → mixing text and expressions in one field:\nHi {{ $json.name }}, your order {{ $json.id }} shipped!' },
      { t: 'callout', variant: 'tip', title: 'When to pick what',
        html: 'One value → expression. Many items restructured → transformation nodes (Split Out, Aggregate, Summarize). Arbitrary logic → Code node.' }
    ],
    exercise: {
      type: 'expression',
      prompt: 'Return the email field of the current item, upper-cased.',
      sample: { email: 'ada@example.com' },
      expected: 'ADA@EXAMPLE.COM',
      hint: 'Chain .toUpperCase() onto the $json.email path.',
      validators: [
        { mustMatch: '$json.email', label: 'Reference $json.email' },
        { mustContain: 'toUpperCase', label: 'Call .toUpperCase()' }
      ]
    }
  };

  L['expressions-data-mapping/json-and-node-vars'] = {
    blocks: [
      { t: 'p', html: 'Three variables cover 95% of references: <code>$json</code> (current item), <code>$node["Name"]</code> (a specific earlier node), and <code>$input</code> (the incoming items when you need more than one).' },
      { t: 'code', lang: 'javascript', label: 'Side by side', code: '{{ $json.id }}\n{{ $node["HTTP Request"].json.data[0].id }}\n{{ $input.all().length }}  // how many items came in' },
      { t: 'callout', variant: 'warn', title: 'Names must match exactly',
        html: '$node["…"] uses the node\'s canvas name. Renaming a node breaks references — the expression editor will flag missing names.' }
    ],
    exercise: {
      type: 'expression',
      prompt: 'Return the token produced by the node named "Auth".',
      sample: { token: 'abc123' },
      expected: 'abc123',
      hint: 'Use $node["Auth"] and then .json.token.',
      validators: [
        { mustMatch: '$node["Auth"].json.token', label: 'Use $node["Auth"].json.token' }
      ]
    }
  };
  L['expressions-data-mapping/expressions-vs-code'] = {
    blocks: [
      { t: 'p', html: 'The #1 source of "why does my code fail?" is using expression helpers inside the Code node. They are different runtimes:' },
      { t: 'table', head: ['Feature', 'Expressions', 'Code node'], rows: [
        ['<code>$if()</code>, <code>$jmespath()</code>, top-level helpers', 'Available', 'Not available'],
        ['n8n-only <code>DateTime.format()</code>', 'Available (custom n8n functionality)', 'Use native <code>toFormat()</code>'],
        ['<code>DateTime.plus(amount, unit)</code> two-arg form', 'Available', 'Native Luxon takes <code>{ days: 7 }</code>'],
        ['Plain JavaScript + Luxon', 'Yes', 'Yes'],
        ['Promises, console.log, npm modules', 'No', 'Yes (npm: self-hosted only)']
      ] },
      { t: 'callout', variant: 'warn', title: 'Silent wrong results',
        html: 'Worst case is not an error: calling the expression-style <code>plus(7, "days")</code> in the Code node does not throw — it quietly does nothing useful. When the Code node misbehaves, first check whether the method is tagged "Custom n8n functionality" in the docs.' }
    ],
    exercise: {
      type: 'quiz',
      questions: [
        {
          q: 'You need $jmespath() to query a nested structure. Where can it run?',
          options: ['Expressions only', 'Code node only', 'Both', 'Neither'],
          answer: [0],
          why: 'All top-level helper functions are expression-editor only; the Code node runs plain JavaScript.'
        },
        {
          q: 'In the Code node, the correct way to add 7 days to a Luxon DateTime is:',
          options: ['dt.plus(7, "days")', 'dt.plus({ days: 7 })', 'dt.addDays(7)', 'n8n.helpers.addDays(dt, 7)'],
          answer: [1],
          why: 'Native Luxon plus() accepts a single Duration-like object; the two-arg form is an n8n expression extension that silently misbehaves in Code.'
        }
      ]
    }
  };
  L['expressions-data-mapping/builtin-shortcuts'] = {
    blocks: [
      { t: 'p', html: 'Beyond the big variables, expressions ship with shortcuts that save a lot of typing. A few of the most useful:' },
      { t: 'code', lang: 'javascript', label: 'Everyday shortcuts', code: '{{ $now.toFormat("yyyy-MM-dd") }}   // 2026-09-18\n{{ $today.plus(7, "days") }}          // expression version accepts (amount, unit)\n{{ $json.name || "unknown" }}         // fallbacks\n{{ $json.items.length }}              // plain JS works too\n{{ Math.round($json.price * 1.2) }}   // any JS expression' },
      { t: 'callout', variant: 'tip', title: 'Bookmark the reference',
        html: 'The full list of built-in methods and variables lives in the n8n docs under "Code in n8n → Use built-in shortcuts" — worth keeping open in a second tab while you build.' }
    ]
  };
  /*@@LESSONS@@*/
})(window);


