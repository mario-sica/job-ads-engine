import type { Creative, Facts, Specs } from "@job-ads-engine/content";
import { escapeHtml } from "../format.js";
import { canvasFor, htmlDocument, tag } from "./document.js";

const SQUARE = { width: 1080, height: 1080 };

/*
 * Un solo layout per tutte le proporzioni: la colonna di testo resta in alto e la
 * foto occupa lo spazio che avanza. In verticale (9:16) i caratteri crescono,
 * coerentemente con l'hook più lungo ammesso dalle specs.
 */
const CSS = `
.creative { display: flex; flex-direction: column; gap: 28px; padding: 64px; height: 100%; }
.logos { display: flex; align-items: center; gap: 18px; font-size: 22px; }
.logos .placeholder { width: 180px; height: 72px; }
.logos .times { font-size: 36px; color: #5f6368; }
.title { font-size: 84px; line-height: 1.2; }
.title mark { background: #ffd600; color: inherit; padding: 0 8px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.hook { font-size: 44px; font-weight: 800; text-transform: uppercase; color: #1848a0; }
.subline { font-size: 34px; color: #4a4a4a; }
.photo { flex: 1; min-height: 0; border-radius: 24px; font-size: 26px; padding: 32px; }
.tall .title { font-size: 104px; }
.tall .hook { font-size: 56px; }
.tall .subline { font-size: 40px; }
`;

/** Titolo con la parte evidenziata: ogni pezzo è escapato separatamente. */
function highlightedTitle({ text, highlight }: Creative["title"]): string {
  const start = text.indexOf(highlight);
  const before = text.slice(0, start);
  const after = text.slice(start + highlight.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(highlight)}</mark>${escapeHtml(after)}`;
}

export function renderCreativeHtml(creative: Creative, facts: Facts, specs: Specs): string {
  const canvas = canvasFor(specs, SQUARE);
  const tall = canvas.height / canvas.width >= 1.6;

  const body = `<div class="creative${tall ? " tall" : ""}">
<div class="logos">
  ${tag("div", "Logo Gyver", "placeholder")}<span class="times">×</span>${tag("div", `Logo ${facts.company_name}`, "placeholder")}
</div>
<h1 class="title">${highlightedTitle(creative.title)}</h1>
${tag("p", creative.hook, "hook")}
${tag("p", creative.subline, "subline")}
${tag("div", `Foto: ${creative.visual_brief}`, "placeholder photo")}
</div>`;

  return htmlDocument({ title: creative.title.text, canvas, css: CSS, body });
}
