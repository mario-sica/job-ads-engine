import { validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { InvalidTransitionError, NotFoundError } from "../src/errors.js";
import { adsSetup } from "./ads-fixtures.js";

const OLD = "2020-01-01T00:00:00.000Z";

/** Annuncio Indeed con due varianti e `updated_at` riportato indietro, per vedere se una scrittura lo aggiorna. */
function withAd() {
  const setup = adsSetup();
  const f = setup.format("indeed", "text");
  const ad = setup.ads.create(setup.newAd(f));
  setup.db.prepare("UPDATE ads SET updated_at = ? WHERE id = ?").run(OLD, ad.id);
  const updatedAt = () => setup.ads.get(ad.id).updated_at;
  const [a, b] = ad.variants;
  return { ...setup, f, ad, a: a!, b: b!, updatedAt };
}

const edited = (content: Record<string, unknown>) => {
  const text = content.text as Record<string, unknown>;
  return { ...content, text: { ...text, headline: "Titolo modificato a mano" } };
};

describe("nuova revisione", () => {
  it("diventa la corrente e lascia intatta la precedente", () => {
    const { ads, a, f, updatedAt } = withAd();
    const revision = ads.addRevision(a.id, { source: "manual", content: edited(validContent(f)) });

    expect(ads.getVariant(a.id).current_revision).toEqual(revision);
    expect(revision).toMatchObject({ source: "manual", model: null, variant_id: a.id });
    expect(ads.listRevisions(a.id)).toEqual([revision, a.current_revision]);
    expect(updatedAt()).not.toBe(OLD);
  });

  it("le revisioni restano immutabili anche con SQL diretto", () => {
    const { db, a } = withAd();
    expect(() => db.prepare("UPDATE ad_revisions SET content = '{}' WHERE id = ?").run(a.current_revision.id)).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM ad_revisions WHERE id = ?").run(a.current_revision.id)).toThrow(/append-only/);
  });

  it("su una variante inesistente solleva NotFoundError e non scrive nulla", () => {
    const { ads, f, count } = withAd();
    const before = count("ad_revisions");
    expect(() => ads.addRevision(999, { source: "manual", content: validContent(f) })).toThrow(NotFoundError);
    expect(() => ads.listRevisions(999)).toThrow(NotFoundError);
    expect(count("ad_revisions")).toBe(before);
  });
});

describe("ripristino", () => {
  it("riporta il puntatore su una revisione precedente senza crearne una nuova", () => {
    const { ads, a, f, count, db, ad, updatedAt } = withAd();
    ads.addRevision(a.id, { source: "manual", content: edited(validContent(f)) });
    db.prepare("UPDATE ads SET updated_at = ? WHERE id = ?").run(OLD, ad.id);
    const before = count("ad_revisions");

    const restored = ads.restoreRevision(a.id, a.current_revision.id);
    expect(restored.current_revision).toEqual(a.current_revision);
    expect(count("ad_revisions")).toBe(before);
    expect(updatedAt()).not.toBe(OLD);
  });

  it("rifiuta una revisione di un'altra variante", () => {
    const { ads, a, b } = withAd();
    expect(() => ads.restoreRevision(a.id, b.current_revision.id)).toThrow(NotFoundError);
    expect(ads.getVariant(a.id).current_revision.id).toBe(a.current_revision.id);
  });

  it("rifiuta variante o revisione inesistenti", () => {
    const { ads, a } = withAd();
    expect(() => ads.restoreRevision(999, a.current_revision.id)).toThrow(NotFoundError);
    expect(() => ads.restoreRevision(a.id, 999)).toThrow(NotFoundError);
  });
});

describe("varianti", () => {
  it("addVariant aggiunge una variante con la sua prima revisione", () => {
    const { ads, ad, f, llmRevision, updatedAt } = withAd();
    const c = ads.addVariant(ad.id, { label: "C", angle: "vicinanza", revision: llmRevision(f) });
    expect(c).toMatchObject({ ad_id: ad.id, label: "C", angle: "vicinanza", is_active: true });
    expect(c.current_revision).toMatchObject({ variant_id: c.id, source: "llm" });
    expect(ads.get(ad.id).variants.map((v) => v.label)).toEqual(["A", "B", "C"]);
    expect(updatedAt()).not.toBe(OLD);
  });

  it("addVariant con label già usata o annuncio inesistente non scrive nulla", () => {
    const { ads, ad, f, llmRevision, count } = withAd();
    const before = [count("ad_variants"), count("ad_revisions")];
    expect(() => ads.addVariant(ad.id, { label: "A", angle: null, revision: llmRevision(f) })).toThrow(/UNIQUE/);
    expect(() => ads.addVariant(999, { label: "Z", angle: null, revision: llmRevision(f) })).toThrow(NotFoundError);
    expect([count("ad_variants"), count("ad_revisions")]).toEqual(before);
  });

  it("setVariantActive spegne e riaccende una variante", () => {
    const { ads, b, updatedAt } = withAd();
    expect(ads.setVariantActive(b.id, false).is_active).toBe(false);
    expect(updatedAt()).not.toBe(OLD);
    expect(ads.setVariantActive(b.id, true).is_active).toBe(true);
    expect(() => ads.setVariantActive(999, false)).toThrow(NotFoundError);
  });
});

describe("stato dell'annuncio", () => {
  it("applica una transizione ammessa", () => {
    const { ads, ad, updatedAt } = withAd();
    expect(ads.updateStatus(ad.id, "active").status).toBe("active");
    expect(updatedAt()).not.toBe(OLD);
    expect(ads.updateStatus(ad.id, "closed").status).toBe("closed");
    expect(ads.updateStatus(ad.id, "archived").status).toBe("archived");
  });

  it("rifiuta una transizione non ammessa e lascia lo stato invariato", () => {
    const { ads, ad, updatedAt } = withAd();
    expect(() => ads.updateStatus(ad.id, "closed")).toThrow(InvalidTransitionError);
    expect(ads.get(ad.id).status).toBe("draft");
    expect(updatedAt()).toBe(OLD);
  });

  it("archived è terminale", () => {
    const { ads, ad } = withAd();
    ads.updateStatus(ad.id, "archived");
    expect(() => ads.updateStatus(ad.id, "active")).toThrow(InvalidTransitionError);
  });

  it("su un annuncio inesistente solleva NotFoundError", () => {
    expect(() => withAd().ads.updateStatus(999, "active")).toThrow(NotFoundError);
  });
});
