import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { createLocationsRepository } from "../modules/locations/repository.js";
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

/*
 * Le job offer stanno in tutti i file `job_offers*.json` della cartella:
 * `job_offers.json` è quella della traccia, invariata; `job_offers.fictional.json`
 * contiene job offer inventate per provare la generazione su casi diversi.
 */
const JOB_OFFER_FILES = /^job_offers.*\.json$/;

/** Canali, formati e job offer di esempio. Ripetibile: ciò che esiste già resta com'è. */
export function seed(db: Db, dir = SEED_DIR): void {
  const channelsSql = readFileSync(join(dir, "001_channels.sql"), "utf8");
  const raw = readdirSync(dir)
    .filter((name) => JOB_OFFER_FILES.test(name))
    .sort()
    .flatMap((name) => z.array(z.unknown()).parse(JSON.parse(readFileSync(join(dir, name), "utf8"))));
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

  const locations = createLocationsRepository(db);
  db.transaction(() => {
    db.exec(channelsSql);
    for (const { offer, raw } of offers) {
      const { location, required_skills, ...fields } = offer;
      insertOffer.run({
        ...fields,
        location_id: locations.findOrCreate(location),
        required_skills: JSON.stringify(required_skills),
        raw,
      });
    }
  })();
}
