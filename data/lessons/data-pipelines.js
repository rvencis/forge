/* Rvencis Forge — data/lessons/data-pipelines.js (2 authored lessons) */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  L['data-pipelines/merge-node'] = {
    blocks: [
      { t: 'p', html: '<strong>Merge</strong> brings two branches back together. Its three modes map to three intentions:' },
      { t: 'table', head: ['Mode', 'Behaviour', 'Use when'], rows: [
        ['Append', 'Output = branch A items + branch B items', 'You just need both sets'],
        ['Combine', 'Match items pairwise by position or matching fields', 'Enriching one dataset with another'],
        ['Choose Branch', 'Pass through one input (per-item or all)', 'Fallbacks: "API result, else cache"']
      ] },
      { t: 'callout', variant: 'tip', title: 'Match on a key',
        html: 'In Combine mode, matching on a shared field (e.g. <code>customer_id</code>) is usually what you want — position matching breaks when either source is missing rows.' }
    ],
    exercise: {
      type: 'nodeconfig',
      nodeLabel: 'Merge',
      nodeType: 'n8n-nodes-base.merge',
      brief: 'Combine two branches by matching on customer_id.',
      spec: [
        { key: 'mode',      label: 'Mode', type: 'select', options: ['Append', 'Combine', 'Choose Branch'], solution: 'Combine' },
        { key: 'matchType', label: 'Combine By', type: 'select', options: ['Matching Fields', 'Position'], solution: 'Matching Fields' },
        { key: 'key',       label: 'Matching field', type: 'text', placeholder: 'e.g. customer_id', solution: 'customer_id' }
      ],
      sample: { customer_id: 'c-17' },
      explanation: 'Combine + Matching Fields joins each left item with its right-side counterpart sharing customer_id.'
    }
  };

  L['data-pipelines/pipeline-lab'] = {
    blocks: [
      { t: 'p', html: 'Lab: merge a CRM export with an billing API, drop inactive customers, and keep the highest-value field per customer.' },
      { t: 'list', items: [
        'Two <strong>HTTP Request</strong> branches fetch both sources.',
        '<strong>Merge (Combine)</strong> joins them on customer id.',
        '<strong>Filter</strong> drops inactive rows.',
        '<strong>Summarize</strong> aggregates revenue per customer.'
      ] },
      { t: 'callout', variant: 'info', title: 'Design for re-runs',
        html: 'A pipeline that appends on every run will double-count. Either upsert on a key or make the final write a full replace of the target dataset.' }
    ],
    exercise: {
      type: 'workflow',
      brief: 'Build the lab skeleton: HTTP Request ×2 → Merge → Filter.',
      palette: [
        { key: 'httpA',  type: 'n8n-nodes-base.httpRequest', label: 'HTTP Request (CRM)' },
        { key: 'httpB',  type: 'n8n-nodes-base.httpRequest', label: 'HTTP Request (Billing)' },
        { key: 'merge',  type: 'n8n-nodes-base.merge',       label: 'Merge' },
        { key: 'filter', type: 'n8n-nodes-base.filter',      label: 'Filter' }
      ],
      target: {
        nodes: ['httpA', 'httpB', 'merge', 'filter'],
        edges: [['httpA', 'merge'], ['httpB', 'merge'], ['merge', 'filter']]
      },
      flow: { httpA: { in: 1, out: 1 }, httpB: { in: 1, out: 1 }, merge: { in: 2, out: 1 }, filter: { in: 1, out: 1 } },
      explanation: 'Merge is the only node here with two inputs — both HTTP branches feed it, then Filter cleans the combined output.'
    }
  };
  /*@@LESSONS@@*/
})(window);
