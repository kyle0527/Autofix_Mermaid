
from __future__ import annotations
import ast, os
from typing import List, Tuple, Optional
from .graph import Graph
from .flow import FlowBuilder

def render_file_to_graph(path: str) -> List[Tuple[str, Graph]]:
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        src = fh.read()
    try:
        tree = ast.parse(src, filename=path)
    except SyntaxError as se:
        g = Graph()
        g.add_node("err", f"SyntaxError: {se.msg} @ {se.lineno}:{se.offset}")
        return [(f"{os.path.basename(path)} :: SyntaxError", g)]

    results: List[Tuple[str, Graph]] = []

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            title = f"{os.path.basename(path)} :: def {node.name}"
            g = Graph()
            fb = FlowBuilder(g, prefix="n")
            e, x = fb.build_block(node.body)
            start = g.add_node("start", "start", "circle")
            end = g.add_node("end", "end", "circle")
            g.add_edge("start", e)
            g.add_edge(x, "end")
            results.append((title, g))

    top_statements = [n for n in tree.body if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    if top_statements:
        g = Graph()
        fb = FlowBuilder(g, prefix="m")
        e, x = fb.build_block(top_statements)
        start = g.add_node("start", "module start", "circle")
        end = g.add_node("end", "module end", "circle")
        g.add_edge("start", e)
        g.add_edge(x, "end")
        results.append((f"{os.path.basename(path)} :: <module>", g))

    return results

def walk_and_render(root: str, max_files: int = 500, ignore: Optional[List[str]] = None) -> List[Tuple[str, Graph]]:
    ignore = [i.strip() for i in (ignore or []) if i.strip()]
    results: List[Tuple[str, Graph]] = []
    count = 0
    if os.path.isfile(root) and root.endswith(".py"):
        return render_file_to_graph(root)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not any(ig in os.path.join(dirpath, d) for ig in ignore)]
        for fn in sorted(filenames):
            if not fn.endswith(".py"):
                continue
            fpath = os.path.join(dirpath, fn)
            if any(ig in fpath for ig in ignore):
                continue
            results.extend(render_file_to_graph(fpath))
            count += 1
            if count >= max_files:
                return results
    return results
