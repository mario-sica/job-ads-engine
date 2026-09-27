import type { Db } from "../../db/connection.js";
import { NotFoundError } from "../../errors.js";

export interface LocationInput {
  street_name: string | null;
  street_number: string | null;
  postal_code: string | null;
  locality: string | null;
  province: string | null;
  province_code: string | null;
  region: string | null;
  country_code: string;
}

export interface Location extends LocationInput {
  id: number;
}

/** Location come oggetto JSON in una SELECT, per annidarla senza colonne con prefisso. */
export const locationJson = (alias: string) => `json_object(
  'id', ${alias}.id,
  'street_name', ${alias}.street_name,
  'street_number', ${alias}.street_number,
  'postal_code', ${alias}.postal_code,
  'locality', ${alias}.locality,
  'province', ${alias}.province,
  'province_code', ${alias}.province_code,
  'region', ${alias}.region,
  'country_code', ${alias}.country_code
)`;

export function createLocationsRepository(db: Db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO locations
      (street_name, street_number, postal_code, locality, province, province_code, region, country_code)
    VALUES
      (@street_name, @street_number, @postal_code, @locality, @province, @province_code, @region, @country_code)
  `);
  // Stesse colonne e stesso COALESCE dell'indice locations_unique: NULL e '' sono lo stesso luogo.
  const findId = db
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
    .pluck();
  const byId = db.prepare("SELECT * FROM locations WHERE id = ?");

  return {
    /** Id del luogo, creandolo se non esiste. */
    findOrCreate(location: LocationInput): number {
      insert.run(location);
      return findId.get(location) as number;
    },

    get(id: number): Location {
      const row = byId.get(id) as Location | undefined;
      if (!row) throw new NotFoundError("location", id);
      return row;
    },
  };
}

export type LocationsRepository = ReturnType<typeof createLocationsRepository>;
