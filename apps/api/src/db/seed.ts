import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { buildFacts } from "@job-ads-engine/content";
import { issuesOf } from "../errors.js";
import { createLocationsRepository } from "../modules/locations/repository.js";
import type { Db } from "./connection.js";

export const SEED_DIR = fileURLToPath(new URL("../../db/seed/", import.meta.url));

// Il JSON arriva da fuori: si valida, e i campi assenti diventano NULL.
const text = z.string().nullish().transform((v) => v ?? null);
const int = z.number().int().nullish().transform((v) => v ?? null);

const locationSchema = z
  .object({
    street_name: text,
    street_number: text,
    postal_code: text,
    locality: text,
    province: text,
    province_code: text,
    region: text,
    country_code: z.string().length(2).default("IT"),
  })
  // Senza almeno uno di questi l'annuncio non avrebbe un luogo da mostrare.
  .refine((l) => l.locality || l.province || l.region, {
    message: "serve almeno uno tra locality, province e region",
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
type JobOfferInput = z.infer<typeof jobOfferSchema>;

/*
 * Le job offer stanno in tutti i file `job_offers*.json` della cartella:
 * `job_offers.json` è quella della traccia, invariata; `job_offers.fictional.json`
 * contiene job offer inventate per provare la generazione su casi diversi.
 * Chi usa l'app ne aggiunge di nuove con un proprio file, es. `job_offers.mie.json`.
 */
const JOB_OFFER_FILES = /^job_offers.*\.json$/;

const describe = (issues: { path: string; message: string }[]) =>
  issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");

/*
 * I facts della job offer devono rispettare il contratto: se la RAL o l'esperienza
 * sono incoerenti, l'errore deve uscire qui e non come 500 alla prima generazione.
 */
function factsIssues(offer: JobOfferInput): string | null {
  try {
    buildFacts(offer, null);
    return null;
  } catch (err) {
    if (!(err instanceof z.ZodError)) throw err;
    // L'avviso nomina il campo del file, non il percorso interno dei facts.
    return describe(issuesOf(err).map((i) => ({ ...i, path: sourceField(i.path) })));
  }
}

const FACTS_TO_SOURCE: Record<string, string> = {
  "salary.min": "ral_min",
  "salary.max": "ral_max",
  "salary.currency": "currency",
  "experience.min_years": "min_exp_years",
  "experience.max_years": "max_exp_years",
  skills: "required_skills",
};

const sourceField = (path: string) =>
  Object.entries(FACTS_TO_SOURCE).reduce(
    (p, [from, to]) => (p === from || p.startsWith(`${from}.`) ? to + p.slice(from.length) : p),
    path,
  );

interface Candidate {
  file: string;
  offer: JobOfferInput;
  raw: string;
}

/**
 * Legge i file delle job offer. Un file illeggibile o una job offer non valida non
 * bloccano le altre: si scartano, e il motivo finisce negli avvisi.
 */
function readJobOffers(dir: string, warnings: string[]): Candidate[] {
  const candidates: Candidate[] = [];
  const files = readdirSync(dir).filter((name) => JOB_OFFER_FILES.test(name)).sort();

  for (const file of files) {
    let items: unknown;
    try {
      items = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (err) {
      warnings.push(`${file}: file ignorato, JSON non valido (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (!Array.isArray(items)) {
      warnings.push(`${file}: file ignorato, deve contenere un array di job offer ([ {...}, {...} ])`);
      continue;
    }

    items.forEach((item: unknown, index) => {
      const id = (item as { job_offer_id?: unknown } | null)?.job_offer_id;
      const label = `${file} › ${typeof id === "string" && id ? id : `elemento ${index + 1}`}`;
      const parsed = jobOfferSchema.safeParse(item);
      if (!parsed.success) {
        warnings.push(`${label}: scartata. ${describe(issuesOf(parsed.error))}`);
        return;
      }
      const facts = factsIssues(parsed.data);
      if (facts) {
        warnings.push(`${label}: scartata. ${facts}`);
        return;
      }
      candidates.push({ file, offer: parsed.data, raw: JSON.stringify(item) });
    });
  }
  return candidates;
}

/**
 * Canali, formati e job offer. Ripetibile: ciò che esiste già resta com'è.
 * Restituisce gli avvisi (file o job offer scartati, modifiche non applicate): vuoto se è tutto a posto.
 */
export function seed(db: Db, dir = SEED_DIR): string[] {
  const channelsSql = readFileSync(join(dir, "001_channels.sql"), "utf8");
  const warnings: string[] = [];
  const candidates = readJobOffers(dir, warnings);

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
  `);
  const storedRaw = db.prepare("SELECT raw FROM job_offers WHERE id = ?").pluck();

  const locations = createLocationsRepository(db);
  db.transaction(() => {
    db.exec(channelsSql);
    const seen = new Map<string, string>();
    for (const { file, offer, raw } of candidates) {
      const id = offer.job_offer_id;
      const label = `${file} › ${id}`;
      const previousFile = seen.get(id);
      if (previousFile) {
        warnings.push(`${label}: scartata, id già usato in ${previousFile}`);
        continue;
      }
      seen.set(id, file);

      // La job offer è read-only: il seed non la aggiorna. Se il file è cambiato, lo si dice.
      const stored = storedRaw.get(id) as string | undefined;
      if (stored !== undefined) {
        if (stored !== raw) {
          warnings.push(`${label}: già caricata con dati diversi, modifica non applicata (serve npm run db:reset, che cancella gli annunci)`);
        }
        continue;
      }

      const { location, required_skills, ...fields } = offer;
      insertOffer.run({
        ...fields,
        location_id: locations.findOrCreate(location),
        required_skills: JSON.stringify(required_skills),
        raw,
      });
    }
  })();
  return warnings;
}

/** Stampa gli avvisi del seed in modo leggibile da chi ha scritto il file. */
export function logSeedWarnings(warnings: string[], log: (line: string) => void = console.warn): void {
  if (warnings.length === 0) return;
  log(`\nAttenzione, seed delle job offer: ${warnings.length} avvis${warnings.length === 1 ? "o" : "i"}`);
  for (const warning of warnings) log(`  - ${warning}`);
  log("Le altre job offer sono state caricate. Correggi il file e rilancia: npm run db:seed -w @job-ads-engine/api\n");
}
