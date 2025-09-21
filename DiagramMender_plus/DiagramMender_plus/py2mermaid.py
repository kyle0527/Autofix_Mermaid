#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
py2mermaid — Generate Mermaid flowcharts from a Python project folder.

Usage:
  python py2mermaid.py /path/to/project --out mermaid.md [--html preview.html] [--max-files 500] [--ignore "venv,.venv,site-packages,__pycache__"]
"""
from __future__ import annotations
import os, ast, sys, argparse, re, html
from pathlib import Path
from typing import List, Tuple, Dict, Optional, Set

BASE = Path(__file__).resolve().parent

def safe_id(s: str) -> str:
    """Make a Mermaid-safe node id (alnum + underscores)."""
    s = re.sub(r"[^0-9A-Za-z_]", "_", s)
    if re.match(r"^\d", s):
        s = "_" + s
    return s

def iter_py_files(root: Path, ignore: List[str], max_files: int) -> List[Path]:
    ignores: List[str] = [i.strip() for i in ignore if i.strip()]
    out: List[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune ignored directories
        dirnames[:] = [d for d in dirnames if d not in ignores and d != "__pycache__"]
        for fn in filenames:
            if fn.endswith(".py"):
                p = Path(dirpath) / fn
                if any(seg in ignores for seg in p.parts):
                    continue
                out.append(p)
                if len(out) >= max_files:
                    return out
    return out

class CallCollector(ast.NodeVisitor):
    def __init__(self):
        self.calls: Set[str] = set()

    def visit_Call(self, node: ast.Call):
        name = None
        if isinstance(node.func, ast.Name):
            name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            name = node.func.attr
        if name:
            self.calls.add(name)
        self.generic_visit(node)

def parse_module(src: str) -> Dict:
    tree = ast.parse(src)
    functions = []
    classes = []
    calls = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            collector = CallCollector()
            for n in node.body:
                collector.visit(n)
            functions.append({
                "name": node.name,
                "lineno": getattr(node, "lineno", None),
                "calls": sorted(collector.calls),
                "is_async": False,
            })
            calls.update(collector.calls)
        elif isinstance(node, ast.AsyncFunctionDef):
            collector = CallCollector()
            for n in node.body:
                collector.visit(n)
            functions.append({
                "name": node.name,
                "lineno": getattr(node, "lineno", None),
                "calls": sorted(collector.calls),
                "is_async": True,
            })
            calls.update(collector.calls)
        elif isinstance(node, ast.ClassDef):
            bases = []
            for b in node.bases:
                if isinstance(b, ast.Name):
                    bases.append(b.id)
                elif isinstance(b, ast.Attribute):
                    bases.append(b.attr)
                else:
                    bases.append(type(b).__name__)
            methods = []
            for n in node.body:
                if isinstance(n, ast.FunctionDef):
                    collector = CallCollector()
                    for bn in n.body:
                        collector.visit(bn)
                    methods.append({
                        "name": n.name,
                        "lineno": getattr(n, "lineno", None),
                        "calls": sorted(collector.calls),
                    })
                    calls.update(collector.calls)
            classes.append({
                "name": node.name,
                "bases": bases,
                "methods": methods,
                "lineno": getattr(node, "lineno", None),
            })

    return {
        "functions": functions,
        "classes": classes,
        "calls": sorted(set(calls)),
    }

def analyze_project(paths: List[Path]) -> Dict[str, Dict]:
    ir: Dict[str, Dict] = {}
    for p in paths:
        try:
            src = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            src = ""
        ir[str(p)] = parse_module(src)
    return ir

def build_mermaid(ir: Dict[str, Dict], root: Optional[Path]=None) -> str:
    lines = ["flowchart TD"]
    added_edges: Set[Tuple[str,str]] = set()
    for fullpath, mod in ir.items():
        module_name = str(Path(fullpath).relative_to(root)) if root and str(fullpath).startswith(str(root)) else fullpath
        mid = safe_id("mod_" + module_name.replace("/", "_").replace("\\", "_"))
        lines.append(f'  subgraph {mid}["{html.escape(module_name)}"]')
        for cls in mod["classes"]:
            cid = safe_id(f"{module_name}_class_{cls['name']}")
            title = f"class {cls['name']}"
            if cls.get("bases"):
                title += " : " + ", ".join(cls['bases'])
            lines.append(f'    {cid}["{html.escape(title)}"]')
            for m in cls["methods"]:
                fid = safe_id(f"{module_name}_{cls['name']}_{m['name']}")
                label = m['name']
                lines.append(f"    {fid}({html.escape(label)})")
                for callee in m["calls"]:
                    to = safe_id(f"func_{callee}")
                    if (fid, to) not in added_edges:
                        lines.append(f"    {fid} --> {to}")
                        added_edges.add((fid, to))
        for fn in mod["functions"]:
            fid = safe_id(f"{module_name}_fn_{fn['name']}")
            label = fn['name'] + (" (async)" if fn.get("is_async") else "")
            lines.append(f"    {fid}({html.escape(label)})")
            for callee in fn["calls"]:
                to = safe_id(f"func_{callee}")
                if (fid, to) not in added_edges:
                    lines.append(f"    {fid} --> {to}")
                    added_edges.add((fid, to))
        lines.append("  end")
    seen_callees: Set[str] = set()
    for mod in ir.values():
        for fn in mod["functions"]:
            for callee in fn["calls"]:
                seen_callees.add(callee)
        for cls in mod["classes"]:
            for m in cls["methods"]:
                for callee in m["calls"]:
                    seen_callees.add(callee)
    for c in sorted(seen_callees):
        lines.append(f"  {safe_id('func_' + c)}{{{html.escape(c)}}}")
    return "\n".join(lines)

def mend_mermaid(code: str) -> str:
    code = code.strip()
    if not code.startswith("flowchart"):
        code = "flowchart TD\n" + code
    code = code.replace("```", "")
    code = re.sub(r"-{1,}>{1,}", "-->", code)
    opens = len(re.findall(r"\bsubgraph\b", code))
    ends = len(re.findall(r"^\s*end\s*$", code, flags=re.M))
    if ends < opens:
        code += "\n" + "\n".join(["end"] * (opens - ends))
    return code

def write_markdown(mermaid_code: str, out_md: Path):
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(f"```mermaid\n{mermaid_code}\n```", encoding="utf-8")

def build_html(mermaid_code: str, mermaid_js_path: Path) -> str:
    js = mermaid_js_path.read_text(encoding="utf-8", errors="replace")
    escaped = html.escape(mermaid_code)
    tpl = f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>DiagramMender Preview</title>
  <style>
    body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 1rem; }}
    .container {{ max-width: 1400px; margin: auto; }}
    .code {{ white-space: pre; background: #f7f7f9; padding: 1rem; border: 1px solid #eee; overflow:auto; }}
  </style>
</head>
<body>
  <div class="container">
    <h1>DiagramMender – Mermaid Preview</h1>
    <div class="code mermaid">
{escaped}
    </div>
  </div>
  <script>
{js}
  </script>
  <script>
    if (window.mermaid && mermaid.initialize) {{ mermaid.initialize({{ startOnLoad: true }}) }}
  </script>
</body>
</html>
"""
    return tpl

def cli(argv=None):
    parser = argparse.ArgumentParser(description="Generate Mermaid flowcharts from a Python project.")
    parser.add_argument("path", help="Path to Python project (directory)")
    parser.add_argument("--out", default="mermaid.md", help="Output Markdown file (with ```mermaid block)")
    parser.add_argument("--html", default=None, help="Optional output HTML preview file")
    parser.add_argument("--max-files", type=int, default=500, help="Max number of .py files to scan")
    parser.add_argument("--ignore", default="venv,.venv,site-packages,__pycache__", help="Comma-separated names to ignore")
    args = parser.parse_args(argv)

    root = Path(args.path).resolve()
    if not root.exists():
        print(f"[ERROR] Path not found: {root}", file=sys.stderr)
        sys.exit(2)

    ignore = [s.strip() for s in args.ignore.split(",")]
    files = iter_py_files(root, ignore, args.max_files)
    if not files:
        print("[WARN] No Python files found.", file=sys.stderr)

    ir = analyze_project(files)
    code = build_mermaid(ir, root=root)
    code = mend_mermaid(code)

    out_md = Path(args.out).resolve()
    write_markdown(code, out_md)
    print(f"[OK] Mermaid Markdown written: {out_md} ({out_md.stat().st_size} bytes)")

    if args.html:
        mermaid_js = BASE / "mermaid.min.js"
        html_str = build_html(code, mermaid_js)
        out_html = Path(args.html).resolve()
        out_html.write_text(html_str, encoding="utf-8")
        print(f"[OK] HTML preview written: {out_html} ({out_html.stat().st_size} bytes)")

if __name__ == "__main__":
    cli()
