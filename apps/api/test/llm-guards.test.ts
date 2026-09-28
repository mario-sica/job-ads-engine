import { CAPTION, CREATIVE, JOB_DESCRIPTION } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { findToneIssues } from "../src/llm/guards.js";

describe("guardrail di tono", () => {
  it.each([
    ["contrapposizione con la virgola", "Grandi impianti FV, non tetti"],
    ["contrapposizione in una frase lunga", "Lavoro vero in cantiere, non in ufficio."],
    ["contrapposizione col trattino", "Impianti industriali – non piccoli lavori"],
    ["apertura in negativo", "Niente scrivania: sopralluoghi e collaudi."],
    ["apertura in negativo dopo un punto", "Si parte presto. Basta ufficio."],
    ["aggettivo che sottintende un confronto", "Cantieri, collaudi, impianti veri"],
  ])("segnala %s", (_, text) => {
    expect(findToneIssues({ image: { hook: text } })).toEqual([expect.stringContaining("image.hook: frase costruita per contrasto")]);
  });

  it.each([["🔧"], ["👷‍♂️"], ["☀️"], ["⚡"], ["🇮🇹"]])("segnala l'emoji %s", (emoji) => {
    expect(findToneIssues({ text: { opening: `Cerchiamo un tecnico ${emoji}` } })).toEqual([
      expect.stringContaining("text.opening: contiene emoji"),
    ]);
  });

  it.each([["Cerchiamo un giovane installatore"], ["Ambiente giovanile e dinamico"], ["Candidati se sei under 30"]])(
    "segnala l'età nel testo: %s",
    (text) => {
      expect(findToneIssues({ text: { primary: text } })).toEqual([expect.stringContaining("text.primary: indica l'età")]);
    },
  );

  it("non segnala l'età nella descrizione della foto", () => {
    expect(findToneIssues({ image: { visual_brief: "Giovane tecnico che installa uno split a parete" } })).toEqual([]);
  });

  it("indica il campo anche dentro le liste", () => {
    expect(findToneIssues({ text: { bullets: ["Ticket da 13 €", "Impianti veri"] } })[0]).toMatch(/^text\.bullets\.1:/);
  });

  it.each([
    ["negazione normale", "Se non hai mai lavorato su impianti MT, ti formeremo."],
    ["numeri e simboli", "Ticket da 13 € · 60 € lordi a notte · MT/BT"],
    ["parole che contengono 'vero'", "Il Gruppo AB ha una rete di fornitori e verifiche severe"],
  ])("non segnala %s", (_, text) => {
    expect(findToneIssues({ text: { primary: text } })).toEqual([]);
  });

  it("i contenuti di riferimento senza emoji passano", () => {
    expect(findToneIssues({ text: JOB_DESCRIPTION, caption: CAPTION, image: CREATIVE })).toEqual([]);
  });
});
