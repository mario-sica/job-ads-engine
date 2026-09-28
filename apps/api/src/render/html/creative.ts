import type { Creative, Facts, Specs } from "@job-ads-engine/content";
import { fitScale, maxLength, type SoftField } from "../../creative-fit.js";
import { escapeHtml } from "../format.js";
import { canvasFor, htmlDocument, tag } from "./document.js";

const SQUARE = { width: 1080, height: 1080 };

/*
 * Un solo layout per tutte le proporzioni: la colonna di testo resta in alto e la
 * foto occupa lo spazio che avanza. In verticale (9:16) i caratteri crescono,
 * coerentemente con l'hook più lungo ammesso dalle specs. Un testo oltre
 * l'obiettivo di lunghezza riduce il proprio font (`--fit`, vedi creative-fit.ts).
 */
const CSS = `
.creative { display: flex; flex-direction: column; gap: 28px; padding: 64px; height: 100%; }
.logos { display: flex; align-items: center; gap: 18px; font-size: 22px; }
/* Il riquadro si allarga con il nome dell'azienda e lo manda a capo: un nome lungo non esce dal bordo. */
.logos .placeholder { min-width: 180px; max-width: 420px; height: 72px; padding: 0 16px; line-height: 1.15; overflow: hidden; }
.logos .times { font-size: 36px; color: #5f6368; }
.title { font-size: calc(84px * var(--fit, 1)); line-height: 1.2; }
.title mark { background: #ffd600; color: inherit; padding: 0 8px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.hook { font-size: calc(44px * var(--fit, 1)); font-weight: 800; text-transform: uppercase; color: #1848a0; }
.subline { font-size: calc(34px * var(--fit, 1)); color: #4a4a4a; }
.photo { flex: 1; min-height: 0; border-radius: 24px; font-size: 26px; padding: 32px; }
.tall .title { font-size: calc(104px * var(--fit, 1)); }
.tall .hook { font-size: calc(56px * var(--fit, 1)); }
.tall .subline { font-size: calc(40px * var(--fit, 1)); }
`;

/** Titolo con la parte evidenziata: ogni pezzo è escapato separatamente. */
function highlightedTitle({ text, highlight }: Creative["title"]): string {
  const start = text.indexOf(highlight);
  const before = text.slice(0, start);
  const after = text.slice(start + highlight.length);
  return `${escapeHtml(before)}<mark>${escapeHtml(highlight)}</mark>${escapeHtml(after)}`;
}

/** Attributo di stile con la scala del font, solo se il testo supera l'obiettivo. */
function fit(field: SoftField, text: string, specs: Specs): string {
  const scale = fitScale(text.length, maxLength(field, specs));
  return scale < 1 ? ` style="--fit: ${scale.toFixed(3)}"` : "";
}

export function renderCreativeHtml(creative: Creative, facts: Facts, specs: Specs): string {
  const canvas = canvasFor(specs, SQUARE);
  const tall = canvas.height / canvas.width >= 1.6;

  const body = `<div class="creative${tall ? " tall" : ""}">
<div class="logos">
  ${tag("div", "Logo Gyver", "placeholder")}<span class="times">×</span>${tag("div", `Logo ${facts.company_name}`, "placeholder")}
</div>
<h1 class="title"${fit("title", creative.title.text, specs)}>${highlightedTitle(creative.title)}</h1>
<p class="hook"${fit("hook", creative.hook, specs)}>${escapeHtml(creative.hook)}</p>
<p class="subline"${fit("subline", creative.subline, specs)}>${escapeHtml(creative.subline)}</p>
${tag("div", `Foto: ${creative.visual_brief}`, "placeholder photo")}
</div>`;

  return htmlDocument({ title: creative.title.text, canvas, css: CSS, body });
}
