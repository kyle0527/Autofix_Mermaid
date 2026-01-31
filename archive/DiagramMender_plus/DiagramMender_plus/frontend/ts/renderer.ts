
import { idle, decodeB64 } from "./utils";
import { tryImportMermaid } from "./loader";

export async function renderAll(): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-mermaid]"));
  if (blocks.length === 0) return;

  const mermaid = await tryImportMermaid();
  if (!mermaid) {
    console.warn("Mermaid 無法載入，保持降級（顯示原始碼）。");
    return;
  }

  try {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
  } catch (e) {
    console.warn("Mermaid 初始化失敗，保持降級：", e);
    return;
  }

  const batchSize = 3;
  for (let i = 0; i < blocks.length; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    await new Promise<void>((resolve) => {
      idle(async () => {
        for (const el of batch) {
          try {
            const b64 = el.getAttribute("data-code-b64");
            const code = b64 ? decodeB64(b64) : (el.textContent || "");
            if (!code.trim()) continue;
            const container = document.createElement("div");
            el.replaceWith(container);
            const id = "mmd-" + Math.random().toString(36).slice(2);
            const { svg } = await mermaid.render(id, code);
            container.innerHTML = svg;
          } catch (err) {
            console.error("單一圖渲染失敗：保留原始碼", err);
          }
        }
        resolve();
      });
    });
  }
}
