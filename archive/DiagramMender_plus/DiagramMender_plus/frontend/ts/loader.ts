
export async function tryImportMermaid(): Promise<any | null> {
  const sources = [
    "./vendor/mermaid.esm.min.mjs",
    "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"
  ];
  for (const src of sources) {
    try {
      const mod = await import(/* @vite-ignore */ src);
      return (mod && (mod.default || mod));
    } catch (e) {
      console.warn("Mermaid import failed from", src, e);
    }
  }
  return null;
}
