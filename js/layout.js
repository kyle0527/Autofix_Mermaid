
// Layout selector: default / elk / tidytree (hint config; real effect requires plugin in engine build)
export function applyLayoutSelection(mermaid, layout) {
  const cfg = { startOnLoad:false, securityLevel:'strict' };
  if (layout === 'elk')      cfg.flowchart = { layout: 'elk' };
  else if (layout === 'tidytree') cfg.flowchart = { layout: 'tidy' };
  mermaid.initialize(cfg);
}
