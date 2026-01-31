#!/usr/bin/env python3
# Convert rulepack.json + promptpack.json back into diagram_knowledge_pack.xlsx skeleton
import sys, json
import pandas as pd
from pathlib import Path

def main(rulepack_json, promptpack_json, out_xlsx):
    with open(rulepack_json, "r", encoding="utf-8") as fp:
        rp = json.load(fp)
    with open(promptpack_json, "r", encoding="utf-8") as fp:
        pp = json.load(fp)

    rule_rows = []
    for r in rp.get("rules", []):
        rule_rows.append({
            "rule_id": r.get("rule_id",""),
            "title": r.get("title",""),
            "category": r.get("category",""),
            "diagram_types": r.get("diagram_types",""),
            "phase": r.get("phase",""),
            "severity": r.get("severity",""),
            "enabled": r.get("enabled", True),
            "pattern_kind": r.get("pattern_kind",""),
            "pattern": r.get("pattern",""),
            "condition_json": json.dumps(r.get("condition_json",{}), ensure_ascii=False),
            "fix_action": r.get("fix_action",""),
            "fix_params_json": json.dumps(r.get("fix_params_json",{}), ensure_ascii=False),
            "example_in": r.get("example_in",""),
            "example_out": r.get("example_out",""),
            "notes": r.get("notes",""),
            "origin": r.get("origin",""),
            "version": r.get("version",""),
            "created_at": r.get("created_at",""),
            "updated_at": r.get("updated_at",""),
        })
    prompts_rows = []
    for p in pp.get("prompts", []):
        prompts_rows.append({
            "prompt_id": p.get("prompt_id",""),
            "intent": p.get("intent",""),
            "input_type": p.get("input_type",""),
            "template": p.get("template",""),
            "schema_ref": p.get("schema_ref",""),
            "system_instructions": p.get("system_instructions",""),
        })

    with pd.ExcelWriter(out_xlsx, engine="xlsxwriter") as writer:
        pd.DataFrame(rule_rows).to_excel(writer, sheet_name="RuleCatalog", index=False)
        pd.DataFrame(prompts_rows).to_excel(writer, sheet_name="AI_Prompts", index=False)
        pd.DataFrame(columns=["key","value","comment"]).to_excel(writer, sheet_name="Config", index=False)
        pd.DataFrame(columns=["token","canonical","scope","diagram_types","aliases","notes"]).to_excel(writer, sheet_name="Normalization", index=False)
        pd.DataFrame(columns=["test_id","rule_id","diagram_type","input","expected_output","status"]).to_excel(writer, sheet_name="Tests", index=False)
        pd.DataFrame(columns=["rule_id","issue_url","coverage_status","notes"]).to_excel(writer, sheet_name="Coverage", index=False)
        pd.DataFrame(columns=["source_file","issue_number","title","state","labels","createdAt","closedAt","url"]).to_excel(writer, sheet_name="Issues", index=False)
    print("Wrote:", out_xlsx)

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: json_to_xlsx.py <rulepack.json> <promptpack.json> <out.xlsx>")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
