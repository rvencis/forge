/* Rvencis Forge — data/lessons/ai-agents-n8n.js (2 authored lessons) */
(function (global) {
  'use strict';
  var L = global.N8N_LESSONS = global.N8N_LESSONS || {};

  L['ai-agents-n8n/agent-anatomy'] = {
    blocks: [
      { t: 'p', html: 'An n8n agent is a graph: a <strong>Chat Trigger</strong> (or any trigger) feeds an <strong>AI Agent</strong> node, which connects three helper groups.' },
      { t: 'list', items: [
        '<strong>Model</strong> — the LLM (OpenAI, Anthropic, local via Ollama, …) attached to the agent.',
        '<strong>Memory</strong> — conversation history so the agent remembers context within a session.',
        '<strong>Tools</strong> — capabilities the agent may call: HTTP Request tools, app nodes, or whole sub-workflows.'
      ] },
      { t: 'callout', variant: 'tip', title: 'Sub-workflows as tools',
        html: 'Wrap a complex process (lookup order → check stock → reply) in a sub-workflow and expose it as one tool. The agent decides <em>when</em>; the sub-workflow guarantees <em>how</em>.' },
      { t: 'h', text: 'Evaluation matters' },
      { t: 'p', html: 'Agents are probabilistic. Score outputs with the Evaluation nodes, keep a golden set of prompts, and gate releases on quality metrics rather than vibes.' },
      { t: 'checklist', items: [
        'I can name the three helper groups: model, memory, tools',
        'I know why complex logic belongs in sub-workflows, not prompts'
      ] }
    ]
  };

  L['ai-agents-n8n/chat-trigger'] = {
    blocks: [
      { t: 'p', html: 'The <strong>Chat Trigger</strong> gives your workflow a hosted chat interface; <strong>Chat Respond (Respond to Chat)</strong> returns the agent\'s answer to it.' },
      { t: 'list', items: [
        'Chat Trigger provides <code>sessionId</code> and the user message on its item.',
        'Memory nodes key off that session id — distinct users stay isolated.',
        'For custom front-ends, call the same workflow via its webhook with the same payload shape.'
      ] }
    ],
    exercise: {
      type: 'quiz',
      questions: [
        {
          q: 'What keeps two users\' conversations separate?',
          options: ['The model temperature', 'Session id + memory node', 'Separate workflows', 'Nothing — they share context'],
          answer: [1],
          why: 'Memory is scoped by the session id delivered by the Chat Trigger.'
        }
      ]
    }
  };
  /*@@LESSONS@@*/
})(window);
