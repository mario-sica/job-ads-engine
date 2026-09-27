import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Db } from "./connection.js";

export const SEED_DIR = fileURLToPath(new URL("../../db/seed/", import.meta.url));

// Il JSON arriva da fuori: si valida, e i campi assenti diventano NULL.
const text = z.string().nullish().transform((v) => v ?? null);
const int = z.number().int().nullish().transform((v) => v ?? null);

const locationSchema = z.object({
  street_name: text,
  street_number: text,
  postal_code: text,
  locality: text,
  province: text,
  province_code: text,
  region: text,
  country_code: z.string().length(2).default("IT"),
});
type LocationInput = z.infer<typeof locationSchema>;

const jobOfferSchema = z.object({
  job_offer_id: z.string().min(1),
  title: z.string().min(1),
  company_name: z.string().min(1),
  status: z.string().min(1),
  created_at: z.string().min(1),
  location: locationSchema,
  contract_type: text,
  min_exp_years: int,
  max_exp_years: int,
  ral_min: int,
  ral_max: int,
  currency: text,
  required_skills: z.array(z.string()).default([]),
  role_description: text,
  location_and_hours: text,
  company_description: text,
  requirements_description: text,
  compensation_package: text,
});

/** Canali, formati e job offer di esempio. Ripetibile: ciò che esiste già resta com'è. */
export function seed(db: Db, dir = SEED_DIR): void {
  const channelsSql = readFileSync(join(dir, "001_channels.sql"), "utf8");
  const raw = z.array(z.unknown()).parse(JSON.parse(readFileSync(join(dir, "job_offers.json"), "utf8")));
  const offers = raw.map((item) => ({ offer: jobOfferSchema.parse(item), raw: JSON.stringify(item) }));

  const insertOffer = db.prepare(`
    INSERT INTO job_offers (
      id, title, company_name, status, location_id, contract_type,
      min_exp_years, max_exp_years, ral_min, ral_max, currency, required_skills,
      role_description, location_and_hours, company_description,
      requirements_description, compensation_package, raw, created_at
    ) VALUES (
      @job_offer_id, @title, @company_name, @status, @location_id, @contract_type,
      @min_exp_years, @max_exp_years, @ral_min, @ral_max, @currency, @required_skills,
      @role_description, @location_and_hours, @company_description,
      @requirements_description, @compensation_package, @raw, @created_at
    )
    -- la job offer è read-only: il seed non la aggiorna
    ON CONFLICT (id) DO NOTHING
  `);

  db.transaction(() => {
    db.exec(channelsSql);
    for (const { offer, raw } of offers) {
      const { location, required_skills, ...fields } = offer;
      insertOffer.run({
        ...fields,
        location_id: findOrCreateLocation(db, location),
        required_skills: JSON.stringify(required_skills),
        raw,
      });
    }
  })();
}

// Resta qui finché lo step 6 non introduce il repository delle location.
function findOrCreateLocation(db: Db, location: LocationInput): number {
  db.prepare(`
    INSERT OR IGNORE INTO locations
      (street_name, street_number, postal_code, locality, province, province_code, region, country_code)
    VALUES
      (@street_name, @street_number, @postal_code, @locality, @province, @province_code, @region, @country_code)
  `).run(location);
  // Stesse colonne e stesso COALESCE dell'indice locations_unique: NULL e '' sono lo stesso luogo.
  const id = db
    .prepare(`
      SELECT id FROM locations
      WHERE country_code = @country_code
        AND COALESCE(region, '')        = COALESCE(@region, '')
        AND COALESCE(province_code, '') = COALESCE(@province_code, '')
        AND COALESCE(locality, '')      = COALESCE(@locality, '')
        AND COALESCE(postal_code, '')   = COALESCE(@postal_code, '')
        AND COALESCE(street_name, '')   = COALESCE(@street_name, '')
        AND COALESCE(street_number, '') = COALESCE(@street_number, '')
    `)
    .pluck()
    .get(location) as number;
  return id;
}
