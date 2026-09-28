import type { FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { GenerationFailedError, ProviderUnavailableError } from "../src/llm/errors.js";
import { createChannelFormatsRepository } from "../src/modules/channel-formats/repository.js";
import { fakeLlm, testApp } from "./api-fixtures.js";
import { seededDb } from "./helpers.js";

const formats = createChannelFormatsRepository(seededDb()).list();
const formatId = (channel: string, fmt: string, ratio: string | null = null) =>
  formats.find((f) => f.channel_code === channel && f.format === fmt && f.aspect_ratio === ratio)!.id;

const INDEED = formatId("indeed", "text");
const WHATSAPP = formatId("whatsapp", "text");

type Ad = {
  id: number;
  status: string;
  location_precision: string;
  location: { locality: string | null; province: string | null };
  variants: { id: number; label: string; angle: string | null; current_revision: { source: string; model: string } }[];
};

const createAd = (app: FastifyInstance, body: Record<string, unknown>) => app.inject({ method: "POST", url: "/api/ads", payload: body });

const newAd = (overrides: Record<string, unknown> = {}) => ({
  job_offer_id: "jo_001",
  channel_format_id: INDEED,
  variants: [{ angle: "crescita" }, { angle: "stabilità" }],
  ...overrides,
});

const count = (db: ReturnType<typeof seededDb>, table: string) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get();

describe("POST /api/ads", () => {
  it("genera le varianti, assegna le label e salva tutto", async () => {
    const llm = fakeLlm();
    const { app } = testApp(llm.client);
    const res = await createAd(app, newAd());

    expect(res.statusCode).toBe(201);
    const ad = res.json() as Ad;
    expect(ad).toMatchObject({ status: "draft", location_precision: "address", location: { locality: "Orzinuovi" } });
    expect(ad.variants.map((v) => [v.label, v.angle])).toEqual([
      ["A", "crescita"],
      ["B", "stabilità"],
    ]);
    expect(ad.variants[0]!.current_revision).toMatchObject({ source: "llm", model: "modello-finto" });
    expect(llm.calls).toHaveLength(2);
  });

  it("la precisione di default dipende dal kind; luogo e precisione si possono scegliere", async () => {
    const { app } = testApp();
    const whatsapp = (await createAd(app, newAd({ channel_format_id: WHATSAPP }))).json() as Ad;
    expect(whatsapp.location_precision).toBe("locality");

    const custom = (await createAd(
      app,
      newAd({ location: { locality: "Brescia", province: "Brescia", province_code: "BS" }, location_precision: "province" }),
    )).json() as Ad;
    expect(custom).toMatchObject({ location_precision: "province", location: { locality: "Brescia", province: "Brescia" } });
  });

  it.each([
    ["senza varianti", { variants: [] }],
    ["più di 4 varianti", { variants: Array.from({ length: 5 }, () => ({ angle: null })) }],
    ["campo sconosciuto", { extra: true }],
    ["precisione non valida", { location_precision: "street" }],
    ["luogo senza località, provincia o regione", { location: { postal_code: "25034" } }],
  ])("400 se %s, senza chiamare l'LLM", async (_, overrides) => {
    const llm = fakeLlm();
    const res = await createAd(testApp(llm.client).app, newAd(overrides));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "invalid_input" } });
    expect(llm.calls).toHaveLength(0);
  });

  it("404 per job offer o formato inesistenti, senza chiamare l'LLM", async () => {
    const llm = fakeLlm();
    const { app } = testApp(llm.client);
    expect((await createAd(app, newAd({ job_offer_id: "jo_999" }))).statusCode).toBe(404);
    expect((await createAd(app, newAd({ channel_format_id: 999 }))).statusCode).toBe(404);
    expect(llm.calls).toHaveLength(0);
  });

  it("se la seconda variante fallisce non si salva nulla (502)", async () => {
    const { client } = fakeLlm({ fail: new GenerationFailedError(["text.cta: obbligatorio"]), failFrom: 2 });
    const { app, db } = testApp(client);
    const res = await createAd(app, newAd());
    expect(res.statusCode).toBe(502);
    expect(res.json()).toMatchObject({ error: { code: "generation_failed", details: ["text.cta: obbligatorio"] } });
    expect([count(db, "ads"), count(db, "ad_variants"), count(db, "ad_revisions")]).toEqual([0, 0, 0]);
  });

  it("provider non disponibile → 503", async () => {
    const { client } = fakeLlm({ fail: new ProviderUnavailableError("timeout") });
    const res = await createAd(testApp(client).app, newAd());
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ error: { code: "provider_unavailable", details: { reason: "timeout" } } });
  });
});

describe("lettura e stato degli annunci", () => {
  async function withAds() {
    const { app, db } = testApp();
    const indeed = (await createAd(app, newAd())).json() as Ad;
    const whatsapp = (await createAd(app, newAd({ channel_format_id: WHATSAPP }))).json() as Ad;
    return { app, db, indeed, whatsapp };
  }

  it("GET /api/ads filtra per job offer, canale e stato", async () => {
    const { app, indeed, whatsapp } = await withAds();
    await app.inject({ method: "PATCH", url: `/api/ads/${indeed.id}`, payload: { status: "active" } });
    const ids = async (query: string) => ((await app.inject({ method: "GET", url: `/api/ads${query}` })).json() as Ad[]).map((a) => a.id).sort();

    expect(await ids("")).toEqual([indeed.id, whatsapp.id].sort());
    expect(await ids("?channel=whatsapp")).toEqual([whatsapp.id]);
    expect(await ids("?status=active&job_offer_id=jo_001")).toEqual([indeed.id]);
    expect(await ids("?status=&channel=")).toHaveLength(2);
    expect((await app.inject({ method: "GET", url: "/api/ads?status=pubblicato" })).statusCode).toBe(400);
  });

  it("GET /api/ads/:id restituisce varianti e contenuto corrente; 404 e 400 sugli id", async () => {
    const { app, indeed } = await withAds();
    const res = await app.inject({ method: "GET", url: `/api/ads/${indeed.id}` });
    expect(res.json()).toMatchObject({ id: indeed.id, variants: [{ label: "A" }, { label: "B" }] });
    expect((await app.inject({ method: "GET", url: "/api/ads/999" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/ads/abc" })).statusCode).toBe(400);
  });

  it("PATCH /api/ads/:id cambia lo stato; 409 se la transizione non è ammessa", async () => {
    const { app, indeed } = await withAds();
    const ok = await app.inject({ method: "PATCH", url: `/api/ads/${indeed.id}`, payload: { status: "active" } });
    expect(ok.json()).toMatchObject({ status: "active" });

    const bad = await app.inject({ method: "PATCH", url: `/api/ads/${indeed.id}`, payload: { status: "archived" } });
    expect(bad.statusCode).toBe(409);
    expect(bad.json()).toMatchObject({ error: { code: "invalid_transition", details: { from: "active", to: "archived" } } });
    expect((await app.inject({ method: "PATCH", url: `/api/ads/${indeed.id}`, payload: { status: "boh" } })).statusCode).toBe(400);
  });

  it("POST /api/ads/:id/variants genera la variante con la prima label libera", async () => {
    const { app, indeed } = await withAds();
    const res = await app.inject({ method: "POST", url: `/api/ads/${indeed.id}/variants`, payload: { angle: "vicinanza" } });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ label: "C", angle: "vicinanza", current_revision: { source: "llm" } });
  });

  it("un annuncio archiviato non accetta nuove varianti (409), e l'LLM non viene chiamato", async () => {
    const llm = fakeLlm();
    const { app } = testApp(llm.client);
    const ad = (await createAd(app, newAd())).json() as Ad;
    await app.inject({ method: "PATCH", url: `/api/ads/${ad.id}`, payload: { status: "archived" } });
    const callsBefore = llm.calls.length;

    const res = await app.inject({ method: "POST", url: `/api/ads/${ad.id}/variants`, payload: { angle: null } });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: "ad_archived" } });
    expect(llm.calls).toHaveLength(callsBefore);
  });
});
