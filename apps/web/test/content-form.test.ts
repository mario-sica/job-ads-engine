import { contentSchemaFor, parseSpecs, type ContentTarget } from "@job-ads-engine/content";
import { validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { editableFields, fromValues, splitLines, toValues, validate } from "../src/content-form.js";

const target = (kind: ContentTarget["kind"], format: ContentTarget["format"], specs: unknown = {}): ContentTarget => ({
  kind,
  format,
  specs: parseSpecs(specs),
});

const TARGETS = [
  target("job_board", "text"),
  target("messaging", "text"),
  target("messaging", "image"),
  target("messaging", "image_text"),
  target("social", "image"),
  target("social", "image_text"),
];

describe("modulo di edit", () => {
  it("i campi nascono dallo schema, senza i facts", () => {
    const keys = editableFields(target("social", "image_text")).map((f) => f.key);
    expect(keys).toEqual([
      "text.primary",
      "text.cta",
      "text.hashtags",
      "image.title.text",
      "image.title.highlight",
      "image.hook",
      "image.subline",
      "image.visual_brief",
    ]);
  });

  it("i limiti arrivano dalle specs del formato", () => {
    const fields = editableFields(target("social", "image", { limits: { image: { hook_max: 48 } } }));
    expect(fields.find((f) => f.key === "image.hook")?.maxLength).toBe(48);
    const offer = editableFields(target("job_board", "text")).find((f) => f.key === "text.offer");
    expect(offer).toMatchObject({ type: "list", maxLength: 160, minItems: 1, maxItems: 3 });
  });

  it.each(TARGETS)("andata e ritorno senza modifiche restituisce lo stesso contenuto ($kind, $format)", (t) => {
    const content = validContent(t) as Record<string, unknown>;
    const fields = editableFields(t);
    const back = fromValues(fields, toValues(fields, content), content);
    expect(back).toEqual(content);
    expect(validate(t, fields, back)).toEqual({});
  });

  it("le liste si scrivono una riga per elemento, ignorando le righe vuote", () => {
    expect(splitLines("  primo \n\n secondo\n")).toEqual(["primo", "secondo"]);
  });

  it("modifica solo il campo cambiato e non tocca il contenuto di partenza", () => {
    const t = target("job_board", "text");
    const content = validContent(t) as Record<string, unknown>;
    const snapshot = structuredClone(content);
    const fields = editableFields(t);
    const values = { ...toValues(fields, content), "text.role.title": "Nuovo titolo" };
    const edited = fromValues(fields, values, content);
    expect(edited).toMatchObject({ text: { role: { title: "Nuovo titolo" } }, facts: content.facts });
    expect(content).toEqual(snapshot);
    expect(contentSchemaFor(t).safeParse(edited).success).toBe(true);
  });

  it("gli errori finiscono sul campo giusto, con la riga per le liste", () => {
    const t = target("job_board", "text");
    const content = validContent(t) as Record<string, unknown>;
    const fields = editableFields(t);
    const values = { ...toValues(fields, content), "text.headline": "", "text.offer": `ok\n${"x".repeat(161)}` };
    const errors = validate(t, fields, fromValues(fields, values, content));
    expect(Object.keys(errors).sort()).toEqual(["text.headline", "text.offer"]);
    expect(errors["text.offer"]?.[0]).toMatch(/^riga 2: /);
  });

  it("i vincoli tra campi finiscono sul campo indicato dallo schema", () => {
    const t = target("social", "image");
    const content = validContent(t) as Record<string, unknown>;
    const fields = editableFields(t);
    const values = { ...toValues(fields, content), "image.title.highlight": "assente" };
    expect(Object.keys(validate(t, fields, fromValues(fields, values, content)))).toEqual(["image.title.highlight"]);
  });

  it("un errore fuori dai campi, come nei facts, resta visibile con il suo percorso", () => {
    const t = target("messaging", "text");
    const content = { ...(validContent(t) as Record<string, unknown>), facts: {} };
    const fields = editableFields(t);
    expect(validate(t, fields, content)[""]?.[0]).toMatch(/^facts\./);
  });
});
