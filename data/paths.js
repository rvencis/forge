/* Rvencis Forge — data/paths.js
   Learning paths (curated course sequences) and badge definitions. */
(function (global) {
  'use strict';

  global.N8N_PATHS = [
    /* ============================================================
       TEMPORARILY DISABLED — all 3 paths (nothing deleted).
       Restore by removing ONLY this comment block. The paths page,
       badges and the progress system stay fully wired for these
       slugs. N8N_PATHS ships as an empty array while disabled so
       no page errors out.
       Disabled 2026-09-20: the catalog ships with one active course.
       ============================================================
    {
      slug: 'automation-builder',
      title: 'Automation Builder',
      tagline: 'From zero to shipping your own workflows. The starting line for everyone.',
      icon: 'bolt',
      color: '#814ac8',
      courses: ['n8n-fundamentals', 'expressions-data-mapping', 'webhooks-and-forms'],
      outcomes: ['Build complete workflows on your own', 'Handle incoming events and outgoing data']
    },
    {
      slug: 'data-ops',
      title: 'Data Ops with n8n',
      tagline: 'Move and reshape data across systems with production-grade pipelines.',
      icon: 'chart',
      color: '#2fbf71',
      courses: ['n8n-fundamentals', 'expressions-data-mapping', 'data-pipelines', 'http-and-apis'],
      outcomes: ['Design multi-source pipelines', 'Aggregate, deduplicate and merge reliably']
    },
    {
      slug: 'ai-automation',
      title: 'AI Automation Engineer',
      tagline: 'Put LLM agents to work inside dependable automated systems.',
      icon: 'brain',
      color: '#ea4b71',
      courses: ['n8n-fundamentals', 'http-and-apis', 'ai-agents-n8n', 'error-handling'],
      outcomes: ['Build agents with tools and memory', 'Harden automations against failure']
    }
    ============================================================ */
  ];

  global.N8N_BADGES = [
    { id: 'first-lesson',      title: 'First Steps',        desc: 'Complete your first lesson',            icon: 'bolt' },
    { id: 'streak-3',          title: 'On a Roll',          desc: 'Learn 3 days in a row',                 icon: 'flame' },
    { id: 'streak-7',          title: 'Unstoppable',        desc: 'Learn 7 days in a row',                 icon: 'flame' },
    { id: 'quiz-ace',          title: 'Quiz Ace',           desc: 'Score 100% on a checkpoint quiz',       icon: 'quiz' },
    { id: 'workflow-builder',  title: 'Workflow Builder',   desc: 'Complete a workflow-building exercise', icon: 'workflow' },
    { id: 'xp-1000',           title: 'XP 1000',            desc: 'Earn 1,000 XP',                         icon: 'trophy' },
    { id: 'course-complete',   title: 'Course Graduate',    desc: 'Finish an entire course',               icon: 'doc' },
    { id: 'path-complete',     title: 'Path Master',        desc: 'Finish an entire learning path',        icon: 'trophy' }
  ];
})(window);
