/* Rvencis Forge — js/simulator.js
   The interactive practice canvas ("Simulator"): an n8n-style node editor the
   learner builds inside the Practice step of a lesson.

   Three deliberately separated layers:

     LAYER 1  DATA     Simulator.registry  node types, colours, ports   (pure)
     LAYER 2  DOMAIN   Simulator.graph    model · verify · serialize   (pure, Node-safe)
     LAYER 3  BACKEND  Simulator.backends swappable renderer           (DOM)

   Layer 2 is the contract. A backend only ever sees the graph model, so the
   renderer can be swapped for Rete or Baklava without touching a single
   authored spec, verify rule, validator or test.

   BACKEND CONTRACT — the exact shape mount() expects:

     Simulator.registerBackend(name, factory)  // factory(ctx) → backend | Promise
     Simulator.useBackend(name)                // default 'vanilla'
     Simulator.mount(rootEl, ctx)              // → backend | Promise<backend>

     backend = {
       name,
       mount(rootEl, ctx),   // ctx = { graph, spec, registry, lessonKey, emit(evt) }
       sync(graph),          // re-render after a model mutation
       viewport: { zoom(z), panTo(x, y), fit() },
       destroy()
     }

   ctx.emit receives { type: 'change' | 'verify' | 'run', … } so the host page
   (js/steps.js) can re-gate the lesson without knowing which backend is live.

   Why the model speaks n8n's own vocabulary: mapping it onto a third-party
   engine is then mechanical, and verification stays engine-agnostic.

     registry node → { key, type:'n8n-nodes-base.httpRequest', name, trigger,
                       inputs:[{name,type}], outputs:[{name,type}] }
     graph node    → { id, key, name, type, position:[x,y], params:{} }
     graph edge    → { from:<id>, out:<portIndex>, to:<id>, in:<portIndex> }

   Rete: one NodeEditor node per graph node, one Socket per port, one
   Connection per edge — sync() diffs by id. Baklava: one interface-bearing
   node per graph node, outputs grouped by interface. Neither touches
   verifyGraph(), the authored specs, scripts/validate.js or the smoke test.

   Depends on: nothing. Layers 1-2 are loadable in plain Node (no document
   access at load time) so scripts/validate.js can check every spec. */
(function (global) {
  'use strict';

  /* ================= Layer 1 — DATA: the node registry ================= */

  /* Colours are stored as the two free components of an HSL triple; the CSS
     derives the card background (L 20%) and the accent (L 60%) from them, the
     same trick n8n itself uses with --color-node-type-*-h/s/l. */
  function node(key, type, name, o) {
    o = o || {};
    return {
      key: key, type: type, name: name,
      trigger: !!o.trigger,
      h: o.h, s: o.s,
      desc: o.desc || '',
      inputs: o.inputs || [],
      outputs: o.outputs || []
    };
  }
  function ports(names) {
    return names.map(function (n) { return { name: n, type: 'main' }; });
  }

  var REGISTRY = {
    manualTrigger: node('manualTrigger', 'n8n-nodes-base.manualTrigger', 'Manual Trigger', {
      trigger: true, h: 240, s: 8, outputs: ports(['main']),
      desc: 'Starts the run when you press Execute workflow.'
    }),
    scheduleTrigger: node('scheduleTrigger', 'n8n-nodes-base.scheduleTrigger', 'Schedule Trigger', {
      trigger: true, h: 188, s: 68, outputs: ports(['main']),
      desc: 'Starts the run on a timer — the workflow must be Active.'
    }),
    webhook: node('webhook', 'n8n-nodes-base.webhook', 'Webhook', {
      trigger: true, h: 32, s: 88, outputs: ports(['main']),
      desc: 'Gives the workflow a URL an outside service can call.'
    }),
    httpRequest: node('httpRequest', 'n8n-nodes-base.httpRequest', 'HTTP Request', {
      h: 162, s: 55, inputs: ports(['main']), outputs: ports(['main']),
      desc: 'Calls an external HTTP API.'
    }),
    set: node('set', 'n8n-nodes-base.set', 'Edit Fields (Set)', {
      h: 206, s: 70, inputs: ports(['main']), outputs: ports(['main']),
      desc: 'Adds, renames, computes or drops fields on each item.'
    }),
    code: node('code', 'n8n-nodes-base.code', 'Code', {
      h: 36, s: 84, inputs: ports(['main']), outputs: ports(['main']),
      desc: 'Runs your own JavaScript over the items.'
    }),
    if: node('if', 'n8n-nodes-base.if', 'If', {
      h: 96, s: 52, inputs: ports(['main']), outputs: ports(['true', 'false']),
      desc: 'One condition, two named exits: true and false.'
    }),
    switch: node('switch', 'n8n-nodes-base.switch', 'Switch', {
      h: 280, s: 58, inputs: ports(['main']), outputs: ports(['0', '1', '2']),
      desc: 'Routes items by value across a rule set — many exits.'
    }),
    merge: node('merge', 'n8n-nodes-base.merge', 'Merge', {
      h: 196, s: 52, inputs: ports(['input 1', 'input 2']), outputs: ports(['main']),
      desc: 'Brings parallel branches back into one stream.'
    }),
    loop: node('loop', 'n8n-nodes-base.splitInBatches', 'Loop Over Items', {
      /* Two inputs, as in n8n: the batch enters on the first, the body
         returns on the second — which is what closes the loop. */
      h: 322, s: 54, inputs: ports(['input', 'loop back']),
      outputs: ports(['loop', 'done']),
      desc: 'Emits items one batch at a time until they run out.'
    }),
    respondToWebhook: node('respondToWebhook', 'n8n-nodes-base.respondToWebhook', 'Respond to Webhook', {
      h: 14, s: 76, inputs: ports(['main']), outputs: [],
      desc: 'Answers the caller that hit your Webhook URL.'
    }),
    gmail: node('gmail', 'n8n-nodes-base.gmail', 'Gmail', {
      h: 352, s: 68, inputs: ports(['main']), outputs: [],
      desc: 'Sends an email — a natural end of the line for an alert.'
    })
  };

  function def(key) { return Object.prototype.hasOwnProperty.call(REGISTRY, key) ? REGISTRY[key] : null; }
  function keys() { return Object.keys(REGISTRY); }

  /* ================= Layer 2 — DOMAIN: the graph model =================
     Pure data + pure functions. No document, no window listeners: this layer
     is loaded verbatim by scripts/validate.js in plain Node. */

  var seq = 0;
  function uid(prefix) {
    seq += 1;
    return prefix + '-' + seq.toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
  }

  function create() { return { nodes: [], edges: [] }; }

  function clone(g) {
    return {
      nodes: g.nodes.map(function (n) {
        return { id: n.id, key: n.key, name: n.name, type: n.type,
                 position: [n.position[0], n.position[1]],
                 params: Object.assign({}, n.params || {}) };
      }),
      edges: g.edges.map(function (e) {
        return { id: e.id, from: e.from, out: e.out, to: e.to, in: e.in };
      })
    };
  }

  function byId(g, id) {
    for (var i = 0; i < g.nodes.length; i++) if (g.nodes[i].id === id) return g.nodes[i];
    return null;
  }
  function keyOf(g, id) { var n = byId(g, id); return n ? n.key : null; }
  function countByKey(g, key) {
    return g.nodes.filter(function (n) { return n.key === key; }).length;
  }
  function edge(g, id) {
    for (var i = 0; i < g.edges.length; i++) if (g.edges[i].id === id) return g.edges[i];
    return null;
  }

  function addNode(g, key, position) {
    var d = def(key);
    if (!d) throw new Error('Unknown node type: ' + key);
    var n = {
      id: uid('n'),
      key: key,
      /* n8n auto-names duplicates: "Edit Fields (Set)", "Edit Fields (Set)1" */
      name: d.name + (countByKey(g, key) ? String(countByKey(g, key)) : ''),
      type: d.type,
      position: [Math.round(position ? position[0] : 60), Math.round(position ? position[1] : 80)],
      params: {}
    };
    g.nodes.push(n);
    return n;
  }

  function removeNode(g, id) {
    g.nodes = g.nodes.filter(function (n) { return n.id !== id; });
    g.edges = g.edges.filter(function (e) { return e.from !== id && e.to !== id; });
  }

  /* Direction is normalised: dragging input→output produces the same edge as
     output→input, which is what makes the loop-back edge easy to draw. */
  function connect(g, fromId, outPort, toId, inPort) {
    var a = byId(g, fromId), b = byId(g, toId);
    if (!a || !b || a.id === b.id) return null;
    outPort = outPort | 0; inPort = inPort | 0;
    if (!def(a.key).outputs[outPort] || !def(b.key).inputs[inPort]) return null;
    /* an input port holds exactly one connection — a new one replaces it */
    g.edges = g.edges.filter(function (e) { return !(e.to === b.id && e.in === inPort); });
    var e = { id: uid('e'), from: a.id, out: outPort, to: b.id, in: inPort };
    g.edges.push(e);
    return e;
  }

  function removeEdge(g, id) { g.edges = g.edges.filter(function (e) { return e.id !== id; }); }

  function canConnect(g, fromId, fromPort, fromDir, toId, toPort, toDir) {
    if (fromId === toId || fromDir === toDir) return false;
    var a = byId(g, fromId), b = byId(g, toId);
    if (!a || !b) return false;
    var outNode = fromDir === 'out' ? a : b;
    var inNode = fromDir === 'in' ? a : b;
    var outPort = fromDir === 'out' ? fromPort : toPort;
    var inPort = fromDir === 'in' ? fromPort : toPort;
    return !!(def(outNode.key).outputs[outPort] && def(inNode.key).inputs[inPort]);
  }

  function tally(list) {
    var out = {};
    (list || []).forEach(function (k) { out[k] = (out[k] || 0) + 1; });
    return out;
  }

  function edgeLabel(e) {
    var a = def(e[0]), b = def(e[2]);
    var outName = a && a.outputs[e[1]] ? a.outputs[e[1]].name : null;
    var inName = b && b.inputs[e[3]] ? b.inputs[e[3]].name : null;
    var s = (a ? a.name : e[0]) + ' → ' + (b ? b.name : e[2]);
    if (outName && outName !== 'main') s += ' · ' + outName;
    if (inName && inName !== 'main') s += ' · in ' + inName;
    return s;
  }

  /* The single source of truth for "did the learner build the right graph?".
     Returns one check per requirement so the UI can show live ✓/✗ rows.

     A spec is:
       { brief, palette:[key], required:{ nodes:[key], edges:[[fromKey,out,toKey,in]] },
         allowExtras:false, checklist:[indices into the practice checklist] } */
  function verifyGraph(g, spec) {
    spec = spec || {};
    var req = spec.required || { nodes: [], edges: [] };
    var want = tally(req.nodes);
    var have = tally(g.nodes.map(function (n) { return n.key; }));
    var checks = [];
    var ok = true;

    Object.keys(want).forEach(function (key) {
      var d = def(key);
      var good = (have[key] || 0) === want[key];
      if (!good) ok = false;
      checks.push({
        id: 'node:' + key,
        kind: 'node',
        key: key,
        label: (d ? d.name : key) + (want[key] > 1 ? ' ×' + want[key] : ''),
        ok: good,
        note: good ? '' : (have[key] || 0) > want[key]
          ? 'Remove the extra ' + (d ? d.name : key) + '.'
          : 'Place a ' + (d ? d.name : key) + ' on the canvas.'
      });
    });

    function matches(e, want_e) {
      return keyOf(g, e.from) === want_e[0] && e.out === (want_e[1] | 0) &&
             keyOf(g, e.to) === want_e[2] && e.in === (want_e[3] | 0);
    }
    (req.edges || []).forEach(function (we) {
      var found = g.edges.some(function (e) { return matches(e, we); });
      if (!found) ok = false;
      checks.push({
        id: 'edge:' + edgeLabel(we),
        kind: 'edge',
        label: edgeLabel(we),
        ok: found,
        note: found ? '' : 'Drag from one handle onto the other to connect them.'
      });
    });

    var extras = { nodes: [], edges: [] };
    if (spec.allowExtras === false) {
      g.nodes.forEach(function (n) { if (!want[n.key]) extras.nodes.push(n); });
      g.edges.forEach(function (e) {
        if (!(req.edges || []).some(function (we) { return matches(e, we); })) extras.edges.push(e);
      });
      if (extras.nodes.length || extras.edges.length) ok = false;
      checks.push({
        id: 'extras',
        kind: 'extras',
        label: 'No extra nodes or connections',
        ok: !extras.nodes.length && !extras.edges.length,
        note: 'This task is exact — the decoys stay out.'
      });
    }

    return { ok: ok, checks: checks, extras: extras, required: req,
             nodes: g.nodes.length, edges: g.edges.length };
  }

  /* Real n8n export shape: nodes[] + connections{ "<node name>": { main: [[…]] } }.
     Named outputs (If true/false) become separate entries in the main array,
     exactly as n8n writes them. */
  function toJSON(g, spec) {
    spec = spec || {};
    var name = spec.name || 'Practice workflow';
    var names = {};
    g.nodes.forEach(function (n) { names[n.id] = n.name; });

    var nodes = g.nodes.map(function (n) {
      return {
        parameters: n.params || {},
        id: n.id,
        name: n.name,
        type: n.type,
        typeVersion: 1,
        position: [n.position[0], n.position[1]]
      };
    });

    var connections = {};
    g.edges.forEach(function (e) {
      var from = names[e.from], to = names[e.to];
      if (!from || !to) return;
      var slot = connections[from] || (connections[from] = { main: [] });
      while (slot.main.length <= e.out) slot.main.push([]);
      slot.main[e.out].push({ node: to, type: 'main', index: e.in });
    });

    return {
      name: name,
      nodes: nodes,
      connections: connections,
      active: false,
      settings: { executionOrder: 'v1' },
      pinData: {},
      tags: [],
      meta: { instanceId: 'rvencis-forge-practice-canvas' }
    };
  }

  /* Builds the reference graph for a spec — used by scripts/validate.js to
     prove every authored spec is satisfiable, and by the smoke test to seed
     a correct build programmatically. */
  function referenceGraph(spec) {
    var g = create();
    var req = (spec && spec.required) || {};
    (req.nodes || []).forEach(function (key, i) { addNode(g, key, [60 + i * 190, 90]); });
    var byKey = {};
    g.nodes.forEach(function (n) { (byKey[n.key] = byKey[n.key] || []).push(n); });

    (req.edges || []).forEach(function (we) {
      var outPort = we[1] | 0, inPort = we[3] | 0;
      /* first source of that key with that output port still free… */
      var a = (byKey[we[0]] || []).filter(function (n) {
        return !g.edges.some(function (e) { return e.from === n.id && e.out === outPort; });
      })[0];
      /* …and first target of that key with that input port still free */
      var b = (byKey[we[2]] || []).filter(function (n) {
        return !g.edges.some(function (e) { return e.to === n.id && e.in === inPort; });
      })[0];
      if (a && b) connect(g, a.id, outPort, b.id, inPort);
    });
    return g;
  }

  /* Topological-ish order for the Execute animation: triggers first, then
     breadth-first, with anything unreachable appended in placement order. */
  function runOrder(g) {
    var seen = {}, order = [], queue = [];
    g.nodes.filter(function (n) { return def(n.key).trigger; }).forEach(function (n) { queue.push(n.id); });
    if (!queue.length && g.nodes.length) queue.push(g.nodes[0].id);
    while (queue.length) {
      var id = queue.shift();
      if (seen[id]) continue;
      seen[id] = true;
      order.push(id);
      g.edges.filter(function (e) { return e.from === id; })
        .forEach(function (e) { if (!seen[e.to]) queue.push(e.to); });
    }
    g.nodes.forEach(function (n) { if (!seen[n.id]) order.push(n.id); });
    return order;
  }

  /* ================= Layer 3 — BACKEND: swappable renderer ================= */

  var backends = {};
  var activeName = 'vanilla';

  /* factory(ctx) may return a backend or a Promise<backend> (e.g. an engine
     that lazy-loads its own bundle). */
  function registerBackend(name, factory) {
    if (!name || typeof factory !== 'function') throw new Error('registerBackend(name, factory)');
    backends[name] = factory;
    return name;
  }
  function useBackend(name) {
    if (name && !backends[name]) throw new Error('No such canvas backend: ' + name);
    activeName = name || activeName;
    return activeName;
  }

  /* Mounts a backend into rootEl and returns it (or a Promise for it).
     ctx = { graph, spec, registry, lessonKey, emit }.
     The live backend is also published as Simulator.active so a host (or the
     smoke test) can drive the graph without holding a reference. */
  var active = null;
  function mount(rootEl, ctx) {
    ctx = ctx || {};
    var name = ctx.backend || activeName;
    var factory = backends[name];
    if (!factory) throw new Error('No such canvas backend: ' + name);
    var made = factory(ctx);
    function attach(backend) {
      if (!backend) throw new Error('Backend "' + name + '" produced nothing');
      if (typeof backend.mount === 'function') backend.mount(rootEl, ctx);
      active = backend;
      return backend;
    }
    return (made && typeof made.then === 'function') ? made.then(attach) : attach(made);
  }

  /* ---------- the default renderer: hand-rolled DOM canvas ----------
     No engine, no dependencies. It is deliberately written against the Layer-2
     contract only (graph in, DOM out) so the Rete/Baklava adapters stay honest. */

  var NODE_W = 168;   /* card width  — matches .sim-node in css/simulator.css */
  var NODE_H = 96;    /* card height */
  var DRAFT_PREFIX = 'rvencisforge.canvas.draft.';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function icon(name, size) {
    return (global.UI && UI.icon) ? UI.icon(name, size || 14) : '';
  }

  function vanillaBackend(ctx) {
    var spec = ctx.spec || {};
    var g = ctx.graph || create();
    var lessonKey = ctx.lessonKey || 'practice';
    var emit = ctx.emit || function () {};

    var root, stage, world, wires, nodeLayer;
    var reqPill, reqList, consoleBox, consoleRun, actionSlotEl;
    var view = { x: 0, y: 0, z: 1 };
    var selection = null;      /* selected node id */
    var running = false;
    var destroyed = false;
    var draftTimer = null;

    /* ---------- geometry ---------- */
    /* Ports sit on the vertical centre of the card edge, fanned out when a
       node declares more than one (If true/false, Merge input 1/2). */
    var PORT_GAP = 22;
    function portPoint(nodeId, dir, port) {
      var n = byId(g, nodeId);
      if (!n) return { x: 0, y: 0 };
      var count = dir === 'out' ? def(n.key).outputs.length : def(n.key).inputs.length;
      var dy = count > 1 ? (port - (count - 1) / 2) * PORT_GAP : 0;
      return {
        x: n.position[0] + (dir === 'out' ? NODE_W : 0),
        y: n.position[1] + NODE_H / 2 + dy
      };
    }
    function bezier(a, b) {
      var dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
      return 'M' + a.x + ',' + a.y + ' C' + (a.x + dx) + ',' + a.y + ' ' +
             (b.x - dx) + ',' + b.y + ' ' + b.x + ',' + b.y;
    }

    /* ---------- shell ----------
       DataCamp-style IDE: a toolbar, a canvas that takes all the remaining
       height, a collapsible console drawer and a footer action bar. The host
       page owns the gated "Ready for Quiz" button and hands it over through
       ctx.actionSlot, so there is exactly one gate on screen. */
    function shell() {
      var palette = (spec.palette || []).map(function (key) {
        var d = def(key);
        if (!d) return '';
        return '<button type="button" class="sim-chip" data-key="' + esc(key) + '" ' +
          'style="--nh:' + d.h + ';--ns:' + d.s + '%" title="' + esc(d.desc) + '">' +
          '<span class="sim-chip-dot"></span>' + esc(d.name) + '</button>';
      }).join('');

      root.innerHTML =
        '<div class="sim-ide">' +

          /* ---- top toolbar: palette + canvas controls ---- */
          '<div class="sim-toolbar">' +
            '<div class="sim-palette" role="group" aria-label="Add a node">' +
              '<span class="sim-toolbar-label">Add node</span>' + palette +
            '</div>' +
            '<div class="sim-toolbar-tools">' +
              '<button type="button" class="sim-pill" data-tab-jump="req" ' +
                'title="Show the requirements you still have to meet">0 / 0</button>' +
              '<div class="sim-zoom" role="group" aria-label="Zoom">' +
                '<button type="button" class="sim-zoom-btn" data-zoom="out" aria-label="Zoom out">&minus;</button>' +
                '<button type="button" class="sim-zoom-btn" data-zoom="fit" aria-label="Fit to view">Fit</button>' +
                '<button type="button" class="sim-zoom-btn" data-zoom="in" aria-label="Zoom in">+</button>' +
              '</div>' +
              '<button type="button" class="sim-ghost-btn sim-reset" title="Clear the canvas">' +
                icon('reset', 14) + '<span>Reset canvas</span></button>' +
            '</div>' +
          '</div>' +

          /* ---- the canvas ---- */
          '<div class="sim-stage" tabindex="0" aria-label="Workflow canvas">' +
            '<div class="sim-world">' +
              '<svg class="sim-wires" aria-hidden="true"><g class="sim-wire-g"></g></svg>' +
              '<div class="sim-nodes"></div>' +
            '</div>' +
            '<p class="sim-empty" hidden>Pick a node above to start building.</p>' +
            '<p class="sim-hint">Click a node to add it &middot; drag a handle onto another to connect &middot; drag the background to pan</p>' +
          '</div>' +

          /* ---- console drawer ---- */
          '<div class="sim-console" data-open="0">' +
            '<div class="sim-console-head">' +
              '<div class="sim-tabs" role="tablist">' +
                '<button type="button" class="sim-tab is-on" data-pane-jump="run" role="tab">Run output</button>' +
                '<button type="button" class="sim-tab" data-pane-jump="req" role="tab">Requirements</button>' +
              '</div>' +
              '<button type="button" class="sim-console-toggle" data-act="console" aria-expanded="false">' +
                icon('chevron', 14) + '<span>Console</span></button>' +
            '</div>' +
            '<pre class="sim-console-body" data-pane="run"></pre>' +
            '<ul class="sim-console-body sim-console-reqs" data-pane="req" hidden></ul>' +
          '</div>' +

          /* ---- footer action bar ---- */
          '<div class="sim-footbar">' +
            '<button type="button" class="sim-ghost-btn sim-reset">' + icon('reset', 14) + 'Reset canvas</button>' +
            '<span class="sim-footbar-gap"></span>' +
            '<button type="button" class="sim-ghost-btn sim-json-btn">View JSON</button>' +
            '<button type="button" class="sim-primary-btn sim-run">' + icon('play', 14) + 'Execute run</button>' +
            '<span class="sim-slot"></span>' +
          '</div>' +
        '</div>';

      stage = root.querySelector('.sim-stage');
      world = root.querySelector('.sim-world');
      wires = root.querySelector('.sim-wire-g');
      nodeLayer = root.querySelector('.sim-nodes');
      reqPill = root.querySelector('.sim-pill');
      reqList = root.querySelector('.sim-console-reqs');
      consoleBox = root.querySelector('.sim-console');
      consoleRun = root.querySelector('.sim-console-body[data-pane="run"]');
      actionSlotEl = root.querySelector('.sim-slot');

      /* the host's gated button lives in the canvas action bar */
      if (ctx.actionSlot && actionSlotEl) actionSlotEl.appendChild(ctx.actionSlot);
    }

    /* ---------- render (diff by id — the same shape a Rete/Baklava adapter uses) ---------- */
    var elById = {};   /* node id -> rendered element */

    function nodeHtml(n) {
      var d = def(n.key);
      var inPorts = d.inputs.map(function (p, i) {
        return '<button type="button" class="sim-port sim-port-in" data-dir="in" data-port="' + i + '" ' +
          'aria-label="' + esc(d.name + ' input ' + p.name) + '"></button>';
      }).join('');
      var outPorts = d.outputs.map(function (p, i) {
        return '<button type="button" class="sim-port sim-port-out" data-dir="out" data-port="' + i + '" ' +
          'aria-label="' + esc(d.name + ' output ' + p.name) + '"></button>';
      }).join('');
      return '<div class="sim-node" data-id="' + esc(n.id) + '" ' +
          'style="--nh:' + d.h + ';--ns:' + d.s + '%;left:' + n.position[0] + 'px;top:' + n.position[1] + 'px">' +
          '<div class="sim-node-tools">' +
            '<button type="button" class="sim-tool sim-tool-del" data-act="delete" aria-label="Delete ' + esc(d.name) + '">' + icon('x', 12) + '</button>' +
          '</div>' +
          '<span class="sim-node-ico" aria-hidden="true">' + (d.trigger ? '⚡' : '●') + '</span>' +
          '<div class="sim-node-body"><strong>' + esc(d.name) + '</strong>' +
            '<span class="sim-node-type">' + esc(n.type) + '</span></div>' +
          inPorts + outPorts +
        '</div>';
    }

    function renderNodes() {
      var seen = {};
      g.nodes.forEach(function (n) {
        seen[n.id] = true;
        var el = elById[n.id];
        if (!el) {
          var tpl = document.createElement('div');
          tpl.innerHTML = nodeHtml(n);
          el = tpl.firstElementChild;
          elById[n.id] = el;
          nodeLayer.appendChild(el);
        } else {
          /* keep the live element so an in-flight drag is never interrupted */
          el.style.left = n.position[0] + 'px';
          el.style.top = n.position[1] + 'px';
        }
        el.classList.toggle('is-selected', n.id === selection);
        el.classList.toggle('is-running', running);
      });
      Object.keys(elById).forEach(function (id) {
        if (seen[id]) return;
        if (elById[id].parentNode) elById[id].parentNode.removeChild(elById[id]);
        delete elById[id];
      });
    }

    function renderWires() {
      var paths = [];
      g.edges.forEach(function (e) {
        var d = bezier(portPoint(e.from, 'out', e.out), portPoint(e.to, 'in', e.in));
        paths.push('<g class="sim-wire-pair" data-edge="' + esc(e.id) + '">' +
          '<path class="sim-wire" d="' + d + '"></path>' +
          '<path class="sim-wire-hit" d="' + d + '"></path></g>');
      });
      wires.innerHTML = paths.join('');
    }

    function sync() {
      if (destroyed || !nodeLayer) return null;
      renderNodes();
      renderWires();
      var empty = root.querySelector('.sim-empty');
      if (empty) empty.hidden = g.nodes.length > 0;
      applyView();
      saveDraft();
      return renderRequirements();   /* callers chain on the verification result */
    }

    function applyView() {
      world.style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.z + ')';
      stage.style.setProperty('--sim-zoom', view.z);
    }

    /* Requirements live in two places by design: a compact counter pill in the
       toolbar, and the full list in the console drawer. The learner-facing
       checklist is the left rail's (owned by js/steps.js), so nothing is
       rendered twice. */
    function renderRequirements() {
      var res = verifyGraph(g, spec);
      var done = res.checks.filter(function (c) { return c.ok; }).length;
      var total = res.checks.length;

      if (reqPill) {
        reqPill.textContent = done + ' / ' + total + ' met';
        reqPill.setAttribute('data-state', res.ok ? 'ok' : (done ? 'part' : 'idle'));
        reqPill.setAttribute('title', res.ok
          ? 'Every requirement is met.'
          : res.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.label; }).join(' · '));
      }
      if (reqList) {
        reqList.innerHTML = res.checks.map(function (c) {
          return '<li class="sim-req' + (c.ok ? ' is-ok' : '') + '">' +
            '<span class="sim-req-mark" aria-hidden="true">' + (c.ok ? '✓' : '○') + '</span>' +
            '<span class="sim-req-text">' + esc(c.label) +
              (c.ok || !c.note ? '' : '<em>' + esc(c.note) + '</em>') + '</span></li>';
        }).join('');
      }
      return res;
    }

    /* ---------- console drawer ---------- */
    function setConsole(open, pane) {
      if (!consoleBox) return;
      consoleBox.setAttribute('data-open', open ? '1' : '0');
      var toggle = consoleBox.querySelector('.sim-console-toggle');
      if (toggle) toggle.setAttribute('aria-expanded', String(!!open));
      showPane(pane || consoleBox.getAttribute('data-pane') || 'run');
    }
    function showPane(name) {
      if (!consoleBox) return;
      consoleBox.setAttribute('data-pane', name);
      consoleBox.querySelectorAll('[data-pane]').forEach(function (p) {
        p.hidden = p.getAttribute('data-pane') !== name;
      });
      consoleBox.querySelectorAll('.sim-tab').forEach(function (t) {
        t.classList.toggle('is-on', t.getAttribute('data-pane-jump') === name);
      });
    }
    /* a short, deterministic console log — enough to feel like a real run
       without pretending to execute anything */
    function consoleWrite(lines) {
      if (!consoleRun) return;
      consoleRun.textContent += (consoleRun.textContent ? '\n' : '') + lines.join('\n');
      consoleRun.scrollTop = consoleRun.scrollHeight;
    }
    function consoleClear() { if (consoleRun) consoleRun.textContent = ''; }

    /* ---------- change plumbing ---------- */
    function changed(reason) {
      var res = sync();
      emit({ type: 'change', graph: g, reason: reason || 'edit' });
      emit({ type: 'verify', graph: g, result: res, reason: reason || 'edit' });
      return res;
    }

    /* ---------- placement ---------- */
    function slot() {
      /* cascade new nodes so repeated clicks never stack them */
      var i = g.nodes.length;
      return [40 + (i % 4) * 40, 40 + Math.floor(i / 4) * 120];
    }
    function addFromPalette(key) {
      var n = addNode(g, key, slot());
      changed('add');
      selectNode(n.id);
      sync();
      return n;
    }
    function selectNode(id) { selection = id; }

    /* ---------- pointer: drag nodes, drag wires, pan the canvas ---------- */
    function stagePoint(ev) {
      var box = stage.getBoundingClientRect();
      return { x: (ev.clientX - box.left - view.x) / view.z, y: (ev.clientY - box.top - view.y) / view.z };
    }
    function onPointerDown(ev) {
      if (ev.button !== 0) return;
      var portEl = ev.target.closest('.sim-port');
      var nodeEl = ev.target.closest('.sim-node');
      var wireEl = ev.target.closest('.sim-wire-hit');
      var toolEl = ev.target.closest('[data-act="delete"]');

      if (toolEl && nodeEl) {                 /* delete button */
        ev.preventDefault();
        removeNode(g, nodeEl.getAttribute('data-id'));
        changed('delete');
        return;
      }
      if (portEl && nodeEl) {                 /* start a connection */
        ev.preventDefault();
        startLink(nodeEl.getAttribute('data-id'), portEl.getAttribute('data-dir'), portEl.getAttribute('data-port') | 0);
        return;
      }
      if (wireEl) {                           /* click a wire to cut it */
        ev.preventDefault();
        removeEdge(g, wireEl.getAttribute('data-edge'));
        changed('disconnect');
        return;
      }
      if (nodeEl) {                           /* drag a node */
        ev.preventDefault();
        var id = nodeEl.getAttribute('data-id');
        var n = byId(g, id);
        var start = stagePoint(ev);
        var origin = [n.position[0], n.position[1]];
        selectNode(id);
        sync();
        drag(ev, function (e) {
          var p = stagePoint(e);
          n.position[0] = Math.max(0, Math.round(origin[0] + p.x - start.x));
          n.position[1] = Math.max(0, Math.round(origin[1] + p.y - start.y));
          renderNodes();
          renderWires();
        }, function () { changed('move'); });
        return;
      }
      /* empty canvas: deselect + pan */
      selectNode(null);
      sync();
      var from = { x: ev.clientX - view.x, y: ev.clientY - view.y };
      drag(ev, function (e) {
        view.x = e.clientX - from.x;
        view.y = e.clientY - from.y;
        applyView();
      }, function () {});
    }

    /* shared pointer capture loop */
    function drag(startEv, onMove, onEnd) {
      var moved = false;
      function move(e) { moved = true; onMove(e); }
      function up(e) {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        try { document.releasePointerCapture(startEv.pointerId); } catch (err) { /* not captured */ }
        onEnd(e, moved);
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      try { startEv.target.setPointerCapture(startEv.pointerId); } catch (err) { /* no capture */ }
    }

    /* ---------- drag-to-connect ----------
       Works in both directions: dragging from an output or from an input
       produces the same edge, which is what makes the loop-back connection
       on Loop Over Items drawable without a special case. */
    function startLink(fromId, dir, port) {
      var anchor = portPoint(fromId, dir, port);
      var svgEl = wires.ownerSVGElement;
      stage.classList.add('is-linking');
      var temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      temp.setAttribute('class', 'sim-wire-temp');
      if (svgEl) svgEl.appendChild(temp);

      function move(e) {
        if (!svgEl) return;
        var p = stagePoint(e);
        temp.setAttribute('d', dir === 'out' ? bezier(anchor, p) : bezier(p, anchor));
      }
      function up(e) {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        stage.classList.remove('is-linking');
        if (temp.parentNode) temp.parentNode.removeChild(temp);

        var target = document.elementFromPoint(e.clientX, e.clientY);
        var hit = target && target.closest ? target.closest('.sim-node') : null;
        if (!hit) return;
        var toId = hit.getAttribute('data-id');
        var portEl = target.closest('.sim-port');
        var toDir = portEl ? portEl.getAttribute('data-dir') : (dir === 'out' ? 'in' : 'out');
        var toPort = portEl ? portEl.getAttribute('data-port') | 0 : 0;

        if (!canConnect(g, fromId, port, dir, toId, toPort, toDir)) {
          if (byId(g, toId)) log('That handle cannot take this connection.', 'warn');
          return;
        }
        if (dir === 'out') connect(g, fromId, port, toId, toPort);
        else connect(g, toId, toPort, fromId, port);
        changed('connect');
      }
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    }

    /* ---------- Execute: animate the run and stream mock payloads ----------
       The payloads are illustrative only — this canvas teaches topology, it
       does not run n8n. They are shaped exactly like n8n items so the mental
       model transfers. */
    function sampleFor(key) {
      switch (key) {
        case 'manualTrigger': return { json: { timestamp: '2026-09-28T10:04:12.882Z' } };
        case 'scheduleTrigger': return { json: { timestamp: '2026-09-28T09:00:00.000Z', 'Seconds till next execution': 900 } };
        case 'webhook': return { json: { headers: { 'content-type': 'application/json' }, query: {}, body: {} } };
        case 'httpRequest': return { json: { statusCode: 200, body: { ok: true } } };
        case 'set': return { json: { id: 1, total: 1250, status: 'paid' } };
        case 'code': return { json: { id: 1, total: 30, computed: true } };
        case 'gmail': return { json: { id: '18f0a1', threadId: '18f0a1' } };
        case 'respondToWebhook': return { json: { statusCode: 200, body: 'ok' } };
        default: return { json: {} };
      }
    }

    function run() {
      if (running || !g.nodes.length) {
        if (!g.nodes.length) setConsole(true, 'run'), consoleWrite('Add a node first — there is nothing to execute yet.');
        return;
      }
      running = true;
      var order = runOrder(g);
      var step = Math.min(420, 1500 / Math.max(1, order.length));
      var i = 0;
      var started = Date.now();
      setConsole(true, 'run');
      consoleClear();
      consoleWrite(['▶ Executing "' + (spec.name || 'Practice workflow') + '" — ' +
        order.length + ' node' + (order.length === 1 ? '' : 's') + ', ' + g.edges.length + ' connection' +
        (g.edges.length === 1 ? '' : 's')]);

      (function tick() {
        if (destroyed) return;
        if (i > 0 && elById[order[i - 1]]) elById[order[i - 1]].classList.remove('is-running');
        if (i >= order.length) {
          running = false;
          sync();
          var res = verifyGraph(g, spec);
          consoleWrite([
            '',
            res.ok ? '✔ Finished successfully in ' + (Date.now() - started) + 'ms'
                    : '⚠ Finished in ' + (Date.now() - started) + 'ms — ' +
                      (res.checks.length - res.checks.filter(function (c) { return c.ok; }).length) +
                      ' requirement(s) still unmet.'
          ]);
          emit({ type: 'run', graph: g, result: res, order: order });
          return;
        }
        var id = order[i];
        var el = elById[id];
        if (el) el.classList.add('is-running');
        var node = byId(g, id);
        if (node) {
          var payload = sampleFor(node.key);
          consoleWrite([
            '',
            '✓ ' + node.name,
            '  ' + JSON.stringify([payload])
          ]);
        }
        i++;
        setTimeout(tick, step);
      })();
    }

    /* ---------- JSON view: the real n8n export ---------- */
    function showJson() {
      setConsole(true, 'run');
      consoleClear();
      consoleWrite(['// Paste this straight into n8n (Menu ▸ Import from Clipboard)', '']);
      consoleWrite([JSON.stringify(toJSON(g, spec), null, 2)]);
    }

    /* ---------- viewport (part of the backend contract) ---------- */
    function zoomBy(factor) {
      view.z = Math.min(1.6, Math.max(0.4, Math.round(view.z * factor * 100) / 100));
      applyView();
    }
    function panTo(x, y) { view.x = x; view.y = y; applyView(); }
    function fit() {
      if (!g.nodes.length || !stage) { panTo(0, 0); view.z = 1; applyView(); return; }
      var box = stage.getBoundingClientRect();
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      g.nodes.forEach(function (n) {
        minX = Math.min(minX, n.position[0]);
        minY = Math.min(minY, n.position[1]);
        maxX = Math.max(maxX, n.position[0] + NODE_W);
        maxY = Math.max(maxY, n.position[1] + NODE_H);
      });
      var pad = 32;
      var z = Math.min(1.2, Math.max(0.4,
        Math.min((box.width - pad * 2) / (maxX - minX), (box.height - pad * 2) / (maxY - minY))));
      view.z = Math.round(z * 100) / 100;
      view.x = (box.width - (maxX - minX) * view.z) / 2 - minX * view.z;
      view.y = (box.height - (maxY - minY) * view.z) / 2 - minY * view.z;
      applyView();
    }

    /* ---------- draft persistence ----------
       The graph survives a reload, but never blocks the lesson: a draft that
       no longer verifies is simply restored as a starting point. */
    function draftKey() { return DRAFT_PREFIX + lessonKey; }
    function saveDraft() {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = setTimeout(function () {
        draftTimer = null;
        try {
          if (!g.nodes.length) { global.localStorage.removeItem(draftKey()); return; }
          global.localStorage.setItem(draftKey(), JSON.stringify({ v: 1, graph: g, view: view }));
        } catch (e) { /* private mode / quota — the canvas still works */ }
      }, 250);
    }
    function loadDraft() {
      try {
        var raw = global.localStorage.getItem(draftKey());
        if (!raw) return;
        var saved = JSON.parse(raw);
        if (!saved || !saved.graph || !Array.isArray(saved.graph.nodes)) return;
        g.nodes = saved.graph.nodes;
        g.edges = saved.graph.edges || [];
        if (saved.view) view = saved.view;
      } catch (e) { /* corrupt draft: start clean */ }
    }
    function resetAll() {
      g.nodes = [];
      g.edges = [];
      selection = null;
      view = { x: 0, y: 0, z: 1 };
      try { global.localStorage.removeItem(draftKey()); } catch (e) { /* nothing stored */ }
      changed('reset');
      consoleClear();
      setConsole(false);
    }

    /* ---------- lifecycle ---------- */
    function onPaletteClick(e) {
      var chip = e.target.closest('.sim-chip');
      if (chip) { addFromPalette(chip.getAttribute('data-key')); return; }
      var zoomBtn = e.target.closest('[data-zoom]');
      if (zoomBtn) {
        var how = zoomBtn.getAttribute('data-zoom');
        if (how === 'in') zoomBy(1.15);
        else if (how === 'out') zoomBy(1 / 1.15);
        else fit();
        return;
      }
      /* the counter pill is the shortcut into the requirements tab */
      var jump = e.target.closest('[data-tab-jump]');
      if (jump) { setConsole(true, jump.getAttribute('data-tab-jump')); return; }
      var paneJump = e.target.closest('[data-pane-jump]');
      if (paneJump) { setConsole(true, paneJump.getAttribute('data-pane-jump')); return; }
      if (e.target.closest('[data-act="console"]')) {
        setConsole(consoleBox.getAttribute('data-open') !== '1');
        return;
      }
      if (e.target.closest('.sim-run')) { run(); return; }
      if (e.target.closest('.sim-json-btn')) { showJson(); return; }
      if (e.target.closest('.sim-reset')) { resetAll(); return; }
    }
    function onKeyDown(e) {
      if (!root.contains(document.activeElement) && document.activeElement !== stage) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selection) return;
        e.preventDefault();
        removeNode(g, selection);
        selection = null;
        changed('delete');
      } else if (e.key === 'Escape') {
        selection = null;
        sync();
      }
    }

    var backend = {
      name: 'vanilla',
      mount: function (rootEl) {
        root = rootEl;
        root.classList.add('sim-root');
        shell();
        loadDraft();
        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('wheel', onWheel, { passive: false });
        root.addEventListener('click', onPaletteClick);
        document.addEventListener('keydown', onKeyDown);
        sync();
        var res = renderRequirements();
        emit({ type: 'verify', graph: g, result: res, reason: 'mount' });
        return backend;
      },
      sync: function () { sync(); },
      viewport: {
        zoom: zoomBy,
        panTo: panTo,
        fit: fit,
        get: function () { return { x: view.x, y: view.y, z: view.z }; }
      },
      /* graph handles, so a host or a test can build programmatically */
      addNode: addFromPalette,
      removeNode: function (id) { removeNode(g, id); changed('delete'); },
      connect: function (fromId, outPort, toId, inPort) {
        var e = connect(g, fromId, outPort, toId, inPort);
        if (e) changed('connect');
        return e;
      },
      run: run,
      reset: resetAll,
      toJSON: function () { return toJSON(g, spec); },
      verify: function () { return verifyGraph(g, spec); },
      graph: g,
      destroy: function () {
        destroyed = true;
        if (draftTimer) { clearTimeout(draftTimer); draftTimer = null; }
        try { saveDraftNow(); } catch (e) { /* storage gone */ }
        if (stage) stage.removeEventListener('pointerdown', onPointerDown);
        if (stage) stage.removeEventListener('wheel', onWheel);
        if (root) root.removeEventListener('click', onPaletteClick);
        document.removeEventListener('keydown', onKeyDown);
        elById = {};
        root = stage = world = wires = nodeLayer = null;
        reqPill = reqList = consoleBox = consoleRun = actionSlotEl = null;
      }
    };

    /* flush a pending draft immediately when the view is torn down */
    function saveDraftNow() {
      if (!g.nodes.length) { global.localStorage.removeItem(draftKey()); return; }
      global.localStorage.setItem(draftKey(), JSON.stringify({ v: 1, graph: g, view: view }));
    }

    function onWheel(e) {
      if (!e.ctrlKey && !e.metaKey) return;   /* plain wheel scrolls the page */
      e.preventDefault();
      var before = stagePoint(e);
      zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
      var after = stagePoint(e);
      view.x += (after.x - before.x) * view.z;
      view.y += (after.y - before.y) * view.z;
      applyView();
    }

    return backend;
  }

  registerBackend('vanilla', vanillaBackend);

  /* Verifies a lesson's spec by building its own reference graph — the same
     self-check scripts/validate.js runs over every authored spec. */
  function verifyTopology(spec) { return verifyGraph(referenceGraph(spec), spec); }

  /* ================= exports ================= */
  global.Simulator = {
    /* Layer 1 */
    registry: REGISTRY,
    def: def,
    keys: keys,
    /* Layer 2 (pure — safe to require in Node) */
    graph: {
      create: create, clone: clone, byId: byId, edge: edge, keyOf: keyOf,
      addNode: addNode, removeNode: removeNode, countByKey: countByKey,
      connect: connect, removeEdge: removeEdge, canConnect: canConnect,
      verifyGraph: verifyGraph, toJSON: toJSON, referenceGraph: referenceGraph,
      runOrder: runOrder, edgeLabel: edgeLabel
    },
    verifyGraph: verifyGraph,
    verifyTopology: verifyTopology,
    toJSON: toJSON,
    /* Layer 3 */
    backends: backends,
    registerBackend: registerBackend,
    useBackend: useBackend,
    mount: mount,
    get active() { return active; },
    NODE_W: NODE_W,
    NODE_H: NODE_H
  };
})(typeof window !== 'undefined' ? window : globalThis);
