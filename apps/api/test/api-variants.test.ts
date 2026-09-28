import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { createChannelFormatsRepository } from "../src/modules/channel-formats/repository.js";
import { testApp } from "./api-fixtures.js";
import { seededDb } from "./helpers.js";

const formats = createChannelFormatsRepository(seededDb()).list();
const formatId = (channel: string, fmt: string, ratio: string | null = null) =>
  formats.find((f) => f.channel_code === channel && f.format === fmt && f.aspect_ratio === ratio)!.id;

type Revision = { id: number; source: string; content: { text: { headline: string } } & Record<string, unknown> };
type Variant = { id: number; label: string; is_active: boolean; current_revision: Revision };
type Ad = { id: number; variants: Variant[] };

async function withAd(channel = formatId("indeed", "text")) {
  const { app } = testApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/ads",
    payload: { job_offer_id: "jo_001", channel_format_id: channel, variants: [{ angle: "crescita" }, { angle: null }] },
  });
  const ad = res.json() as Ad;
  return { app, ad, a: ad.variants[0]!, b: ad.variants[1]! };
}

const archive = (app: FastifyInstance, adId: number) =>
  app.inject({ method: "PATCH", url: `/api/ads/${adId}`, payload: { status: "archived" } });

const edited = (revision: Revision) => ({
  ...revision.content,
  text: { ...revision.content.text, headline: "Titolo scritto a mano" },
});

describe("varianti", () => {
  it("PATCH /api/variants/:id spegne e riaccende una variante", async () => {
    const { app, b } = await withAd();
    const off = await app.inject({ method: "PATCH", url: `/api/variants/${b.id}`, payload: { is_active: false } });
    expect(off.json()).toMatchObject({ id: b.id, is_active: false });
    expect((await app.inject({ method: "PATCH", url: `/api/variants/${b.id}`, payload: { is_active: "no" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: "/api/variants/999", payload: { is_active: true } })).statusCode).toBe(404);
  });
});

describe("revisioni", () => {
  it("un edit manuale crea una revisione che diventa la corrente; lo storico va dal più recente", async () => {
    const { app, ad, a } = await withAd();
    const res = await app.inject({ method: "POST", url: `/api/variants/${a.id}/revisions`, payload: { content: edited(a.current_revision) } });
    expect(res.statusCode).toBe(201);
    const revision = res.json() as Revision;
    expect(revision).toMatchObject({ source: "manual", content: { text: { headline: "Titolo scritto a mano" } } });

    const current = (await app.inject({ method: "GET", url: `/api/ads/${ad.id}` })).json() as Ad;
    expect(current.variants[0]!.current_revision.id).toBe(revision.id);
    const history = (await app.inject({ method: "GET", url: `/api/variants/${a.id}/revisions` })).json() as Revision[];
    expect(history.map((r) => [r.id, r.source])).toEqual([
      [revision.id, "manual"],
      [a.current_revision.id, "llm"],
    ]);
  });

  it("un contenuto non valido per il formato → 422 con i campi da correggere", async () => {
    const { app, a } = await withAd();
    const { text: _, ...withoutText } = a.current_revision.content;
    const tooLong = { ...a.current_revision.content, text: { ...a.current_revision.content.text, headline: "x".repeat(200) } };

    for (const [content, path] of [[withoutText, "text"], [tooLong, "text.headline"]] as const) {
      const res = await app.inject({ method: "POST", url: `/api/variants/${a.id}/revisions`, payload: { content } });
      expect(res.statusCode).toBe(422);
      expect(res.json()).toMatchObject({ error: { code: "invalid_content", details: [expect.objectContaining({ path })] } });
    }
    const history = (await app.inject({ method: "GET", url: `/api/variants/${a.id}/revisions` })).json() as Revision[];
    expect(history).toHaveLength(1);
  });

  it("un body senza content è un 400, non un 422", async () => {
    const { app, a } = await withAd();
    expect((await app.inject({ method: "POST", url: `/api/variants/${a.id}/revisions`, payload: { testo: "x" } })).statusCode).toBe(400);
  });

  it("PUT current-revision ripristina una revisione; quella di un'altra variante è un 404", async () => {
    const { app, a, b } = await withAd();
    await app.inject({ method: "POST", url: `/api/variants/${a.id}/revisions`, payload: { content: edited(a.current_revision) } });

    const restored = await app.inject({ method: "PUT", url: `/api/variants/${a.id}/current-revision`, payload: { revision_id: a.current_revision.id } });
    expect((restored.json() as Variant).current_revision.id).toBe(a.current_revision.id);

    const foreign = await app.inject({ method: "PUT", url: `/api/variants/${a.id}/current-revision`, payload: { revision_id: b.current_revision.id } });
    expect(foreign.statusCode).toBe(404);
    expect((await app.inject({ method: "PUT", url: `/api/variants/${a.id}/current-revision`, payload: {} })).statusCode).toBe(400);
  });

  it("su un annuncio archiviato edit, ripristino e accensione rispondono 409; lettura e anteprima funzionano", async () => {
    const { app, ad, a } = await withAd();
    await archive(app, ad.id);
    const requests = [
      { method: "POST" as const, url: `/api/variants/${a.id}/revisions`, payload: { content: edited(a.current_revision) } },
      { method: "PUT" as const, url: `/api/variants/${a.id}/current-revision`, payload: { revision_id: a.current_revision.id } },
      { method: "PATCH" as const, url: `/api/variants/${a.id}`, payload: { is_active: false } },
    ];
    for (const request of requests) {
      const res = await app.inject(request);
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: { code: "ad_archived" } });
    }
    expect((await app.inject({ method: "GET", url: `/api/variants/${a.id}/revisions` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/api/variants/${a.id}/preview` })).statusCode).toBe(200);
  });
});

describe("anteprima", () => {
  it("Indeed: testo con i campi, titolo della job offer, niente HTML", async () => {
    const { app, a } = await withAd();
    const res = await app.inject({ method: "GET", url: `/api/variants/${a.id}/preview` });
    expect(res.json()).toMatchObject({
      text: { fields: { Titolo: "Tecnico elettricista fotovoltaico", Luogo: "Via Artigianato 27, 25034 Orzinuovi (BS)" } },
      html: null,
    });
  });

  it("segue la revisione corrente dopo un edit", async () => {
    const { app, a } = await withAd();
    await app.inject({ method: "POST", url: `/api/variants/${a.id}/revisions`, payload: { content: edited(a.current_revision) } });
    const { text } = (await app.inject({ method: "GET", url: `/api/variants/${a.id}/preview` })).json() as { text: { body: string } };
    expect(text.body.startsWith("Titolo scritto a mano")).toBe(true);
  });

  it("?as=html restituisce la pagina con una CSP senza script", async () => {
    const { app, a } = await withAd(formatId("instagram", "image", "4:5"));
    const res = await app.inject({ method: "GET", url: `/api/variants/${a.id}/preview?as=html` });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["content-security-policy"]).toBe("default-src 'none'; style-src 'unsafe-inline'");
    expect(res.body).toContain("height: 1350px;");
  });

  it("?as=html su un formato solo testo è un 400; variante inesistente 404", async () => {
    const { app, a } = await withAd();
    expect((await app.inject({ method: "GET", url: `/api/variants/${a.id}/preview?as=html` })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/variants/999/preview" })).statusCode).toBe(404);
  });
});
