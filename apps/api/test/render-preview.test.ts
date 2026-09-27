import { FACTS, validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { createChannelFormatsRepository } from "../src/modules/channel-formats/repository.js";
import type { LocationInput } from "../src/modules/locations/repository.js";
import { renderPreview } from "../src/render/index.js";
import { seededDb } from "./helpers.js";

const formats = createChannelFormatsRepository(seededDb()).list();
const location: LocationInput = {
  street_name: "Via Artigianato",
  street_number: "27",
  postal_code: "25034",
  locality: "Orzinuovi",
  province: "Brescia",
  province_code: "BS",
  region: "Lombardia",
  country_code: "IT",
};

describe("anteprima per ogni combinazione del seed", () => {
  it.each(formats.map((f) => [`${f.channel_code} ${f.format} ${f.aspect_ratio ?? ""}`, f] as const))("%s", (_, target) => {
    const preview = renderPreview({ target, content: validContent(target), location, precision: "locality" });
    expect(preview.text !== null).toBe(target.format !== "image");
    expect(preview.html !== null).toBe(target.format !== "text");
    if (preview.html) expect(preview.html).toContain(`width: ${target.specs.width_px}px; height: ${target.specs.height_px}px;`);
  });
});

describe("anteprima", () => {
  const indeed = formats.find((f) => f.channel_code === "indeed")!;

  it("il luogo segue la precisione dell'annuncio", () => {
    const at = (precision: "address" | "locality" | "province") =>
      renderPreview({ target: indeed, content: validContent(indeed), location, precision }).text?.fields?.Luogo;
    expect(at("address")).toBe("Via Artigianato 27, 25034 Orzinuovi (BS)");
    expect(at("locality")).toBe("Orzinuovi (BS)");
    expect(at("province")).toBe("Provincia di Brescia");
  });

  it("un contenuto non valido per il formato è rifiutato", () => {
    expect(() => renderPreview({ target: indeed, content: { facts: FACTS }, location, precision: "locality" })).toThrow(ZodError);
  });
});
