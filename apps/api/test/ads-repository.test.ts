import { SCHEMA_VERSION } from "@job-ads-engine/content";
import { validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../src/errors.js";
import { adsSetup } from "./ads-fixtures.js";

describe("creazione di un annuncio", () => {
  it("salva annuncio, varianti, revisioni e puntatori", () => {
    const { ads, format, newAd, count } = adsSetup();
    const indeed = format("indeed", "text");
    const ad = ads.create(newAd(indeed));

    expect(ad).toMatchObject({
      job_offer_id: "jo_001",
      channel_code: "indeed",
      kind: "job_board",
      format: "text",
      aspect_ratio: null,
      status: "draft",
      location_precision: "locality",
      location: { locality: "Orzinuovi", province_code: "BS" },
    });
    expect(ad.variants.map((v) => [v.label, v.angle, v.is_active])).toEqual([
      ["A", "crescita", true],
      ["B", "stabilità", true],
    ]);
    const [a] = ad.variants;
    expect(a?.current_revision).toMatchObject({
      variant_id: a?.id,
      source: "llm",
      model: "modello-di-test",
      prompt_version: "test-1",
      schema_version: SCHEMA_VERSION,
      content: validContent(indeed),
      input_snapshot: { angle: "crescita", published_location: "Orzinuovi (BS)" },
    });
    expect([count("ads"), count("ad_variants"), count("ad_revisions")]).toEqual([1, 2, 2]);
  });

  it("accetta una revisione manuale senza metadati di generazione", () => {
    const { ads, format, newAd, manualRevision } = adsSetup();
    const f = format("whatsapp", "text");
    const ad = ads.create(newAd(f, { variants: [{ label: "A", angle: null, revision: manualRevision(f) }] }));
    expect(ad.variants[0]?.current_revision).toMatchObject({ source: "manual", model: null, prompt_version: null, input_snapshot: null });
  });

  describe("è atomica: se una parte fallisce non resta nulla", () => {
    const expectEmpty = (count: (t: string) => number) =>
      expect([count("ads"), count("ad_variants"), count("ad_revisions")]).toEqual([0, 0, 0]);

    it("label duplicata", () => {
      const { ads, format, newAd, llmRevision, count } = adsSetup();
      const f = format("indeed", "text");
      const dup = { label: "A", angle: null, revision: llmRevision(f) };
      expect(() => ads.create(newAd(f, { variants: [dup, dup] }))).toThrow(/UNIQUE/);
      expectEmpty(count);
    });

    it("formato di canale inesistente", () => {
      const { ads, format, newAd, count } = adsSetup();
      expect(() => ads.create(newAd(format("indeed", "text"), { channel_format_id: 999 }))).toThrow(/FOREIGN KEY/);
      expectEmpty(count);
    });

    it("revisione llm senza metadati, rifiutata dal CHECK del DB", () => {
      const { ads, format, newAd, count } = adsSetup();
      const f = format("indeed", "text");
      // Aggira i tipi apposta: il vincolo deve reggere anche se l'applicazione sbaglia.
      const broken = { source: "llm", content: validContent(f) } as never;
      expect(() => ads.create(newAd(f, { variants: [{ label: "A", angle: null, revision: broken }] }))).toThrow(/CHECK/);
      expectEmpty(count);
    });
  });
});

describe("lettura degli annunci", () => {
  it("get e getVariant sollevano NotFoundError sugli id inesistenti", () => {
    const { ads } = adsSetup();
    expect(() => ads.get(999)).toThrow(NotFoundError);
    expect(() => ads.getVariant(999)).toThrow(NotFoundError);
  });

  it("getVariant restituisce la variante con la revisione corrente", () => {
    const { ads, format, newAd } = adsSetup();
    const [, b] = ads.create(newAd(format("indeed", "text"))).variants;
    expect(ads.getVariant(b!.id)).toEqual(b);
  });

  it("filtra per job offer, canale e stato, anche combinati", () => {
    const { db, ads, format, newAd } = adsSetup();
    const indeed = ads.create(newAd(format("indeed", "text")));
    const whatsapp = ads.create(newAd(format("whatsapp", "image", "A4")));
    const tiktok = ads.create(newAd(format("tiktok", "image_text", "9:16")));
    db.prepare("UPDATE ads SET status = 'active' WHERE id IN (?, ?)").run(indeed.id, tiktok.id);

    const ids = (filters: Parameters<typeof ads.list>[0]) => ads.list(filters).map((a) => a.id).sort();
    expect(ids({})).toEqual([indeed.id, whatsapp.id, tiktok.id].sort());
    expect(ids({ job_offer_id: "jo_001" })).toHaveLength(3);
    expect(ids({ job_offer_id: "jo_999" })).toEqual([]);
    expect(ids({ channel: "whatsapp" })).toEqual([whatsapp.id]);
    expect(ids({ status: "active" })).toEqual([indeed.id, tiktok.id].sort());
    expect(ids({ channel: "tiktok", status: "active" })).toEqual([tiktok.id]);
    expect(ids({ channel: "whatsapp", status: "active" })).toEqual([]);
  });

  it("ordina dal più recentemente aggiornato", () => {
    const { db, ads, format, newAd } = adsSetup();
    const older = ads.create(newAd(format("indeed", "text")));
    const newer = ads.create(newAd(format("whatsapp", "text")));
    db.prepare("UPDATE ads SET updated_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(newer.id);
    expect(ads.list().map((a) => a.id)).toEqual([older.id, newer.id]);
  });
});
