import type { Format, Kind, SalaryFraming } from "@job-ads-engine/content";
import type { LocationPrecision } from "../modules/ads/types.js";
import type { ChannelFormat } from "../modules/channel-formats/repository.js";
import type { JobOffer } from "../modules/job-offers/repository.js";
import type { LocationInput } from "../modules/locations/repository.js";
import { formatLocation } from "../render/format.js";

/*
 * L'unica cosa che lascia il sistema verso il provider. Restano fuori id, stato,
 * date, `raw`, l'indirizzo civico e i campi numerici della RAL: le cifre compaiono
 * solo nel testo `compensation_package`, e il guardrail le blocca in uscita.
 */
export type InputSnapshot = {
  channel: { name: string; kind: Kind; format: Format; aspect_ratio: string | null };
  angle: string | null;
  /** Il luogo dell'annuncio, da mettere in primo piano. Mai più preciso della località. */
  published_location: string;
  job_offer: {
    title: string;
    company_name: string;
    /** La sede: un fatto aziendale citabile, non il luogo dell'annuncio. */
    workplace: string;
    contract_type: string | null;
    experience: { min_years: number | null; max_years: number | null };
    required_skills: string[];
    role_description: string | null;
    location_and_hours: string | null;
    company_description: string | null;
    requirements_description: string | null;
    compensation_package: string | null;
  };
  /** I modi di presentare la RAL compatibili con i dati; vuoto se la RAL non c'è. */
  salary_framings: SalaryFraming[];
};

export interface SnapshotInput {
  target: ChannelFormat;
  jobOffer: JobOffer;
  location: LocationInput;
  precision: LocationPrecision;
  angle: string | null;
}

function salaryFramings({ ral_min, ral_max, currency }: JobOffer): SalaryFraming[] {
  if (currency === null) return [];
  const framings: SalaryFraming[] = [];
  if (ral_min !== null && ral_max !== null) framings.push("range");
  if (ral_min !== null) framings.push("from");
  if (ral_max !== null) framings.push("up_to");
  return framings;
}

export function buildInputSnapshot({ target, jobOffer, location, precision, angle }: SnapshotInput): InputSnapshot {
  return {
    channel: { name: target.channel_name, kind: target.kind, format: target.format, aspect_ratio: target.aspect_ratio },
    angle,
    // Indeed mostra l'indirizzo completo, ma al modello arriva al massimo la località.
    published_location: formatLocation(location, precision === "address" ? "locality" : precision),
    job_offer: {
      title: jobOffer.title,
      company_name: jobOffer.company_name,
      workplace: formatLocation(jobOffer.location, "locality"),
      contract_type: jobOffer.contract_type,
      experience: { min_years: jobOffer.min_exp_years, max_years: jobOffer.max_exp_years },
      required_skills: jobOffer.required_skills,
      role_description: jobOffer.role_description,
      location_and_hours: jobOffer.location_and_hours,
      company_description: jobOffer.company_description,
      requirements_description: jobOffer.requirements_description,
      compensation_package: jobOffer.compensation_package,
    },
    salary_framings: salaryFramings(jobOffer),
  };
}
