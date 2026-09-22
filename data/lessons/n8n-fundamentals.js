/* Rvencis Forge — data/lessons/n8n-fundamentals.js
   Authored lessons for the flagship course. Registry keys are
   '<course-slug>/<lesson-slug>'. Facts align with official n8n docs
   (verified 2026-09). */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  L['n8n-fundamentals/what-is-n8n'] = {
    blocks: [
      { t: 'p', html: '<strong>n8n</strong> is a workflow automation tool: you connect nodes on a canvas, and each node performs one step — fetch data, transform it, branch, call an API, notify someone. Where spreadsheets automate calculations, n8n automates <em>processes</em>.' },
      { t: 'callout', variant: 'tip', title: 'Fair-code, self-hostable',
        html: 'n8n uses a sustainable fair-code license: the source is available and you can self-host it, while n8n offers a managed cloud. Everything in this course works in both.' },
      { t: 'h', text: 'The three building blocks' },
      { t: 'list', items: [
        '<strong>Triggers</strong> start a workflow — Manual Trigger (a button), Schedule Trigger (time), Webhook (an HTTP request from the outside world).',
        '<strong>Nodes</strong> do the work — one action each: HTTP Request, Edit Fields (Set), Code, app nodes like Slack or Gmail.',
        '<strong>Connections</strong> carry data — the arrow between nodes passes an array of <em>items</em>.'
      ] },
      { t: 'h', text: 'Why builders choose it' },
      { t: 'p', html: 'No-code tools box you in; pure code tools slow you down. n8n sits in between: drag nodes for the 90% that is standard, and drop into expressions or the Code node for the 10% that is not.' },
      { t: 'table', head: ['You need to…', 'Reach for'], rows: [
        ['Set a few parameter values', 'Expressions, e.g. <code>{{ $json.email }}</code>'],
        ['Reshape many items', 'Split Out, Aggregate, Summarize nodes'],
        ['Run custom JavaScript/Python', 'The Code node'],
        ['Branch on conditions', 'If / Switch nodes']
      ] },
      { t: 'checklist', items: [
        'I can name the three building blocks: triggers, nodes, connections',
        'I know n8n can be self-hosted or used in the cloud'
      ] }
    ]
  };

  L['n8n-fundamentals/editor-tour'] = {
    blocks: [
      { t: 'p', html: 'Open the editor and you see the <strong>canvas</strong>. Workflows are graphs: nodes are boxes, connections are lines, and data flows left to right.' },
      { t: 'figure', svg: 'canvas-tour', caption: 'The editor: trigger on the left, action nodes to the right' },
      { t: 'h', text: 'Panels you will use daily' },
      { t: 'list', items: [
        '<strong>Node panel</strong> — click a node to edit its parameters and view input/output data for that step.',
        '<strong>Executions</strong> — every run is recorded; open a past execution to inspect real data or debug a failure.',
        '<strong>Credentials</strong> — stored connections (API keys, OAuth) that nodes reference; secrets never live inside the workflow JSON.',
        '<strong>Active toggle</strong> — a workflow only responds to the outside world (webhooks, schedules) once it is Active.'
      ] },
      { t: 'callout', variant: 'info', title: 'Pin your data',
        html: 'While building, you can <strong>pin</strong> a node\'s output data. The next run uses the pinned snapshot instead of calling the API again — great for iterating without hammering a rate limit.' },
      { t: 'p', html: 'Executions are your safety net: n8n keeps the input and output of every node, so "what did the API actually return?" is always one click away.' },
      { t: 'checklist', items: [
        'I know where parameters, credentials and executions live',
        'I know why a webhook workflow needs to be Active'
      ] }
    ]
  };
  /* ---- first-workflow: a drag-free workflow-building exercise ---- */
  L['n8n-fundamentals/first-workflow'] = {
    blocks: [
      { t: 'p', html: 'Time to build. The classic first workflow: <strong>read items from a source, reshape them, hand them to the next step</strong>. In this exercise you assemble the graph — no node editor needed.' },
      { t: 'callout', variant: 'tip', title: 'How these exercises work',
        html: 'Click nodes in the palette to place them, then click node A and node B to connect them. Your goal is to match the target structure below.' },
      { t: 'h', text: 'The target' },
      { t: 'list', items: [
        '<strong>Manual Trigger</strong> starts the run (you press "Execute workflow").',
        '<strong>Edit Fields (Set)</strong> reshapes each item — keep only the fields you need.',
        '<strong>HTTP Request</strong> POSTs the cleaned items to an API.'
      ] },
      { t: 'figure', svg: 'flow-basic', caption: 'Trigger → transform → send: the pattern behind most automations' }
    ],
    exercise: {
      type: 'workflow',
      brief: 'Build the 3-node workflow: Manual Trigger → Edit Fields (Set) → HTTP Request, connected left to right.',
      palette: [
        { key: 'manualTrigger', type: 'n8n-nodes-base.manualTrigger', label: 'Manual Trigger' },
        { key: 'set',          type: 'n8n-nodes-base.set',           label: 'Edit Fields (Set)' },
        { key: 'http',         type: 'n8n-nodes-base.httpRequest',   label: 'HTTP Request' },
        { key: 'webhook',      type: 'n8n-nodes-base.webhook',       label: 'Webhook (decoy)' },
        { key: 'code',         type: 'n8n-nodes-base.code',          label: 'Code (decoy)' }
      ],
      target: {
        nodes: ['manualTrigger', 'set', 'http'],
        edges: [['manualTrigger', 'set'], ['set', 'http']]
      },
      flow: {
        'manualTrigger': { in: 1, out: 1 },
        'set': { in: 1, out: 1 },
        'http': { in: 1, out: 1 }
      },
      explanation: 'Triggers start flows; Edit Fields (Set) reshapes items in place; HTTP Request is the standard way to send data onward. The Webhook would *receive* events, and the Code node is overkill for simple reshaping.'
    }
  };

  /* ---- checkpoint-triggers quiz ---- */
  L['n8n-fundamentals/checkpoint-triggers'] = {
    blocks: [
      { t: 'p', html: 'Quick checkpoint before moving to data. Answer all questions — you can retry, and 100% earns the <em>Quiz Ace</em> badge.' }
    ],
    exercise: {
      type: 'quiz',
      questions: [
        {
          q: 'Which node starts a workflow when an outside service sends an HTTP request?',
          options: ['Schedule Trigger', 'Webhook', 'Manual Trigger', 'HTTP Request'],
          answer: [1],
          why: 'Webhook gives the workflow a URL; the external service calls it. HTTP Request goes the other direction — it makes outbound calls.'
        },
        {
          q: 'What passes between two connected nodes?',
          options: ['A single JSON object', 'An array of items, each wrapping a json object', 'Plain text', 'A database row'],
          answer: [1],
          why: 'Data between nodes is an array of objects shaped like [{ json: { … } }] — nodes process each item automatically.'
        },
        {
          q: 'A workflow with a Schedule Trigger runs every hour — but only after you…',
          options: ['Save it', 'Activate it', 'Pin its data', 'Export it'],
          answer: [1],
          why: 'Activation is what subscribes the workflow to the outside world (schedules, webhooks).'
        },
        {
          q: 'You want to iterate on a workflow without calling a rate-limited API again. Best move?',
          options: ['Pin the node output data', 'Deactivate the workflow', 'Use the Code node', 'Duplicate the workflow'],
          answer: [0],
          why: 'Pinned data replays the stored snapshot for that node, so downstream nodes run against known data.'
        }
      ]
    }
  };
  /* ---- items-and-json ---- */
  L['n8n-fundamentals/items-and-json'] = {
    blocks: [
      { t: 'p', html: 'Everything in n8n moves as <strong>items</strong>. An item is an object with a <code>json</code> key (and optionally a <code>binary</code> key for files):' },
      { t: 'code', lang: 'json', label: 'The shape of data between nodes', code: '[\n  {\n    "json": {\n      "fruit": "apples",\n      "color": "green"\n    },\n    "binary": {\n      "data": { "data": "…base64…", "mimeType": "image/png" }\n    }\n  },\n  { "json": { "fruit": "pears", "color": "yellow" } }\n]' },
      { t: 'callout', variant: 'tip', title: 'Nodes iterate for you',
        html: 'If a node receives 50 items and you configure one action — say "create card" — the node runs that action <strong>once per item</strong>. You never write the loop for simple cases.' },
      { t: 'h', text: 'Reading nested data' },
      { t: 'p', html: 'Nested fields are just dot paths. For <code>{ "name": "First", "nested": { "example-number-field": 1 } }</code> the number lives at <code>nested["example-number-field"]</code> — and in the table view n8n bolds nested keys to hint they contain structure.' },
      { t: 'h', text: 'Two gotchas worth knowing' },
      { t: 'list', items: [
        '<strong>Code node convenience:</strong> when you return items from the Code node, n8n adds the <code>json</code> wrapper automatically (since version 0.166.0). When <em>building nodes</em>, you must include it yourself.',
        '<strong>Binary is separate:</strong> images and files ride along in <code>binary</code>, base64-encoded, with an optional <code>mimeType</code> and <code>fileName</code>.'
      ] },
      { t: 'table', head: ['You see…', 'It means'], rows: [
        ['A bold column in the table view', 'That field contains nested JSON'],
        ['A binary tab on a node output', 'Files are present; check mimeType'],
        ['One execution, many rows', 'One item per row — the node iterated']
      ] },
      { t: 'checklist', items: [
        'I can write out the item shape from memory: [{ json: { … } }]',
        'I know binary data is separate from json data'
      ] }
    ]
  };

  /* ---- first-expression ---- */
  L['n8n-fundamentals/first-expression'] = {
    blocks: [
      { t: 'p', html: 'Expressions are small JavaScript snippets inside <code>{{ … }}</code> that compute a parameter value <em>at runtime</em>. They are the workhorse of n8n — prefer them when a plain value will not do.' },
      { t: 'code', lang: 'javascript', label: 'Common reference patterns', code: '{{ $json.email }}            // field on the current item\n{{ $json.body.city }}         // nested field\n{{ $node["HTTP Request"].json.id }}  // a specific earlier node\n{{ $now }}                    // current Luxon DateTime\n{{ $today }}                  // today, at midnight\n{{ $env.MY_FLAG }}            // environment variable (self-hosted)\n{{ $vars.apiBase }}           // instance variables' },
      { t: 'callout', variant: 'tip', title: 'Live preview',
        html: 'The expression editor evaluates as you type against the node\'s input data, so you see the computed value before running anything. Prefer expressions over the Code node whenever a single value is all you need.' },
      { t: 'h', text: 'Your exercise' },
      { t: 'p', html: 'Incoming items look like <code>{ "body": { "city": "Lisbon" } }</code>. Write the expression that pulls the city out.' }
    ],
    exercise: {
      type: 'expression',
      prompt: 'Return the city from the incoming item.',
      sample: { body: { city: 'Lisbon', country: 'Portugal' } },
      expected: 'Lisbon',
      hint: 'The city is nested one level down, under "body".',
      validators: [
        { mustMatch: '$json.body.city', label: 'Use the $json.body.city path' }
      ]
    }
  };
  /* ---- edit-fields-set nodeconfig ---- */
  L['n8n-fundamentals/edit-fields-set'] = {
    blocks: [
      { t: 'p', html: '<strong>Edit Fields (Set)</strong> is the node you will use most. It decides <em>what the output items look like</em>: keep fields, rename them, add constants, compute values with expressions.' },
      { t: 'h', text: 'The three modes that matter' },
      { t: 'list', items: [
        '<strong>Manual Mapping</strong> — define fields one by one; each value can be a literal or an expression.',
        '<strong>JSON Output</strong> — paste a JSON template; <code>{{ … }}</code> inside it is interpolated.',
        '<strong>Drag & drop mapping</strong> — drag a field from the INPUT panel into a parameter and n8n writes the expression for you, e.g. <code>{{ $json.fruit }}</code>.'
      ] },
      { t: 'callout', variant: 'info', title: 'Include Other Fields',
        html: 'By default Set outputs only the fields you define. Toggle "Include Other Input Fields" when you want the untouched fields to pass through too.' },
      { t: 'h', text: 'Your exercise' },
      { t: 'p', html: 'Configure a Set node in <strong>Manual Mapping</strong> mode that produces a <code>fullName</code> field by combining <code>firstName</code> and <code>lastName</code>, and turns on passthrough of the other fields.' }
    ],
    exercise: {
      type: 'nodeconfig',
      nodeLabel: 'Edit Fields (Set)',
      nodeType: 'n8n-nodes-base.set',
      brief: 'Build the fullName field and keep the other input fields.',
      spec: [
        { key: 'mode', label: 'Mode', type: 'select', options: ['Manual Mapping', 'JSON Output'], solution: 'Manual Mapping' },
        { key: 'name', label: 'Field name', type: 'text', placeholder: 'e.g. fullName', solution: 'fullName' },
        { key: 'value', label: 'Value (expression)', type: 'text', placeholder: '{{ … }}', solution: '{{ $json.firstName }} {{ $json.lastName }}' },
        { key: 'includeOther', label: 'Include Other Input Fields', type: 'toggle', solution: true }
      ],
      sample: { firstName: 'Ada', lastName: 'Lovelace' },
      explanation: 'Manual Mapping lets you name the field and compute its value with an expression; Include Other Input Fields keeps firstName/lastName on the output items.'
    }
  };

  /* ---- mapping-fields expression ---- */
  L['n8n-fundamentals/mapping-fields'] = {
    blocks: [
      { t: 'p', html: 'Later nodes can reach <em>any earlier node\'s</em> data — not just the immediately previous one. That is what <code>$node</code> is for.' },
      { t: 'code', lang: 'javascript', label: 'Referencing specific nodes', code: "{{ $node[\"Webhook\"].json.payload.user.id }}\n{{ $node[\"HTTP Request\"].json.data.token }}\n{{ $json.id }}   // current item — the common case" },
      { t: 'callout', variant: 'warn', title: 'Node names are identifiers',
        html: 'The string inside $node["…"] must match the node\'s <em>name</em> on the canvas exactly. If you rename a node, update its references.' },
      { t: 'h', text: 'Your exercise' },
      { t: 'p', html: 'The <code>Webhook</code> node received <code>{ "payload": { "user": { "id": 42 } } }</code>. Write the expression that returns the user id from that node\'s output.' }
    ],
    exercise: {
      type: 'expression',
      prompt: 'Return the user id from the Webhook node output.',
      sample: { payload: { user: { id: 42 } } },
      expected: 42,
      hint: 'Reach into the Webhook node with $node["Webhook"], then walk the payload path.',
      validators: [
        { mustMatch: '$node["Webhook"].json.payload.user.id', label: 'Reference the Webhook node via $node' }
      ]
    }
  };
  /* ---- if-switch nodeconfig ---- */
  L['n8n-fundamentals/if-switch'] = {
    blocks: [
      { t: 'p', html: 'Automation is mostly decisions. <strong>If</strong> gives you a boolean split (two outputs: true / false); <strong>Switch</strong> routes items by value with any number of outputs.' },
      { t: 'list', items: [
        '<strong>If</strong> — condition like <code>{{ $json.total }} &gt; 100</code>; items go to the <em>true</em> or <em>false</em> output.',
        '<strong>Switch</strong> — compare a value against rules; each matching rule routes to its own output (great for order types, event names, status codes).',
        'Both nodes re-emit <strong>all fields</strong> of each item — routing never strips data.'
      ] },
      { t: 'callout', variant: 'info', title: 'Combine conditions',
        html: 'Conditions can be chained with AND/OR inside a single rule set, so complex gating rarely needs nested If nodes.' },
      { t: 'h', text: 'Your exercise' },
      { t: 'p', html: 'Route VIP orders: configure an <strong>If</strong> node whose condition sends items with <code>total &gt; 1000</code> to the true branch.' }
    ],
    exercise: {
      type: 'nodeconfig',
      nodeLabel: 'If',
      nodeType: 'n8n-nodes-base.if',
      brief: 'True branch when total is greater than 1000.',
      spec: [
        { key: 'left',  label: 'Value 1 (expression)', type: 'text', placeholder: '{{ … }}', solution: '{{ $json.total }}' },
        { key: 'op',    label: 'Operation', type: 'select', options: ['larger', 'smaller', 'equals'], solution: 'larger' },
        { key: 'right', label: 'Value 2', type: 'text', placeholder: 'number', solution: '1000' }
      ],
      sample: { total: 1250, customer: 'acme' },
      explanation: 'The condition compares the total field against 1000 with the "larger" operation; matching items exit on the true output.'
    }
  };

  /* ---- code-node-intro (Code exercise) ---- */
  L['n8n-fundamentals/code-node-intro'] = {
    blocks: [
      { t: 'p', html: 'When a one-line expression is not enough, the <strong>Code node</strong> runs real JavaScript against all incoming items. Two modes: <em>Run Once for All Items</em> (you get the whole array) and <em>Run Once for Each Item</em>.' },
      { t: 'code', lang: 'javascript', label: 'Run Once for All Items', code: '// items = [{ json: {...} }, ...]\nreturn items.map(item => ({\n  json: {\n    id: item.json.id,\n    total: item.json.qty * item.json.price\n  }\n}));' },
      { t: 'callout', variant: 'warn', title: 'Expression helpers do NOT exist here',
        html: 'The Code node runs plain JavaScript with native Luxon. n8n-expression-only helpers — <code>$if()</code>, <code>$jmespath()</code>, and all top-level transformation functions — are unavailable. Use <code>toFormat()</code> instead of the n8n-only <code>format()</code>, and note Luxon\'s <code>plus()</code> takes a Duration object, not (amount, unit).' },
      { t: 'h', text: 'Your exercise' },
      { t: 'p', html: 'Given items with <code>qty</code> and <code>price</code>, produce <code>total</code> on every item, keeping the other fields.' }
    ],
    exercise: {
      type: 'code',
      mode: 'all-items',
      brief: 'Add total = qty × price to each item; keep existing fields.',
      starter: '// "items" is the incoming array of { json: {...} }\nreturn items.map(item => ({\n  json: {\n    ...item.json,\n    total: /* your code here */\n  }\n}));',
      tests: [
        { input: [{ json: { id: 1, qty: 2, price: 500 } }], expect: [{ json: { id: 1, qty: 2, price: 500, total: 1000 } }] },
        { input: [{ json: { id: 2, qty: 0, price: 99 } }],  expect: [{ json: { id: 2, qty: 0, price: 99, total: 0 } }] },
        { input: [{ json: { id: 3, qty: 3, price: 19.5 } }], expect: [{ json: { id: 3, qty: 3, price: 19.5, total: 58.5 } }] }
      ],
      hiddenTest: { input: [{ json: { id: 9, qty: 4, price: 12.25 } }], expect: [{ json: { id: 9, qty: 4, price: 12.25, total: 49 } }] },
      solution: 'return items.map(item => ({\n  json: {\n    ...item.json,\n    total: item.json.qty * item.json.price\n  }\n}));'
    }
  };
  /* ---- remaining authored lessons (part 1 of 2) ---- */
  L['n8n-fundamentals/loop-over-items'] = {
    blocks: [
      { t: 'p', html: 'Most nodes already iterate over items — so when do you need <strong>Loop Over Items (Split in Batches)</strong>? When each <em>batch</em> needs its own downstream steps: pause between API pages, summarise per chunk, avoid hammering an endpoint.' },
      { t: 'list', items: [
        'Set a <strong>batch size</strong> (default 1 item per batch).',
        'The node outputs each batch; connect the loop-back path to run the next batch.',
        'Use the <strong>Wait</strong> node inside the loop to pace requests against rate limits.'
      ] },
      { t: 'callout', variant: 'tip', title: 'Do you even need it?',
        html: 'If a single node action handles every item (e.g. one HTTP call per item), let automatic iteration do the work. Reach for batches only when the <em>group</em> matters.' }
    ],
    exercise: {
      type: 'workflow',
      brief: 'Build a paced loop: Schedule Trigger → Loop Over Items → HTTP Request, with HTTP Request looping back into Loop Over Items.',
      palette: [
        { key: 'trigger', type: 'n8n-nodes-base.scheduleTrigger', label: 'Schedule Trigger' },
        { key: 'loop',    type: 'n8n-nodes-base.splitInBatches',  label: 'Loop Over Items' },
        { key: 'http',    type: 'n8n-nodes-base.httpRequest',     label: 'HTTP Request' },
        { key: 'set',     type: 'n8n-nodes-base.set',             label: 'Edit Fields (Set) (decoy)' }
      ],
      target: {
        nodes: ['trigger', 'loop', 'http'],
        edges: [['trigger', 'loop'], ['loop', 'http'], ['http', 'loop']]
      },
      flow: { trigger: { in: 1, out: 1 }, loop: { in: 1, out: 1 }, http: { in: 1, out: 1 } },
      explanation: 'The loop-back edge from HTTP Request into Loop Over Items is what makes it a loop: each batch flows through the body, then returns for the next.'
    }
  };

  L['n8n-fundamentals/schedule-trigger'] = {
    blocks: [
      { t: 'p', html: 'The <strong>Schedule Trigger</strong> starts workflows on time: every N minutes, hourly, daily at a specific time, or a custom cron expression.' },
      { t: 'list', items: [
        'Common pitfall: the workflow must be <strong>Active</strong> or the schedule never fires.',
        'Times follow the instance timezone — set it correctly in workflow settings.',
        'For "every weekday at 9", use the visual fields; save cron for exotic intervals.'
      ] },
      { t: 'callout', variant: 'info', title: 'Idempotency',
        html: 'Scheduled runs repeat forever. Design the first node after the trigger to be safe on re-runs — e.g. fetch "items changed since last run" rather than "everything".' }
    ],
    exercise: {
      type: 'nodeconfig',
      nodeLabel: 'Schedule Trigger',
      nodeType: 'n8n-nodes-base.scheduleTrigger',
      brief: 'Fire every day at 09:00.',
      spec: [
        { key: 'unit',  label: 'Unit', type: 'select', options: ['minutes', 'hours', 'days', 'custom cron'], solution: 'days' },
        { key: 'days',  label: 'Days between runs', type: 'text', placeholder: '1', solution: '1' },
        { key: 'hour',  label: 'Trigger at hour', type: 'text', placeholder: '0-23', solution: '9' }
      ],
      sample: {},
      explanation: 'A daily schedule with "days between runs = 1" and hour = 9 fires once per day at 09:00 instance time.'
    }
  };
  /* ---- remaining authored lessons (part 2 of 2) ---- */
  L['n8n-fundamentals/webhooks'] = {
    blocks: [
      { t: 'p', html: 'A <strong>Webhook</strong> node turns your workflow into an HTTP endpoint. Any service that can send a web request can start your automation.' },
      { t: 'list', items: [
        '<strong>Test URL</strong> — works while the editor listens; use while building.',
        '<strong>Production URL</strong> — live once the workflow is Active.',
        'The incoming body, headers and query params arrive on the trigger item\'s <code>json</code>.'
      ] },
      { t: 'figure', svg: 'flow-webhook', caption: 'Webhook → parse → respond: the inbound mirror of the first-workflow pattern' }
    ],
    exercise: {
      type: 'workflow',
      brief: 'Build: Webhook → Edit Fields (Set) → Respond to Webhook.',
      palette: [
        { key: 'webhook', type: 'n8n-nodes-base.webhook',         label: 'Webhook' },
        { key: 'set',     type: 'n8n-nodes-base.set',             label: 'Edit Fields (Set)' },
        { key: 'respond', type: 'n8n-nodes-base.respondToWebhook', label: 'Respond to Webhook' },
        { key: 'http',    type: 'n8n-nodes-base.httpRequest',     label: 'HTTP Request (decoy)' }
      ],
      target: {
        nodes: ['webhook', 'set', 'respond'],
        edges: [['webhook', 'set'], ['set', 'respond']]
      },
      flow: { webhook: { in: 1, out: 1 }, set: { in: 1, out: 1 }, respond: { in: 1, out: 1 } },
      explanation: 'Webhook receives, Set shapes the response payload, Respond to Webhook sends it back to the caller with your chosen status code.'
    }
  };

  L['n8n-fundamentals/final-project'] = {
    blocks: [
      { t: 'p', html: 'Everything you learned in one workflow: a <strong>daily digest</strong>.' },
      { t: 'h', text: 'The spec' },
      { t: 'list', items: [
        '<strong>Schedule Trigger</strong> — every morning at 08:00.',
        '<strong>HTTP Request</strong> — fetch yesterday\'s records from an API.',
        '<strong>Edit Fields (Set)</strong> — keep only title and status.',
        '<strong>If</strong> — separate items where <code>status === "failed"</code>.',
        '<strong>HTTP Request</strong> — POST the failures to a webhook for alerting.'
      ] },
      { t: 'callout', variant: 'tip', title: 'Build order',
        html: 'Trigger first, then run it with pinned sample data and add one node at a time — executing after every addition catches mistakes while they are cheap.' }
    ],
    exercise: {
      type: 'workflow',
      brief: 'Assemble the digest skeleton: Schedule Trigger → HTTP Request → Edit Fields (Set) → If.',
      palette: [
        { key: 'trigger', type: 'n8n-nodes-base.scheduleTrigger', label: 'Schedule Trigger' },
        { key: 'http',    type: 'n8n-nodes-base.httpRequest',     label: 'HTTP Request' },
        { key: 'set',     type: 'n8n-nodes-base.set',             label: 'Edit Fields (Set)' },
        { key: 'if',      type: 'n8n-nodes-base.if',              label: 'If' },
        { key: 'webhook', type: 'n8n-nodes-base.webhook',         label: 'Webhook (decoy)' }
      ],
      target: {
        nodes: ['trigger', 'http', 'set', 'if'],
        edges: [['trigger', 'http'], ['http', 'set'], ['set', 'if']]
      },
      flow: { trigger: { in: 1, out: 1 }, http: { in: 1, out: 1 }, set: { in: 1, out: 1 }, if: { in: 1, out: 1 } },
      explanation: 'This is the linear fetch → clean → decide spine; the If node\'s two outputs would then feed the alert branch and the "all good" branch.'
    }
  };
  /*@@LESSONS@@*/
})(window);
