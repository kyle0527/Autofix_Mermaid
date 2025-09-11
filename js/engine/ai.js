/* js/engine/ai.js */
const EngineAI = (function(){
  const { guessDiagramType } = self.EngineCommon;

  function score(text, keywords){
    const s = (text||'').toLowerCase();
    let sc = 0;
    for (const k of keywords){
      if (s.indexOf(k.toLowerCase())>=0) sc += 1;
    }
    return sc / Math.max(1, keywords.length);
  }

  function suggestAndFix(code, {diagram='auto', logs:ext=[]}={}){
    const dtypeGuess = diagram==='auto' ? guessDiagramType(code) : diagram;
    // Find best ai bucket
    let best = null, bestScore = -1;
    for (const b of AI_RULES){
      const sc = (dtypeGuess==='unknown' || b.diagram===dtypeGuess) ? 0.1 : 0;
      const s = sc + score(code, b.keywords||[]);
      if (s>bestScore){ best=b; bestScore=s; }
    }
    const logs = [];
    if (best){
      logs.push({level:'info', rule:'ai.bucket', msg:`AI bucket ${best.diagram} chosen (score=${bestScore.toFixed(2)})`});
    }
    // Apply deterministic rules first
    const det = EngineRules.applyAll(code, {diagram: dtypeGuess});
    const out = det.code;
    logs.push(...det.logs);

    // Attach suggestions (no-op changes)
    for (const s of SUGGESTIONS){
      if (s.applies_to.indexOf(dtypeGuess)>=0 || s.applies_to.indexOf('unknown')>=0){
        if ((s.keywords||[]).some(k => (code||'').toLowerCase().includes(k))){
          logs.push({level:'warn', rule: s.id, msg: s.description, suggest: s.suggest_fix});
        }
      }
    }
    return {code: out, logs, dtypeGuess};
  }

  // Embedded assets
  const AI_RULES = [
  {
    "diagram": "unknown",
    "keywords": [
      "https",
      "com",
      "response_",
      "version",
      "github",
      "commit",
      "not",
      "reproduce",
      "mermaid-js",
      "screenshots",
      "context",
      "sample",
      "browser",
      "image",
      "additional",
      "steps",
      "branch",
      "can",
      "description",
      "you"
    ]
  },
  {
    "diagram": "flowchart",
    "keywords": [
      "https",
      "com",
      "subgraph",
      "version",
      "github",
      "graph",
      "end",
      "not",
      "response_",
      "mermaid-js",
      "image",
      "reproduce",
      "text",
      "node",
      "html",
      "screenshots",
      "details",
      "summary",
      "sample",
      "context"
    ]
  },
  {
    "diagram": "sequenceDiagram",
    "keywords": [
      "https",
      "participant",
      "sequence",
      "com",
      "sequencediagram",
      "version",
      "are",
      "you",
      "john",
      "actor",
      "text",
      "null",
      "not",
      "github",
      "reproduce",
      "alice",
      "png",
      "image",
      "width",
      "response_"
    ]
  },
  {
    "diagram": "classDiagram",
    "keywords": [
      "classdiagram",
      "https",
      "version",
      "not",
      "response_",
      "com",
      "string",
      "live",
      "github",
      "reproduce",
      "are",
      "screenshots",
      "sample",
      "context",
      "name",
      "example",
      "additional",
      "but",
      "like",
      "type"
    ]
  },
  {
    "diagram": "architecture",
    "keywords": [
      "https",
      "architecture",
      "database",
      "response_",
      "com",
      "service",
      "version",
      "github",
      "live",
      "api",
      "screenshots",
      "sample",
      "group",
      "src",
      "architecture-beta",
      "but",
      "render",
      "server",
      "edge",
      "blob"
    ]
  },
  {
    "diagram": "erDiagram",
    "keywords": [
      "not",
      "null",
      "erdiagram",
      "text",
      "https",
      "version",
      "response_",
      "reproduce",
      "string",
      "screenshots",
      "integer",
      "com",
      "sample",
      "but",
      "service",
      "name",
      "can",
      "live",
      "description",
      "browser"
    ]
  },
  {
    "diagram": "mindmap",
    "keywords": [
      "mindmap",
      "response_",
      "version",
      "https",
      "browser",
      "chrome",
      "github",
      "description",
      "reproduce",
      "sample",
      "are",
      "node",
      "steps",
      "screenshots",
      "additional",
      "context",
      "com",
      "docs",
      "setup",
      "not"
    ]
  },
  {
    "diagram": "gantt",
    "keywords": [
      "gantt",
      "section",
      "response_",
      "https",
      "chart",
      "not",
      "version",
      "dateformat",
      "task",
      "com",
      "after",
      "reproduce",
      "like",
      "github",
      "context",
      "axisformat",
      "title",
      "additional",
      "but",
      "steps"
    ]
  },
  {
    "diagram": "block",
    "keywords": [
      "response_",
      "blocks",
      "block",
      "version",
      "arrow",
      "merge",
      "two",
      "description",
      "image",
      "https",
      "github",
      "com",
      "user-attachments",
      "assets",
      "steps",
      "reproduce",
      "screenshots",
      "sample",
      "setup",
      "suggested"
    ]
  },
  {
    "diagram": "treemap",
    "keywords": [
      "data",
      "treemap",
      "use",
      "new",
      "update",
      "class-based",
      "approach",
      "each",
      "https",
      "rectangles",
      "rectangle",
      "leaf",
      "dimension",
      "analyzer",
      "response_",
      "makes",
      "parallel",
      "rendering",
      "more",
      "robust"
    ]
  },
  {
    "diagram": "packet",
    "keywords": [
      "bit",
      "bits",
      "packet",
      "start",
      "name",
      "new",
      "data",
      "update",
      "use",
      "approach",
      "makes",
      "count",
      "well",
      "end",
      "field",
      "where",
      "based",
      "class-based",
      "parallel",
      "rendering"
    ]
  },
  {
    "diagram": "timeline",
    "keywords": [
      "timeline",
      "response_",
      "you",
      "https",
      "file",
      "mermaid-js",
      "lib",
      "node_modules",
      "description",
      "are",
      "reproduce",
      "sample",
      "text",
      "additional",
      "context",
      "version",
      "not",
      "steps",
      "screenshots",
      "com"
    ]
  },
  {
    "diagram": "pie",
    "keywords": [
      "pie",
      "chart",
      "https",
      "response_",
      "you",
      "slice",
      "label",
      "negative",
      "not",
      "com",
      "title",
      "version",
      "see",
      "describe",
      "values",
      "description",
      "reproduce",
      "screenshots",
      "browser",
      "chrome"
    ]
  },
  {
    "diagram": "stateDiagram",
    "keywords": [
      "state",
      "https",
      "com",
      "composite",
      "not",
      "github",
      "reproduce",
      "statediagram-v2",
      "you",
      "like",
      "statediagram",
      "screenshots",
      "response_",
      "version",
      "mermaid-js",
      "live",
      "image",
      "syntax",
      "user-images",
      "githubusercontent"
    ]
  }
];
  const SUGGESTIONS = [
  {
    "id": "suggest.sequence.bidirectional_autonumber",
    "applies_to": [
      "sequenceDiagram"
    ],
    "description": "autonumber + <<->> renders poorly; recommend splitting into two directional messages.",
    "keywords": [
      "autonumber",
      "bidirectional",
      "<<->>"
    ],
    "suggest_fix": "Replace `A<<->>B: msg` with `A->>B: msg` and an immediate `B-->>A: ack`.",
    "source": "compiled"
  },
  {
    "id": "suggest.flow.elk_graph_word",
    "applies_to": [
      "flowchart"
    ],
    "description": "When flowchart.defaultRenderer=elk, node text 'graph' may parse as a keyword.",
    "keywords": [
      "elk",
      "defaultRenderer",
      "graph"
    ],
    "suggest_fix": "Wrap node labels containing the word `graph` in backticks or quotes, e.g., `[\"graph\"]`.",
    "source": "compiled"
  },
  {
    "id": "suggest.gantt.excludes_datetime",
    "applies_to": [
      "gantt"
    ],
    "description": "excludes with 'YYYY-MM-DD HH:mm:ss' may be ignored.",
    "keywords": [
      "excludes",
      "dateFormat"
    ],
    "suggest_fix": "Use date-only excludes or align excludes to start-of-day; alternatively split the task range.",
    "source": "compiled"
  }
];
  return { suggestAndFix };
})();
