/* Rvencis Forge — data/lessons/n8n-fundamentals-steps.js
   DataCamp-style step content for the flagship course: every lesson splits into
   three isolated views — Video ➔ Practice ➔ Quiz (see js/steps.js).

   Each entry MERGES into the same registry key the reading content uses
   (N8N_LESSONS['<course>/<lesson>']), so a lesson stays one object:

     video    { title, concept, minutes, takeaways[2..3], embed }
     practice { objective, steps[{title,detail,code?}], checklist[3..],
                workspace:{url,label} }
     quiz     { passPct: 100, questions[2..3] }
              - questions[0] is always a conceptual multiple choice ('mcq')
              - questions[1] is an expression ('expression', evaluated against
                its sample by Exercises.evaluateExpression) or a node-config
                'mcq'
              - an optional 'text' question accepts a pasted variable name,
                JSON path or node type (matched against an accept list)

   The gate: a lesson is only marked complete at 100% on the quiz.
   Node names and expression syntax follow the official n8n docs (verified
   2026-09). */
(function (global) {
  'use strict';

  var WS = { url: 'http://localhost:5678', label: 'Open Local n8n Canvas' };

  var S = global.N8N_STEPS = global.N8N_STEPS || {};

  /* ================= Module 1 — Getting Started ================= */

  S['n8n-fundamentals/what-is-n8n'] = {
    video: {
      title: 'Understanding Triggers, Nodes & Connections',
      concept: '<p><strong>n8n</strong> is a workflow automation tool: you connect nodes on a canvas and each node performs one step — fetch data, transform it, branch, call an API. This lesson covers what n8n is and the two ways to run it: <strong>self-hosted</strong> on your own server under a fair-code license, and <strong>n8n Cloud</strong>, which is managed for you. The editor and every lesson here work the same in both.</p>',
      minutes: 6,
      takeaways: [
        'Three building blocks: <strong>triggers</strong> start a workflow, <strong>nodes</strong> do the work, <strong>connections</strong> carry the data.',
        'Self-hosted = your server, your credentials, your rules; Cloud = no server to maintain, same canvas.',
        'No-code covers the 90%; expressions and the Code node cover the other 10%.'
      ]
    },
    practice: {
      objective: 'Place the three building blocks on a blank canvas: a Manual Trigger, an Edit Fields (Set) node, and an HTTP Request node — connected left to right.',
      steps: [
        { title: 'Open the canvas', detail: 'Open your local n8n editor and create a new, blank workflow.' },
        { title: 'Drop a trigger', detail: 'Open the node panel, search "Manual Trigger", and add it — this is the entry point that starts the run.', code: 'n8n-nodes-base.manualTrigger' },
        { title: 'Reshape the data', detail: 'Add an Edit Fields (Set) node and connect it to the right of the trigger.', code: 'n8n-nodes-base.set' },
        { title: 'Send it onward', detail: 'Add an HTTP Request node and connect it after Edit Fields (Set).', code: 'n8n-nodes-base.httpRequest' }
      ],
      checklist: [
        'A Manual Trigger sits on the canvas',
        'An Edit Fields (Set) node is connected after the trigger',
        'An HTTP Request node is connected after Edit Fields (Set)',
        'The three nodes form one unbroken left-to-right chain'
      ],
      workspace: WS,
      canvas: {
        brief: 'Place the three building blocks: a trigger, a transformer and a sender, connected left to right.',
        palette: ['manualTrigger', 'scheduleTrigger', 'set', 'httpRequest', 'webhook'],
        required: {
          nodes: ['manualTrigger', 'set', 'httpRequest'],
          edges: [['manualTrigger', 0, 'set', 0], ['set', 0, 'httpRequest', 0]]
        },
        allowExtras: false,
        checklist: [0, 1, 2, 3]
      }
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'Which node gives your workflow a URL that an outside service can call to start it?',
          options: ['Schedule Trigger', 'Webhook', 'Manual Trigger', 'HTTP Request'],
          answer: [1],
          why: 'Webhook exposes an inbound HTTP endpoint. HTTP Request makes outbound calls — the opposite direction.',
          hint: 'Think about which node *receives* a request from the outside world.'
        },
        {
          type: 'mcq',
          q: 'You want to run a workflow by hand while you build it. Which node do you add first?',
          options: ['Manual Trigger', 'Schedule Trigger', 'Webhook', 'If'],
          answer: [0],
          why: 'Manual Trigger runs only when you press "Execute workflow" — the standard way to build and test.',
          hint: 'It has no timer and no URL — a human button starts it.'
        },
        {
          type: 'text',
          q: 'Type the name of n8n\u2019s license model: it lets you self-host the source while n8n runs a managed cloud.',
          accept: ['fair-code', 'fair code', 'faircode', 'fair code license', 'fair-code license'],
          why: 'n8n is distributed under a sustainable fair-code license.',
          hint: 'One hyphenated word: "____-code".'
        }
      ]
    }
  };

  S['n8n-fundamentals/editor-tour'] = {
    video: {
      title: 'The Editor, Canvas, and Executions',
      concept: '<p>The editor is one screen: the <strong>canvas</strong> where workflows live as graphs (nodes are boxes, connections are lines), the <strong>node panel</strong> where you edit a node\u2019s parameters and inspect its input/output for that step, and the <strong>Executions</strong> tab where every past run is recorded. This lesson tours the panels you will use daily.</p>',
      minutes: 8,
      takeaways: [
        'Data flows left to right along connections; open any node to see the exact input and output it saw.',
        'The Executions tab keeps input and output for <em>every</em> node — "what did the API actually return?" is one click away.',
        'Credentials live outside the workflow JSON, and the <strong>Active</strong> toggle is what lets live triggers fire.'
      ]
    },
    practice: {
      objective: 'Tour your local editor: run a tiny workflow, inspect a node\u2019s input/output, open the Executions tab, and pin a node\u2019s output data.',
      steps: [
        { title: 'Make one run', detail: 'Build Manual Trigger → Edit Fields (Set), then press "Execute workflow" once.' },
        { title: 'Inspect a step', detail: 'Open the Edit Fields (Set) node and switch between its Input and Output views to see what it received and produced.' },
        { title: 'Read history', detail: 'Open the Executions tab, click the run you just made, and confirm you can replay the data node by node.' },
        { title: 'Pin the data', detail: 'On the node output, use the pin control so the next run replays the snapshot instead of re-calling any API.' }
      ],
      checklist: [
        'I opened a node and saw its Input and Output views',
        'I found my run in the Executions tab',
        'I can name where credentials are stored',
        'I pinned one node\u2019s output data'
      ],
      workspace: WS,
      canvas: {
        brief: 'Rebuild the tiny run you inspected: Manual Trigger → Edit Fields (Set).',
        palette: ['manualTrigger', 'set', 'httpRequest'],
        required: {
          nodes: ['manualTrigger', 'set'],
          edges: [['manualTrigger', 0, 'set', 0]]
        },
        allowExtras: true,
        checklist: [0, 1]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'After a run, you need to answer "what did that API actually return?" Where do you look?',
          options: ['The node\u2019s input/output view and the Executions tab', 'The credentials store', 'The expression editor', 'The canvas grid settings'],
          answer: [0],
          why: 'n8n records the input and output of every node for every run, exposed on the node and in the Executions tab.',
          hint: 'The answer is about the recorded history of a run.'
        },
        {
          type: 'mcq',
          q: 'You pin a node\u2019s output data while building. What does the next run use?',
          options: ['The pinned snapshot instead of re-calling the API', 'Fresh API data plus the snapshot', 'Nothing until you unpin', 'The credential\u2019s cached response'],
          answer: [0],
          why: 'Pinning replays the stored snapshot downstream, so you can iterate without hammering a rate limit.',
          hint: 'Pinning exists so the API is *not* called again.'
        },
        {
          type: 'text',
          q: 'Paste the exact name of the tab that lists every past run with its status and duration.',
          accept: ['executions', 'execution', 'executions tab', 'the executions tab'],
          why: 'Every run lands in the Executions tab, where you can open it and debug node by node.',
          hint: 'Plural of "execution".'
        }
      ]
    }
  };

  S['n8n-fundamentals/first-workflow'] = {
    video: {
      title: 'Build Your First 3-Node Workflow',
      concept: '<p>The classic first workflow: <strong>read items from a source, reshape them, hand them to the next step</strong> — Manual Trigger → Edit Fields (Set) → HTTP Request. Learn to assemble the graph, connect the nodes, and execute the whole chain in one run.</p>',
      minutes: 12,
      takeaways: [
        'Triggers start the flow; Edit Fields (Set) reshapes items in place; HTTP Request sends them onward.',
        'Connect nodes by dragging from one node\u2019s output dot to the next node\u2019s input dot.',
        'Execute after every addition — catching mistakes while they are cheap is the habit of a good builder.'
      ]
    },
    practice: {
      objective: 'Build a 3-node workflow using Manual Trigger, Edit Fields (Set), and HTTP Request, connected left to right.',
      steps: [
        { title: 'Add the trigger', detail: 'Search the node panel for Manual Trigger and drop it on the left of the canvas.', code: 'n8n-nodes-base.manualTrigger' },
        { title: 'Reshape items', detail: 'Add Edit Fields (Set), keep only the fields you need, and wire it after the trigger.', code: 'n8n-nodes-base.set' },
        { title: 'Send the data', detail: 'Add HTTP Request after Edit Fields (Set) and choose its method (for example POST).', code: 'n8n-nodes-base.httpRequest' },
        { title: 'Run it', detail: 'Press "Execute workflow" and confirm each node lights up with data passing left to right.' }
      ],
      checklist: [
        'Manual Trigger is connected to Edit Fields (Set)',
        'Edit Fields (Set) is connected to HTTP Request',
        'All three nodes executed successfully in one run',
        'I inspected the output of the HTTP Request node'
      ],
      workspace: WS,
      /* The canvas replaces the old workflow exercise: same target graph, but
         built on a real drag-and-drop canvas with live requirements. */
      canvas: {
        brief: 'Build the 3-node chain: Manual Trigger → Edit Fields (Set) → HTTP Request, left to right.',
        palette: ['manualTrigger', 'set', 'httpRequest', 'webhook', 'code'],
        required: {
          nodes: ['manualTrigger', 'set', 'httpRequest'],
          edges: [['manualTrigger', 0, 'set', 0], ['set', 0, 'httpRequest', 0]]
        },
        allowExtras: false,
        checklist: [0, 1, 3]
      }
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'In that first workflow, which node reshapes each item before it is sent onward?',
          options: ['Manual Trigger', 'Edit Fields (Set)', 'HTTP Request', 'The connection arrow'],
          answer: [1],
          why: 'Edit Fields (Set) keeps, renames and computes fields on each item; the other nodes start the run or transmit it.',
          hint: 'Its older name in n8n was simply "Set".'
        },
        {
          type: 'expression',
          q: 'An item arrives as { "email": "ada@example.com", "name": "Ada" }. Write the expression that returns the email of the current item.',
          sample: { email: 'ada@example.com', name: 'Ada' },
          expected: 'ada@example.com',
          answer: '{{ $json.email }}',
          why: 'On the current item, $json points at its json object — so {{ $json.email }} reads the email field.',
          hint: 'Wrap the field path in {{ … }} and start from $json.'
        },
        {
          type: 'text',
          q: 'Type the node label that starts this workflow when you press "Execute workflow".',
          accept: ['manual trigger', 'manualtrigger', 'n8n-nodes-base.manualtrigger'],
          why: 'Manual Trigger is the human-pressed entry point used while building.',
          hint: 'Two words: what a human does, plus "Trigger".'
        }
      ]
    }
  };

  S['n8n-fundamentals/checkpoint-triggers'] = {
    video: {
      title: 'Checkpoint: Triggers & Nodes',
      concept: '<p>Checkpoint time. Before moving into how data flows, make sure you can name the trigger types (Manual, Schedule, Webhook), say what a node does, and describe what a connection carries — then prove it on the canvas and in the quiz gate.</p>',
      minutes: 5,
      takeaways: [
        'Each trigger answers a different question: a button, a clock, or an inbound HTTP call.',
        'A node performs exactly one action; a connection passes an array of items between nodes.',
        'A workflow only responds to the outside world once it is <strong>Active</strong>.'
      ]
    },
    practice: {
      objective: 'Rebuild the trigger → transform → send chain from memory, then confirm where each trigger type would attach.',
      steps: [
        { title: 'Rebuild the chain', detail: 'On a blank workflow, add Manual Trigger → Edit Fields (Set) → HTTP Request without looking at your notes.' },
        { title: 'Swap the trigger', detail: 'Delete the Manual Trigger and drop a Schedule Trigger in its place — the action nodes stay untouched.' },
        { title: 'Note the webhook case', detail: 'Identify where a Webhook node would sit: always first, on the far left.' },
        { title: 'Execute', detail: 'Run the workflow once and confirm every node produced output.' }
      ],
      checklist: [
        'I rebuilt the 3-node chain from memory',
        'I swapped Manual Trigger for Schedule Trigger',
        'I can say where a Webhook node belongs',
        'The final chain executed successfully'
      ],
      workspace: WS,
      canvas: {
        brief: 'Rebuild the chain from memory, then swap the Manual Trigger for a Schedule Trigger.',
        palette: ['manualTrigger', 'scheduleTrigger', 'set', 'httpRequest', 'webhook'],
        required: {
          nodes: ['scheduleTrigger', 'set', 'httpRequest'],
          edges: [['scheduleTrigger', 0, 'set', 0], ['set', 0, 'httpRequest', 0]]
        },
        allowExtras: false,
        checklist: [0, 1, 3]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'A workflow with a Schedule Trigger is saved but never fires. What is missing?',
          options: ['Activation', 'A webhook URL', 'An expression', 'Pinned data'],
          answer: [0],
          why: 'Activation is what subscribes the workflow to schedules and webhooks; a saved draft stays inert.',
          hint: 'There is a toggle in the top-right of the editor for this.'
        },
        {
          type: 'mcq',
          q: 'You must call a rate-limited API only once while you iterate on the nodes after it. What is the best move?',
          options: ['Pin that node\u2019s output data', 'Deactivate the workflow', 'Wrap it in a Code node', 'Duplicate the workflow'],
          answer: [0],
          why: 'Pinned data replays the stored snapshot for that node, so downstream steps run against known data.',
          hint: 'It is the same control you used in the editor-tour lesson.'
        },
        {
          type: 'text',
          q: 'Paste the n8n node type string for the Webhook node, exactly as it appears in the workflow JSON.',
          accept: ['n8n-nodes-base.webhook'],
          why: 'Node type strings look like n8n-nodes-base.<nodeName>; you see them whenever you export workflow JSON.',
          hint: 'Prefix n8n-nodes-base. followed by the lowercase node name.'
        }
      ]
    }
  };

  S['n8n-fundamentals/items-and-json'] = {
    video: {
      title: 'Items: Data Between Nodes',
      concept: '<p>Everything in n8n moves as <strong>items</strong>. An item is an object with a <code>json</code> key (and an optional <code>binary</code> key for files), shaped like <code>[{ "json": { … } }]</code>. If a node receives 50 items and performs one configured action, it runs that action once per item — you never write the loop.</p>',
      minutes: 8,
      takeaways: [
        'The shape between nodes is always an array of items wrapping a <code>json</code> object.',
        'A bold column in the table view means that field contains nested JSON.',
        'Files ride along separately under <code>binary</code>, base64-encoded, with an optional mimeType.'
      ]
    },
    practice: {
      objective: 'Send three sample items through a chain and read their [{ json: { … } }] shape in the table view.',
      steps: [
        { title: 'Emit items', detail: 'Add a Manual Trigger, then an Edit Fields (Set) node in JSON Output mode that emits three sample items (for example fruit + color).' },
        { title: 'Open the table view', detail: 'Select the Set node and switch its output view to Table — each row is one item.' },
        { title: 'Add a nested field', detail: 'Add a nested object (for example { "stock": { "qty": 12 } }) and confirm the table view bolds the nested key.' },
        { title: 'Trace the flow', detail: 'Connect an HTTP Request node and confirm every item arrives with its json wrapper intact.' }
      ],
      checklist: [
        'My chain emitted at least three items',
        'I read the items in the table view',
        'I added a nested field and saw it bolded in the table',
        'The downstream node received the same [{ json: … }] shape'
      ],
      workspace: WS,
      canvas: {
        brief: 'Emit items from a trigger, reshape them in Edit Fields (Set), and send them onward.',
        palette: ['manualTrigger', 'set', 'httpRequest', 'webhook'],
        required: {
          nodes: ['manualTrigger', 'set', 'httpRequest'],
          edges: [['manualTrigger', 0, 'set', 0], ['set', 0, 'httpRequest', 0]]
        },
        allowExtras: false,
        checklist: [3]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'What passes between two connected nodes?',
          options: ['A single JSON object', 'An array of items, each wrapping a json object', 'Plain text', 'A database row'],
          answer: [1],
          why: 'n8n passes [{ json: { … } }]; nodes iterate over the array automatically.',
          hint: 'Think of the wrapper object every node outputs.'
        },
        {
          type: 'expression',
          q: 'An item holds { "fruit": "apples", "color": "green" }. Write the expression that returns the fruit of the current item.',
          sample: { fruit: 'apples', color: 'green' },
          expected: 'apples',
          answer: '{{ $json.fruit }}',
          why: '$json points at the current item\u2019s json object, so {{ $json.fruit }} reads the field.',
          hint: 'Wrap the field name in {{ … }} after $json.'
        },
        {
          type: 'text',
          q: 'Paste the exact JSON key that wraps an item\u2019s payload in n8n.',
          accept: ['json'],
          why: 'Every item is shaped { "json": { … } }; binary data lives under a separate binary key.',
          hint: 'Three letters — the same word as the data format itself.'
        }
      ]
    }
  };

  S['n8n-fundamentals/first-expression'] = {
    video: {
      title: 'Your First Expression ($json)',
      concept: '<p>Expressions are small JavaScript snippets inside <code>{{ … }}</code> that compute a parameter value <em>at runtime</em>. <code>{{ $json.field }}</code> reads a field off the current item, and the expression editor evaluates as you type against the node\u2019s input data, so you always see the computed value before running anything.</p>',
      minutes: 10,
      takeaways: [
        'Prefer expressions over hard-coded values whenever a parameter must depend on data.',
        'The expression editor live-previews against real input data — use it to verify before executing.',
        'Reach beyond the current item with <code>{{ $node["Name"].json… }}</code>, <code>{{ $now }}</code> or <code>{{ $vars.x }}</code>.'
      ]
    },
    practice: {
      objective: 'Add an Edit Fields (Set) node and drive its value from an expression using $json, so the output is computed from the input.',
      steps: [
        { title: 'Prepare input data', detail: 'Feed the Set node an item with firstName and lastName fields (a Webhook, HTTP Request or JSON Output Set works).' },
        { title: 'Add a computed field', detail: 'In Edit Fields (Set), add a field called fullName and switch its value to Expression mode.' },
        { title: 'Write the expression', detail: 'Type the expression that concatenates both names — watch the live preview fill in.', code: '{{ $json.firstName }} {{ $json.lastName }}' },
        { title: 'Execute and verify', detail: 'Run the node and confirm fullName arrives computed on the output items.' }
      ],
      checklist: [
        'My input item has firstName and lastName',
        'The new field is in Expression mode, not Fixed',
        'I saw the live preview evaluate before executing',
        'The executed output contains the computed fullName'
      ],
      workspace: WS,
      canvas: {
        brief: 'Feed a data source into an Edit Fields (Set) node — that is where your expression lives.',
        palette: ['webhook', 'manualTrigger', 'set', 'httpRequest'],
        required: {
          nodes: ['webhook', 'set'],
          edges: [['webhook', 0, 'set', 0]]
        },
        allowExtras: true,
        checklist: [0]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'When does an expression inside {{ … }} get evaluated?',
          options: ['At runtime, against the data entering that node', 'When you save the workflow, once', 'Only in the Code node', 'When n8n is upgraded'],
          answer: [0],
          why: 'Expressions evaluate per execution against that node\u2019s input data — which is why the live preview changes with the data.',
          hint: 'The preview updates as soon as the input data changes.'
        },
        {
          type: 'expression',
          q: 'Write the expression that returns "Ada Lovelace" from an item holding firstName: "Ada" and lastName: "Lovelace".',
          sample: { firstName: 'Ada', lastName: 'Lovelace' },
          expected: 'Ada Lovelace',
          answer: '{{ $json.firstName }} {{ $json.lastName }}',
          why: 'Two field references separated by a literal space produce the full name at runtime.',
          hint: 'Reference both fields with {{ … }} and put a space between them.'
        },
        {
          type: 'text',
          q: 'Paste the expression that reads the field body.temp from the current item, wrapped in {{ … }}.',
          accept: ['{{ $json.body.temp }}', '$json.body.temp'],
          why: 'Nested fields are plain dot paths from $json.',
          hint: 'Start from $json and walk down: body, then temp.'
        }
      ]
    }
  };

  S['n8n-fundamentals/edit-fields-set'] = {
    video: {
      title: 'Edit Fields / Set Node Deep Dive',
      concept: '<p>The <strong>Edit Fields (Set)</strong> node is your everyday transformer: it adds, renames, computes and drops fields on every item that passes through. This lesson covers its two output modes — <strong>Manual Mapping</strong> (field-by-field) and <strong>JSON Output</strong> (raw object) — plus the <em>Include Other Input Fields</em> toggle that decides whether untouched fields survive.</p>',
      minutes: 12,
      takeaways: [
        'Manual Mapping = explicit per-field assignments; JSON Output = paste/build a whole json object.',
        'Include Other Input Fields (on by default) keeps every incoming field you did not touch.',
        'Computed values come from expressions, so the same node works on every item.'
      ]
    },
    practice: {
      objective: 'Configure an Edit Fields (Set) node to build fullName from firstName and lastName, with Include Other Input Fields left on.',
      steps: [
        { title: 'Add the node', detail: 'Drop an Edit Fields (Set) node after your data source.', code: 'n8n-nodes-base.set' },
        { title: 'Choose the mode', detail: 'Keep Mode on Manual Mapping so each field is assigned explicitly.', code: 'Manual Mapping' },
        { title: 'Name and compute', detail: 'Set the field name to fullName and its value to the expression that joins the two names.', code: '{{ $json.firstName }} {{ $json.lastName }}' },
        { title: 'Keep the rest', detail: 'Leave Include Other Input Fields enabled, then execute and confirm firstName, lastName and fullName are all present.' }
      ],
      checklist: [
        'The node is in Manual Mapping mode',
        'A field named fullName is assigned',
        'Its value comes from an expression, not a fixed string',
        'Include Other Input Fields is on and other fields survived'
      ],
      workspace: WS,
      canvas: {
        brief: 'Wire a data source into Edit Fields (Set) and keep the rest of the fields flowing through.',
        palette: ['webhook', 'manualTrigger', 'set', 'httpRequest'],
        required: {
          nodes: ['set'],
          edges: []
        },
        allowExtras: true,
        checklist: []
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'After an Edit Fields (Set) node with Include Other Input Fields off, what does the next node receive?',
          options: ['Only the fields you assigned', 'Every incoming field', 'No items at all', 'The raw API response'],
          answer: [0],
          why: 'Turning it off drops everything you did not explicitly assign — useful for strictly trimming the payload.',
          hint: 'The toggle name says what it includes.'
        },
        {
          type: 'expression',
          q: 'The item is { "firstName": "Ada", "city": "London" }. Write the expression that returns "Ada is in London".',
          sample: { firstName: 'Ada', city: 'London' },
          expected: 'Ada is in London',
          answer: '{{ $json.firstName }} is in {{ $json.city }}',
          why: 'Expressions can mix field references with literal text in one string.',
          hint: 'Two {{ … }} references separated by the literal words "is in".'
        },
        {
          type: 'text',
          q: 'Paste the n8n node type string for the Edit Fields (Set) node.',
          accept: ['n8n-nodes-base.set', 'n8n-nodes-base.setv1' , 'set', 'edit fields'],
          why: 'Its type string is n8n-nodes-base.set — the node kept its historical "Set" name.',
          hint: 'n8n-nodes-base. followed by four letters.'
        }
      ]
    }
  };

  S['n8n-fundamentals/mapping-fields'] = {
    video: {
      title: 'Mapping Fields Between Nodes',
      concept: '<p>Real workflows pull fields from <em>different</em> nodes. On the current item you use <code>{{ $json.x }}</code>; for an earlier node you name it explicitly with <code>{{ $node["Node Name"].json.x }}</code>. The string inside the brackets must match the node\u2019s name on the canvas exactly.</p>',
      minutes: 10,
      takeaways: [
        '<code>{{ $json… }}</code> = current item; <code>{{ $node["Name"]… }}</code> = a specific earlier node.',
        'Node names are identifiers — rename a node and you must update its references.',
        'Map early, map explicitly: assign the fields you need once so downstream nodes stay simple.'
      ]
    },
    practice: {
      objective: 'Map fields from a Webhook node\u2019s output into an Edit Fields (Set) node using a $node reference, while keeping a $json reference in the same node.',
      steps: [
        { title: 'Receive data', detail: 'Add a Webhook node and send it a payload containing { "payload": { "user": { "id": 42 } } } (use the Test URL).', code: 'n8n-nodes-base.webhook' },
        { title: 'Add the mapping node', detail: 'Connect an Edit Fields (Set) node after the Webhook and name it "Map User".' },
        { title: 'Reference the webhook', detail: 'Add a userId field whose value reaches into the Webhook node by name.', code: '{{ $node["Webhook"].json.payload.user.id }}' },
        { title: 'Mix in $json', detail: 'Add a second field reading straight off the current item with {{ $json.payload.user.id }} and execute to compare.' }
      ],
      checklist: [
        'My Webhook produced a test item with a nested payload.user.id',
        'One field uses a $node["Webhook"] reference',
        'One field uses a $json reference',
        'Both fields resolved to 42 after executing'
      ],
      workspace: WS,
      canvas: {
        brief: 'A Webhook feeding an Edit Fields (Set) node — the pair that made $node["Webhook"] resolve.',
        palette: ['webhook', 'set', 'httpRequest', 'manualTrigger'],
        required: {
          nodes: ['webhook', 'set'],
          edges: [['webhook', 0, 'set', 0]]
        },
        allowExtras: true,
        checklist: []
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'Which expression reads a value from a specific earlier node rather than the current item?',
          options: ['{{ $node["Webhook"].json.payload.user.id }}', '{{ $json.payload.user.id }}', '{{ $item.payload }}', '{{ $from.webhook }}'],
          answer: [0],
          why: '$node["<name>"] reaches back to that node\u2019s output; $json only sees the current item.',
          hint: 'The accessor is named after the node you want to reach into.'
        },
        {
          type: 'expression',
          q: 'The current item holds { "email": "ada@example.com", "city": "London" }. Write the expression that returns the email.',
          sample: { email: 'ada@example.com', city: 'London' },
          expected: 'ada@example.com',
          answer: '{{ $json.email }}',
          why: 'For the common case — a field on the current item — $json is all you need.',
          hint: 'Wrap the field name in {{ … }} after $json.'
        },
        {
          type: 'text',
          q: 'Paste the expression that reads the user id from the Webhook node\u2019s output: { "payload": { "user": { "id": 42 } } }.',
          accept: ['{{ $node["Webhook"].json.payload.user.id }}', '$node["Webhook"].json.payload.user.id', "{{ $node['Webhook'].json.payload.user.id }}"],
          why: 'You name the node with $node["Webhook"], then walk the payload path with dot notation.',
          hint: 'Start with $node["Webhook"].json, then payload, user, id.'
        }
      ]
    }
  };

  S['n8n-fundamentals/if-switch'] = {
    video: {
      title: 'Branching with IF and Switch Nodes',
      concept: '<p>Automation is mostly decisions. <strong>If</strong> gives you a boolean split (two outputs: true / false); <strong>Switch</strong> routes items by value across any number of outputs. Both re-emit <em>all</em> fields of each item — routing never strips data — and conditions can be chained with AND/OR, so complex gating rarely needs nested If nodes.</p>',
      minutes: 12,
      takeaways: [
        'If = one condition, two exits; Switch = compare against a rule set, many exits.',
        'Expressions like <code>{{ $json.total }} &gt; 1000</code> are evaluated per item, so each item takes its own branch.',
        'Branch outputs keep every field — normalise with Edit Fields (Set) only when branches produce different shapes.'
      ]
    },
    practice: {
      objective: 'Configure an If node that routes items where total is greater than 1000 to the true branch, then wire a second node off the false branch.',
      steps: [
        { title: 'Add sample orders', detail: 'Feed the If node items with a numeric total (for example 1250 and 420).' },
        { title: 'Drop the If node', detail: 'Add an If node after your data source.', code: 'n8n-nodes-base.if' },
        { title: 'Set the condition', detail: 'Value 1 = the total expression, Operation = larger, Value 2 = 1000.', code: '{{ $json.total }}' },
        { title: 'Branch it out', detail: 'Connect one node off the true output and another off the false output, then execute and watch items split.' }
      ],
      checklist: [
        'The If node compares {{ $json.total }} larger than 1000',
        'A node hangs off the true output',
        'A node hangs off the false output',
        'Executing split my sample items between the two branches'
      ],
      workspace: WS,
      canvas: {
        brief: 'Split orders by total on an If node, then hang a node off each of its true and false outputs.',
        palette: ['manualTrigger', 'set', 'if', 'switch', 'gmail', 'httpRequest'],
        required: {
          nodes: ['manualTrigger', 'if', 'gmail'],
          edges: [
            ['manualTrigger', 0, 'if', 0],
            ['if', 0, 'gmail', 0]
          ]
        },
        allowExtras: true,
        checklist: [1, 2]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'You need to route items into five different paths based on an order type field. Which node fits best?',
          options: ['Switch', 'If', 'Merge', 'Code'],
          answer: [0],
          why: 'Switch compares a value against a rule set and gives each matching rule its own output — ideal for many-way routing.',
          hint: 'If only has two outputs; you need more.'
        },
        {
          type: 'expression',
          q: 'The item holds { "total": 1250 }. Write the expression that evaluates to true when total is greater than 1000.',
          sample: { total: 1250 },
          expected: 'true',
          answer: '{{ $json.total > 1000 }}',
          why: 'A comparison expression evaluates to a boolean; true sends the item down the If node\u2019s true output.',
          hint: 'Compare $json.total with 1000 using the > operator.'
        },
        {
          type: 'text',
          q: 'Paste the operation name n8n uses for "greater than" in the If node\u2019s condition.',
          accept: ['larger', 'greater than', 'gt'],
          why: 'n8n labels the comparison larger (with smaller for less than).',
          hint: 'One word — the opposite of smaller.'
        }
      ]
    }
  };

  S['n8n-fundamentals/loop-over-items'] = {
    video: {
      title: 'Loops with Loop Over Items',
      concept: '<p><strong>Loop Over Items (Split In Batches)</strong> takes a batch of items, emits them a batch at a time, and hands control back to the rest of the workflow — which eventually returns to the loop node for the next batch. That loop-back edge is what makes it a loop, and it is how you respect rate limits instead of hammering an API 500 times at once.</p>',
      minutes: 14,
      takeaways: [
        'The loop node splits input into batches (default batch size: 1 item) and emits one batch per run through the body.',
        'A connection from the last body node back into Loop Over Items is what continues to the next batch.',
        'Reach for it with rate-limited APIs, one-message-per-recipient fan-out, and any per-item side effect.'
      ]
    },
    practice: {
      objective: 'Build Schedule Trigger → Loop Over Items → HTTP Request, with a loop-back edge returning from the HTTP Request to Loop Over Items.',
      steps: [
        { title: 'Start on a schedule', detail: 'Add a Schedule Trigger so the loop has a reason to run unattended.', code: 'n8n-nodes-base.scheduleTrigger' },
        { title: 'Split the items', detail: 'Add Loop Over Items and connect it after the trigger.', code: 'n8n-nodes-base.splitInBatches' },
        { title: 'Body of the loop', detail: 'Add an HTTP Request node after Loop Over Items — this runs once per batch.', code: 'n8n-nodes-base.httpRequest' },
        { title: 'Close the loop', detail: 'Drag a connection from the HTTP Request output back into Loop Over Items so the next batch flows through.' }
      ],
      checklist: [
        'A Schedule Trigger starts the workflow',
        'Loop Over Items is connected after the trigger',
        'HTTP Request runs inside the loop body',
        'A loop-back connection returns to Loop Over Items',
        'Executing processes every item in batches without errors'
      ],
      workspace: WS,
      canvas: {
        brief: 'Build a paced loop: Schedule Trigger → Loop Over Items → HTTP Request, with the HTTP Request looping back into Loop Over Items.',
        palette: ['scheduleTrigger', 'loop', 'httpRequest', 'set'],
        required: {
          nodes: ['scheduleTrigger', 'loop', 'httpRequest'],
          edges: [
            ['scheduleTrigger', 0, 'loop', 0],
            ['loop', 0, 'httpRequest', 0],
            ['httpRequest', 0, 'loop', 1]
          ]
        },
        allowExtras: false,
        checklist: [0, 1, 2, 3]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'What actually makes a Loop Over Items build a loop?',
          options: ['A connection from the last body node back into Loop Over Items', 'Adding a Code node inside the body', 'Setting batch size to 0', 'Duplicating the trigger'],
          answer: [0],
          why: 'The loop-back edge returns control to the loop node so it can emit the next batch.',
          hint: 'It is a wiring decision, not a parameter.'
        },
        {
          type: 'mcq',
          q: 'What is Loop Over Items\u2019 default batch size?',
          options: ['1 item', '10 items', '100 items', 'All items at once'],
          answer: [0],
          why: 'The default emits one item per batch; raise it deliberately when the downstream API allows more per call.',
          hint: 'It is the smallest possible batch.'
        },
        {
          type: 'text',
          q: 'Paste the n8n node type string for Loop Over Items.',
          accept: ['n8n-nodes-base.splitinbatches', 'n8n-nodes-base.splitInBatches', 'splitinbatches', 'split in batches'],
          why: 'Its type string is n8n-nodes-base.splitInBatches — the node historically named "Split In Batches".',
          hint: 'n8n-nodes-base.split… (its older name).'
        }
      ]
    }
  };

  S['n8n-fundamentals/merging-branches'] = {
    video: {
      title: 'Merging Branches',
      concept: '<p>Branches multiply your options — but eventually they need to reunite. <strong>Merge</strong> nodes bring parallel paths back into one stream. This lesson covers the modes (<strong>Append</strong>, <strong>Keep</strong>, <strong>Wait for all</strong>) and the schema caveat: Merge does not unify shapes, so normalise with Edit Fields (Set) first when branches carry different fields.</p>',
      minutes: 9,
      takeaways: [
        'Append stacks every item from every input in order; Keep keeps only a chosen input; Wait for all holds until every input produced something.',
        'Merge does not merge schemas — downstream nodes must tolerate missing keys.',
        'An alert branch and a silent branch rejoin after an If; two parallel lookups rejoin at a Merge.'
      ]
    },
    practice: {
      objective: 'Split with an If node, then bring both branches back together with a Merge node set to Append.',
      steps: [
        { title: 'Create two paths', detail: 'Add an If node with a simple condition and connect one node off each output.' },
        { title: 'Add the Merge', detail: 'Drop a Merge node to the right of the two branch nodes.', code: 'n8n-nodes-base.merge' },
        { title: 'Choose the mode', detail: 'Set the merge mode to Append so items from both inputs are stacked in order.' },
        { title: 'Normalise first', detail: 'If the branches return different fields, add an Edit Fields (Set) before the Merge so shapes match, then execute.' }
      ],
      checklist: [
        'An If node produces two branches',
        'Both branches feed one Merge node',
        'The Merge mode is Append',
        'Executing emitted items from both inputs together'
      ],
      workspace: WS,
      canvas: {
        brief: 'Split with an If node, run both branches in parallel, then bring them back together with one Merge node.',
        palette: ['manualTrigger', 'if', 'set', 'httpRequest', 'merge', 'gmail'],
        required: {
          nodes: ['manualTrigger', 'if', 'set', 'httpRequest', 'merge'],
          edges: [
            ['manualTrigger', 0, 'if', 0],
            ['if', 0, 'set', 0],
            ['if', 1, 'httpRequest', 0],
            ['set', 0, 'merge', 0],
            ['httpRequest', 0, 'merge', 1]
          ]
        },
        allowExtras: true,
        checklist: [0, 1]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'Items from two branches carry different fields, and a node after the Merge fails on a missing key. What is the root cause?',
          options: ['Merge does not unify schemas — the branches produce different shapes', 'Merge only supports two inputs', 'The workflow is inactive', 'The expression used a wrong node name'],
          answer: [0],
          why: 'Merge combines streams, not schemas; normalise with Edit Fields (Set) before merging.',
          hint: 'Think about what Merge is — and is not — responsible for.'
        },
        {
          type: 'mcq',
          q: 'Which Merge mode stacks every item from every input, in order?',
          options: ['Append', 'Keep', 'Wait for all', 'Combine by position'],
          answer: [0],
          why: 'Append simply queues all inputs\u2019 items together; Keep drops everything but a chosen input.',
          hint: 'It is the simplest "put them together" mode.'
        },
        {
          type: 'text',
          q: 'Paste the n8n node type string for the Merge node.',
          accept: ['n8n-nodes-base.merge', 'merge'],
          why: 'Its type string is n8n-nodes-base.merge.',
          hint: 'n8n-nodes-base. plus the English word for the operation.'
        }
      ]
    }
  };

  S['n8n-fundamentals/code-node-intro'] = {
    video: {
      title: 'When to Reach for Code Nodes',
      concept: '<p>When a one-line expression is not enough, the <strong>Code node</strong> runs real JavaScript (or Python) against your items — in <em>Run Once for All Items</em> mode you receive the whole <code>items</code> array. Reach for it for multi-field transforms, grouping, and logic that expressions cannot express; prefer expressions for single values, because they stay visible inside the parameter they compute.</p>',
      minutes: 15,
      takeaways: [
        'Expressions = one value in a parameter; Code node = real logic across many items.',
        'In Run Once for All Items you get <code>items = [{ json: { … } }, …]</code> and return the array you want out.',
        'Expression helpers like <code>$now</code> do not exist as helpers in Code mode — use plain JavaScript (e.g. <code>new Date()</code>).'
      ]
    },
    practice: {
      objective: 'Add a Code node (Run Once for All Items) that returns a computed field for every item, then run it on sample data.',
      steps: [
        { title: 'Prepare items', detail: 'Feed the node items with qty and price fields (a JSON Output Set works well).' },
        { title: 'Add the Code node', detail: 'Drop a Code node after the source and set its mode to Run Once for All Items.', code: 'n8n-nodes-base.code' },
        { title: 'Map the items', detail: 'Return a new array that keeps the input fields and adds a computed total.', code: 'return items.map(item => ({ json: { ...item.json, total: item.json.qty * item.json.price } }));' },
        { title: 'Execute', detail: 'Run the node and confirm every item now carries a total computed by your code.' }
      ],
      checklist: [
        'The Code node is in Run Once for All Items mode',
        'I return an array of { json: … } objects',
        'Every output item carries the computed total',
        'The run finished without a thrown error'
      ],
      workspace: WS,
      canvas: {
        brief: 'Feed sample items into a Code node so your JavaScript runs over the whole batch.',
        palette: ['manualTrigger', 'set', 'code', 'httpRequest'],
        required: {
          nodes: ['code'],
          edges: []
        },
        allowExtras: true,
        checklist: []
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'Which task is the best candidate for the Code node rather than an expression?',
          options: ['Grouping items by a key and computing per-group sums', 'Reading one field off the current item', 'Setting a static priority value', 'Renaming a column'],
          answer: [0],
          why: 'Anything that spans many items at once (grouping, aggregation) is Code territory; single values belong in expressions.',
          hint: 'Ask: does it need the whole array, or just one field?'
        },
        {
          type: 'expression',
          q: 'The item is { "qty": 3, "price": 10 }. Write the expression that returns the line total.',
          sample: { qty: 3, price: 10 },
          expected: 30,
          answer: '{{ $json.qty * $json.price }}',
          why: 'Expressions are plain JavaScript — arithmetic on two fields evaluates at runtime.',
          hint: 'Multiply the two fields inside {{ … }}.'
        },
        {
          type: 'text',
          q: 'Paste the Code node mode name in which you receive the entire array as items.',
          accept: ['run once for all items', 'run once for all item', 'all items'],
          why: 'Run Once for All Items hands you the whole array; Run Once for Each Item processes items separately.',
          hint: 'Three words after "Run Once for": … all …'
        }
      ]
    }
  };

  S['n8n-fundamentals/schedule-trigger'] = {
    video: {
      title: 'Run Workflows on a Schedule',
      concept: '<p>The <strong>Schedule Trigger</strong> starts workflows on time: every N minutes, hourly, daily at a specific time, or a custom cron expression. Two things trip up almost everyone: the workflow must be <strong>Active</strong> or the schedule never fires, and times follow the instance timezone — so set that before you trust an alert at 09:00.</p>',
      minutes: 8,
      takeaways: [
        'Unit + interval + hour fields cover most schedules; save cron for exotic intervals.',
        'An inactive workflow never fires — the Active toggle is part of the trigger.',
        'Scheduled runs repeat forever, so make the first node safe to re-run (idempotent).'
      ]
    },
    practice: {
      objective: 'Configure a Schedule Trigger that fires every day at 09:00, then activate the workflow so the schedule is live.',
      steps: [
        { title: 'Drop the trigger', detail: 'Add a Schedule Trigger as the first node of a new workflow.', code: 'n8n-nodes-base.scheduleTrigger' },
        { title: 'Set the unit', detail: 'Choose days as the interval unit.', code: 'days' },
        { title: 'Set the interval and hour', detail: 'Days between runs = 1, trigger at hour = 9.', code: '9' },
        { title: 'Activate', detail: 'Save the workflow and flip the Active toggle so the schedule actually fires; check the instance timezone in workflow settings.' }
      ],
      checklist: [
        'The Schedule Trigger unit is days',
        'Days between runs is 1 and the hour is 9',
        'I confirmed the instance timezone',
        'The workflow is Active'
      ],
      workspace: WS,
      canvas: {
        brief: 'Put a Schedule Trigger first — the sweep that fires the rest of the workflow every day at 09:00.',
        palette: ['scheduleTrigger', 'httpRequest', 'set', 'manualTrigger', 'webhook'],
        required: {
          nodes: ['scheduleTrigger'],
          edges: []
        },
        allowExtras: true,
        checklist: [0]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'Your Schedule Trigger is configured correctly but no runs appear. What do you check first?',
          options: ['Whether the workflow is Active', 'Whether an expression has a typo', 'Whether the canvas is zoomed', 'Whether credentials are shared'],
          answer: [0],
          why: 'An inactive workflow never subscribes to its schedule; nothing else in the list affects firing.',
          hint: 'There is a toggle in the top-right of the editor.'
        },
        {
          type: 'mcq',
          q: 'To run every day at 09:00 using the visual fields, which unit do you pick?',
          options: ['minutes', 'hours', 'days', 'custom cron'],
          answer: [2],
          why: 'Unit "days" with days between runs = 1 and hour = 9 fires once per day at 09:00 instance time.',
          hint: 'The interval is measured across whole days.'
        },
        {
          type: 'text',
          q: 'Paste the n8n node type string for the Schedule Trigger.',
          accept: ['n8n-nodes-base.scheduletrigger', 'scheduletrigger', 'schedule trigger'],
          why: 'Its type string is n8n-nodes-base.scheduleTrigger.',
          hint: 'n8n-nodes-base. plus "scheduleTrigger".'
        }
      ]
    }
  };

  S['n8n-fundamentals/webhooks'] = {
    video: {
      title: 'Start Workflows with Webhooks',
      concept: '<p>A <strong>Webhook</strong> node turns your workflow into an HTTP endpoint — any service that can send a web request can start your automation. The <strong>Test URL</strong> works while the editor is listening (you are building); the <strong>Production URL</strong> is live only once the workflow is Active. The incoming body, headers and query params all arrive on the trigger item\u2019s <code>json</code>.</p>',
      minutes: 12,
      takeaways: [
        'Webhook receives, Edit Fields (Set) shapes, Respond to Webhook answers the caller.',
        'Test URL while building; Production URL once Active — different URLs, same node.',
        'Read the payload with dot paths like <code>{{ $json.body.temp }}</code>.'
      ]
    },
    practice: {
      objective: 'Build Webhook → Edit Fields (Set) → Respond to Webhook, then call the Test URL and read the response.',
      steps: [
        { title: 'Add the webhook', detail: 'Drop a Webhook node and note its Test URL.', code: 'n8n-nodes-base.webhook' },
        { title: 'Shape the payload', detail: 'Add Edit Fields (Set) after it and map the fields you want to echo back.', code: 'n8n-nodes-base.set' },
        { title: 'Answer the caller', detail: 'Add Respond to Webhook after the Set node and choose the response status code.', code: 'n8n-nodes-base.respondToWebhook' },
        { title: 'Call it', detail: 'With the editor listening, send a request at the Test URL (curl or a browser) and confirm the response body.' }
      ],
      checklist: [
        'A Webhook node is first in the chain',
        'Edit Fields (Set) maps at least one incoming field',
        'Respond to Webhook is wired after the Set node',
        'My Test URL call returned the expected response'
      ],
      workspace: WS,
      canvas: {
        brief: 'Build the inbound mirror: Webhook → Edit Fields (Set) → Respond to Webhook.',
        palette: ['webhook', 'set', 'respondToWebhook', 'httpRequest'],
        required: {
          nodes: ['webhook', 'set', 'respondToWebhook'],
          edges: [['webhook', 0, 'set', 0], ['set', 0, 'respondToWebhook', 0]]
        },
        allowExtras: false,
        checklist: [0, 2]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'When does the webhook Production URL start receiving calls?',
          options: ['Once the workflow is Active', 'As soon as you save it', 'Only while the editor is open', 'After you pin data'],
          answer: [0],
          why: 'The Production URL is served by the live, active workflow; the Test URL is served by the editor session.',
          hint: 'One URL is tied to the editor, the other to the activated workflow.'
        },
        {
          type: 'expression',
          q: 'The webhook receives a JSON body containing { "temp": 21.5 }. Write the expression that returns the temperature on the trigger item.',
          sample: { body: { temp: 21.5 } },
          expected: 21.5,
          answer: '{{ $json.body.temp }}',
          why: 'The request body lands on the trigger item\u2019s json, so a plain dot path reads it.',
          hint: 'Walk down from $json: body, then temp.'
        },
        {
          type: 'text',
          q: 'Paste the n8n node type string for the Webhook node.',
          accept: ['n8n-nodes-base.webhook', 'webhook'],
          why: 'Its type string is n8n-nodes-base.webhook.',
          hint: 'n8n-nodes-base. plus the node name in lowercase.'
        }
      ]
    }
  };

  S['n8n-fundamentals/activation-executions'] = {
    video: {
      title: 'Activation, Executions, and History',
      concept: '<p>A workflow does nothing for the outside world until it is <strong>Active</strong> — activation is what turns a draft into a live automation. From then on, every run lands in the <strong>Executions</strong> tab with its status, duration and full node-by-node data: Success, Waiting, Error or Cancelled.</p>',
      minutes: 7,
      takeaways: [
        'Active = webhooks listen and schedules fire; Inactive = safe to edit, silent to the world.',
        'Every execution records status, duration, and the input/output of each node.',
        'Pinning data plus execution history is how you debug without re-calling external APIs.'
      ]
    },
    practice: {
      objective: 'Activate a workflow, watch the Executions tab record a run, then deactivate it to edit safely.',
      steps: [
        { title: 'Finish a workflow', detail: 'Make sure the workflow has a trigger and at least one action node and is saved.' },
        { title: 'Activate', detail: 'Flip the Active toggle and confirm the workflow shows as active in the workflow list.' },
        { title: 'Generate a run', detail: 'Trigger it (manually, by schedule, or by calling the webhook) and open the Executions tab.' },
        { title: 'Inspect and deactivate', detail: 'Open the run, check its status and duration, then turn Active off before editing again.' }
      ],
      checklist: [
        'I flipped the workflow to Active',
        'A run appeared in the Executions tab',
        'I opened the run and saw status and duration',
        'I deactivated the workflow before editing'
      ],
      workspace: WS,
      canvas: {
        brief: 'A finished workflow you can activate: a trigger, one action, and a connection between them.',
        palette: ['manualTrigger', 'webhook', 'httpRequest', 'set'],
        required: {
          nodes: ['manualTrigger', 'httpRequest'],
          edges: [['manualTrigger', 0, 'httpRequest', 0]]
        },
        allowExtras: false,
        checklist: []
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'What does activating a workflow actually do?',
          options: ['Subscribes it to its triggers — schedules fire and webhook URLs listen', 'Runs it once immediately', 'Publishes it to the n8n community', 'Compiles expressions ahead of time'],
          answer: [0],
          why: 'Activation connects the workflow to the outside world; it does not run it on the spot.',
          hint: 'Think "live", not "run now".'
        },
        {
          type: 'mcq',
          q: 'You are iterating on a node that calls a rate-limited API. Which control saves you repeated calls?',
          options: ['Pin output data', 'Delete credentials', 'Export the workflow', 'Add a comment node'],
          answer: [0],
          why: 'Pinning replays a stored snapshot so downstream work continues without hitting the API again.',
          hint: 'It stores the last response as if it were the data.'
        },
        {
          type: 'text',
          q: 'Paste the exact name of the tab that lists every past run with its status and duration.',
          accept: ['executions', 'execution', 'executions tab', 'the executions tab'],
          why: 'The Executions tab is the run history: status, duration, and full data for every execution.',
          hint: 'Plural of "execution".'
        }
      ]
    }
  };

  S['n8n-fundamentals/final-project'] = {
    video: {
      title: 'Final Capstone: Order Anomaly Engine',
      concept: '<p>The capstone pulls every module together into one production-shaped workflow: the <strong>Order Anomaly Engine</strong>. On a schedule it fetches the day\u2019s orders, trims them to the fields your rules need, splits the anomalies from the ordinary, and alerts you only when something needs a human.</p>',
      minutes: 18,
      takeaways: [
        'The spine is fetch → clean → decide → alert: Schedule Trigger, HTTP Request, Edit Fields (Set), If, Webhook.',
        'Run it with pinned sample data first and add one node at a time.',
        'A scheduled sweep can re-check the whole batch; a webhook reacts per event — choose by alerting policy.'
      ]
    },
    practice: {
      objective: 'Build the Order Anomaly Engine: Schedule Trigger → HTTP Request → Edit Fields (Set) → If → Webhook alert.',
      steps: [
        { title: 'Schedule the sweep', detail: 'Add a Schedule Trigger firing every 15 minutes.', code: 'n8n-nodes-base.scheduleTrigger' },
        { title: 'Fetch the orders', detail: 'Add an HTTP Request that GETs today\u2019s orders from your API.', code: 'n8n-nodes-base.httpRequest' },
        { title: 'Trim the payload', detail: 'Add Edit Fields (Set) keeping only id, total, status and customer.email.', code: 'n8n-nodes-base.set' },
        { title: 'Detect anomalies', detail: 'Add an If node whose true branch matches total above 5000 or status "refunded".', code: '{{ $json.total }}' },
        { title: 'Alert', detail: 'Off the true output, add a Webhook node (HTTP Request to your alert endpoint) that POSTs each anomaly.' }
      ],
      checklist: [
        'The Schedule Trigger fires every 15 minutes',
        'HTTP Request fetches the orders',
        'Edit Fields (Set) keeps only id, total, status and customer.email',
        'The If node routes anomalies on total > 5000 or status "refunded"',
        'The alert node hangs off the If node\u2019s true output',
        'A test run with pinned anomalies produced an alert'
      ],
      workspace: WS,
      canvas: {
        brief: 'Assemble the Order Anomaly Engine spine: Schedule Trigger → HTTP Request → Edit Fields (Set) → If, with an alert off the true output.',
        palette: ['scheduleTrigger', 'httpRequest', 'set', 'if', 'gmail', 'webhook'],
        required: {
          nodes: ['scheduleTrigger', 'httpRequest', 'set', 'if', 'gmail'],
          edges: [
            ['scheduleTrigger', 0, 'httpRequest', 0],
            ['httpRequest', 0, 'set', 0],
            ['set', 0, 'if', 0],
            ['if', 0, 'gmail', 0]
          ]
        },
        allowExtras: false,
        checklist: [1, 4]
      },
    },
    quiz: {
      passPct: 100,
      questions: [
        {
          type: 'mcq',
          q: 'In the Order Anomaly Engine, which node carries the anomaly condition itself?',
          options: ['The If node', 'The Schedule Trigger', 'The Edit Fields (Set) node', 'The HTTP Request node'],
          answer: [0],
          why: 'Schedule starts the run, HTTP fetches, Set trims — the decision lives entirely in the If node.',
          hint: 'It is the node with two outputs.'
        },
        {
          type: 'expression',
          q: 'An order item holds { "id": "A-1", "total": 9000, "status": "paid" }. Write the expression that is true when the total is above 5000.',
          sample: { id: 'A-1', total: 9000, status: 'paid' },
          expected: 'true',
          answer: '{{ $json.total > 5000 }}',
          why: 'The boolean expression drives the If node; true sends the order down the alert branch.',
          hint: 'Compare $json.total with 5000 using >.'
        },
        {
          type: 'text',
          q: 'Paste the expression that reads the customer email off the current item: { "customer": { "email": "ada@example.com" } }.',
          accept: ['{{ $json.customer.email }}', '$json.customer.email'],
          why: 'Nested fields are plain dot paths from $json.',
          hint: 'Start at $json, then customer, then email.'
        }
      ]
    }
  };

  /*@@STEPS@@*/
})(window);
