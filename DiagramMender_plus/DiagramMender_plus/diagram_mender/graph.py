
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional

def _sanitize(s: str) -> str:
    s = s.replace('"', "'").replace("\n", " ").strip()
    return s[:120]

@dataclass
class Node:
    id: str
    label: str
    shape: str = "rect"  # rect | diamond | circle

@dataclass
class Edge:
    src: str
    dst: str
    label: Optional[str] = None

@dataclass
class Graph:
    nodes: Dict[str, Node] = field(default_factory=dict)
    edges: List[Edge] = field(default_factory=list)

    def add_node(self, node_id: str, label: str, shape: str = "rect") -> str:
        if node_id not in self.nodes:
            self.nodes[node_id] = Node(node_id, _sanitize(label), shape)
        else:
            if not self.nodes[node_id].label:
                self.nodes[node_id].label = _sanitize(label)
        return node_id

    def new_node(self, prefix: str, label: str, shape: str = "rect") -> str:
        base = f"{prefix}{len(self.nodes)+1}"
        idx = 1
        node_id = base
        while node_id in self.nodes:
            idx += 1
            node_id = f"{base}_{idx}"
        self.add_node(node_id, label, shape)
        return node_id

    def add_edge(self, src: str, dst: str, label: Optional[str] = None) -> None:
        self.edges.append(Edge(src, dst, label))

    def to_mermaid(self, title: str) -> str:
        lines = [f"%% {title}", "flowchart TD"]
        for n in self.nodes.values():
            if n.shape == "rect":
                lines.append(f'  {n.id}["{n.label}"]')
            elif n.shape == "diamond":
                lines.append(f'  {n.id}{{"{n.label}"}}')
            elif n.shape == "circle":
                lines.append(f'  {n.id}(("{n.label}"))')
            else:
                lines.append(f'  {n.id}["{n.label}"]')
        for e in self.edges:
            if e.label:
                lines.append(f'  {e.src} -->|{_sanitize(e.label)}| {e.dst}')
            else:
                lines.append(f'  {e.src} --> {e.dst}')
        return "\n".join(lines)
