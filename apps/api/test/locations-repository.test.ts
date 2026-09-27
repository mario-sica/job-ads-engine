import { describe, expect, it } from "vitest";
import { NotFoundError } from "../src/errors.js";
import { createLocationsRepository, type LocationInput } from "../src/modules/locations/repository.js";
import { seededDb } from "./helpers.js";

const location = (overrides: Partial<LocationInput> = {}): LocationInput => ({
  street_name: null,
  street_number: null,
  postal_code: null,
  locality: "Brescia",
  province: "Brescia",
  province_code: "BS",
  region: "Lombardia",
  country_code: "IT",
  ...overrides,
});

describe("repository delle location", () => {
  it("crea un luogo nuovo e lo rilegge", () => {
    const repo = createLocationsRepository(seededDb());
    const id = repo.findOrCreate(location());
    expect(repo.get(id)).toEqual({ id, ...location() });
  });

  it("restituisce lo stesso id per lo stesso luogo, anche con NULL o stringa vuota", () => {
    const repo = createLocationsRepository(seededDb());
    const id = repo.findOrCreate(location());
    expect(repo.findOrCreate(location())).toBe(id);
    expect(repo.findOrCreate(location({ postal_code: "" }))).toBe(id);
  });

  it("il nome della provincia non fa parte dell'identità del luogo", () => {
    const repo = createLocationsRepository(seededDb());
    expect(repo.findOrCreate(location({ province: "BS" }))).toBe(repo.findOrCreate(location()));
  });

  it("luoghi diversi hanno id diversi", () => {
    const repo = createLocationsRepository(seededDb());
    expect(repo.findOrCreate(location({ locality: "Orzinuovi" }))).not.toBe(repo.findOrCreate(location()));
  });

  it("ritrova il luogo della job offer seedata", () => {
    const db = seededDb();
    const repo = createLocationsRepository(db);
    const seeded = db.prepare("SELECT location_id FROM job_offers WHERE id = 'jo_001'").pluck().get() as number;
    const { id: _, ...input } = repo.get(seeded);
    expect(repo.findOrCreate(input)).toBe(seeded);
  });

  it("un id inesistente solleva NotFoundError", () => {
    expect(() => createLocationsRepository(seededDb()).get(999)).toThrow(NotFoundError);
  });
});
