import { parseAmounts } from "@job-ads-engine/content";
import { CREATIVE, FACTS, JOB_SHEET } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { createChannelFormatsRepository } from "../src/modules/channel-formats/repository.js";
import { escapeHtml } from "../src/render/format.js";
import { renderCreativeHtml } from "../src/render/html/creative.js";
import { renderJobSheetHtml } from "../src/render/html/job-sheet.js";
import type { RenderContext } from "../src/render/text.js";
import { seededDb } from "./helpers.js";

const formats = createChannelFormatsRepository(seededDb()).list();
const specsOf = (channel: string, ratio: string) =>
  formats.find((f) => f.channel_code === channel && f.format === "image" && f.aspect_ratio === ratio)!.specs;

const ctx: RenderContext = { facts: FACTS, location: "Orzinuovi (BS)" };
const INJECTED = `<script>alert("x")</script> & 'y'`;
const ESCAPED = "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;";

describe("foglio A4 WhatsApp", () => {
  const html = renderJobSheetHtml(JOB_SHEET, ctx, specsOf("whatsapp", "A4"));

  it("usa le dimensioni delle specs", () => {
    expect(html).toContain("width: 1240px; height: 1754px;");
  });

  it("mostra i chip dell'LLM e quelli composti dai facts", () => {
    expect(html).toMatch(/<li>Impianti fotovoltaici industriali<\/li><li>📍 Orzinuovi \(BS\)<\/li><li>Tempo indeterminato<\/li><li>RAL da 32\.000.€<\/li>/u);
  });

  it("contiene le sezioni della JobDescription e il segnaposto del logo", () => {
    for (const title of [JOB_SHEET.description.headline, "Quello che ti offrirà l&#39;azienda:", "Il tuo profilo:"]) {
      expect(html).toContain(`<h2>${title}</h2>`);
    }
    expect(html).toContain('<div class="placeholder logo">Logo AB Group SpA</div>');
  });

  it("escapa tutto il testo del contenuto", () => {
    const injected = renderJobSheetHtml(
      { ...JOB_SHEET, title: INJECTED, tags: [INJECTED], description: { ...JOB_SHEET.description, profile: [INJECTED] } },
      { facts: { ...FACTS, company_name: INJECTED }, location: INJECTED },
      specsOf("whatsapp", "A4"),
    );
    expect(injected).not.toContain("<script>");
    expect(injected.split(ESCAPED).length - 1).toBeGreaterThanOrEqual(5);
  });

  it("snapshot", async () => {
    await expect(html).toMatchFileSnapshot("./__snapshots__/render/whatsapp-a4.html");
  });
});

describe("creative social", () => {
  it.each([
    ["1:1", "1080px; height: 1080px"],
    ["4:5", "1080px; height: 1350px"],
    ["9:16", "1080px; height: 1920px"],
  ])("%s usa le dimensioni delle specs", (ratio, size) => {
    expect(renderCreativeHtml(CREATIVE, FACTS, specsOf("instagram", ratio))).toContain(`width: ${size};`);
  });

  it("solo il 9:16 usa i caratteri più grandi", () => {
    expect(renderCreativeHtml(CREATIVE, FACTS, specsOf("instagram", "9:16"))).toContain('class="creative tall"');
    expect(renderCreativeHtml(CREATIVE, FACTS, specsOf("instagram", "4:5"))).toContain('class="creative"');
  });

  it("loghi, titolo evidenziato, hook, sottotitolo e foto, in quest'ordine", () => {
    const html = renderCreativeHtml(CREATIVE, FACTS, specsOf("instagram", "1:1"));
    const order = ["Logo Gyver", "Logo AB Group SpA", "Tecnico <mark>Fotovoltaico</mark>", CREATIVE.hook, CREATIVE.subline, `Foto: ${CREATIVE.visual_brief}`]
      .map((s) => (s.includes("<mark>") ? s : escapeHtml(s)));
    const positions = order.map((s) => html.indexOf(s));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("niente RAL e niente luogo", () => {
    const html = renderCreativeHtml(CREATIVE, FACTS, specsOf("instagram", "1:1"));
    expect(parseAmounts(html)).not.toContain(32000);
    expect(html).not.toContain("📍");
  });

  it("escapa anche il titolo evidenziato", () => {
    const title = { text: `Tecnico <b>&</b> FV`, highlight: "<b>&</b>" };
    const html = renderCreativeHtml({ ...CREATIVE, title, hook: INJECTED }, FACTS, specsOf("instagram", "1:1"));
    expect(html).toContain("Tecnico <mark>&lt;b&gt;&amp;&lt;/b&gt;</mark> FV");
    expect(html).toContain(ESCAPED);
    expect(html).not.toContain("<script>");
  });

  it.each([["1:1", "1x1"], ["4:5", "4x5"], ["9:16", "9x16"]])("snapshot %s", async (ratio, name) => {
    await expect(renderCreativeHtml(CREATIVE, FACTS, specsOf("instagram", ratio)))
      .toMatchFileSnapshot(`./__snapshots__/render/creative-${name}.html`);
  });
});
