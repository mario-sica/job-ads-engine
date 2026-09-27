import type { Specs } from "@job-ads-engine/content";
import { escapeHtml } from "../format.js";

export interface Canvas {
  width: number;
  height: number;
}

/** Dimensioni della tela dalle specs della riga, con un ripiego se mancano. */
export const canvasFor = (specs: Specs, fallback: Canvas): Canvas => ({
  width: specs.width_px ?? fallback.width,
  height: specs.height_px ?? fallback.height,
});

/** Tag con testo escapato. Tutto il testo del contenuto passa da qui o da escapeHtml. */
export const tag = (name: string, text: string, className?: string) =>
  `<${name}${className ? ` class="${className}"` : ""}>${escapeHtml(text)}</${name}>`;

/*
 * Documento autosufficiente: CSS inline e nessuna risorsa esterna, così l'anteprima
 * si apre ovunque. Foto e loghi sono segnaposto tratteggiati.
 */
export function htmlDocument({ title, canvas, css, body }: { title: string; canvas: Canvas; css: string; body: string }): string {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #e8e8e8; display: flex; justify-content: center; padding: 24px 0; }
.canvas {
  position: relative; overflow: hidden; background: #fff; color: #1b1b1b;
  width: ${canvas.width}px; height: ${canvas.height}px;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.placeholder {
  display: flex; align-items: center; justify-content: center; text-align: center;
  border: 3px dashed #9aa0a6; color: #5f6368; background: #f1f3f4;
}
${css}
</style>
</head>
<body>
<div class="canvas">
${body}
</div>
</body>
</html>
`;
}
