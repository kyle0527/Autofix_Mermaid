
from __future__ import annotations
import argparse
from typing import List
from .render import walk_and_render
from .output import write_markdown

def main(argv: List[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Generate Mermaid flowcharts from Python code")
    ap.add_argument("target", help="A Python file or a directory to scan")
    ap.add_argument("--out", default="mermaid.md", help="Output Markdown file (default: mermaid.md)")
    ap.add_argument("--max-files", type=int, default=500, help="Scan at most this many Python files")
    ap.add_argument("--ignore", default="venv,.venv,__pycache__,site-packages", help="Comma-separated ignore substrings")
    args = ap.parse_args(argv)
    ignore_list = [x.strip() for x in args.ignore.split(",") if x.strip()]
    results = walk_and_render(args.target, max_files=args.max_files, ignore=ignore_list)
    write_markdown(results, args.out)
    print(f"Wrote {len(results)} flowcharts to {args.out}")
    return 0
