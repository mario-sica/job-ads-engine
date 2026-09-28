import { contentSchemaFor, type ContentTarget } from "@job-ads-engine/content";
import { validContent } from "@job-ads-engine/content/testing";
import { describe, expect, it } from "vitest";
import { testApp } from "./api-fixtures.js";

describe("lettura di job offer e formati", () => {
  it("GET /api/job-offers elenca la job offer seedata", async () => {
    const res = await testApp().app.inject({ method: "GET", url: "/api/job-offers" });
    expect(res.statusCode).toBe(200);
    const offers = res.json() as { id: string; location: { locality: string } }[];
    expect(offers.map((o) => o.id)).toEqual(["jo_001"]);
    expect(offers[0]).toMatchObject({ location: { locality: "Orzinuovi" } });
    expect(offers[0]).not.toHaveProperty("raw");
  });

  it("GET /api/job-offers/:id legge per id, 404 se non esiste", async () => {
    const { app } = testApp();
    expect((await app.inject({ method: "GET", url: "/api/job-offers/jo_001" })).json()).toMatchObject({ title: "Tecnico elettricista fotovoltaico" });
    const missing = await app.inject({ method: "GET", url: "/api/job-offers/jo_999" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: "not_found", details: { entity: "job offer", id: "jo_999" } } });
  });

  it("GET /api/channel-formats: kind e specs bastano a ricostruire lo schema degli edit", async () => {
    const res = await testApp().app.inject({ method: "GET", url: "/api/channel-formats" });
    const formats = res.json() as (ContentTarget & { channel_code: string })[];
    expect(formats).toHaveLength(12);
    for (const target of formats) {
      expect(contentSchemaFor(target).safeParse(validContent(target)).success).toBe(true);
    }
  });
});
