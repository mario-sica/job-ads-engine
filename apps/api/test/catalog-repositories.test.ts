import { buildFacts, contentSchemaFor, InvalidSpecsError } from "@job-ads-engine/content";
import { validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../src/errors.js";
import { createChannelFormatsRepository } from "../src/modules/channel-formats/repository.js";
import { createJobOffersRepository } from "../src/modules/job-offers/repository.js";
import { seededDb } from "./helpers.js";

describe("repository delle job offer", () => {
  it("l'elenco restituisce solo id, titolo, azienda e luogo", () => {
    const offers = createJobOffersRepository(seededDb()).list();
    for (const offer of offers) expect(Object.keys(offer).sort()).toEqual(["company_name", "id", "location", "title"]);
    expect(offers.find((o) => o.id === "jo_001")).toEqual({
      id: "jo_001",
      title: "Tecnico elettricista fotovoltaico",
      company_name: "AB Group SpA",
      location: expect.objectContaining({ locality: "Orzinuovi", province_code: "BS", street_name: "Via Artigianato" }),
    });
  });

  it("il dettaglio ha skill e luogo già convertiti, senza raw", () => {
    const offer = createJobOffersRepository(seededDb()).get("jo_001");
    expect(offer).toMatchObject({
      required_skills: ["Fotovoltaico industriale", "Cabine secondarie - MT/BT"],
      location: { locality: "Orzinuovi" },
    });
    expect(offer).not.toHaveProperty("raw");
  });

  it("la job offer letta va bene per buildFacts", () => {
    const offer = createJobOffersRepository(seededDb()).get("jo_001");
    expect(buildFacts(offer, "range").salary).toEqual({ min: 32000, max: 38000, currency: "EUR", framing: "range" });
  });

  it("un id inesistente solleva NotFoundError", () => {
    expect(() => createJobOffersRepository(seededDb()).get("jo_999")).toThrow(NotFoundError);
  });
});

describe("repository dei formati di canale", () => {
  it("elenca le 12 combinazioni con kind e specs già parsate", () => {
    const formats = createChannelFormatsRepository(seededDb()).list();
    expect(formats).toHaveLength(12);
    const vertical = formats.find((f) => f.channel_code === "instagram" && f.format === "image" && f.aspect_ratio === "9:16");
    expect(vertical).toMatchObject({ channel_name: "Instagram", kind: "social", specs: { limits: { image: { title_max: 36, hook_max: 48, subline_max: 36 } } } });
  });

  it("ogni formato è un ContentTarget valido", () => {
    for (const format of createChannelFormatsRepository(seededDb()).list()) {
      expect(contentSchemaFor(format).safeParse(validContent(format)).success).toBe(true);
    }
  });

  it("legge per id", () => {
    const repo = createChannelFormatsRepository(seededDb());
    const [first] = repo.list();
    expect(repo.get(first!.id)).toEqual(first);
  });

  it("un id inesistente solleva NotFoundError", () => {
    expect(() => createChannelFormatsRepository(seededDb()).get(999)).toThrow(NotFoundError);
  });

  it("specs non valide nel DB sono un errore di configurazione", () => {
    const db = seededDb();
    db.prepare(`UPDATE channel_formats SET specs = '{"limts":{}}' WHERE channel_code = 'indeed'`).run();
    expect(() => createChannelFormatsRepository(db).list()).toThrow(InvalidSpecsError);
  });
});
