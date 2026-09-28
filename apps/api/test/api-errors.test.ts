import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AdArchivedError, InvalidContentError, InvalidTransitionError, NotFoundError } from "../src/errors.js";
import { parseInput } from "../src/http/validation.js";
import { GenerationFailedError, ProviderUnavailableError } from "../src/llm/errors.js";
import { testApp } from "./api-fixtures.js";

const KEY = "sk-ant-segreta";

/** App con route di prova che sollevano ciascun errore. */
function appThrowing() {
  const { app } = testApp();
  const errors: Record<string, () => unknown> = {
    input: () => parseInput(z.object({ n: z.number() }), { n: "x" }),
    missing: () => {
      throw new NotFoundError("ad", 9);
    },
    transition: () => {
      throw new InvalidTransitionError("archived", "active");
    },
    archived: () => {
      throw new AdArchivedError(3);
    },
    content: () => {
      throw new InvalidContentError([{ path: "text.cta", message: "obbligatorio" }]);
    },
    generation: () => {
      throw new GenerationFailedError(["image.hook: troppo lungo"]);
    },
    provider: () => {
      throw new ProviderUnavailableError("rate_limit", { cause: new Error(`429 con ${KEY}`) });
    },
    boom: () => {
      throw new Error(`dettaglio interno con ${KEY}`);
    },
  };
  for (const [name, fn] of Object.entries(errors)) app.get(`/test/${name}`, async () => fn());
  app.post("/test/echo", async (request) => request.body);
  return app;
}

describe("formato unico degli errori", () => {
  it.each([
    ["input", 400, "invalid_input", [{ path: "n", message: expect.any(String) }]],
    ["missing", 404, "not_found", { entity: "ad", id: 9 }],
    ["transition", 409, "invalid_transition", { from: "archived", to: "active" }],
    ["archived", 409, "ad_archived", { ad_id: 3 }],
    ["content", 422, "invalid_content", [{ path: "text.cta", message: "obbligatorio" }]],
    ["generation", 502, "generation_failed", ["image.hook: troppo lungo"]],
    ["provider", 503, "provider_unavailable", { reason: "rate_limit" }],
    ["boom", 500, "internal_error", null],
  ] as const)("%s → %s %s", async (name, status, code, details) => {
    const res = await appThrowing().inject({ method: "GET", url: `/test/${name}` });
    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ error: { code, message: expect.any(String), details } });
    expect(res.body).not.toContain(KEY);
    expect(res.body).not.toContain("dettaglio interno");
  });

  it("route inesistente → 404 not_found", async () => {
    const res = await appThrowing().inject({ method: "GET", url: "/api/nulla" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: "not_found", details: null } });
  });

  it("JSON malformato → 400 invalid_input", async () => {
    const res = await appThrowing().inject({
      method: "POST",
      url: "/test/echo",
      headers: { "content-type": "application/json" },
      payload: "{ non json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { code: "invalid_input" } });
  });
});
