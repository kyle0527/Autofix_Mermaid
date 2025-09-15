#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run_v3_then_combine.py - v3 (Base64 HTML embed)
- Step 1: run py2mermaid_v3 to generate MD/HTML
- Step 2: combine all ```mermaid blocks into a single .mmd
- Step 3: inject the combined diagram into the HTML using data-code-b64 (same mechanism as per-file charts)
- Optional: include non-mermaid Markdown text as comments (%% ...) in the .mmd
"""
# [完整內容如前述 run_v3_then_combine.py 內容]