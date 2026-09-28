import { validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createAnthropicClient } from "../src/llm/client.js";
import { createAdsRepository } from "../src/modules/ads/repository.js";
import { createChannelFormatsRepository } from "../src/modules/channel-formats/repository.js";
import { seededDb } from "./helpers.js";

/** Come il server senza ANTHROPIC_API_KEY: client reale, nessuna chiave, un annuncio già presente. */
function appWithoutKey() {
  const db = seededDb();
  const target = createChannelFormatsRepository(db).list().find((f) => f.channel_code === "indeed")!;
  const locationId = db.prepare("SELECT location_id FROM job_offers WHERE id = 'jo_001'").pluck().get() as number;
  const ad = createAdsRepository(db).create({
    job_offer_id: "jo_001",
    channel_format_id: target.id,
    location_id: locationId,
    location_precision: "address",
    variants: [{ label: "A", angle: null, revision: { source: "manual", content: validContent(target) } }],
  });
  const llm = createAnthropicClient({ apiKey: undefined, model: "claude-sonnet-5", timeoutSeconds: 60 });
  return { app: buildApp({ db, llm }), ad, target };
}

describe("senza chiave API", () => {
  it("letture, anteprima, edit manuale, ripristino e stato funzionano", async () => {
    const { app, ad, target } = appWithoutKey();
    const variant = ad.variants[0]!;
    const content = validContent(target);
    const text = content.text as Record<string, unknown>;

    const responses = [
      await app.inject({ method: "GET", url: "/api/job-offers" }),
      await app.inject({ method: "GET", url: "/api/channel-formats" }),
      await app.inject({ method: "GET", url: "/api/ads" }),
      await app.inject({ method: "GET", url: `/api/ads/${ad.id}` }),
      await app.inject({ method: "GET", url: `/api/variants/${variant.id}/preview` }),
      await app.inject({
        method: "POST",
        url: `/api/variants/${variant.id}/revisions`,
        payload: { content: { ...content, text: { ...text, headline: "Scritto a mano" } } },
      }),
      await app.inject({ method: "PUT", url: `/api/variants/${variant.id}/current-revision`, payload: { revision_id: variant.current_revision.id } }),
      await app.inject({ method: "PATCH", url: `/api/ads/${ad.id}`, payload: { status: "active" } }),
    ];
    expect(responses.map((r) => r.statusCode)).toEqual([200, 200, 200, 200, 200, 201, 200, 200]);
  });

  it("la generazione risponde 503 provider_unavailable, senza dettagli del provider", async () => {
    const { app, ad, target } = appWithoutKey();
    const create = await app.inject({
      method: "POST",
      url: "/api/ads",
      payload: { job_offer_id: "jo_001", channel_format_id: target.id, variants: [{ angle: null }] },
    });
    const variant = await app.inject({ method: "POST", url: `/api/ads/${ad.id}/variants`, payload: { angle: null } });

    for (const res of [create, variant]) {
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({
        error: { code: "provider_unavailable", message: "chiave API assente: la generazione non è disponibile", details: { reason: "missing_key" } },
      });
    }
  });
});
