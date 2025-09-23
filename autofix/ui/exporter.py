# exporter.py — robust, dependency-light exporter
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Mapping, Optional, Sequence, Union, Any
import csv
import io
import json
import os
import shutil
import tempfile
import time
import hashlib
import textwrap
import html
from pathlib import Path

def _ensure_dir(path: str) -> None:
    d = os.path.dirname(os.path.abspath(path))
    if d and not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

def _atomic_write_text(path: str, text: str, newline: str = "\n") -> None:
    _ensure_dir(path)
    tmp_fd, tmp_path = tempfile.mkstemp(prefix=".tmp_export_", dir=os.path.dirname(os.path.abspath(path)))
    try:
        with os.fdopen(tmp_fd, "w", encoding="utf-8", newline=newline) as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass

def _atomic_write_bytes(path: str, data: bytes) -> None:
    _ensure_dir(path)
    tmp_fd, tmp_path = tempfile.mkstemp(prefix=".tmp_export_", dir=os.path.dirname(os.path.abspath(path)))
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
    finally:
        try:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
        except Exception:
            pass

def _sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

@dataclass
class ExportConfig:
    mermaid_version: str = "11.12.0"
    mermaid_theme: str = "default"
    html_title: str = "Diagram Export"
    html_script_url: Optional[str] = None
    fail_if_mmdc_missing: bool = False
    newline: str = "\n"
    pretty_json: bool = True
    csv_dialect: str = "excel"
    csv_encoding: str = "utf-8"
    append_manifest: bool = True

@dataclass
class DiagramBundle:
    name: str
    mermaid: str
    metadata: Mapping[str, Any] = field(default_factory=dict)
    csv_headers: Optional[Sequence[str]] = None
    csv_rows: Optional[Sequence[Sequence[Union[str, int, float, None]]]] = None

class Exporter:
    def __init__(self, out_dir: str, config: Optional[ExportConfig] = None):
        self.out_dir = os.path.abspath(out_dir)
        self.cfg = config or ExportConfig()
        os.makedirs(self.out_dir, exist_ok=True)

    def _full(self, filename: str) -> str:
        return os.path.join(self.out_dir, filename)

    def export_mermaid(self, name: str, mermaid_text: str) -> str:
        if not mermaid_text.strip():
            raise ValueError("empty mermaid_text")
        clean = mermaid_text.replace("\r\n", "\n").replace("\r", "\n")
        path = self._full(f"{name}.mmd")
        _atomic_write_text(path, clean, newline=self.cfg.newline)
        return path

    def export_html(self, name: str, mermaid_text: str, title: Optional[str] = None) -> str:
        mver = self.cfg.mermaid_version
        script_url = self.cfg.html_script_url or f"https://cdn.jsdelivr.net/npm/mermaid@{mver}/dist/mermaid.min.js"
        title = title or self.cfg.html_title
        escaped = html.escape(mermaid_text, quote=False)
        html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{html.escape(title)}</title>
<style>
  body {{ margin: 0; padding: 16px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }}
  .mwrap {{ overflow: auto; }}
</style>
<script src="{script_url}"></script>
<script>
  mermaid.initialize({{ startOnLoad: true, securityLevel: 'loose', theme: '{self.cfg.mermaid_theme}' }});
</script>
</head>
<body>
  <div class="mwrap">
    <pre class="mermaid">
{escaped}
    </pre>
  </div>
</body>
</html>"""
        path = self._full(f"{name}.html")
        _atomic_write_text(path, html_doc, newline=self.cfg.newline)
        return path

    def export_png(self, name: str, mermaid_text: str) -> str:
        mmdc = shutil.which("mmdc")
        if not mmdc:
            if self.cfg.fail_if_mmdc_missing:
                raise RuntimeError("mmdc (mermaid-cli) not found in PATH")
            html_path = self.export_html(name, mermaid_text, title=f"{name} (HTML fallback, mmdc not found)")
            return html_path
        mmd_path = self.export_mermaid(name, mermaid_text)
        out_png = self._full(f"{name}.png")
        tmp_png = self._full(f".{name}.tmp.png")
        cmd = f'"{mmdc}" -i "{mmd_path}" -o "{tmp_png}"'
        code = os.system(cmd)
        if code != 0 or not os.path.exists(tmp_png):
            raise RuntimeError(f"mmdc failed (exit={code}). Command: {cmd}")
        with open(tmp_png, "rb") as f:
            _atomic_write_bytes(out_png, f.read())
        try:
            os.remove(tmp_png)
        except FileNotFoundError:
            pass
        return out_png

    def export_json(self, name: str, data: Any) -> str:
        text = (
            json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
            if self.cfg.pretty_json else
            json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        )
        path = self._full(f"{name}.json")
        _atomic_write_text(path, text, newline=self.cfg.newline)
        return path

    def export_csv(self, name: str, headers: Sequence[str], rows: Sequence[Sequence[Union[str, int, float, None]]]) -> str:
        path = self._full(f"{name}.csv")
        _ensure_dir(path)
        with io.StringIO(newline="") as buf:
            writer = csv.writer(buf, dialect=self.cfg.csv_dialect)
            writer.writerow(list(headers))
            for r in rows:
                writer.writerow([("" if v is None else v) for v in r])
            data = buf.getvalue()
        _atomic_write_text(path, data, newline="")
        return path

    def export_all(self, bundle: DiagramBundle) -> Mapping[str, str]:
        stamp = time.strftime("%Y%m%d-%H%M%S", time.localtime())
        base = f"{bundle.name}__{stamp}"
        paths = {}

        paths["mmd"] = self.export_mermaid(base, bundle.mermaid)
        paths["html"] = self.export_html(base, bundle.mermaid, title=bundle.name)

        try:
            paths["png_or_html_fallback"] = self.export_png(base, bundle.mermaid)
        except Exception as e:
            paths["png_error"] = str(e)

        meta = dict(bundle.metadata)
        meta.update({
            "name": bundle.name,
            "sha256_mermaid": _sha256_text(bundle.mermaid),
            "generated_at": stamp,
            "out_dir": self.out_dir,
            "mermaid_version": self.cfg.mermaid_version,
            "mermaid_theme": self.cfg.mermaid_theme,
        })
        paths["json"] = self.export_json(base + "__meta", meta)

        if bundle.csv_headers and bundle.csv_rows:
            paths["csv"] = self.export_csv(base + "__table", bundle.csv_headers, bundle.csv_rows)

        if self.cfg.append_manifest:
            manifest_path = self._full("EXPORT_MANIFEST.jsonl")
            line = json.dumps({"name": bundle.name, "files": paths, "meta": meta}, ensure_ascii=False)
            tmp = self._full(".tmp_manifest_line.jsonl")
            _atomic_write_text(tmp, line + "\n", newline="\n")
            with open(tmp, "r", encoding="utf-8") as src:
                data = src.read()
            mode = "a" if os.path.exists(manifest_path) else "w"
            with open(manifest_path, mode, encoding="utf-8", newline="\n") as dst:
                dst.write(data)
            try:
                os.remove(tmp)
            except FileNotFoundError:
                pass
        return paths

# ===== COMPATIBILITY LAYER FOR EXISTING AUTOFIX UI SYSTEM =====
# These functions provide compatibility with the existing CLI commands

# Global constants for compatibility
SCHEMA_VERSION = "1.2"
UI_VERSION = "1.2.0"

# Create a default exporter instance for backward compatibility
_default_export_config = ExportConfig()
_temp_export_dir = tempfile.mkdtemp(prefix="autofix_ui_export_")
_default_exporter = Exporter(_temp_export_dir, _default_export_config)

def build_history_styles() -> str:
    """Return CSS styles for the history UI (compatibility function)."""
    return textwrap.dedent("""
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f6f8fa;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            padding: 20px;
        }
        .header {
            border-bottom: 1px solid #e1e4e8;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .entry {
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            margin-bottom: 10px;
            padding: 15px;
        }
        .method {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            color: white;
        }
        .method-GET { background-color: #28a745; }
        .method-POST { background-color: #ffc107; color: #333; }
        .method-PUT { background-color: #17a2b8; }
        .method-DELETE { background-color: #dc3545; }
        .status-2xx { color: #28a745; }
        .status-3xx { color: #17a2b8; }
        .status-4xx { color: #ffc107; }
        .status-5xx { color: #dc3545; }
    """).strip()

def build_history_app_script() -> str:
    """Return JavaScript for the history UI (compatibility function)."""
    return textwrap.dedent("""
        (function() {
            'use strict';
            
            function renderHistoryData(data) {
                const container = document.getElementById('history-container');
                if (!container || !data) return;
                
                const project = data.project || {};
                const runs = data.runs || [];
                
                let html = `
                    <div class="header">
                        <h1>${project.name || 'Autofix History'}</h1>
                        <p>Generated: ${project.created_at || new Date().toISOString()}</p>
                    </div>
                `;
                
                runs.forEach(run => {
                    const proxy = run.history_proxy || [];
                    html += `
                        <div class="run-section">
                            <h2>Run: ${run.run_id}</h2>
                            <p>Duration: ${run.summary?.duration_sec || 0}s</p>
                            <div class="entries">
                    `;
                    
                    proxy.forEach(entry => {
                        const req = entry.request || {};
                        const res = entry.response || {};
                        html += `
                            <div class="entry">
                                <div class="request-line">
                                    <span class="method method-${req.method}">${req.method || 'UNKNOWN'}</span>
                                    <span class="url">${req.url || ''}</span>
                                    <span class="status status-${Math.floor((res.status || 0) / 100)}xx">${res.status || 0}</span>
                                </div>
                                <div class="timestamp">${entry.ts || ''}</div>
                                <div class="tags">${(entry.tags || []).join(', ')}</div>
                            </div>
                        `;
                    });
                    
                    html += `
                            </div>
                        </div>
                    `;
                });
                
                container.innerHTML = html;
            }
            
            // Auto-render when data is available
            if (window.HISTORY_DATA) {
                renderHistoryData(window.HISTORY_DATA);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    if (window.HISTORY_DATA) {
                        renderHistoryData(window.HISTORY_DATA);
                    }
                });
            }
        })();
    """).strip()

def render_single_file_html(data: Any) -> str:
    """Render history data as a single HTML file (compatibility function)."""
    styles = build_history_styles()
    script = build_history_app_script()
    
    return textwrap.dedent(f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Autofix History Viewer</title>
            <style>
                {styles}
            </style>
        </head>
        <body>
            <div class="container">
                <div id="history-container">Loading...</div>
            </div>
            
            <script>
                window.HISTORY_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};
            </script>
            <script>
                {script}
            </script>
        </body>
        </html>
    """).strip()

def write_single_file_ui(data: Any, output_path: Path) -> Path:
    """Write history data as a single HTML file (compatibility function)."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    html_content = render_single_file_html(data)
    output_path.write_text(html_content, encoding='utf-8')
    
    return output_path

def write_static_bundle(data: Any, output_dir: Path) -> Path:
    """Write history data as a static asset bundle (compatibility function)."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Write main HTML file
    index_html = textwrap.dedent("""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Autofix History Viewer</title>
            <link rel="stylesheet" href="ui.css">
        </head>
        <body>
            <div class="container">
                <div id="history-container">Loading...</div>
            </div>
            
            <script src="data.js"></script>
            <script src="ui.js"></script>
        </body>
        </html>
    """).strip()
    
    (output_dir / 'index.html').write_text(index_html, encoding='utf-8')
    
    # Write CSS file
    (output_dir / 'ui.css').write_text(build_history_styles(), encoding='utf-8')
    
    # Write data file
    data_js = f"window.HISTORY_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};"
    (output_dir / 'data.js').write_text(data_js, encoding='utf-8')
    
    # Write JavaScript file
    (output_dir / 'ui.js').write_text(build_history_app_script(), encoding='utf-8')
    
    return output_dir

# Export all symbols needed for compatibility
__all__ = [
    # New exporter classes
    "Exporter", "ExportConfig", "DiagramBundle",
    # Compatibility functions for existing UI system
    "build_history_app_script",
    "build_history_styles", 
    "render_single_file_html",
    "write_single_file_ui",
    "write_static_bundle",
    # Constants
    "SCHEMA_VERSION",
]

# Quick demo when run directly
if __name__ == "__main__":
    out = os.environ.get("EXPORT_OUT", "./export_out")
    exp = Exporter(out)
    demo_mmd = textwrap.dedent("""\
    flowchart TD
      A[Start] --> B{Export?}
      B -- Mermaid --> C[.mmd]
      B -- HTML --> D[.html]
      B -- PNG --> E[.png]
      C --> F[Done]
      D --> F
      E --> F
    """)
    bundle = DiagramBundle(
        name="export_demo",
        mermaid=demo_mmd,
        metadata={"component": "exporter.py", "purpose": "smoke-test"},
        csv_headers=["file", "status"],
        csv_rows=[["mmd", "ok"], ["html", "ok"], ["png_or_html_fallback", "maybe"]],
    )
    paths = exp.export_all(bundle)
    print(json.dumps(paths, indent=2, ensure_ascii=False))