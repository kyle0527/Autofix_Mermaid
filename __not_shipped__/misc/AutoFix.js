// js/AutoFix.js (V4) - ES6-only, ASCII-only
// Public API stays the same: AutoFix.run(text, opts); and named export: fixCode.

const AutoFix = (() => {
  // ===== Utils =====
  const ID_OK = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const INVIS = /[\u200B-\u200D\uFEFF]/g;

  const isBlank = (l) => !l || /^\s*(%%.*)?$/.test(l);
  const linesOf = (t) => t.replace(/\r\n?/g, "\n").split("\n");
  const join = (a) => a.join("\n");

  // Fullwidth to ASCII map (selected punctuation only)
  const FW = {
    "\uFF1A": ":", "\uFF0C": ",", "\uFF08": "(", "\uFF09": ")",
  //     "\u3002": ".", "\uFF1B": ";", "\u3001": ",", "\uFF01": "!",
    "\u3002": ".", "\uFF1B": ";", "\u3001": ",", "\uFF01": "!",
  // [專案架構變換指南]
  // V3.3 架構
  // autofix_mermaidV3.3/
  //   index.html
  //   css/
  //   js/
  //     UI.js
  //     worker.js
  // V3.4 架構
  // autofix_mermaidV3.4/
  //   index.html
  //   css/
  //   js/
  //     UI.js
  //     worker.js
  // V3.5 架構
  // autofix_mermaidV3.5/
  //   index.html
  //   css/
  //   js/
  //     UI.js
  //     worker.js
  //     rules/
  //       registry.json
  //       index.js
  //     tests/
  //       cases/
  //         0001_class_whitespace.json
  //         0002_flow_elk_order.json
  //         0003_gantt_excludes.json
  //         0004_pie_zero_negative.json
  //       schema.json
  //       run.js
  // [V3.5 主要調整紀錄]
  // 1. 題庫格式全面採用 JSON Schema 驗證（schema.json），確保每題完整性。
  // 2. 四個題庫檔案（cases/*.json）皆為可程式化驗證格式，支援 renderOk、contains、errorIncludes、ruleSuggestion 等。
  // 3. 規則庫結構調整為 registry.json（陣列）+ index.js（API 實作），支援自動去重與新增。
  // 4. worker.js 增加測試執行器，支援 normalizeSvg、runOneCase、runIssueCases 訊息，與 UI/AI 協作。
  // 5. run.js 實作題庫批次執行，UI 可呼叫 worker 跑所有題目並顯示結果。
  // 6. 所有調整均已納入本次專案結構與指南。
    "\u3002": ".", "\uFF1B": ";", "\u3001": ",", "\uFF01": "!",
    "\uFF1F": "?", "\uFF02": "\"", "\uFF07": "'", "\uFF5C": "|",
    "\uFF3B": "[", "\uFF3D": "]", "\uFF5B": "{", "\uFF5D": "}",
    "\uFF1D": "=", "\uFF0B": "+", "\uFF0D": "-", "\uFF1C": "<",
    "\uFF1E": ">", "\u3000": " ", "\u2026": "..."
  };

  const stripInvisible = (s) => s.replace(INVIS, "");
  const asciiPunct = (s) => s.replace(/[\u3000-\u303F\uFF00-\uFFEF]/g, (ch) => (FW[ch] !== undefined ? FW[ch] : ch));

  const htmlEscapeExceptBR = (s) => s
    .replace(/&(?!#\d+;|#x[0-9a-fA-F]+;|amp;|lt;|gt;|quot;|apos;)/g, "&amp;")
    .replace(/<(?!br\s*\/?>)/gi, "&lt;")
    .replace(/>/g, "&gt;");

  const legalizeId = (id, used) => {
    let s = id.replace(/[^\w]/g, "_");
    if (!/^[A-Za-z_]/.test(s)) s = "_" + s;
    s = s.replace(/_+/g, "_");
    if (/^_+$/.test(s)) s = "_node";
    const base = s; let i = 1;
    while (used.has(s)) s = base + "_" + (i++);
    used.add(s);
    return s;
  };

  const isEdge = (ln) =>
    /--[->x.]/.test(ln) && !/^\s*(classDef|linkStyle|style|click)\b/.test(ln.trim());

  const parseEdge = (ln) => {
    const m = ln.match(/^\s*([A-Za-z0-9_."()\[\]<>:-]+)\s*-{2,}[^>]*>\s*([^\s]+)\s*/);
    if (!m) return null;
    const src = m[1].replace(/[\[\(].*$/, "");
    const dst = m[2].replace(/[\[\(].*$/, "");
    return { src, dst };
  };

  // ===== Init directive repair =====
  function repairInitDirectives(raw, opts, log, errors){
    if (!opts || !opts.initRepair) return raw;
    const re = /%%\s*\{\s*init\s*:\s*([\s\S]*?)\s*\}\s*%%/gmi;
    let out = "", last = 0, m, idx = 1;
    while ((m = re.exec(raw))) {
      out += raw.slice(last, m.index);
      let s = m[1];
      s = asciiPunct(s);
      // remove comments and trailing commas
      s = s.replace(/\/\*[\s\S]*?\*\//g, "");
      s = s.replace(/(^|[^:])\/\/.*$/gm, "$1");
      s = s.replace(/,(\s*[}\]])/g, "$1");
      // quote keys and single-quoted strings
      s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, "\"$1\"");
      s = s.replace(/([{\s,])([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, function(_,$1,$2){ return $1 + "\"" + $2 + "\":"; });
      // quote bare string values
      const bare = new Set(["true","false","null"]);
      s = s.replace(/:\s*([A-Za-z_][A-Za-z0-9_-]*)\s*([,}\]])/g, function(_,$1,$2){ return bare.has($1) ? ": " + $1 + $2 : ": \"" + $1 + "\"" + $2; });
      let ok=false, comp="";
      try { const parsed = JSON.parse("{" + s + "}"); comp = JSON.stringify(parsed); ok=true; } catch(e){ ok=false; }
      if (ok) { out += "%%{init: " + comp + "}%%"; log.push({rule:"init.repair", msg:"fixed init #"+idx}); }
      else { if (opts.initFailClosed) { out += "%% invalid init removed %%"; errors.push({type:"init.invalid", msg:"commented"}); } else { out += raw.slice(m.index, re.lastIndex); } }
      last = re.lastIndex; idx++;
    }
    out += raw.slice(last);
    return out;
  }

  // ===== Detect type =====
  function detectType(text){
    const t = text.trim();
    const m = t.match(/^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|quadrantChart|gitGraph|timeline|mindmap|sankey|xychart(?:-beta)?)\b/i);
    if (m) return m[1].toLowerCase().replace("xychart-beta","xychart");
    if (/\bsequenceDiagram\b/i.test(text)) return "sequencediagram";
    if (/\bgantt\b/i.test(text)) return "gantt";
    if (/\bpie\b/i.test(text)) return "pie";
    if (/\bmindmap\b/i.test(text)) return "mindmap";
    return "";
  }

  // ===== Passes =====
  function pass_header(lines, log, dtype){
    const first = lines.find((l)=>!isBlank(l));
    const re = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|quadrantChart|gitGraph|timeline|mindmap|sankey|xychart)\b/i;
    if (!first || !re.test(first.trim())){
      const head = (
        dtype==="sequencediagram" ? "sequenceDiagram" :
        dtype==="classdiagram" ? "classDiagram" :
        dtype==="statediagram" ? "stateDiagram" :
        dtype==="erdiagram" ? "erDiagram" :
        dtype==="gantt" ? "gantt" :
        dtype==="pie" ? "pie" :
        dtype==="mindmap" ? "mindmap" :
        dtype==="xychart" ? "xychart" :
        "flowchart LR"
      );
      lines.unshift(head);
      log.push({rule:"header.add", msg:"add header "+head});
    }
    return {lines,log};
  }

  function pass_keywords_case(lines, log){
    let changed = false;
    const out = lines.map((l) => l.replace(/\b(flowchart|graph|subgraph|end|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey|quadrantChart|gitGraph|timeline|mindmap|sankey|xychart|loop|alt|opt|par|critical|break|box|rect|else)\b/g,
      function(m){ const k=m.toLowerCase(); if(k!==m) changed=true; return k; }));
    if (changed) log.push({rule:"keyword.case", msg:"lower-case keywords"});
    return {lines:out,log};
  }

  function pass_protect_end_in_text(lines, log){
    let changed=false;
    const out = lines.map(function(ln){
      if (/^\s*end\s*$/i.test(ln)) return ln;
      const s = ln
        .replace(/:\s*end\s*$/i, ': "end"')
        .replace(/\[\s*end\s*\]/ig, '["end"]');
      if (s!==ln) changed=true;
      return s;
    });
    if (changed) log.push({rule:"label.end", msg:'quote bare "end"'});
    return {lines:out,log};
  }

  function pass_illegal_ids(lines, log){
    const out=[]; const used=new Set();
    for (let i=0;i<lines.length;i++){
      let ln=lines[i];
      const m = ln.match(/^\s*([A-Za-z_][\w-]*)\s*[\[(\{]/);
      if (m){
        const id = m[1];
        if (!ID_OK.test(id)){
          const legal = legalizeId(id, used);
          const re = new RegExp("(^|\\W)"+id+"(\\W|$)", "g");
          ln = ln.replace(re, "$1"+legal+"$2");
          log.push({rule:"id.fix", msg:"ID "+id+" -> "+legal, line:i+1});
        } else {
          used.add(id);
        }
      }
      out.push(ln);
    }
    return {lines:out,log};
  }

  function normalize_arrows(lines, log){
    let changed=false;
    const out = lines.map(function(ln){
      let s=ln;
      s = s.replace(/-\.\-+>/g, "-.->");
      s = s.replace(/-{3,}(?=>)/g, "--");
      s = s.replace(/-+>/g, "->");
      s = s.replace(/-x+>/g, "-x>");
      s = s.replace(/->>+/g, "->>");
      if (s!==ln) changed=true;
      return s;
    });
    if (changed) log.push({rule:"arrows", msg:"normalize arrows"});
    return {lines:out,log};
  }

  // Escape within all kinds of labels and protect parens in [ ... ]
  function escapeParensInRectLabels(line){
    let out="", i=0;
    while(true){
      const a=line.indexOf("[", i); if(a<0){ out+=line.slice(i); break; }
      out+=line.slice(i, a+1);
      let depth=1, j=a+1, inQ=false, qc="";
      for(; j<line.length; j++){
        const ch=line[j];
        if(inQ){ if(ch===qc) inQ=false; continue; }
        if(ch==="\"" || ch==="'"){ inQ=true; qc=ch; continue; }
        if(ch==="[") depth++;
        else if(ch==="]"){ depth--; if(depth===0) break; }
      }
      let content = line.slice(a+1, j);
        content = content.replace(/\n/g,"<br/>").replace(/<br\s*\/?>/gi,"<br/>");
     const t = content.trim(); // Ensure proper syntax with a colon
      // Replace fullwidth colon with ASCII colon
      content = content.replace(/\uFF1A/g, ":");
      const looksCylinder = t.startsWith("(") && t.endsWith(")");
      if (!looksCylinder){
        content = content.replace(/\(/g,"&#40;").replace(/\)/g,"&#41;");
      }
      out += htmlEscapeExceptBR(content) + "]";
      i = j+1;
    }
    return out;
  }

  function fix_flowchart_labelEsc(lines, log, errors){
    let changed=false;
    const out = lines.map(function(ln){
      // Only process lines that look like node defs or edges with labels
      if (/^\s*[A-Za-z_][\w-]*\s*[\[(\{]/.test(ln) || isEdge(ln)){
        // escape all three label kinds; keep <br/>; protect () in [ ... ]
        let s = ln;
        // Stray ']' at end of edge lines without '[' in the line
        const t = s.trimEnd();
        if (isEdge(s) && t.endsWith("]") && s.indexOf("[") < 0){
          s = s.replace(/\]+\s*$/, ""); changed=true; log.push({rule:"label.strayRB", msg:"remove stray ] at EOL"});
        }
        // Escape parens inside [ ... ] (cylinder safe) and escape HTML keeping <br/>
        s = escapeParensInRectLabels(s);
        // Also escape inside (...) and {...} regions
        s = s.replace(/\(([^)]*)\)/g, function(_,$1){ return "(" + htmlEscapeExceptBR($1.replace(/\\n/g,"<br/>")) + ")"; });
        s = s.replace(/\{([^}]*)\}/g, function(_,$1){ return "{" + htmlEscapeExceptBR($1.replace(/\\n/g,"<br/>")) + "}"; });
        if (s!==ln) changed=true;
        return s;
      }
      return ln;
    });
    if (changed) log.push({rule:"flowchart.labelEsc", msg:"escape labels; keep <br/>; protect () inside [..]"});
    return {lines:out,log,errors};
  }

  function pass_balance_blocks(lines, log, dtype){
    const out=[...lines];
    // subgraph balance
    let sub=0;
    for (const ln of out){
      const t=ln.trim().toLowerCase();
      if (t.startsWith("subgraph ")) sub++;
      else if (t==="end" && sub>0) sub--;
    }
    while (sub-- > 0) out.push("end");
    // sequence blocks
    if (dtype==="sequencediagram" || (/^\s*sequenceDiagram\b/i).test(out[0]||"")){
      const opener = /^(loop|alt|opt|par|critical|break|box|rect)\b/i;
      const stack=[];
      out.forEach(function(ln){
        const t=ln.trim();
        if (opener.test(t)) stack.push(1);
        else if (/^end\b/i.test(t)) { if (stack.length) stack.pop(); }
      });
      while (stack.length){ out.push("end"); stack.pop(); }
      log.push({rule:"sequence.end", msg:"balance sequence blocks"});
    }
    return {lines:out,log};
  }

  // Subgraph helpers
  function scanSubgraphs(lines){
    const names=new Set(); const indexes=[];
    lines.forEach(function(ln,i){
      const m = ln.match(/^\s*subgraph\s+(.+)$/i);
      if (m){ const name=m[1].trim(); names.add(name); indexes.push({name,line:i}); }
    });
    return {names,indexes};
  }

  function subgraphHub(lines, log){
    const {names,indexes} = scanSubgraphs(lines);
    if (!names.size) return {lines,log};
    const out=[...lines];
    const hubs = new Map();
    function hubOf(name){
      if (!hubs.has(name)) hubs.set(name, legalizeId(name,new Set()) + "_HUB");
      return hubs.get(name);
    }
    for (let i=0;i<out.length;i++){
      const ln = out[i]; if (!isEdge(ln)) continue;
      const e = parseEdge(ln); if (!e) continue;
      for (const side of ["src","dst"]){
        if (names.has(e[side])){
          const hub = hubOf(e[side]);
          out[i] = out[i].replace(new RegExp("\\b"+e[side]+"\\b","g"), hub);
          const found = indexes.find(function(x){ return x.name===e[side]; });
          if (found){
            const insertAt = found.line+1;
            if (!out.slice(insertAt, insertAt+4).some(function(x){ return x.indexOf(hub)>=0; })){
              out.splice(insertAt, 0, "  "+hub+'[""] %% hub for subgraph');
              if (i>=insertAt) i++;
            }
          }
          log.push({rule:"subgraph.hub", msg:"replace subgraph endpoint with hub"});
        }
      }
    }
    return {lines:out,log};
  }

  function moveCrossEdges(lines, log){
    let cur=null; const owner=new Map(); const out=[]; const moved=[];
    for (const ln of lines){
      const t=ln.trim();
      if (/^subgraph\b/i.test(t)){ cur=t.replace(/^subgraph\s+/i,"").trim(); out.push(ln); continue; }
      if (/^end\s*$/i.test(t)){ cur=null; out.push(ln); continue; }
      const m = ln.match(/^\s*([A-Za-z_][\w-]*)\s*[\[(\{]/);
      if (m){ const id=m[1]; if (!owner.has(id)) owner.set(id, cur); }
      if (isEdge(ln) && cur){
        const e = parseEdge(ln);
        if (e){
          const a=owner.get(e.src), b=owner.get(e.dst);
          if (a!==cur || b!==cur){
            moved.push(ln.trim()); out.push("%% moved: "+ln);
            log.push({rule:"edge.cross", msg:"move cross edge to global"});
            continue;
          }
        }
      }
      out.push(ln);
    }
    if (moved.length){ out.push("%% cross-subgraph edges"); moved.forEach(function(x){ out.push(x); }); }
    return {lines:out,log};
  }

  // Diagram-specific passes
  function pieRules(lines, log){
    const out=[]; let inPie=false;
    for (let ln of lines){
      const t=ln.trim();
      if (/^pie\b/i.test(t)){ inPie=true; out.push(ln); continue; }
      if (inPie){
        if (/^title\b/i.test(t) || !t){ out.push(ln); continue; }
        const m = t.match(/^"?.+?"?\s*:\s*([-+]?\d+(?:\.\d+)?)/);
        if (m){
          const val = parseFloat(m[1]);
          if (!(val>0)){ out.push("%% drop non-positive: "+ln); log.push({rule:"pie.value", msg:"drop non-positive value"}); continue; }
          if (!/^\s*"/.test(t)){ ln = ln.replace(/^\s*([^:]+):/,'  "$1":'); log.push({rule:"pie.quote", msg:"quoted label"}); }
        }
      }
      out.push(ln);
    }
    return {lines:out,log};
  }

  function ganttRules(lines, log){
    let inG=false, hasDF=false; const out=[];
    for (let ln of lines){
      const t=ln.trim();
      if (/^gantt\b/i.test(t)){ inG=true; out.push(ln); continue; }
      if (inG){
        if (/^dateFormat\b/i.test(t)) hasDF=true;
        if (/\bmilestone\b/i.test(t) && /,\s*\d+\s*[dwmy]\b/i.test(t)){
          ln = ln.replace(/,\s*\d+\s*[dwmy]\b/i, ", 0d"); log.push({rule:"gantt.milestone", msg:"set milestone to 0d"});
        }
      }
      out.push(ln);
    }
    if (inG && !hasDF){ out.splice(1,0,"  dateFormat YYYY-MM-DD"); log.push({rule:"gantt.dateFormat", msg:"insert default dateFormat"}); }
    return {lines:out,log};
  }

  function mindmapIndent(lines, log){
    let inM=false; const out=[];
    for (const raw of lines){
      const t = raw.replace(/\t/g,"    ");
      if (/^\s*mindmap\b/i.test(t)) inM=true;
      out.push(inM ? t.replace(/  +/g, function(m){ return " ".repeat(Math.min(m.length, 40)); }) : t);
    }
    if (inM) log.push({rule:"mindmap.indent", msg:"normalize indentation"});
    return {lines:out,log};
  }

  function quadrantClamp(lines, log){
    let inQ=false; const out=[];
    for (let ln of lines){
      const t=ln.trim();
      if (/^quadrantChart\b/i.test(t)){ inQ=true; out.push(ln); continue; }
      if (inQ){
        ln = ln.replace(/:\s*\[\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\]/g, function(_,$1,$2){
          const x = Math.max(0, Math.min(1, parseFloat($1)));
          const y = Math.max(0, Math.min(1, parseFloat($2)));
          return ": ["+x+", "+y+"]";
        });
      }
      out.push(ln);
    }
    return {lines:out,log};
  }

  function sankeyRules(lines, log){
    let inS=false; const out=[];
    for (let ln of lines){
      const t=ln.trim();
      if (/^sankey\b/i.test(t)){ inS=true; out.push(ln); continue; }
      if (inS && t && !/^%%/.test(t)){
        const parts = t.split(",").map(function(x){ return x.trim(); });
        if (parts.length < 3){ out.push("%% invalid sankey row: "+ln); log.push({rule:"sankey.cols", msg:"row skipped (needs 3 columns)"}); continue; }
        if (parts.length > 3){ ln = parts.slice(0,3).join(", "); log.push({rule:"sankey.cols", msg:"trim columns to 3"}); }
      }
      out.push(ln);
    }
    return {lines:out,log};
  }

  function xychartRules(lines, log){
    // Keep light to avoid over-fixing; only placeholder for now
    return {lines,log};
  }

  function fillUndefined(text, log){
    const ls = linesOf(text); const defined=new Set(), seen=new Set();
    ls.forEach(function(ln){
      const m = ln.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\b/); if (m) defined.add(m[1]);
      if (isEdge(ln)){ const e=parseEdge(ln); if (e){ seen.add(e.src); seen.add(e.dst); } }
    });
    const missing = Array.from(seen).filter(function(x){ return !defined.has(x); });
    if (missing.length){
      const inject = missing.map(function(id){ return id+"["+id+"]"; });
      const out = ls.slice();
      out.splice(1, 0, ...inject);
      log.push({rule:"node.missing", msg:"define "+missing.length+" nodes"});
      return join(out);
    }
    return join(ls);
  }

  // ===== Run pipeline =====
  function run(text, opts){
    const options = Object.assign({ initRepair:true, initFailClosed:true }, opts||{});
    let errors = [], log = [];

    // preflight
    let raw = stripInvisible(text);
    raw = asciiPunct(raw);
    raw = repairInitDirectives(raw, options, log, errors);

    // detect type and basic structure
    let dtype = detectType(raw);
    // if no type but edges present, assume graph
    ({ dtype, log } = fallbackGraphIfEdges(raw, dtype, log));

    let lines = linesOf(raw);
    ({lines,log} = pass_header(lines, log, dtype));
    ({lines,log} = pass_keywords_case(lines, log));
    ({lines,log} = pass_protect_end_in_text(lines, log));
    ({lines,log} = pass_illegal_ids(lines, log));
    ({lines,log} = normalize_arrows(lines, log));

    // flowchart/graph specifics
    if (dtype==="flowchart" || dtype==="graph" || dtype===""){
      ({lines,log,errors} = fix_flowchart_labelEsc(lines, log, errors));
      // subgraph helpers
      ({lines,log} = subgraphHub(lines, log));
      ({lines,log} = moveCrossEdges(lines, log));
    }

    // diagram-specific rules
    if (dtype==="pie") ({lines,log} = pieRules(lines, log));
    if (dtype==="gantt") ({lines,log} = ganttRules(lines, log));
    if (dtype==="mindmap") ({lines,log} = mindmapIndent(lines, log));
    if (dtype==="quadrantchart") ({lines,log} = quadrantClamp(lines, log));
    if (dtype==="sankey") ({lines,log} = sankeyRules(lines, log));
    if (dtype==="xychart") ({lines,log} = xychartRules(lines, log));

    ({lines,log} = pass_balance_blocks(lines, log, dtype));

    // finalize
    let code = join(lines);
    code = fillUndefined(code, log);

    return { code, errors, log, dtype: dtype || "flowchart" };
  }

  return { run };
})();

// ES6 named export for compatibility with UI.js
export const fixCode = AutoFix.run;

// Fallback: assume graph when edges but no header
function fallbackGraphIfEdges(raw, dtype, log){
  if (dtype) return { dtype, log };
  const edgeRe = /(?:-->|<-+|--x|==>|===|--\||\|-\-|\.-\.|-\.-+>)/m;
  if (edgeRe.test(raw)){
    log.push({rule:"assumeGraph", msg:"no header but edges detected -> assume graph"});
    return { dtype:"graph", log };
  }
  return { dtype, log };
}
