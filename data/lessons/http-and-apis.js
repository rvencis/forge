/* Rvencis Forge — data/lessons/http-and-apis.js (2 authored lessons) */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  L['http-and-apis/http-node-tour'] = {
    blocks: [
      { t: 'p', html: 'The <strong>HTTP Request</strong> node is n8n\'s universal adapter: if a service has a REST API and no dedicated node, this one calls it. One node covers methods, auth, pagination and more.' },
      { t: 'list', items: [
        '<strong>Method + URL</strong> — GET/POST/PUT/PATCH/DELETE; URL accepts expressions.',
        '<strong>Send Query / Headers / Body</strong> — each gets its own parameter group; body types: JSON, form, raw.',
        '<strong>Response</strong> — expect JSON (default), or capture as text/binary/file.',
        '<strong>Options</strong> — timeouts, redirects, proxies, and "Full Response" to see status + headers.'
      ] },
      { t: 'callout', variant: 'tip', title: 'Import from cURL',
        html: 'Paste a cURL command and n8n converts it into node parameters — the fastest way to port a working example from API docs.' }
    ],
    exercise: {
      type: 'nodeconfig',
      nodeLabel: 'HTTP Request',
      nodeType: 'n8n-nodes-base.httpRequest',
      brief: 'GET https://api.example.com/users and expect JSON.',
      spec: [
        { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], solution: 'GET' },
        { key: 'url',    label: 'URL', type: 'text', placeholder: 'https://…', solution: 'https://api.example.com/users' },
        { key: 'resp',   label: 'Response format', type: 'select', options: ['JSON', 'Text', 'File'], solution: 'JSON' }
      ],
      sample: {},
      explanation: 'GET + JSON response is the default read pattern; the response items land on the node output exactly as the API returned them.'
    }
  };

  L['http-and-apis/authentication'] = {
    blocks: [
      { t: 'p', html: 'Credentials are stored once and referenced by nodes — never hard-code secrets into parameters or workflow JSON.' },
      { t: 'table', head: ['API style', 'How to wire it'], rows: [
        ['Bearer token', 'Header Auth credential: <code>Authorization: Bearer …</code>'],
        ['Basic auth', 'Built-in Basic Auth credential (user + password)'],
        ['OAuth2', 'Prebuilt OAuth2 credential; n8n handles the token flow and refresh'],
        ['Query-key APIs', 'Send the key as a query parameter or custom header via the node']
      ] },
      { t: 'callout', variant: 'warn', title: 'Sharing workflows',
        html: 'Exported workflow JSON contains credential <em>names and IDs</em> (not secrets). If credential names reveal anything sensitive, anonymize them before sharing.' }
    ],
    exercise: {
      type: 'quiz',
      questions: [
        {
          q: 'Where should an API token live?',
          options: ['Hard-coded in the URL', 'In a Header Auth credential', 'In a pinned item', 'In the workflow name'],
          answer: [1],
          why: 'Credentials are encrypted at rest and referenced by ID — keeping them out of parameters and exports.'
        },
        {
          q: 'Which credential type handles token refresh for you?',
          options: ['Header Auth', 'Basic Auth', 'OAuth2', 'Query Auth'],
          answer: [2],
          why: 'OAuth2 credentials manage the full authorization-code flow including automatic refresh.'
        }
      ]
    }
  };
  /*@@LESSONS@@*/
})(window);
