#!/usr/bin/env python3
# Convert diagram_knowledge_pack.xlsx into rulepack.json and promptpack.json
import sys, json
import pandas as pd
from pathlib import Path

def main(xlsx_path, out_dir="."):
    xlsx_path = Path(xlsx_path)
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    xl = pd.ExcelFile(xlsx_path)
    # RulePack
    rules = []
    if "RuleCatalog" in xl.sheet_names:
        df = xl.parse("RuleCatalog")
        df = df.fillna("")
        for _, row in df.iterrows():
            try:
                cond = row.get("condition_json", "{}"); 
                cond = json.loads(cond) if cond else {}
            except Exception:
                cond = {}
            try:
                fixp = row.get("fix_params_json", "{}"); 
                fixp = json.loads(fixp) if fixp else {}
            except Exception:
                fixp = {}
            rules.append({
                "rule_id": row.get("rule_id",""),
                "title": row.get("title",""),
                "category": row.get("category",""),
                "diagram_types": row.get("diagram_types",""),
                "phase": row.get("phase",""),
                "severity": row.get("severity",""),
                "enabled": bool(row.get("enabled", True)),
                "pattern_kind": row.get("pattern_kind",""),
                "pattern": row.get("pattern",""),
                "condition_json": cond,
                "fix_action": row.get("fix_action",""),
                "fix_params_json": fixp,
                "example_in": row.get("example_in",""),
                "example_out": row.get("example_out",""),
                "notes": row.get("notes",""),
                "origin": row.get("origin",""),
                "version": row.get("version",""),
                "created_at": row.get("created_at",""),
                "updated_at": row.get("updated_at",""),
            })
    out_rulepack = {"version":"1.0.0","rules": rules}
    (out_dir / "rulepack.json").write_text(json.dumps(out_rulepack, indent=2, ensure_ascii=False), encoding="utf-8")

    # PromptPack
    prompts = []
    if "AI_Prompts" in xl.sheet_names:
        dfp = xl.parse("AI_Prompts").fillna("")
        for _, row in dfp.iterrows():
            prompts.append({
                "prompt_id": row.get("prompt_id",""),
                "intent": row.get("intent",""),
                "input_type": row.get("input_type",""),
                "template": row.get("template",""),
                "schema_ref": row.get("schema_ref",""),
                "system_instructions": row.get("system_instructions","")
            })
    out_promptpack = {"version":"1.0.0","prompts": prompts}
    (out_dir / "promptpack.json").write_text(json.dumps(out_promptpack, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Wrote:", out_dir / "rulepack.json", "and", out_dir / "promptpack.json")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: xlsx_to_json.py <diagram_knowledge_pack.xlsx> [out_dir]")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ".")
