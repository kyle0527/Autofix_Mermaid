#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_v3_then_combine.py
Convenience wrapper that generates Mermaid from a project and produces:
- Markdown with ```mermaid block
- Raw .mmd
- Offline HTML preview

Example:
  python run_v3_then_combine.py ./some_project \
    --out-dir ./out \
    --name some_project
"""
from __future__ import annotations
import argparse
from pathlib import Path
from py2mermaid_v2 import cli as py2_cli

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("path", help="Path to Python project directory")
    ap.add_argument("--out-dir", default="out", help="Output directory")
    ap.add_argument("--name", default="diagram", help="Base name for outputs")
    args = ap.parse_args(argv)

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    md = out_dir / f"{args.name}.md"
    mmd = out_dir / f"{args.name}.mmd"
    html = out_dir / f"{args.name}.html"
    # Delegate to v2
    py2_cli([args.path, "--out-md", str(md), "--out-mmd", str(mmd), "--out-html", str(html)])

    print("[DONE] Outputs:")
    print(" -", md)
    print(" -", mmd)
    print(" -", html)

if __name__ == "__main__":
    main()
