/* js/engine/rules.js */
const _EngineRules = (function(){
  const logs = [];
  const { guessDiagramType, applyRegexAll } = self.EngineCommon;
  // mark known-but-unused helpers as used to silence ESLint warnings
  void logs; void applyRegexAll;

  function applyRule(code, rule, dtypeGuess){
    let changed = false;
    let after = code;
    if (rule.detect && rule.detect.regex){
      const re = new RegExp(rule.detect.regex, 'm');
      if (!re.test(code)) return {code, changed:false, logs:[], dtypeGuess};
    }
    if (rule.fix && rule.fix.regex){
      const re = new RegExp(rule.fix.regex, 'gm');
      after = after.replace(re, rule.fix.replace);
      if (after !== code){
        changed = true;
      }
    }
    const l = {level:'info', rule:rule.id, msg: rule.description, confidence: rule.confidence||0.7};
    return {code: after, changed, logs:[l], dtypeGuess};
  }

  function applyAll(code, {diagram='auto', logs:ext=[]}={}){
    // silence unused param
    void ext;
    let out = code;
    const dtypeGuess = diagram==='auto' ? guessDiagramType(code) : diagram;
    const rules = RULES;
    const allLogs = [];
    for (const r of rules){
      if (r.applies_to.indexOf('unknown')<0 && dtypeGuess!=='unknown' && r.applies_to.indexOf(dtypeGuess)===-1){
        continue;
      }
      const res = applyRule(out, r, dtypeGuess);
      out = res.code;
      allLogs.push(...res.logs);
    }
    return {code: out, logs: allLogs, dtypeGuess};
  }

  // Embedded registry (generated)
  const RULES = [
  {
    "id": "fix.class.empty_braces_whitespace",
    "applies_to": [
      "classDiagram"
    ],
    "match": {
      "regex": "classDiagram"
    },
    "description": "Class with empty body requires whitespace between { } in certain mermaid versions.",
    "detect": {
      "regex": "class\\s+[`\\w:~<>]+\\s*\\{\\s*\\}"
    },
    "fix": {
      "regex": "(\\{\\s*\\})",
      "replace": "{ }"
    },
    "confidence": 0.85,
    "source": "compiled from known issues"
  },
  {
    "id": "fix.pie.negative_to_zero",
    "applies_to": [
      "pie"
    ],
    "match": {
      "regex": "\\npie\\b"
    },
    "description": "Pie slices must be ≥ 0. Replace negative values with 0.",
    "detect": {
      "regex": ":\\s*-\\d+"
    },
    "fix": {
      "regex": ":\\s*-(\\d+)",
      "replace": ": 0"
    },
    "confidence": 0.8,
    "source": "compiled from known issues"
  },
  {
    "id": "fix.normalize.line_endings",
    "applies_to": [
      "unknown",
      "flowchart",
      "classDiagram",
      "sequenceDiagram",
      "gantt",
      "erDiagram",
      "mindmap",
      "timeline",
      "pie",
      "stateDiagram",
      "block",
      "treemap",
      "packet",
      "architecture"
    ],
    "match": {
      "regex": ".*"
    },
    "description": "Normalize CRLF/LF to LF.",
    "detect": {
      "regex": "\\r\\n"
    },
    "fix": {
      "regex": "\\r\\n",
      "replace": "\n"
    },
    "confidence": 0.99,
    "source": "general"
  },
  {
    "id": "fix.trim.bom",
    "applies_to": [
      "unknown",
      "flowchart",
      "classDiagram",
      "sequenceDiagram",
      "gantt",
      "erDiagram",
      "mindmap",
      "timeline",
      "pie",
      "stateDiagram",
      "block",
      "treemap",
      "packet",
      "architecture"
    ],
    "match": {
      "regex": ".*"
    },
    "description": "Trim UTF-8 BOM at start of document.",
    "detect": {
      "regex": "^\\ufeff"
    },
    "fix": {
      "regex": "^\\ufeff",
      "replace": ""
    },
    "confidence": 0.99,
    "source": "general"
  }
];
  return { applyAll };
})();
