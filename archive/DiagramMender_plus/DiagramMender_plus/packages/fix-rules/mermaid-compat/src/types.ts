export interface FixContext { diagram:'flowchart'|'classDiagram'|'sequenceDiagram'; mermaidVersion:'v10'|'v11'; }
export interface FixResult { code: string; notes: string[]; }
export interface FixRule { name: string; priority: number; run(code: string, ctx: FixContext): FixResult; }
