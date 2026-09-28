import { describe, expect, it } from "vitest";
import { formatLabel, locationLabel } from "../src/labels.js";

const place = { street_name: null, street_number: null, postal_code: null, province: null, region: null, country_code: "IT" };

describe("etichette", () => {
  it("il formato unisce canale, tipo e proporzione", () => {
    expect(formatLabel({ channel_name: "Instagram", format: "image", aspect_ratio: "9:16" })).toBe("Instagram · immagine · 9:16");
    expect(formatLabel({ channel_name: "Indeed", format: "text", aspect_ratio: null })).toBe("Indeed · testo");
  });

  it("il luogo mostra la località con la sigla, o il livello più ampio disponibile", () => {
    expect(locationLabel({ ...place, locality: "Orzinuovi", province_code: "BS" })).toBe("Orzinuovi (BS)");
    expect(locationLabel({ ...place, locality: null, province_code: "BS", province: "Brescia" })).toBe("Brescia");
    expect(locationLabel({ ...place, locality: null, province_code: null, region: "Lombardia" })).toBe("Lombardia");
  });
});
