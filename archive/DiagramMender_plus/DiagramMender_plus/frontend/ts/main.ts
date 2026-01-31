
import { renderAll } from "./renderer";

document.getElementById("btnRender")?.addEventListener("click", () => { renderAll(); });
setTimeout(() => renderAll(), 1200);
