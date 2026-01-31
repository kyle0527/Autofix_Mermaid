export function initMermaid(mermaid: any) {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
}
export async function renderMermaid(mermaid: any, el: HTMLElement, code: string) {
  try {
    const { svg } = await mermaid.render('m_'+Math.random().toString(36).slice(2), code);
    el.innerHTML = svg;
  } catch (e:any) {
    el.textContent = 'Render error: ' + (e?.message || String(e));
  }
}
