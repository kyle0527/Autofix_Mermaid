export function initMermaid(mermaid) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
}
export async function renderMermaid(mermaid, el, code) {
    try {
        const { svg } = await mermaid.render('m_' + Math.random().toString(36).slice(2), code);
        el.innerHTML = svg;
    }
    catch (e) {
        el.textContent = 'Render error: ' + (e?.message || String(e));
    }
}
