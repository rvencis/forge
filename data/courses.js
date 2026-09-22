/* Rvencis Forge — data/courses.js
   Course catalog. Node names, expression syntax and data shape follow the
   official n8n docs (verified 2026-09): items are [{ json: {...} }],
   mapping uses {{ $json.field }}, and core nodes include Code,
   Edit Fields (Set), If, Switch, Merge, Loop Over Items (Split in Batches),
   HTTP Request, Webhook and Schedule Trigger. */
(function (global) {
  'use strict';

  var INSTRUCTOR = {
    name: 'Academy Team',
    role: 'Automation engineers & n8n practitioners',
    bio: 'Lessons are written and reviewed by practitioners who build production n8n workflows every day.'
  };

  global.N8N_COURSES = [
    {
      slug: 'n8n-fundamentals',
      title: 'n8n Fundamentals',
      tagline: 'Build your first real automation — triggers, nodes, data flow, and your first shipped workflow.',
      track: 'foundations',
      level: 'beginner',
      updated: '2026-08-14',
      glyph: 'n8n',
      tags: ['triggers', 'editor', 'data flow', 'basics'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Navigate the n8n editor and build workflows confidently',
        'Understand how items (JSON objects) flow between nodes',
        'Use triggers: Manual, Schedule, Webhook',
        'Transform data with Edit Fields (Set) and expressions',
        'Add branching with If and Switch, loops with Loop Over Items'
      ],
      prerequisites: [],
      chapters: [
        { id: 'c1', title: 'Getting started', lessons: [
          { slug: 'what-is-n8n', title: 'What is n8n?', type: 'reading', minutes: 6 },
          { slug: 'editor-tour', title: 'The editor, canvas and executions', type: 'reading', minutes: 8 },
          { slug: 'first-workflow', title: 'Build your first workflow', type: 'workflow', minutes: 12 },
          { slug: 'checkpoint-triggers', title: 'Checkpoint: triggers & nodes', type: 'quiz', minutes: 5 }
        ]},
        { id: 'c2', title: 'Data in n8n', lessons: [
          { slug: 'items-and-json', title: 'Items: the data between nodes', type: 'reading', minutes: 8 },
          { slug: 'first-expression', title: 'Your first expression', type: 'expression', minutes: 10 },
          { slug: 'edit-fields-set', title: 'Edit Fields (Set) node deep dive', type: 'nodeconfig', minutes: 12 },
          { slug: 'mapping-fields', title: 'Mapping fields between nodes', type: 'expression', minutes: 10 }
        ]},
        { id: 'c3', title: 'Flow logic', lessons: [
          { slug: 'if-switch', title: 'Branching with If and Switch', type: 'nodeconfig', minutes: 12 },
          { slug: 'loop-over-items', title: 'Loops with Loop Over Items', type: 'workflow', minutes: 14 },
          { slug: 'merging-branches', title: 'Merging branches back together', type: 'reading', minutes: 9 },
          { slug: 'code-node-intro', title: 'When to reach for the Code node', type: 'code', minutes: 15 }
        ]},
        { id: 'c4', title: 'Ship it', lessons: [
          { slug: 'schedule-trigger', title: 'Run workflows on a schedule', type: 'nodeconfig', minutes: 8 },
          { slug: 'webhooks', title: 'Start workflows with webhooks', type: 'workflow', minutes: 12 },
          { slug: 'activation-executions', title: 'Activation, executions and history', type: 'reading', minutes: 7 },
          { slug: 'final-project', title: 'Final project: daily digest workflow', type: 'workflow', minutes: 18 }
        ]}
      ]
    },

    /* ============================================================
       TEMPORARILY DISABLED — 7 of 8 courses (nothing deleted).
       Restore by removing ONLY this comment block. Lesson content
       (data/lessons/*.js), the exercise engines, certificates, the
       dashboard and progress tracking stay fully wired for these
       slugs, so re-enabling needs zero code changes.
       Disabled 2026-09-20: the catalog ships with one active course.
       ============================================================
    {
      slug: 'expressions-data-mapping',
      title: 'Expressions & Data Mapping',
      tagline: 'Master {{ }} expressions, $json, $node, built-in variables and n8n data transformation functions.',
      track: 'foundations',
      level: 'beginner',
      rating: 4.8,
      students: 8210,
      updated: '2026-07-30',
      glyph: '{{}}',
      tags: ['expressions', '$json', 'data mapping'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Write expressions that reference any previous node',
        'Use built-in variables: $json, $node, $now, $today, $vars, $env',
        'Know what works in expressions vs. the Code node',
        'Reshape arrays of items with Split Out, Aggregate and Summarize'
      ],
      prerequisites: ['n8n-fundamentals'],
      chapters: [
        { id: 'c1', title: 'Expression foundations', lessons: [
          { slug: 'expression-syntax', title: 'Expression syntax: {{ }}', type: 'reading', minutes: 7 },
          { slug: 'json-and-node-vars', title: '$json, $node and $input', type: 'expression', minutes: 10 },
          { slug: 'builtin-shortcuts', title: 'Built-in methods and shortcuts', type: 'reading', minutes: 9 },
          { slug: 'expressions-vs-code', title: 'Expressions vs. the Code node', type: 'quiz', minutes: 6 }
        ]},
        { id: 'c2', title: 'Transforming items', lessons: [
          { slug: 'split-out', title: 'Split Out: one item to many', type: 'nodeconfig', minutes: 8 },
          { slug: 'aggregate', title: 'Aggregate: many items to one', type: 'nodeconfig', minutes: 8 },
          { slug: 'summarize', title: 'Summarize: pivot-table style grouping', type: 'reading', minutes: 8 },
          { slug: 'remove-duplicates', title: 'Sort, Limit and Remove Duplicates', type: 'reading', minutes: 7 }
        ]}
      ]
    },
    {
      slug: 'http-and-apis',
      title: 'HTTP Request & APIs',
      tagline: 'Call any REST API from n8n: auth, pagination, rate limits and error handling.',
      track: 'integrations',
      level: 'intermediate',
      rating: 4.8,
      students: 6390,
      updated: '2026-08-02',
      glyph: 'HTTP',
      tags: ['http request', 'rest', 'api auth', 'pagination'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Configure HTTP Request node methods, headers and bodies',
        'Handle bearer tokens, basic auth and OAuth2 credentials',
        'Paginate through large API responses',
        'Respect rate limits with Wait and retry logic'
      ],
      prerequisites: ['n8n-fundamentals'],
      chapters: [
        { id: 'c1', title: 'HTTP essentials', lessons: [
          { slug: 'http-node-tour', title: 'The HTTP Request node', type: 'nodeconfig', minutes: 10 },
          { slug: 'authentication', title: 'Authentication strategies', type: 'reading', minutes: 10 },
          { slug: 'sending-data', title: 'Query params, headers and bodies', type: 'nodeconfig', minutes: 10 },
          { slug: 'checkpoint-http', title: 'Checkpoint: HTTP', type: 'quiz', minutes: 5 }
        ]},
        { id: 'c2', title: 'Production patterns', lessons: [
          { slug: 'pagination', title: 'Paginating API responses', type: 'workflow', minutes: 14 },
          { slug: 'rate-limits', title: 'Rate limits and retries', type: 'reading', minutes: 9 }
        ]}
      ]
    },
    {
      slug: 'webhooks-and-forms',
      title: 'Webhooks & Forms',
      tagline: 'Receive events from any service: Webhook triggers, Respond to Webhook, and n8n Form.',
      track: 'integrations',
      level: 'beginner',
      rating: 4.7,
      students: 5120,
      updated: '2026-07-18',
      glyph: 'HOOK',
      tags: ['webhook', 'forms', 'respond to webhook'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Expose webhook endpoints (test vs. production URLs)',
        'Parse and validate incoming payloads',
        'Respond to Webhook with custom JSON',
        'Collect data with n8n Form and n8n Trigger'
      ],
      prerequisites: ['n8n-fundamentals'],
      chapters: [
        { id: 'c1', title: 'Receiving events', lessons: [
          { slug: 'webhook-trigger', title: 'The Webhook trigger', type: 'nodeconfig', minutes: 9 },
          { slug: 'test-vs-production', title: 'Test URL vs. production URL', type: 'reading', minutes: 6 },
          { slug: 'respond-to-webhook', title: 'Responding with data', type: 'workflow', minutes: 11 }
        ]}
      ]
    },
    {
      slug: 'data-pipelines',
      title: 'Data Pipelines in n8n',
      tagline: 'Split, merge, aggregate and deduplicate: build robust multi-source pipelines.',
      track: 'data',
      level: 'intermediate',
      rating: 4.8,
      students: 4310,
      updated: '2026-08-22',
      glyph: 'DATA',
      tags: ['merge', 'aggregate', 'pipelines', 'data tables'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Combine sources with Merge (append, combine, choose branch)',
        'Group and aggregate items with Summarize',
        'Persist working data with Data Tables',
        'Design idempotent, re-runnable pipelines'
      ],
      prerequisites: ['expressions-data-mapping'],
      chapters: [
        { id: 'c1', title: 'Combining data', lessons: [
          { slug: 'merge-node', title: 'Merge: three ways to combine', type: 'nodeconfig', minutes: 12 },
          { slug: 'compare-datasets', title: 'Compare Datasets for syncs', type: 'reading', minutes: 9 },
          { slug: 'pipeline-lab', title: 'Lab: two-source pipeline', type: 'workflow', minutes: 16 }
        ]}
      ]
    },
    {
      slug: 'ai-agents-n8n',
      title: 'AI Agents in n8n',
      tagline: 'Chain models, tools and memory: build agents with the AI nodes and Chat Trigger.',
      track: 'ai',
      level: 'advanced',
      rating: 4.9,
      students: 7840,
      updated: '2026-09-05',
      glyph: 'AI',
      tags: ['agents', 'llm', 'chat trigger', 'tools'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Assemble an agent: model, memory, tools',
        'Wire the Chat Trigger and Chat Respond nodes',
        'Give agents structured tools with sub-workflows',
        'Evaluate agent output quality'
      ],
      prerequisites: ['http-and-apis'],
      chapters: [
        { id: 'c1', title: 'Agent building blocks', lessons: [
          { slug: 'agent-anatomy', title: 'Anatomy of an n8n agent', type: 'reading', minutes: 10 },
          { slug: 'chat-trigger', title: 'Chat Trigger & Chat Respond', type: 'nodeconfig', minutes: 10 },
          { slug: 'agent-lab', title: 'Lab: support-ticket agent', type: 'workflow', minutes: 18 }
        ]}
      ]
    },
    {
      slug: 'error-handling',
      title: 'Error Handling & Reliability',
      tagline: 'Retry, fallback and monitor: workflows that survive real-world failures.',
      track: 'ops',
      level: 'intermediate',
      rating: 4.7,
      students: 3560,
      updated: '2026-08-28',
      glyph: 'FAIL',
      tags: ['error trigger', 'retries', 'stop and error', 'monitoring'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Configure node-level retries and Continue on Fail',
        'Stop And Error for fail-fast designs',
        'Build an Error Trigger alert workflow',
        'Debug with execution history and pinned data'
      ],
      prerequisites: ['n8n-fundamentals'],
      chapters: [
        { id: 'c1', title: 'Failing well', lessons: [
          { slug: 'retries', title: 'Retries and Continue on Fail', type: 'nodeconfig', minutes: 9 },
          { slug: 'stop-and-error', title: 'Stop And Error & error workflows', type: 'reading', minutes: 8 },
          { slug: 'debugging', title: 'Debugging with pinned data', type: 'reading', minutes: 7 }
        ]}
      ]
    },
    {
      slug: 'self-hosting-n8n',
      title: 'Self-hosting n8n',
      tagline: 'Run n8n yourself: Docker, environment variables, backups and upgrades.',
      track: 'ops',
      level: 'advanced',
      rating: 4.6,
      students: 2870,
      updated: '2026-06-30',
      glyph: 'OPS',
      tags: ['docker', 'env vars', 'backups', 'upgrades'],
      instructor: INSTRUCTOR,
      outcomes: [
        'Run n8n in Docker with persistent volumes',
        'Configure key environment variables',
        'Back up workflows and credentials safely',
        'Upgrade without downtime'
      ],
      prerequisites: ['n8n-fundamentals'],
      chapters: [
        { id: 'c1', title: 'Operations', lessons: [
          { slug: 'docker-setup', title: 'Docker Compose setup', type: 'reading', minutes: 12 },
          { slug: 'env-vars', title: 'Environment variables that matter', type: 'reading', minutes: 9 },
          { slug: 'backups-upgrades', title: 'Backups and upgrades', type: 'reading', minutes: 8 }
        ]}
      ]
    }
    ============================================================ */



  ];

  global.N8N_LESSONS = global.N8N_LESSONS || {};
})(window);
