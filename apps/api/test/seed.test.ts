import { describe, expect, it } from "vitest";
import { buildFacts, contentSchemaFor, type FactsSource } from "@job-ads-engine/content";
import { FACTS_SOURCE, validContent } from "@job-ads-engine/content/testing";
import { channelFormats, seedJobOffers, seededDb } from "./helpers.js";

const rows = channelFormats(seededDb());

describe("seed dei canali", () => {
  it("contiene le 12 combinazioni previste", () => {
    expect(rows).toHaveLength(12);
  });

  it.each(rows.map((r) => [`${r.channel_code} ${r.format} ${r.aspect_ratio ?? ""}`, r] as const))(
    "%s: le specs sono valide e lo schema accetta un contenuto valido",
    (_, target) => {
      const result = contentSchemaFor(target).safeParse(validContent(target));
      expect(result.error?.issues ?? []).toEqual([]);
    },
  );
});

describe("seed delle job offer", () => {
  it("la fixture dei facts coincide con jo_001", () => {
    const jo = seedJobOffers[0];
    const source = Object.fromEntries(Object.keys(FACTS_SOURCE).map((k) => [k, jo?.[k]]));
    expect(source).toEqual(FACTS_SOURCE);
  });

  it("jo_001 produce facts validi", () => {
    const facts = buildFacts(seedJobOffers[0] as unknown as FactsSource, "range");
    expect(facts.salary).toEqual({ min: 32000, max: 38000, currency: "EUR", framing: "range" });
  });
});
