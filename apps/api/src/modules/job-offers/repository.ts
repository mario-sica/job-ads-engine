import type { FactsSource } from "@job-ads-engine/content";
import type { Db } from "../../db/connection.js";
import { NotFoundError } from "../../errors.js";
import { locationJson, type Location } from "../locations/repository.js";

/** Job offer letta dal DB. I campi dei facts hanno gli stessi nomi di `FactsSource`. */
export interface JobOffer extends FactsSource {
  id: string;
  title: string;
  status: string;
  role_description: string | null;
  location_and_hours: string | null;
  company_description: string | null;
  requirements_description: string | null;
  compensation_package: string | null;
  created_at: string;
  location: Location;
}

type JobOfferRow = Omit<JobOffer, "required_skills" | "location"> & { required_skills: string; location: string };

// `raw` resta nel DB come archivio del payload: non serve a chi legge.
const SELECT = `
  SELECT jo.id, jo.title, jo.company_name, jo.status, jo.contract_type,
         jo.min_exp_years, jo.max_exp_years, jo.ral_min, jo.ral_max, jo.currency, jo.required_skills,
         jo.role_description, jo.location_and_hours, jo.company_description,
         jo.requirements_description, jo.compensation_package, jo.created_at,
         ${locationJson("l")} AS location
  FROM job_offers jo
  JOIN locations l ON l.id = jo.location_id
`;

const toJobOffer = (row: JobOfferRow): JobOffer => ({
  ...row,
  required_skills: JSON.parse(row.required_skills) as string[],
  location: JSON.parse(row.location) as Location,
});

export function createJobOffersRepository(db: Db) {
  const all = db.prepare(`${SELECT} ORDER BY jo.created_at DESC, jo.id`);
  const byId = db.prepare(`${SELECT} WHERE jo.id = ?`);

  return {
    list(): JobOffer[] {
      return (all.all() as JobOfferRow[]).map(toJobOffer);
    },

    get(id: string): JobOffer {
      const row = byId.get(id) as JobOfferRow | undefined;
      if (!row) throw new NotFoundError("job offer", id);
      return toJobOffer(row);
    },
  };
}

export type JobOffersRepository = ReturnType<typeof createJobOffersRepository>;
