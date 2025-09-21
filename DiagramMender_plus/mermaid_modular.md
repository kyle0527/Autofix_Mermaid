### 1. py2mermaid.py :: def safe_id

```mermaid
%% py2mermaid.py :: def safe_id
flowchart TD
  n1["'Make a Mermaid-safe node id (alnum + underscores).'"]
  n2["s = re.sub('[^0-9A-Za-z_]', '_', s)"]
  n3{"if re.match('^\\d', s)"}
  n4["s = '_' + s"]
  n5["return s"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n3 -->|True| n4
  n2 --> n3
  n4 --> n5
  start --> n1
  n5 --> end
```

### 2. py2mermaid.py :: def iter_py_files

```mermaid
%% py2mermaid.py :: def iter_py_files
flowchart TD
  n1["ignores: List[str] = [i.strip() for i in ignore if i.strip()]"]
  n2["out: List[Path] = []"]
  n3{"for <ast.Tuple object at 0x7ed8c5273950> in os.walk(root)"}
  n4["dirnames[:] = [d for d in dirnames if d not in ignores and d != '__pycache__']"]
  n5{"for <ast.Name object at 0x7ed8c5272450> in filenames"}
  n6{"if fn.endswith('.py')"}
  n7["p = Path(dirpath) / fn"]
  n8{"if any((seg in ignores for seg in p.parts))"}
  n9["continue"]
  n10["out.append(p)"]
  n11{"if len(out) >= max_files"}
  n12["return out"]
  n13["return out"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n8 -->|True| n9
  n7 --> n8
  n9 --> n10
  n11 -->|True| n12
  n10 --> n11
  n6 -->|True| n7
  n5 -->|iter| n6
  n12 -->|next| n5
  n4 --> n5
  n3 -->|iter| n4
  n5 -->|next| n3
  n2 --> n3
  n3 --> n13
  start --> n1
  n13 --> end
```

### 3. py2mermaid.py :: def parse_module

```mermaid
%% py2mermaid.py :: def parse_module
flowchart TD
  n1["tree = ast.parse(src)"]
  n2["functions = []"]
  n3["classes = []"]
  n4["calls = set()"]
  n5{"for <ast.Name object at 0x7ed8c567c360> in ast.walk(tree)"}
  n6{"if isinstance(node, ast.FunctionDef)"}
  n7["collector = CallCollector()"]
  n8{"for <ast.Name object at 0x7ed8c567c660> in node.body"}
  n9["collector.visit(n)"]
  n10["functions.append({'name': node.name, 'lineno': getattr(node, 'lineno', None), 'calls': sorted(collector.calls), 'is_asyn"]
  n11["calls.update(collector.calls)"]
  n12{"if isinstance(node, ast.AsyncFunctionDef)"}
  n13["collector = CallCollector()"]
  n14{"for <ast.Name object at 0x7ed8c567d110> in node.body"}
  n15["collector.visit(n)"]
  n16["functions.append({'name': node.name, 'lineno': getattr(node, 'lineno', None), 'calls': sorted(collector.calls), 'is_asyn"]
  n17["calls.update(collector.calls)"]
  n18{"if isinstance(node, ast.ClassDef)"}
  n19["bases = []"]
  n20{"for <ast.Name object at 0x7ed8c50a6070> in node.bases"}
  n21{"if isinstance(b, ast.Name)"}
  n22["bases.append(b.id)"]
  n23{"if isinstance(b, ast.Attribute)"}
  n24["bases.append(b.attr)"]
  n25["bases.append(type(b).__name__)"]
  n26["join"]
  n27["join"]
  n28["methods = []"]
  n29{"for <ast.Name object at 0x7ed8c50a8350> in node.body"}
  n30{"if isinstance(n, ast.FunctionDef)"}
  n31["collector = CallCollector()"]
  n32{"for <ast.Name object at 0x7ed8c50a85f0> in n.body"}
  n33["collector.visit(bn)"]
  n34["methods.append({'name': n.name, 'lineno': getattr(n, 'lineno', None), 'calls': sorted(collector.calls)})"]
  n35["calls.update(collector.calls)"]
  n36["classes.append({'name': node.name, 'bases': bases, 'methods': methods, 'lineno': getattr(node, 'lineno', None)})"]
  n37["join"]
  n38["join"]
  n39["return {'functions': functions, 'classes': classes, 'calls': sorted(set(calls))}"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  n8 -->|iter| n9
  n9 -->|next| n8
  n7 --> n8
  n8 --> n10
  n10 --> n11
  n6 -->|True| n7
  n14 -->|iter| n15
  n15 -->|next| n14
  n13 --> n14
  n14 --> n16
  n16 --> n17
  n12 -->|True| n13
  n21 -->|True| n22
  n23 -->|True| n24
  n23 -->|False| n25
  n24 --> n26
  n25 --> n26
  n21 -->|False| n23
  n22 --> n27
  n26 --> n27
  n20 -->|iter| n21
  n27 -->|next| n20
  n19 --> n20
  n20 --> n28
  n32 -->|iter| n33
  n33 -->|next| n32
  n31 --> n32
  n32 --> n34
  n34 --> n35
  n30 -->|True| n31
  n29 -->|iter| n30
  n35 -->|next| n29
  n28 --> n29
  n29 --> n36
  n18 -->|True| n19
  n12 -->|False| n18
  n17 --> n37
  n36 --> n37
  n6 -->|False| n12
  n11 --> n38
  n37 --> n38
  n5 -->|iter| n6
  n38 -->|next| n5
  n4 --> n5
  n5 --> n39
  start --> n1
  n39 --> end
```

### 4. py2mermaid.py :: def analyze_project

```mermaid
%% py2mermaid.py :: def analyze_project
flowchart TD
  n1["ir: Dict[str, Dict] = {}"]
  n2{"for <ast.Name object at 0x7ed8c50af4c0> in paths"}
  n3["try"]
  n4["src = p.read_text(encoding='utf-8', errors='replace')"]
  n5["src = ''"]
  n6["join"]
  n7["ir[str(p)] = parse_module(src)"]
  n8["return ir"]
  start(("start"))
  end(("end"))
  n3 -->|body| n4
  n3 -->|except Exception| n5
  n4 --> n6
  n5 --> n6
  n6 --> n7
  n2 -->|iter| n3
  n7 -->|next| n2
  n1 --> n2
  n2 --> n8
  start --> n1
  n8 --> end
```

### 5. py2mermaid.py :: def build_mermaid

```mermaid
%% py2mermaid.py :: def build_mermaid
flowchart TD
  n1["lines = ['flowchart TD']"]
  n2["added_edges: Set[Tuple[str, str]] = set()"]
  n3{"for <ast.Tuple object at 0x7ed8c50b0060> in ir.items()"}
  n4["module_name = str(Path(fullpath).relative_to(root)) if root and str(fullpath).startswith(str(root)) else fullpath"]
  n5["mid = safe_id('mod_' + module_name.replace('/', '_').replace('\\', '_'))"]
  n6["lines.append(f'  subgraph {mid}['{html.escape(module_name)}']')"]
  n7{"for <ast.Name object at 0x7ed8c50b0bd0> in mod['classes']"}
  n8["cid = safe_id(f'{module_name}_class_{cls['name']}')"]
  n9["title = f'class {cls['name']}'"]
  n10{"if cls.get('bases')"}
  n11["title += ' : ' + ', '.join(cls['bases'])"]
  n12["lines.append(f'    {cid}['{html.escape(title)}']')"]
  n13{"for <ast.Name object at 0x7ed8c50b3510> in cls['methods']"}
  n14["fid = safe_id(f'{module_name}_{cls['name']}_{m['name']}')"]
  n15["label = m['name']"]
  n16["lines.append(f'    {fid}({html.escape(label)})')"]
  n17{"for <ast.Name object at 0x7ed8c50b4110> in m['calls']"}
  n18["to = safe_id(f'func_{callee}')"]
  n19{"if (fid, to) not in added_edges"}
  n20["lines.append(f'    {fid} --> {to}')"]
  n21["added_edges.add((fid, to))"]
  n22{"for <ast.Name object at 0x7ed8c50b4800> in mod['functions']"}
  n23["fid = safe_id(f'{module_name}_fn_{fn['name']}')"]
  n24["label = fn['name'] + (' (async)' if fn.get('is_async') else '')"]
  n25["lines.append(f'    {fid}({html.escape(label)})')"]
  n26{"for <ast.Name object at 0x7ed8c50b50d0> in fn['calls']"}
  n27["to = safe_id(f'func_{callee}')"]
  n28{"if (fid, to) not in added_edges"}
  n29["lines.append(f'    {fid} --> {to}')"]
  n30["added_edges.add((fid, to))"]
  n31["lines.append('  end')"]
  n32["seen_callees: Set[str] = set()"]
  n33{"for <ast.Name object at 0x7ed8c50b5a00> in ir.values()"}
  n34{"for <ast.Name object at 0x7ed8c50b5af0> in mod['functions']"}
  n35{"for <ast.Name object at 0x7ed8c50b5be0> in fn['calls']"}
  n36["seen_callees.add(callee)"]
  n37{"for <ast.Name object at 0x7ed8c50b5ee0> in mod['classes']"}
  n38{"for <ast.Name object at 0x7ed8c50b5fd0> in cls['methods']"}
  n39{"for <ast.Name object at 0x7ed8c50b60c0> in m['calls']"}
  n40["seen_callees.add(callee)"]
  n41{"for <ast.Name object at 0x7ed8c50b62a0> in sorted(seen_callees)"}
  n42["lines.append(f'  {safe_id('func_' + c)}{{{html.escape(c)}}}')"]
  n43["return '\n'.join(lines)"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n4 --> n5
  n5 --> n6
  n8 --> n9
  n10 -->|True| n11
  n9 --> n10
  n11 --> n12
  n14 --> n15
  n15 --> n16
  n20 --> n21
  n19 -->|True| n20
  n18 --> n19
  n17 -->|iter| n18
  n21 -->|next| n17
  n16 --> n17
  n13 -->|iter| n14
  n17 -->|next| n13
  n12 --> n13
  n7 -->|iter| n8
  n13 -->|next| n7
  n6 --> n7
  n23 --> n24
  n24 --> n25
  n29 --> n30
  n28 -->|True| n29
  n27 --> n28
  n26 -->|iter| n27
  n30 -->|next| n26
  n25 --> n26
  n22 -->|iter| n23
  n26 -->|next| n22
  n7 --> n22
  n22 --> n31
  n3 -->|iter| n4
  n31 -->|next| n3
  n2 --> n3
  n3 --> n32
  n35 -->|iter| n36
  n36 -->|next| n35
  n34 -->|iter| n35
  n35 -->|next| n34
  n39 -->|iter| n40
  n40 -->|next| n39
  n38 -->|iter| n39
  n39 -->|next| n38
  n37 -->|iter| n38
  n38 -->|next| n37
  n34 --> n37
  n33 -->|iter| n34
  n37 -->|next| n33
  n32 --> n33
  n41 -->|iter| n42
  n42 -->|next| n41
  n33 --> n41
  n41 --> n43
  start --> n1
  n43 --> end
```

### 6. py2mermaid.py :: def mend_mermaid

```mermaid
%% py2mermaid.py :: def mend_mermaid
flowchart TD
  n1["code = code.strip()"]
  n2{"if not code.startswith('flowchart')"}
  n3["code = 'flowchart TD\n' + code"]
  n4["code = code.replace('```', '')"]
  n5["code = re.sub('-{1,}>{1,}', '-->', code)"]
  n6["opens = len(re.findall('\\bsubgraph\\b', code))"]
  n7["ends = len(re.findall('^\\s*end\\s*$', code, flags=re.M))"]
  n8{"if ends < opens"}
  n9["code += '\n' + '\n'.join(['end'] * (opens - ends))"]
  n10["return code"]
  start(("start"))
  end(("end"))
  n2 -->|True| n3
  n1 --> n2
  n3 --> n4
  n4 --> n5
  n5 --> n6
  n6 --> n7
  n8 -->|True| n9
  n7 --> n8
  n9 --> n10
  start --> n1
  n10 --> end
```

### 7. py2mermaid.py :: def write_markdown

```mermaid
%% py2mermaid.py :: def write_markdown
flowchart TD
  n1["out_md.parent.mkdir(parents=True, exist_ok=True)"]
  n2["out_md.write_text(f'```mermaid\n{mermaid_code}\n```', encoding='utf-8')"]
  start(("start"))
  end(("end"))
  n1 --> n2
  start --> n1
  n2 --> end
```

### 8. py2mermaid.py :: def build_html

```mermaid
%% py2mermaid.py :: def build_html
flowchart TD
  n1["js = mermaid_js_path.read_text(encoding='utf-8', errors='replace')"]
  n2["escaped = html.escape(mermaid_code)"]
  n3["tpl = f'<!doctype html>\n<html>\n<head>\n  <meta charset='utf-8'/>\n  <meta name='viewport' content='width=device-width,"]
  n4["return tpl"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  start --> n1
  n4 --> end
```

### 9. py2mermaid.py :: def cli

```mermaid
%% py2mermaid.py :: def cli
flowchart TD
  n1["parser = argparse.ArgumentParser(description='Generate Mermaid flowcharts from a Python project.')"]
  n2["parser.add_argument('path', help='Path to Python project (directory)')"]
  n3["parser.add_argument('--out', default='mermaid.md', help='Output Markdown file (with ```mermaid block)')"]
  n4["parser.add_argument('--html', default=None, help='Optional output HTML preview file')"]
  n5["parser.add_argument('--max-files', type=int, default=500, help='Max number of .py files to scan')"]
  n6["parser.add_argument('--ignore', default='venv,.venv,site-packages,__pycache__', help='Comma-separated names to ignore')"]
  n7["args = parser.parse_args(argv)"]
  n8["root = Path(args.path).resolve()"]
  n9{"if not root.exists()"}
  n10["print(f'[ERROR] Path not found: {root}', file=sys.stderr)"]
  n11["sys.exit(2)"]
  n12["ignore = [s.strip() for s in args.ignore.split(',')]"]
  n13["files = iter_py_files(root, ignore, args.max_files)"]
  n14{"if not files"}
  n15["print('[WARN] No Python files found.', file=sys.stderr)"]
  n16["ir = analyze_project(files)"]
  n17["code = build_mermaid(ir, root=root)"]
  n18["code = mend_mermaid(code)"]
  n19["out_md = Path(args.out).resolve()"]
  n20["write_markdown(code, out_md)"]
  n21["print(f'[OK] Mermaid Markdown written: {out_md} ({out_md.stat().st_size} bytes)')"]
  n22{"if args.html"}
  n23["mermaid_js = BASE / 'mermaid.min.js'"]
  n24["html_str = build_html(code, mermaid_js)"]
  n25["out_html = Path(args.html).resolve()"]
  n26["out_html.write_text(html_str, encoding='utf-8')"]
  n27["print(f'[OK] HTML preview written: {out_html} ({out_html.stat().st_size} bytes)')"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  n4 --> n5
  n5 --> n6
  n6 --> n7
  n7 --> n8
  n10 --> n11
  n9 -->|True| n10
  n8 --> n9
  n11 --> n12
  n12 --> n13
  n14 -->|True| n15
  n13 --> n14
  n15 --> n16
  n16 --> n17
  n17 --> n18
  n18 --> n19
  n19 --> n20
  n20 --> n21
  n23 --> n24
  n24 --> n25
  n25 --> n26
  n26 --> n27
  n22 -->|True| n23
  n21 --> n22
  start --> n1
  n27 --> end
```

### 10. py2mermaid.py :: <module>

```mermaid
%% py2mermaid.py :: <module>
flowchart TD
  m1["'\npy2mermaid — Generate Mermaid flowcharts from a Python project folder.\n\nUsage:\n  python py2mermaid.py /path/to/pro"]
  m2["from __future__ import annotations"]
  m3["import os, ast, sys, argparse, re, html"]
  m4["from pathlib import Path"]
  m5["from typing import List, Tuple, Dict, Optional, Set"]
  m6["BASE = Path(__file__).resolve().parent"]
  m7{"if __name__ == '__main__'"}
  m8["cli()"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m3 --> m4
  m4 --> m5
  m5 --> m6
  m7 -->|True| m8
  m6 --> m7
  start --> m1
  m8 --> end
```

### 11. py2mermaid_v2.py :: <module>

```mermaid
%% py2mermaid_v2.py :: <module>
flowchart TD
  m1["'Thin CLI wrapper for diagram_mender CLI.'"]
  m2["from __future__ import annotations"]
  m3["from diagram_mender.cli import main"]
  m4{"if __name__ == '__main__'"}
  m5["raise SystemExit(main())"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m4 -->|True| m5
  m3 --> m4
  start --> m1
  m5 --> end
```

### 12. run_v3_then_combine.py :: def main

```mermaid
%% run_v3_then_combine.py :: def main
flowchart TD
  n1["ap = argparse.ArgumentParser()"]
  n2["ap.add_argument('path', help='Path to Python project directory')"]
  n3["ap.add_argument('--out-dir', default='out', help='Output directory')"]
  n4["ap.add_argument('--name', default='diagram', help='Base name for outputs')"]
  n5["args = ap.parse_args(argv)"]
  n6["out_dir = Path(args.out_dir).resolve()"]
  n7["out_dir.mkdir(parents=True, exist_ok=True)"]
  n8["md = out_dir / f'{args.name}.md'"]
  n9["mmd = out_dir / f'{args.name}.mmd'"]
  n10["html = out_dir / f'{args.name}.html'"]
  n11["py2_cli([args.path, '--out-md', str(md), '--out-mmd', str(mmd), '--out-html', str(html)])"]
  n12["print('[DONE] Outputs:')"]
  n13["print(' -', md)"]
  n14["print(' -', mmd)"]
  n15["print(' -', html)"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  n4 --> n5
  n5 --> n6
  n6 --> n7
  n7 --> n8
  n8 --> n9
  n9 --> n10
  n10 --> n11
  n11 --> n12
  n12 --> n13
  n13 --> n14
  n14 --> n15
  start --> n1
  n15 --> end
```

### 13. run_v3_then_combine.py :: <module>

```mermaid
%% run_v3_then_combine.py :: <module>
flowchart TD
  m1["'\nrun_v3_then_combine.py\nConvenience wrapper that generates Mermaid from a project and produces:\n- Markdown with ```m"]
  m2["from __future__ import annotations"]
  m3["import argparse"]
  m4["from pathlib import Path"]
  m5["from py2mermaid_v2 import cli as py2_cli"]
  m6{"if __name__ == '__main__'"}
  m7["main()"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m3 --> m4
  m4 --> m5
  m6 -->|True| m7
  m5 --> m6
  start --> m1
  m7 --> end
```

### 14. index.py :: def _parse_source

```mermaid
%% index.py :: def _parse_source
flowchart TD
  n1["tree = ast.parse(src)"]
  n2["functions = []"]
  n3["classes = []"]
  n4{"for <ast.Name object at 0x7ed8c50b37b0> in ast.walk(tree)"}
  n5{"if isinstance(node, ast.FunctionDef)"}
  n6["cc = _CallCollector()"]
  n7{"for <ast.Name object at 0x7ed8c50b34b0> in node.body"}
  n8["cc.visit(n)"]
  n9["functions.append({'name': node.name, 'calls': sorted(cc.calls)})"]
  n10{"if isinstance(node, ast.ClassDef)"}
  n11["methods = []"]
  n12{"for <ast.Name object at 0x7ed8c563e820> in node.body"}
  n13{"if isinstance(n, ast.FunctionDef)"}
  n14["cc = _CallCollector()"]
  n15{"for <ast.Name object at 0x7ed8c563ed60> in n.body"}
  n16["cc.visit(bn)"]
  n17["methods.append({'name': n.name, 'calls': sorted(cc.calls)})"]
  n18["classes.append({'name': node.name, 'methods': methods})"]
  n19["join"]
  n20["return {'functions': functions, 'classes': classes}"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n7 -->|iter| n8
  n8 -->|next| n7
  n6 --> n7
  n7 --> n9
  n5 -->|True| n6
  n15 -->|iter| n16
  n16 -->|next| n15
  n14 --> n15
  n15 --> n17
  n13 -->|True| n14
  n12 -->|iter| n13
  n17 -->|next| n12
  n11 --> n12
  n12 --> n18
  n10 -->|True| n11
  n5 -->|False| n10
  n9 --> n19
  n18 --> n19
  n4 -->|iter| n5
  n19 -->|next| n4
  n3 --> n4
  n4 --> n20
  start --> n1
  n20 --> end
```

### 15. index.py :: def parsePythonProject

```mermaid
%% index.py :: def parsePythonProject
flowchart TD
  n1["'Build a minimal IR from a mapping of filename->source.'"]
  n2["ir = {'modules': {}}"]
  n3{"for <ast.Tuple object at 0x7ed8c567c270> in files.items()"}
  n4["ir['modules'][name] = _parse_source(src)"]
  n5["return ir"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n3 -->|iter| n4
  n4 -->|next| n3
  n2 --> n3
  n3 --> n5
  start --> n1
  n5 --> end
```

### 16. index.py :: <module>

```mermaid
%% index.py :: <module>
flowchart TD
  m1["from __future__ import annotations"]
  m2["import ast"]
  m3["from typing import Dict, Any"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  start --> m1
  m3 --> end
```

### 17. test_ir_basic.py :: def test_simple_class

```mermaid
%% test_ir_basic.py :: def test_simple_class
flowchart TD
  n1["files = {'mod1.py': 'class A:\n    def foo(self):\n        pass\nclass B(A):\n    def bar(self):\n        self.foo()\n'}"]
  n2["ir = parsePythonProject(files)"]
  n3["assert 'mod1.py' in ir['modules']"]
  n4["mod = ir['modules']['mod1.py']"]
  n5["names = {c['name'] for c in mod['classes']}"]
  n6["assert names == {'A', 'B'}"]
  n7["b = [c for c in mod['classes'] if c['name'] == 'B'][0]"]
  n8["mnames = {m['name'] for m in b['methods']}"]
  n9["assert 'bar' in mnames"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  n4 --> n5
  n5 --> n6
  n6 --> n7
  n7 --> n8
  n8 --> n9
  start --> n1
  n9 --> end
```

### 18. test_ir_basic.py :: def test_simple_func

```mermaid
%% test_ir_basic.py :: def test_simple_func
flowchart TD
  n1["files = {'mod2.py': 'def hello():\n    print('hi')\n'}"]
  n2["ir = parsePythonProject(files)"]
  n3["mod = ir['modules']['mod2.py']"]
  n4["assert any((f['name'] == 'hello' for f in mod['functions']))"]
  n5["f = [f for f in mod['functions'] if f['name'] == 'hello'][0]"]
  n6["assert 'print' in f['calls']"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  n4 --> n5
  n5 --> n6
  start --> n1
  n6 --> end
```

### 19. test_ir_basic.py :: <module>

```mermaid
%% test_ir_basic.py :: <module>
flowchart TD
  m1["'\nUnit Test: Python IR Analysis (Basic Classes/Functions/Calls/Inheritance)\n'"]
  m2["from index import parsePythonProject"]
  m3{"if __name__ == '__main__'"}
  m4["test_simple_class()"]
  m5["test_simple_func()"]
  m6["print('All Python IR tests passed.')"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m4 --> m5
  m5 --> m6
  m3 -->|True| m4
  m2 --> m3
  start --> m1
  m6 --> end
```

### 20. __init__.py :: <module>

```mermaid
%% __init__.py :: <module>
flowchart TD
  m1["'Diagram Mender: AST→Mermaid utilities.'"]
  m2["__all__ = ['graph', 'flow', 'render', 'output', 'cli']"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  start --> m1
  m2 --> end
```

### 21. cli.py :: def main

```mermaid
%% cli.py :: def main
flowchart TD
  n1["ap = argparse.ArgumentParser(description='Generate Mermaid flowcharts from Python code')"]
  n2["ap.add_argument('target', help='A Python file or a directory to scan')"]
  n3["ap.add_argument('--out', default='mermaid.md', help='Output Markdown file (default: mermaid.md)')"]
  n4["ap.add_argument('--max-files', type=int, default=500, help='Scan at most this many Python files')"]
  n5["ap.add_argument('--ignore', default='venv,.venv,__pycache__,site-packages', help='Comma-separated ignore substrings')"]
  n6["args = ap.parse_args(argv)"]
  n7["ignore_list = [x.strip() for x in args.ignore.split(',') if x.strip()]"]
  n8["results = walk_and_render(args.target, max_files=args.max_files, ignore=ignore_list)"]
  n9["write_markdown(results, args.out)"]
  n10["print(f'Wrote {len(results)} flowcharts to {args.out}')"]
  n11["return 0"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n3 --> n4
  n4 --> n5
  n5 --> n6
  n6 --> n7
  n7 --> n8
  n8 --> n9
  n9 --> n10
  n10 --> n11
  start --> n1
  n11 --> end
```

### 22. cli.py :: <module>

```mermaid
%% cli.py :: <module>
flowchart TD
  m1["from __future__ import annotations"]
  m2["import argparse"]
  m3["from typing import List"]
  m4["from .render import walk_and_render"]
  m5["from .output import write_markdown"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m3 --> m4
  m4 --> m5
  start --> m1
  m5 --> end
```

### 23. flow.py :: def _short_stmt

```mermaid
%% flow.py :: def _short_stmt
flowchart TD
  n1["try"]
  n2{"if hasattr(ast, 'unparse')"}
  n3["return ast.unparse(s)"]
  n4["pass"]
  n5["join"]
  n6["return s.__class__.__name__"]
  start(("start"))
  end(("end"))
  n2 -->|True| n3
  n1 -->|body| n2
  n1 -->|except Exception| n4
  n3 --> n5
  n4 --> n5
  n5 --> n6
  start --> n1
  n6 --> end
```

### 24. flow.py :: def _expr

```mermaid
%% flow.py :: def _expr
flowchart TD
  n1{"if e is None"}
  n2["return ''"]
  n3["try"]
  n4{"if hasattr(ast, 'unparse')"}
  n5["return ast.unparse(e)"]
  n6["pass"]
  n7["join"]
  n8["return e.__class__.__name__"]
  start(("start"))
  end(("end"))
  n1 -->|True| n2
  n4 -->|True| n5
  n3 -->|body| n4
  n3 -->|except Exception| n6
  n5 --> n7
  n6 --> n7
  n2 --> n3
  n7 --> n8
  start --> n1
  n8 --> end
```

### 25. flow.py :: <module>

```mermaid
%% flow.py :: <module>
flowchart TD
  m1["from __future__ import annotations"]
  m2["import ast"]
  m3["from typing import List, Optional, Tuple"]
  m4["from .graph import Graph"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m3 --> m4
  start --> m1
  m4 --> end
```

### 26. graph.py :: def _sanitize

```mermaid
%% graph.py :: def _sanitize
flowchart TD
  n1["s = s.replace(''', ''').replace('\n', ' ').strip()"]
  n2["return s[:120]"]
  start(("start"))
  end(("end"))
  n1 --> n2
  start --> n1
  n2 --> end
```

### 27. graph.py :: <module>

```mermaid
%% graph.py :: <module>
flowchart TD
  m1["from __future__ import annotations"]
  m2["from dataclasses import dataclass, field"]
  m3["from typing import Dict, List, Optional"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  start --> m1
  m3 --> end
```

### 28. output.py :: def write_markdown

```mermaid
%% output.py :: def write_markdown
flowchart TD
  n1["os.makedirs(os.path.dirname(out_path), exist_ok=True) if os.path.dirname(out_path) else None"]
  n2["with open(out_path, 'w', encoding='utf-8')"]
  n3{"for <ast.Tuple object at 0x7ed8c50a8620> in enumerate(results, 1)"}
  n4["fh.write(f'### {i}. {title}\n\n')"]
  n5["fh.write('```mermaid\n')"]
  n6["fh.write(g.to_mermaid(title))"]
  n7["fh.write('\n```\n\n')"]
  start(("start"))
  end(("end"))
  n4 --> n5
  n5 --> n6
  n6 --> n7
  n3 -->|iter| n4
  n7 -->|next| n3
  n2 -->|enter| n3
  n1 --> n2
  start --> n1
  n3 --> end
```

### 29. output.py :: <module>

```mermaid
%% output.py :: <module>
flowchart TD
  m1["from __future__ import annotations"]
  m2["import os"]
  m3["from typing import List, Tuple"]
  m4["from .graph import Graph"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m3 --> m4
  start --> m1
  m4 --> end
```

### 30. render.py :: def render_file_to_graph

```mermaid
%% render.py :: def render_file_to_graph
flowchart TD
  n1["with open(path, 'r', encoding='utf-8', errors='ignore')"]
  n2["src = fh.read()"]
  n3["try"]
  n4["tree = ast.parse(src, filename=path)"]
  n5["g = Graph()"]
  n6["g.add_node('err', f'SyntaxError: {se.msg} @ {se.lineno}:{se.offset}')"]
  n7["return [(f'{os.path.basename(path)} :: SyntaxError', g)]"]
  n8["join"]
  n9["results: List[Tuple[str, Graph]] = []"]
  n10{"for <ast.Name object at 0x7ed8c5197180> in tree.body"}
  n11{"if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))"}
  n12["title = f'{os.path.basename(path)} :: def {node.name}'"]
  n13["g = Graph()"]
  n14["fb = FlowBuilder(g, prefix='n')"]
  n15["e, x = fb.build_block(node.body)"]
  n16["start = g.add_node('start', 'start', 'circle')"]
  n17["end = g.add_node('end', 'end', 'circle')"]
  n18["g.add_edge('start', e)"]
  n19["g.add_edge(x, 'end')"]
  n20["results.append((title, g))"]
  n21["top_statements = [n for n in tree.body if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]"]
  n22{"if top_statements"}
  n23["g = Graph()"]
  n24["fb = FlowBuilder(g, prefix='m')"]
  n25["e, x = fb.build_block(top_statements)"]
  n26["start = g.add_node('start', 'module start', 'circle')"]
  n27["end = g.add_node('end', 'module end', 'circle')"]
  n28["g.add_edge('start', e)"]
  n29["g.add_edge(x, 'end')"]
  n30["results.append((f'{os.path.basename(path)} :: <module>', g))"]
  n31["return results"]
  start(("start"))
  end(("end"))
  n1 -->|enter| n2
  n3 -->|body| n4
  n5 --> n6
  n6 --> n7
  n3 -->|except SyntaxError| n5
  n4 --> n8
  n7 --> n8
  n2 --> n3
  n8 --> n9
  n12 --> n13
  n13 --> n14
  n14 --> n15
  n15 --> n16
  n16 --> n17
  n17 --> n18
  n18 --> n19
  n19 --> n20
  n11 -->|True| n12
  n10 -->|iter| n11
  n20 -->|next| n10
  n9 --> n10
  n10 --> n21
  n23 --> n24
  n24 --> n25
  n25 --> n26
  n26 --> n27
  n27 --> n28
  n28 --> n29
  n29 --> n30
  n22 -->|True| n23
  n21 --> n22
  n30 --> n31
  start --> n1
  n31 --> end
```

### 31. render.py :: def walk_and_render

```mermaid
%% render.py :: def walk_and_render
flowchart TD
  n1["ignore = [i.strip() for i in ignore or [] if i.strip()]"]
  n2["results: List[Tuple[str, Graph]] = []"]
  n3["count = 0"]
  n4{"if os.path.isfile(root) and root.endswith('.py')"}
  n5["return render_file_to_graph(root)"]
  n6{"for <ast.Tuple object at 0x7ed8c50af970> in os.walk(root)"}
  n7["dirnames[:] = [d for d in dirnames if not any((ig in os.path.join(dirpath, d) for ig in ignore))]"]
  n8{"for <ast.Name object at 0x7ed8c50b03f0> in sorted(filenames)"}
  n9{"if not fn.endswith('.py')"}
  n10["continue"]
  n11["fpath = os.path.join(dirpath, fn)"]
  n12{"if any((ig in fpath for ig in ignore))"}
  n13["continue"]
  n14["results.extend(render_file_to_graph(fpath))"]
  n15["count += 1"]
  n16{"if count >= max_files"}
  n17["return results"]
  n18["return results"]
  start(("start"))
  end(("end"))
  n1 --> n2
  n2 --> n3
  n4 -->|True| n5
  n3 --> n4
  n9 -->|True| n10
  n10 --> n11
  n12 -->|True| n13
  n11 --> n12
  n13 --> n14
  n14 --> n15
  n16 -->|True| n17
  n15 --> n16
  n8 -->|iter| n9
  n17 -->|next| n8
  n7 --> n8
  n6 -->|iter| n7
  n8 -->|next| n6
  n5 --> n6
  n6 --> n18
  start --> n1
  n18 --> end
```

### 32. render.py :: <module>

```mermaid
%% render.py :: <module>
flowchart TD
  m1["from __future__ import annotations"]
  m2["import ast, os"]
  m3["from typing import List, Tuple, Optional"]
  m4["from .graph import Graph"]
  m5["from .flow import FlowBuilder"]
  start(("module start"))
  end(("module end"))
  m1 --> m2
  m2 --> m3
  m3 --> m4
  m4 --> m5
  start --> m1
  m5 --> end
```

