import { findSalaryLeaks } from "@job-ads-engine/content";
import { CAPTION, CHAT_MESSAGE, CREATIVE, FACTS, JOB_DESCRIPTION } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { renderPreview } from "../src/render/index.js";
import { fillSalaryPlaceholder, findUnfillablePlaceholders } from "../src/render/salary-placeholder.js";
import { llmSetup, withoutEmoji } from "./llm-fixtures.js";

const { format, location } = llmSetup();
const plain = (s: string | null | undefined) => s?.replace(/ /g, " ") ?? "";
const preview = (channel: string, fmt: string, ratio: string | null, content: Record<string, unknown>) =>
  renderPreview({ target: format(channel, fmt, ratio), content, location, precision: "locality", jobTitle: "Tecnico" });

describe("segnaposto {RAL}", () => {
  it("si riempie con l'importo del framing, in ogni stringa annidata", () => {
    const filled = fillSalaryPlaceholder({ a: "RAL {RAL}", b: ["Fino a {RAL} lordi"] }, { ...FACTS.salary!, framing: "up_to" });
    expect(plain(JSON.stringify(filled))).toBe('{"a":"RAL fino a 38.000 €","b":["Fino a fino a 38.000 € lordi"]}');
  });

  it("senza RAL nei facts resta com'è e viene segnalato", () => {
    expect(fillSalaryPlaceholder({ a: "RAL {RAL}" }, null)).toEqual({ a: "RAL {RAL}" });
    expect(findUnfillablePlaceholders({ text: { offer: ["RAL {RAL}"] } }, null)).toEqual([expect.stringMatching(/^text\.offer\.0: usa \{RAL\}/)]);
    expect(findUnfillablePlaceholders({ text: { offer: ["RAL {RAL}"] } }, FACTS.salary)).toEqual([]);
  });

  it("non contiene cifre: il guardrail sulla RAL non scatta", () => {
    expect(findSalaryLeaks({ text: { offer: ["RAL {RAL} in base all'esperienza"] } }, FACTS.salary)).toEqual([]);
  });

  it("l'anteprima lo riempie in Indeed, WhatsApp, caption e creative", () => {
    const indeed = preview("indeed", "text", null, { facts: FACTS, text: { ...JOB_DESCRIPTION, offer: ["RAL {RAL} in base all'esperienza"] } });
    expect(plain(indeed.text?.body)).toContain("• RAL da 32.000 € in base all'esperienza");

    const chat = preview("whatsapp", "text", null, { facts: FACTS, text: withoutEmoji({ ...CHAT_MESSAGE, bullets: [...CHAT_MESSAGE.bullets, "Retribuzione {RAL}"] }) });
    expect(plain(chat.text?.body)).toContain("• Retribuzione da 32.000 €");

    const social = preview("instagram", "image_text", "1:1", {
      facts: FACTS,
      text: { ...CAPTION, primary: "RAL {RAL} e tempo indeterminato." },
      image: { ...CREATIVE, subline: "RAL {RAL}" },
    });
    expect(plain(social.text?.body)).toContain("RAL da 32.000 € e tempo indeterminato.");
    expect(plain(social.html)).toContain("RAL da 32.000 €");
    expect(social.html).not.toContain("{RAL}");
  });
});
