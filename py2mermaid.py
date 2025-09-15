#!/usr/bin/env python3

"""
py2mermaid — Generate Mermaid flowcharts from a Python project folder.

Usage:
  python py2mermaid.py /path/to/project --out mermaid.md [--max-files 500] [--ignore "venv,.venv,site-packages,__pycache__"]

What it does:
- Recursively scans for *.py under the given folder
- For each file, parses functions and top-level flow (simplified)
- Emits Mermaid `flowchart TD` for each function and a "module flow" for top-level
- Focuses on if/elif/else, for/while, try/except/finally, return/break/continue

Limitations (by design for speed and robustness):
- This is a *flowchart synthesizer*, not a precise compiler CFG.
- It does not resolve dynamic features (eval/exec, dynamic imports, decorators semantics).
- It summarizes complex expressions/statements into short labels.

Author: ChatGPT
License: MIT
"""

import os, ast, sys, argparse
from pathlib import Path
from typing import List, Tuple, Dict, Optional

# [完整內容如前述 py2mermaid.py 內容]