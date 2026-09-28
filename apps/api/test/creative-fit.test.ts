import { CREATIVE, FACTS } from "@job-ads-engine/content/testing";
import { parseSpecs } from "@job-ads-engine/content";
import { describe, expect, it } from "vitest";
import { fitScale, maxLength, targetLength } from "../src/creative-fit.js";
import { renderCreativeHtml } from "../src/render/html/creative.js";
import { llmSetup } from "./llm-fixtures.js";

const { format } = llmSetup();
const square = format("instagram", "image", "1:1").specs;
const vertical = format("instagram", "image", "9:16").specs;

describe("limiti morbidi della creative", () => {
  it("nelle righe social il massimo è l'obiettivo + 20%", () => {
    expect([maxLength("title", square), maxLength("hook", square), maxLength("subline", square)]).toEqual([36, 36, 36]);
    expect(maxLength("hook", vertical)).toBe(48);
    expect([targetLength(36), targetLength(48)]).toEqual([30, 40]);
  });

  it("senza override vale il default del blocco", () => {
    expect(maxLength("hook", parseSpecs({}))).toBe(30);
  });

  it("la scala è 1 fino all'obiettivo, poi proporzionale, mai sotto 0.8", () => {
    expect(fitScale(30, 36)).toBe(1);
    expect(fitScale(33, 36)).toBeCloseTo(30 / 33);
    expect(fitScale(36, 36)).toBeCloseTo(30 / 36);
    expect(fitScale(60, 36)).toBe(0.8);
  });

  it("il renderer riduce il font solo del testo oltre l'obiettivo", () => {
    const long = { ...CREATIVE, subline: "Impianti fotovoltaici oltre 100 kW" }; // 34 caratteri, obiettivo 30
    const html = renderCreativeHtml(long, FACTS, square);
    expect(html).toContain(`<p class="subline" style="--fit: ${(30 / 34).toFixed(3)}">`);
    expect(html).toContain(`<p class="hook">`);
    expect(renderCreativeHtml(CREATIVE, FACTS, square)).not.toContain("--fit: 0");
  });
});
