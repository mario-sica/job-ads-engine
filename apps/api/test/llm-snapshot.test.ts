import { describe, expect, it } from "vitest";
import { buildInputSnapshot } from "../src/llm/snapshot.js";
import { llmSetup } from "./llm-fixtures.js";

describe("input_snapshot", () => {
  const { jobOffer, format, location } = llmSetup();
  const indeed = format("indeed", "text");
  const snapshot = buildInputSnapshot({ target: indeed, jobOffer, location, precision: "locality", angle: "crescita" });

  it("contiene canale, angle, luoghi e i testi della job offer", () => {
    expect(snapshot).toMatchObject({
      channel: { name: "Indeed", kind: "job_board", format: "text", aspect_ratio: null },
      angle: "crescita",
      published_location: "Orzinuovi (BS)",
      job_offer: {
        title: "Tecnico elettricista fotovoltaico",
        company_name: "AB Group SpA",
        workplace: "Orzinuovi (BS)",
        experience: { min_years: 3, max_years: 5 },
        required_skills: jobOffer.required_skills,
        role_description: jobOffer.role_description,
      },
      salary_framings: ["range", "from", "up_to"],
    });
  });

  it("non contiene id, stato, date, raw, indirizzo civico né i campi numerici della RAL", () => {
    const json = JSON.stringify(snapshot);
    for (const leaked of ["jo_001", "Via Artigianato", "25034", "2026-02-08", "ral_min", "ral_max", '"status"', '"raw"', '"id"']) {
      expect(json).not.toContain(leaked);
    }
  });

  it("con precisione address il modello riceve comunque solo la località", () => {
    const withAddress = buildInputSnapshot({ target: indeed, jobOffer, location, precision: "address", angle: null });
    expect(withAddress.published_location).toBe("Orzinuovi (BS)");
    expect(buildInputSnapshot({ target: indeed, jobOffer, location, precision: "province", angle: null }).published_location).toBe(
      "Provincia di Brescia",
    );
  });

  it("il luogo pubblicato può differire dalla sede", () => {
    const brescia = { ...location, locality: "Brescia", street_name: null, street_number: null, postal_code: null };
    const s = buildInputSnapshot({ target: indeed, jobOffer, location: brescia, precision: "locality", angle: null });
    expect([s.published_location, s.job_offer.workplace]).toEqual(["Brescia (BS)", "Orzinuovi (BS)"]);
  });

  it("i framing seguono i dati della RAL", () => {
    const framings = (ral_min: number | null, ral_max: number | null, currency: string | null = "EUR") =>
      buildInputSnapshot({ target: indeed, jobOffer: { ...jobOffer, ral_min, ral_max, currency }, location, precision: "locality", angle: null })
        .salary_framings;
    expect(framings(32000, null)).toEqual(["from"]);
    expect(framings(null, 38000)).toEqual(["up_to"]);
    expect(framings(null, null)).toEqual([]);
    expect(framings(32000, 38000, null)).toEqual([]);
  });
});
