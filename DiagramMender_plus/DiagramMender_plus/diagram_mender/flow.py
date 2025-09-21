
from __future__ import annotations
import ast
from typing import List, Optional, Tuple
from .graph import Graph

def _short_stmt(s: ast.stmt) -> str:
    try:
        if hasattr(ast, "unparse"):
            return ast.unparse(s)
    except Exception:
        pass
    return s.__class__.__name__

def _expr(e: Optional[ast.AST]) -> str:
    if e is None:
        return ""
    try:
        if hasattr(ast, "unparse"):
            return ast.unparse(e)
    except Exception:
        pass
    return e.__class__.__name__

class FlowBuilder(ast.NodeVisitor):
    """Build simplified control flow for a list of statements."""
    def __init__(self, graph: Graph, prefix: str):
        self.g = graph
        self.prefix = prefix

    def build_block(self, stmts: List[ast.stmt]) -> Tuple[str, str]:
        if not stmts:
            nid = self.g.new_node(self.prefix, "pass")
            return nid, nid
        entries = []
        last_exit = None
        for i, s in enumerate(stmts):
            e, x = self.build_stmt(s)
            entries.append(e) if i == 0 else self.g.add_edge(last_exit, e)
            last_exit = x
        return entries[0], last_exit

    def build_stmt(self, s: ast.stmt) -> Tuple[str, str]:
        if isinstance(s, ast.If):
            return self._build_if(s)
        if isinstance(s, ast.For):
            return self._build_for(s)
        if isinstance(s, ast.While):
            return self._build_while(s)
        if isinstance(s, ast.Try):
            return self._build_try(s)
        if isinstance(s, ast.With):
            head = self.g.new_node(self.prefix, f"with {_expr(s.items[0].context_expr)}")
            b_e, b_x = self.build_block(s.body)
            self.g.add_edge(head, b_e, "enter")
            return head, b_x
        if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            nid = self.g.new_node(self.prefix, f"def/class {getattr(s, 'name', '')}")
            return nid, nid
        if isinstance(s, ast.Return):
            nid = self.g.new_node(self.prefix, f"return {_expr(s.value) if s.value else ''}")
            return nid, nid
        if isinstance(s, ast.Break):
            nid = self.g.new_node(self.prefix, "break")
            return nid, nid
        if isinstance(s, ast.Continue):
            nid = self.g.new_node(self.prefix, "continue")
            return nid, nid

        nid = self.g.new_node(self.prefix, _short_stmt(s))
        return nid, nid

    def _build_if(self, s: ast.If):
        cond = self.g.new_node(self.prefix, f"if {_expr(s.test)}", "diamond")
        then_e, then_x = self.build_block(s.body)
        self.g.add_edge(cond, then_e, "True")
        if s.orelse:
            else_e, else_x = self.build_block(s.orelse)
            self.g.add_edge(cond, else_e, "False")
            join = self.g.new_node(self.prefix, "join")
            self.g.add_edge(then_x, join)
            self.g.add_edge(else_x, join)
            return cond, join
        else:
            return cond, then_x

    def _build_for(self, s: ast.For):
        head = self.g.new_node(self.prefix, f"for {getattr(s, 'target', 'iter')} in {_expr(s.iter)}", "diamond")
        body_e, body_x = self.build_block(s.body)
        self.g.add_edge(head, body_e, "iter")
        self.g.add_edge(body_x, head, "next")
        if s.orelse:
            o_e, o_x = self.build_block(s.orelse)
            self.g.add_edge(head, o_e, "empty")
            return head, o_x
        return head, head

    def _build_while(self, s: ast.While):
        head = self.g.new_node(self.prefix, f"while {_expr(s.test)}", "diamond")
        b_e, b_x = self.build_block(s.body)
        self.g.add_edge(head, b_e, "True")
        self.g.add_edge(b_x, head, "next")
        if s.orelse:
            o_e, o_x = self.build_block(s.orelse)
            self.g.add_edge(head, o_e, "False")
            return head, o_x
        return head, head

    def _build_try(self, s: ast.Try):
        head = self.g.new_node(self.prefix, "try")
        b_e, b_x = self.build_block(s.body)
        self.g.add_edge(head, b_e, "body")
        exits = [b_x]
        for h in s.handlers:
            exc = _expr(h.type) if h.type else "Exception"
            h_e, h_x = self.build_block(h.body)
            self.g.add_edge(head, h_e, f"except {exc}")
            exits.append(h_x)
        if s.finalbody:
            f_e, f_x = self.build_block(s.finalbody)
            for ex in exits:
                self.g.add_edge(ex, f_e, "finally")
            return head, f_x
        else:
            join = self.g.new_node(self.prefix, "join")
            for ex in exits:
                self.g.add_edge(ex, join)
            return head, join
