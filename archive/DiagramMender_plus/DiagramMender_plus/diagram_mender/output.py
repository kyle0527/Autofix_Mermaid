
from __future__ import annotations
import os
from typing import List, Tuple
from .graph import Graph

def write_markdown(results: List[Tuple[str, Graph]], out_path: str) -> None:
    os.makedirs(os.path.dirname(out_path), exist_ok=True) if os.path.dirname(out_path) else None
    with open(out_path, "w", encoding="utf-8") as fh:
        for i, (title, g) in enumerate(results, 1):
            fh.write(f"### {i}. {title}\n\n")
            fh.write("```mermaid\n")
            fh.write(g.to_mermaid(title))
            fh.write("\n```\n\n")
