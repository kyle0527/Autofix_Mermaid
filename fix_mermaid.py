#!/usr/bin/env python3
"""
快速修復 mermaid_modular.md 中的語法問題
"""
import re

def fix_mermaid_file(file_path: str) -> None:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修復格式問題
    content = re.sub(r'```mermaid\\nflowchart TD\\n%%', r'```mermaid\nflowchart TD\n%%', content)
    
    # 確保所有 mermaid 圖表都有 flowchart TD 聲明
    content = re.sub(r'```mermaid\n%%', r'```mermaid\nflowchart TD\n%%', content)
    
    # 修復 end 節點問題 (如果還有的話)
    content = re.sub(r'\bend\(\("end"\)\)', r'endNode(("end"))', content)
    content = re.sub(r'\bend\(\("module end"\)\)', r'endModule(("module end"))', content)
    
    # 修復指向 end 的箭頭
    content = re.sub(r' --> end$', r' --> endNode', content, flags=re.MULTILINE)
    content = re.sub(r' --> end\n', r' --> endNode\n', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"已修復 {file_path}")

if __name__ == "__main__":
    fix_mermaid_file("DiagramMender_plus/mermaid_modular.md")