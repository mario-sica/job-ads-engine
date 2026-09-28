import { describe, expect, it } from "vitest";
import { ApiError, createApi, describeError } from "../src/api.js";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  };
  return { api: createApi(fetchFn), calls };
}

describe("client dell'API", () => {
  it("antepone /api e restituisce il JSON", async () => {
    const { api, calls } = fakeFetch(200, [{ id: "jo_001" }]);
    expect(await api.jobOffers()).toEqual([{ id: "jo_001" }]);
    expect(calls[0]).toMatchObject({ url: "/api/job-offers", init: { method: "GET" } });
  });

  it("omette dai filtri i valori vuoti", async () => {
    const { api, calls } = fakeFetch(200, []);
    await api.ads({ job_offer_id: "jo_001", channel: "", status: "" });
    await api.ads();
    expect(calls.map((c) => c.url)).toEqual(["/api/ads?job_offer_id=jo_001", "/api/ads"]);
  });

  it("invia il corpo come JSON", async () => {
    const { api, calls } = fakeFetch(201, { id: 9 });
    await api.addRevision(3, { facts: {} });
    expect(calls[0]?.init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: { facts: {} } }),
    });
  });

  it("trasforma il formato d'errore dell'API in ApiError", async () => {
    const { api } = fakeFetch(503, { error: { code: "provider_unavailable", message: "provider non disponibile", details: { reason: "missing_key" } } });
    const error = await api.createAd({ job_offer_id: "jo_001", channel_format_id: 1, variants: [{ angle: null }] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: "provider_unavailable", message: "provider non disponibile", details: { reason: "missing_key" } });
  });

  it("una risposta senza il formato d'errore diventa un errore generico", async () => {
    const { api } = fakeFetch(502, undefined);
    await expect(api.ads()).rejects.toMatchObject({ status: 502, code: "unexpected_response" });
  });

  it("un errore di rete dice che il backend non è raggiungibile", async () => {
    const api = createApi(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(api.ads()).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});

describe("descrizione degli errori", () => {
  it("elenca i problemi di un 400 o di un 422", () => {
    const error = new ApiError(422, "invalid_content", "contenuto non valido", [
      { path: "text.headline", message: "troppo lungo" },
      { path: "", message: "manca facts" },
    ]);
    expect(describeError(error)).toBe("contenuto non valido (invalid_content)\n• text.headline: troppo lungo\n• manca facts");
  });

  it("senza elenco mostra messaggio e codice", () => {
    expect(describeError(new ApiError(503, "provider_unavailable", "provider non disponibile", { reason: "missing_key" }))).toBe(
      "provider non disponibile (provider_unavailable)",
    );
    expect(describeError(new Error("boom"))).toBe("boom");
  });
});
