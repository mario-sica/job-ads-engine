import type { JobSheet, Specs } from "@job-ads-engine/content";
import { formatSalary } from "../format.js";
import { jobDescriptionSections, type RenderContext } from "../text.js";
import { canvasFor, htmlDocument, tag } from "./document.js";

const A4 = { width: 1240, height: 1754 };

const CSS = `
.sheet { padding: 72px 88px; display: flex; flex-direction: column; gap: 36px; height: 100%; }
.head { display: flex; align-items: center; gap: 40px; }
.logo { min-width: 200px; max-width: 320px; height: 120px; padding: 0 16px; font-size: 22px; line-height: 1.2; overflow: hidden; flex: none; }
.head h1 { font-size: 64px; line-height: 1.1; }
.subtitle { font-size: 32px; color: #4a4a4a; margin-top: 8px; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 14px; }
.chips li { font-size: 24px; padding: 10px 22px; border-radius: 999px; background: #eef4ff; color: #1848a0; }
.sections { display: flex; flex-direction: column; gap: 30px; }
.sections h2 { font-size: 30px; margin-bottom: 12px; }
.sections ul { padding-left: 32px; display: flex; flex-direction: column; gap: 8px; }
.sections li { font-size: 24px; line-height: 1.4; }
`;

export function renderJobSheetHtml(sheet: JobSheet, { facts, location }: RenderContext, specs: Specs): string {
  // Chip dell'LLM, poi quelli composti dai facts: luogo, contratto, RAL.
  const chips = [
    ...sheet.tags,
    location,
    facts.contract_type,
    facts.salary && formatSalary(facts.salary),
  ].filter((c): c is string => Boolean(c));

  const sections = jobDescriptionSections(sheet.description, facts)
    .map((s) => `<section>${tag("h2", s.title)}<ul>${s.bullets.map((b) => tag("li", b)).join("")}</ul></section>`)
    .join("\n");

  const body = `<div class="sheet">
<header class="head">
  ${tag("div", `Logo ${facts.company_name}`, "placeholder logo")}
  <div>${tag("h1", sheet.title)}${tag("p", sheet.subtitle, "subtitle")}</div>
</header>
<ul class="chips">${chips.map((c) => tag("li", c)).join("")}</ul>
<main class="sections">
${sections}
</main>
</div>`;

  return htmlDocument({ title: sheet.title, canvas: canvasFor(specs, A4), css: CSS, body });
}
