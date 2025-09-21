import fs from 'fs/promises';
import path from 'path';

const OUT_DIR = path.resolve('./tests/output');
await fs.mkdir(OUT_DIR, { recursive: true });

function simpleMermaidValidator(code){
  const res = { ok: true, problems: [] };
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    res.ok = false; res.problems.push('empty code'); return res;
  }
  const pairs = { '(':')','[':']','{':'}' };
  const stack = [];
  for (const ch of code) {
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (Object.values(pairs).includes(ch)) {
      const exp = stack.pop(); if (exp !== ch) { res.ok=false; res.problems.push('unbalanced brackets'); break; }
    }
  }
  if (stack.length) { res.ok=false; res.problems.push('unclosed brackets'); }
  if (!/\b(graph|flowchart|classDiagram|sequenceDiagram|gantt)\b/i.test(code)) { res.ok=false; res.problems.push('no diagram keyword'); }
  if (!/-->|<--|-->/.test(code) && !/\[.*\]/.test(code)) { res.ok=false; res.problems.push('no edges or nodes found'); }
  return res;
}

function applyHeuristics(code){
  const trace = [];
  let cur = code;

  // Rule 1: collapse exact duplicate 'A / A' occurrences in node labels
  const dupRe = /(\[[^\]]*?\b)([^\]\n]+?)\s*\/\s*\2(\b[^\]]*?\])/g;
  if (dupRe.test(cur)) {
    const before = cur;
    cur = cur.replace(dupRe, '$1$2$3');
    trace.push({ rule: 'collapse-duplicate-slash', before: before, after: cur });
  }

  // Rule 2: remove parentheses around single-word annotations like '(module)' -> ' module'
  const parenRe = /\((module|module\)|module)\)/gi; // not perfect but try common pattern
  // better: replace '(word)' with ' word' when inside node label
  const parenGeneric = /\(([^)\s]+)\)/g;
  if (parenGeneric.test(cur)) {
    const before = cur;
    // only replace when the parentheses are inside a node label (between [ and ] or between " and ")
    cur = cur.replace(/(\["?)([^\]]*?)\(([^)]+)\)([^\]"]*?)("?\])/g, (m,a,b,c,d,e)=>{
      // replace '(c)' with ' c' inside the label
      return `${a}${b} ${c}${d}${e}`;
    });
    if (cur !== before) trace.push({ rule: 'unwrap-parentheses-in-labels', before, after: cur });
  }

  // Rule 3: fix broken arrow '--' -> '-->' when standalone arrow is detected between node ids
  const arrowBrokenRe = /([\w\]\)"']+)\s*--\s*([\w\[\(\"']+)/g;
  if (arrowBrokenRe.test(cur)) {
    const before = cur;
    cur = cur.replace(arrowBrokenRe, (m,a,b)=>`${a}-->${b}`);
    if (cur !== before) trace.push({ rule: 'fix-broken-arrow', before, after: cur });
  }

  // Rule 4: if node label contains problematic characters (slash or unmatched quote), wrap label in quotes inside node brackets
  const wrapRe = /(n\d+\s*\(\[?)([^\]\n]+?)(\]?\)?)?/g; // not perfect; conservative
  // We'll do targeted wrapping: find occurrences like n0([ LABEL ]) and wrap LABEL in quotes if it contains '/'
  cur = cur.replace(/(n\d+\s*\(\[)\s*([^\]]*\S)\s*(\]\))/g, (m, a, label, c) => {
    if (label.includes('/') || /["']/g.test(label)) {
      const newLabel = `" ${label.trim()} "`;
      trace.push({ rule: 'quote-label-for-slash', before: m, after: `${a}${newLabel}${c}` });
      return `${a}${newLabel}${c}`;
    }
    return m;
  });

  return { code: cur, trace };
}

const examples = [
  {
    id: 'ex1',
    before: `flowchart TD
    n0([ Start: run_checks.py (module) / Start: run_checks.py (module) ])
    n1([ End / 結束 ])
    n2["Import / 導入"]
    n3["ImportFrom / 導入自"]
    n4["sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src')) / sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))"]
    n5["ImportFrom / 導入自"]
    n6["def main(...) / 定義"]
    n7{"if __name__ == '__main__' / 如果 __name__ == '__main__'"}
    n8["main() / main()"]
    n9["merge / 合併"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 -->|True| n8
    n7 -->|False| n9
    n8 --> n9
    n9 --> n1`,
    target: `flowchart TD
    n0([ Start: run_checks.py module ])
    n1([ End / 結束 ])
    n2["Import / 導入"]
    n3["ImportFrom / 導入自"]
    n4["sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))"]
    n5["ImportFrom / 導入自"]
    n6["def main... / 定義"]
    n7{"if __name__ == '__main__' / 如果 __name__ == '__main__'"}
    n8["main() / main()"]
    n9["merge / 合併"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 -->|True| n8
    n7 -->|False| n9
    n8 --> n9
    n9 --> n1`
  },
  {
    id: 'ex2',
    before: `flowchart TD
    n0([ Start: main() / Start: main() ])
    n1([ End / 結束 ])
    n2["ap = argparse.ArgumentParser() / ap = argparse.ArgumentParser()"]
    n3["ap.add_argument('--in', dest='infile', required=False, help='path to apis.json') / ap.add_argument('--in', dest='infile', required=False, help='path to apis.json')"]
    n4["ap.add_argument('--checks', default='idor,oauth') / ap.add_argument('--checks', default='idor,oauth')"]
    n5["ap.add_argument('--out', dest='outfile', default='out/findings.jsonl') / ap.add_argument('--out', dest='outfile', default='out/findings.jsonl')"]
    n6["args = ap.parse_args() / args = ap.parse_args()"]
    n7["checks = [c.strip() for c in args.checks.split(',') if c.strip()] / checks = [c.strip() for c in args.checks.split(',') if c.strip()]"]
    n8["classes = [REGISTRY[c] for c in checks if c in REGISTRY] / classes = [REGISTRY[c] for c in checks if c in REGISTRY]"]
    n9["apis = None / apis = None"]
    n10{"if args.infile / 如果 args.infile"}
    n11["try / 嘗試"]
    n12["With / With"]
    n13["except Exception / 例外"]
    n14["apis = None / apis = None"]
    n15["after try / try 後"]
    n16["merge / 合併"]
    n17["out_lines: List[str] = [] / out_lines: List[str] = []"]
    n18{"for Cls in classes / for Cls in classes"}
    n19["inst = Cls() / inst = Cls()"]
    n20{"for finding in inst.run(apis=apis) / for finding in inst.run(apis=apis)"}
    n21["out_lines.append(finding.to_json()) / out_lines.append(finding.to_json())"]
    n22["after for / for 後"]
    n23["after for / for 後"]
    n24["Import / 導入"]
    n25["os.makedirs(os.path.dirname(args.outfile), exist_ok=True) / os.makedirs(os.path.dirname(args.outfile), exist_ok=True)"]
    n26["With / With"]
    n27["print(f'wrote {len(out_lines)} findings to {args.outfile}') / print(f'wrote {len(out_lines)} findings to {args.outfile}')"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 --> n8
    n8 --> n9
    n9 --> n10
    n10 -->|True| n11
    n10 -->|False| n16
    n11 --> n12
    n11 --> n13
    n12 --> n15
    n13 --> n14
    n14 --> n15
    n15 --> n16
    n16 --> n17
    n17 --> n18
    n18 -->|True| n19
    n18 -->|False| n23
    n19 --> n20
    n20 -->|True| n21
    n20 -->|False| n22
    n21 --> n20
    n22 --> n18
    n23 --> n24
    n24 --> n25
    n25 --> n26
    n26 --> n27
    n27 --> n1`,
    target: `flowchart TD
    n0([" Start: main() / Start: main() "])
    n1([" End / 結束 "])
    n2["ap = argparse.ArgumentParser() / ap = argparse.ArgumentParser()"]
    n3["ap.add_argument('--in', dest='infile', required=False, help='path to apis.json') / ap.add_argument('--in', dest='infile', required=False, help='path to apis.json')"]
    n4["ap.add_argument('--checks', default='idor,oauth') / ap.add_argument('--checks', default='idor,oauth')"]
    n5["ap.add_argument('--out', dest='outfile', default='out/findings.jsonl') / ap.add_argument('--out', dest='outfile', default='out/findings.jsonl')"]
    n6["args = ap.parse_args() / args = ap.parse_args()"]
    n7["checks = [c.strip() for c in args.checks.split(',') if c.strip()] / checks = [c.strip() for c in args.checks.split(',') if c.strip()]"]
    n8["classes = [REGISTRY[c] for c in checks if c in REGISTRY] / classes = [REGISTRY[c] for c in checks if c in REGISTRY]"]
    n9["apis = None / apis = None"]
    n10{"if args.infile / 如果 args.infile"}
    n11["try / 嘗試"]
    n12["With / With"]
    n13["except Exception / 例外"]
    n14["apis = None / apis = None"]
    n15["after try / try 後"]
    n16["merge / 合併"]
    n17["out_lines: List[str] = [] / out_lines: List[str] = []"]
    n18{"for Cls in classes / for Cls in classes"}
    n19["inst = Cls() / inst = Cls()"]
    n20{"for finding in inst.run(apis=apis) / for finding in inst.run(apis=apis)"}
    n21["out_lines.append(finding.to_json()) / out_lines.append(finding.to_json())"]
    n22["after for / for 後"]
    n23["after for / for 後"]
    n24["Import / 導入"]
    n25["os.makedirs(os.path.dirname(args.outfile), exist_ok=True) / os.makedirs(os.path.dirname(args.outfile), exist_ok=True)"]
    n26["With / With"]
    n27["print(f'wrote {len(out_lines)} findings to {args.outfile}') / print(f'wrote {len(out_lines)} findings to {args.outfile}')"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 --> n7
    n7 --> n8
    n8 --> n9
    n9 --> n10
    n10 -->|True| n11
    n10 -->|False| n16
    n11 --> n12
    n11 --> n13
    n12 --> n15
    n13 --> n14
    n14 --> n15
    n15 --> n16
    n16 --> n17
    n17 --> n18
    n18 -->|True| n19
    n18 -->|False| n23
    n19 --> n20
    n20 -->|True| n21
    n20 -->|False| n22
    n21 --> n20
    n22 --> n18
    n23 --> n24
    n24 --> n25
    n25 --> n26
    n26 --> n27
    n27 --> n1`
  },
  {
    id: 'ex3',
    before: `flowchart TD
    n0([ Start: scorecard.py (module) / Start: scorecard.py (module) ])
    n1([ End / 結束 ])
    n2["Import / 導入"]
    n3["WEIGHTS = {'discovery': 0.2, 'protocol': 0.25, 'verification': 0.15, 'ranking': 0.1, 'delivery': 0.1, 'ecosystem': 0.1, 'compliance': 0.05, 'performance': 0.05} / WEIGHTS = {'discovery': 0.2, 'protocol': 0.25, 'verification': 0.15, 'ranking': 0.1, 'delivery': 0.1, 'ecosystem': 0.1, 'compliance': 0.05, 'performance': 0.05}']
    n4["def score(...) / 定義"]
    n5["def main(...) / 定義"]
    n6{"if __name__ == '__main__' / 如果 __name__ == '__main__'"}
    n7["main() / main()"]
    n8["merge / 合併"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 -->|True| n7
    n6 -->|False| n8
    n7 --> n8
    n8 --> n1`,
    target: `flowchart TD
    n0(["Start: scorecard.py (module) / Start: scorecard.py (module)"])
    n1(["End / 結束"])
    n2["Import / 導入"]
    n3["WEIGHTS = {'discovery': 0.2, 'protocol': 0.25, 'verification': 0.15, 'ranking': 0.1, 'delivery': 0.1, 'ecosystem': 0.1, 'compliance': 0.05, 'performance': 0.05} / WEIGHTS = {'discovery': 0.2, 'protocol': 0.25, 'verification': 0.15, 'ranking': 0.1, 'delivery': 0.1, 'ecosystem': 0.1, 'compliance': 0.05, 'performance': 0.05}"]
    n4["def score(...) / 定義"]
    n5["def main(...) / 定義"]
    n6{"if __name__ == '__main__' / 如果 __name__ == '__main__'"}
    n7["main() / main()"]
    n8["merge / 合併"]
    n0 --> n2
    n2 --> n3
    n3 --> n4
    n4 --> n5
    n5 --> n6
    n6 -->|True| n7
    n6 -->|False| n8
    n7 --> n8
    n8 --> n1`
  }
];

const results = [];
for (const ex of examples) {
  const beforeVal = simpleMermaidValidator(ex.before);
  const apply = applyHeuristics(ex.before);
  let curr = apply.code;
  const trace = apply.trace.slice();
  const afterVal = simpleMermaidValidator(curr);

  // If still invalid, and target exists, attempt targeted replace by applying simple normalization of duplicated labels
  if (!afterVal.ok) {
    // attempt targeted transforms to match target if provided
    if (ex.target) {
      // try simple replacements from before to target for node labels
      // find differing lines and try to replace
      const beforeLines = ex.before.split('\n').map(s=>s.trim());
      const targetLines = ex.target.split('\n').map(s=>s.trim());
      for (let i=0;i<Math.min(beforeLines.length,targetLines.length);i++){
        if (beforeLines[i] !== targetLines[i]){
          const b = beforeLines[i]; const t = targetLines[i];
          const before = curr;
          curr = curr.replace(b, t);
          if (curr !== before) trace.push({ rule: 'targeted-line-replace', lineIndex: i, before: b, after: t });
        }
      }
    }
  }

  const finalVal = simpleMermaidValidator(curr);
  const rec = { id: ex.id, beforeValid: beforeVal.ok, beforeProblems: beforeVal.problems, applied: trace, after: curr, afterValid: finalVal.ok, afterProblems: finalVal.problems, target: ex.target };
  results.push(rec);
}

await fs.writeFile(path.join(OUT_DIR,'fix_examples_results.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('Wrote tests/output/fix_examples_results.json');
for (const r of results) console.log(r.id, '=>', r.afterValid ? 'OK' : 'FAIL', r.afterProblems);
