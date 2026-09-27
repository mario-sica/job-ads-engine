import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildFacts,
  contentSchemaFor,
  findSalaryLeaks,
  FORMATS,
  InvalidSpecsError,
  KINDS,
  llmOutputSchemaFor,
  parseAmounts,
  parseSpecs,
  UnsupportedFormatError,
  type Format,
  type Kind,
} from "../src/index.js";
import { CHAT_MESSAGE, CREATIVE, FACTS, FACTS_SOURCE, JOB_DESCRIPTION, validContent } from "./fixtures.js";

const target = (kind: Kind, format: Format, specs: unknown = {}) => ({ kind, format, specs: parseSpecs(specs) });
const issuePaths = (result: { success: boolean; error?: z.ZodError }) =>
  result.error?.issues.map((i) => i.path.join(".")) ?? [];

// Tutte le combinazioni kind × formato previste dal modello (job_board è solo testo)
const SUPPORTED = KINDS.flatMap((kind) =>
  FORMATS.filter((format) => kind !== "job_board" || format === "text").map((format) => [kind, format] as const),
);

describe("schemi per ogni combinazione kind × formato", () => {
  it.each(SUPPORTED)("%s %s accetta un contenuto valido e produce un JSON Schema", (kind, format) => {
    const t = target(kind, format);
    expect(issuePaths(contentSchemaFor(t).safeParse(validContent(t)))).toEqual([]);
    expect(z.toJSONSchema(llmOutputSchemaFor(t)).type).toBe("object");
  });
});

describe("il formato decide le parti", () => {
  it("image_text senza immagine è rifiutato", () => {
    const t = target("messaging", "image_text");
    const { image: _, ...content } = validContent(t);
    expect(issuePaths(contentSchemaFor(t).safeParse(content))).toContain("image");
  });

  it("un formato image non accetta la parte text", () => {
    const t = target("social", "image");
    const content = { ...validContent(t), text: CHAT_MESSAGE };
    expect(contentSchemaFor(t).safeParse(content).success).toBe(false);
  });

  it("job_board non prevede immagini", () => {
    expect(() => contentSchemaFor(target("job_board", "image"))).toThrow(UnsupportedFormatError);
  });
});

describe("i limiti arrivano da specs", () => {
  it("override sul numero di bullet: 3 ok con [3,6], rifiutati con [0,2]", () => {
    const alone = target("messaging", "text", { limits: { text: { bullets: [3, 6] } } });
    const withImage = target("messaging", "image_text", { limits: { text: { bullets: [0, 2] } } });
    expect(contentSchemaFor(alone).safeParse({ facts: FACTS, text: CHAT_MESSAGE }).success).toBe(true);
    const tooLong = { ...validContent(withImage), text: CHAT_MESSAGE };
    expect(issuePaths(contentSchemaFor(withImage).safeParse(tooLong))).toContain("text.bullets");
  });

  it("hook di 35 caratteri: ok con override a 40, rifiutato col default a 30", () => {
    const hook = "ENTRA IN UNA MULTINAZIONALE LEADER!"; // 35
    const vertical = target("social", "image", { limits: { image: { hook_max: 40 } } });
    const square = target("social", "image");
    const content = { facts: FACTS, image: { ...CREATIVE, hook } };
    expect(contentSchemaFor(vertical).safeParse(content).success).toBe(true);
    expect(issuePaths(contentSchemaFor(square).safeParse(content))).toContain("image.hook");
  });

  it("override annidati si fondono con i default", () => {
    const t = target("messaging", "image", { limits: { image: { description: { profile_bullets: [1, 1] } } } });
    const tooMany = { facts: FACTS, image: { ...validContent(t).image as object, description: JOB_DESCRIPTION } };
    expect(issuePaths(contentSchemaFor(t).safeParse(tooMany))).toContain("image.description.profile");
  });

  it("override incoerenti sono errori di configurazione", () => {
    expect(() => contentSchemaFor(target("messaging", "text", { limits: { text: { bullets: [4, 2] } } }))).toThrow(
      InvalidSpecsError,
    );
  });

  it("chiavi sconosciute in specs sono rifiutate", () => {
    expect(() => parseSpecs({ limts: {} })).toThrow(InvalidSpecsError);
  });
});

describe("vincoli dei blocchi", () => {
  it("l'evidenziazione deve stare nel titolo", () => {
    const t = target("social", "image");
    const content = { facts: FACTS, image: { ...CREATIVE, title: { text: "Tecnico FV", highlight: "Elettricista" } } };
    expect(issuePaths(contentSchemaFor(t).safeParse(content))).toContain("image.title.highlight");
  });

  it("i bullet vuoti non passano", () => {
    const content = { facts: FACTS, text: { ...JOB_DESCRIPTION, profile: ["  ", "Esperienza in MT."] } };
    expect(contentSchemaFor(target("job_board", "text")).safeParse(content).success).toBe(false);
  });
});

describe("facts", () => {
  it("si costruiscono dai campi della job offer", () => {
    expect(FACTS).toEqual({
      company_name: "AB Group SpA",
      contract_type: "Tempo indeterminato",
      experience: { min_years: 3, max_years: 5 },
      salary: { min: 32000, max: 38000, currency: "EUR", framing: "from" },
      skills: ["Fotovoltaico industriale", "Cabine secondarie - MT/BT"],
    });
  });

  it("un framing incompatibile ripiega su uno valido", () => {
    const facts = buildFacts({ ...FACTS_SOURCE, ral_min: null }, "range");
    expect(facts.salary).toMatchObject({ min: null, max: 38000, framing: "up_to" });
  });

  it("senza RAL la salary è null", () => {
    expect(buildFacts({ ...FACTS_SOURCE, ral_min: null, ral_max: null }, "from").salary).toBeNull();
  });

  it("RAL minima superiore alla massima è rifiutata", () => {
    expect(() => buildFacts({ ...FACTS_SOURCE, ral_min: 40000 }, "range")).toThrow();
  });
});

describe("guardrail RAL", () => {
  it.each([
    ["RAL iniziale da €38'000 + indennità", [38000]],
    ["fino a 38k", [38000]],
    ["da 32.000 a 38.000 €", [32000, 38000]],
    ["32 mila euro", [32000]],
  ])("riconosce gli importi in %s", (text, expected) => {
    expect(parseAmounts(text)).toEqual(expected);
  });

  it("segnala solo le cifre della RAL, non altri numeri", () => {
    const generated = {
      text: {
        company: ["Oltre 1.700 dipendenti in 20 Paesi."],
        offer: ["RAL fino a 38k", "Ticket da 13 € al giorno."],
        profile: ["Impianti oltre 100 kW."],
      },
    };
    expect(findSalaryLeaks(generated, FACTS.salary)).toEqual(["text.offer.0"]);
  });
});
