import { describe, expect, it } from "vitest";
import { EMPTY_LOCATION, toCreateInput, type CreateAdDraft } from "../src/create-ad.js";

const draft: CreateAdDraft = {
  jobOfferId: "jo_001",
  channelFormatId: 5,
  customLocation: false,
  location: EMPTY_LOCATION,
  precision: "",
  angles: ["", "  crescita professionale  "],
};

describe("creazione di un annuncio", () => {
  it("senza luogo né precisione lascia decidere al backend", () => {
    expect(toCreateInput(draft)).toEqual({
      job_offer_id: "jo_001",
      channel_format_id: 5,
      variants: [{ angle: null }, { angle: "crescita professionale" }],
    });
  });

  it("un luogo diverso passa con i campi vuoti a null", () => {
    const input = toCreateInput({
      ...draft,
      customLocation: true,
      location: { ...EMPTY_LOCATION, locality: " Brescia ", province_code: "BS" },
      precision: "locality",
    });
    expect(input).toMatchObject({
      location: { locality: "Brescia", province_code: "BS", street_name: null, region: null, country_code: "IT" },
      location_precision: "locality",
    });
  });

  it("senza job offer o formato non c'è nulla da inviare", () => {
    expect(toCreateInput({ ...draft, jobOfferId: "" })).toBeNull();
    expect(toCreateInput({ ...draft, channelFormatId: null })).toBeNull();
  });
});
