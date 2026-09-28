import { findSalaryLeaks, parseAmounts } from "@job-ads-engine/content";
import { CAPTION, CHAT_MESSAGE, FACTS, JOB_DESCRIPTION } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import {
  jobDescriptionSections,
  renderCaptionText,
  renderChatMessageText,
  renderJobBoardText,
  type RenderContext,
} from "../src/render/text.js";

const ctx: RenderContext = { facts: FACTS, location: "Orzinuovi (BS)", jobTitle: "Tecnico elettricista fotovoltaico" };
const plain = (s: string) => s.replace(/ /g, " ");

describe("sezioni della JobDescription", () => {
  const sections = jobDescriptionSections(JOB_DESCRIPTION, FACTS);

  it("headline e role.title fanno da titolo, poi i titoli fissi", () => {
    expect(sections.map((s) => s.title)).toEqual([
      JOB_DESCRIPTION.headline,
      JOB_DESCRIPTION.role.title,
      "Quello che ti offrirà l'azienda:",
      "Il tuo profilo:",
    ]);
  });

  it("la riga RAL dai facts è il primo bullet dell'offerta", () => {
    expect(plain(sections[2]!.bullets[0]!)).toBe("RAL da 32.000 €");
    expect(sections[2]!.bullets.slice(1)).toEqual(JOB_DESCRIPTION.offer);
  });

  it("senza RAL l'offerta contiene solo i bullet generati", () => {
    expect(jobDescriptionSections(JOB_DESCRIPTION, { ...FACTS, salary: null })[2]!.bullets).toEqual(JOB_DESCRIPTION.offer);
  });
});

describe("testo per kind", () => {
  it("Indeed: campi dai facts e descrizione", async () => {
    const text = renderJobBoardText(JOB_DESCRIPTION, ctx);
    expect(text.fields).toMatchObject({
      Titolo: "Tecnico elettricista fotovoltaico",
      Azienda: "AB Group SpA",
      Luogo: "Orzinuovi (BS)",
      Contratto: "Tempo indeterminato",
      Esperienza: "3–5 anni di esperienza",
      Competenze: "Fotovoltaico industriale, Cabine secondarie - MT/BT",
    });
    expect(plain(text.fields!.RAL!)).toBe("da 32.000 €");
    await expect(`${Object.entries(text.fields!).map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${text.body}\n`)
      .toMatchFileSnapshot("./__snapshots__/render/indeed.txt");
  });

  it("Indeed senza facts opzionali omette i campi vuoti", () => {
    const facts = { ...FACTS, salary: null, contract_type: null, experience: { min_years: null, max_years: null }, skills: [] };
    expect(Object.keys(renderJobBoardText(JOB_DESCRIPTION, { ...ctx, facts }).fields!)).toEqual([
      "Titolo",
      "Azienda",
      "Luogo",
    ]);
  });

  it("WhatsApp: apertura in grassetto, bullet, riga dei facts, CTA", async () => {
    const { body, fields } = renderChatMessageText(CHAT_MESSAGE, ctx);
    expect(fields).toBeUndefined();
    expect(body.startsWith(`*${CHAT_MESSAGE.opening}*\n\n• `)).toBe(true);
    expect(plain(body)).toContain("📍 Orzinuovi (BS) · RAL da 32.000 € · Tempo indeterminato");
    expect(body.endsWith(CHAT_MESSAGE.cta)).toBe(true);
    await expect(`${body}\n`).toMatchFileSnapshot("./__snapshots__/render/whatsapp.txt");
  });

  it("WhatsApp accanto all'immagine, senza bullet, non lascia righe vuote in più", () => {
    const { body } = renderChatMessageText({ ...CHAT_MESSAGE, bullets: [] }, ctx);
    expect(body).not.toContain("\n\n\n");
    expect(body.split("\n\n")).toHaveLength(3);
  });

  it("caption: solo testo generato, senza facts", async () => {
    const { body } = renderCaptionText(CAPTION);
    expect(body).toBe(`${CAPTION.primary}\n\n${CAPTION.cta}\n\n#lavoro #fotovoltaico`);
    expect(parseAmounts(body)).not.toContain(32000);
    await expect(`${body}\n`).toMatchFileSnapshot("./__snapshots__/render/caption.txt");
  });

  it("le cifre della RAL compaiono solo nelle righe composte dai facts", () => {
    const { body } = renderJobBoardText(JOB_DESCRIPTION, ctx);
    const leaking = body.split("\n").filter((line) => findSalaryLeaks({ line }, FACTS.salary).length > 0);
    expect(leaking.map(plain)).toEqual(["• RAL da 32.000 €"]);
  });
});
