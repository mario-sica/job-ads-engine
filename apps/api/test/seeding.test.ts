import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { seed, SEED_DIR } from "../src/db/seed.js";

const TABLES = ["channels", "channel_formats", "locations", "job_offers"] as const;

const counts = (db: Db) =>
  Object.fromEntries(TABLES.map((t) => [t, db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get()]));

function migratedDb() {
  const db = openDatabase(":memory:");
  migrate(db);
  return db;
}

describe("seed", () => {
  it("inserisce canali, formati, luogo e job offer", () => {
    const db = migratedDb();
    seed(db);
    expect(counts(db)).toEqual({ channels: 4, channel_formats: 12, locations: 10, job_offers: 10 });
  });

  it("legge la job offer della traccia e quelle fittizie da file separati", () => {
    const db = migratedDb();
    seed(db);
    const ids = db.prepare("SELECT id FROM job_offers ORDER BY id").pluck().all();
    expect(ids).toEqual(["jo_001", "jo_101", "jo_102", "jo_103", "jo_104", "jo_105", "jo_106", "jo_107", "jo_108", "jo_109"]);
    // I casi limite delle fittizie arrivano intatti: niente RAL, solo il massimo, campi assenti.
    const row = (id: string) => db.prepare("SELECT ral_min, ral_max, currency, company_description FROM job_offers WHERE id = ?").get(id);
    expect(row("jo_102")).toMatchObject({ ral_min: null, ral_max: null, currency: null });
    expect(row("jo_103")).toMatchObject({ ral_min: null, ral_max: 24000, company_description: null });
  });

  it("proietta la job offer nelle colonne e conserva il payload integro in raw", () => {
    const db = migratedDb();
    seed(db);
    const source = (JSON.parse(readFileSync(join(SEED_DIR, "job_offers.json"), "utf8")) as Record<string, unknown>[])[0];
    const row = db.prepare("SELECT * FROM job_offers WHERE id = 'jo_001'").get() as Record<string, unknown>;

    expect(JSON.parse(row.raw as string)).toEqual(source);
    expect(JSON.parse(row.required_skills as string)).toEqual(source?.required_skills);
    expect(row).toMatchObject({ title: source?.title, ral_min: 32000, ral_max: 38000, created_at: source?.created_at });

    const location = db.prepare("SELECT * FROM locations WHERE id = ?").get(row.location_id);
    expect(location).toMatchObject({ locality: "Orzinuovi", province_code: "BS", street_number: "27" });
  });

  it("è ripetibile", () => {
    const db = migratedDb();
    seed(db);
    const before = counts(db);
    seed(db);
    expect(counts(db)).toEqual(before);
  });

  describe("con job offer di prova", () => {
    let dir: string | undefined;
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    const withOffers = (offers: unknown[]) => {
      dir = mkdtempSync(join(tmpdir(), "jae-seed-"));
      copyFileSync(join(SEED_DIR, "001_channels.sql"), join(dir, "001_channels.sql"));
      writeFileSync(join(dir, "job_offers.json"), JSON.stringify(offers));
      return dir;
    };

    const offer = (id: string, location: Record<string, unknown>) => ({
      job_offer_id: id,
      title: "Tecnico",
      company_name: "ACME",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      location,
    });

    it("stesso luogo, anche con campi assenti o vuoti, produce una sola location", () => {
      const db = migratedDb();
      seed(db, withOffers([
        offer("a", { locality: "Orzinuovi", province_code: "BS" }),
        offer("b", { locality: "Orzinuovi", province_code: "BS", postal_code: null }),
        offer("c", { locality: "Orzinuovi", province_code: "BS", postal_code: "" }),
        offer("d", { locality: "Brescia", province_code: "BS" }),
      ]));
      expect(counts(db)).toMatchObject({ locations: 2, job_offers: 4 });
    });

    it("una job offer non valida blocca tutto il seed", () => {
      const db = migratedDb();
      const { job_offer_id: _, ...withoutId } = offer("x", { locality: "Orzinuovi" });
      expect(() => seed(db, withOffers([offer("a", { locality: "Orzinuovi" }), withoutId]))).toThrow();
      expect(counts(db)).toEqual({ channels: 0, channel_formats: 0, locations: 0, job_offers: 0 });
    });
  });
});
