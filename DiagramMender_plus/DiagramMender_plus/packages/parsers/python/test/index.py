# index.py - Simple Python IR builder for tests
from __future__ import annotations
import ast
from typing import Dict, Any

class _CallCollector(ast.NodeVisitor):
    def __init__(self):
        self.calls = set()
    def visit_Call(self, node: ast.Call):
        name = None
        f = node.func
        if isinstance(f, ast.Name):
            name = f.id
        elif isinstance(f, ast.Attribute):
            name = f.attr
        if name:
            self.calls.add(name)
        self.generic_visit(node)

def _parse_source(src: str) -> Dict[str, Any]:
    tree = ast.parse(src)
    functions = []
    classes = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            cc = _CallCollector()
            for n in node.body:
                cc.visit(n)
            functions.append({
                "name": node.name,
                "calls": sorted(cc.calls),
            })
        elif isinstance(node, ast.ClassDef):
            methods = []
            for n in node.body:
                if isinstance(n, ast.FunctionDef):
                    cc = _CallCollector()
                    for bn in n.body:
                        cc.visit(bn)
                    methods.append({"name": n.name, "calls": sorted(cc.calls)})
            classes.append({"name": node.name, "methods": methods})
    return {"functions": functions, "classes": classes}

def parsePythonProject(files: Dict[str, str]) -> Dict[str, Any]:
    """Build a minimal IR from a mapping of filename->source."""
    ir = {"modules": {}}
    for name, src in files.items():
        ir["modules"][name] = _parse_source(src)
    return ir
