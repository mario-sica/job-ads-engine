import type { CreateAdInput, LocationInput, LocationPrecision } from "./api.js";

export const MAX_VARIANTS = 4;

export const LOCATION_FIELDS = [
  ["locality", "Località"],
  ["province", "Provincia"],
  ["province_code", "Sigla provincia"],
  ["region", "Regione"],
  ["postal_code", "CAP"],
  ["street_name", "Via"],
  ["street_number", "Civico"],
] as const;

export type LocationDraft = Record<(typeof LOCATION_FIELDS)[number][0], string>;

export const EMPTY_LOCATION: LocationDraft = Object.fromEntries(LOCATION_FIELDS.map(([k]) => [k, ""])) as LocationDraft;

export interface CreateAdDraft {
  jobOfferId: string;
  channelFormatId: number | null;
  /** Se falso, l'annuncio usa il luogo della job offer. */
  customLocation: boolean;
  location: LocationDraft;
  /** Vuoto: la precisione predefinita del backend per il kind. */
  precision: LocationPrecision | "";
  angles: string[];
}

/** Dalla bozza del modulo al corpo di `POST /api/ads`; i campi vuoti diventano assenti. */
export function toCreateInput(draft: CreateAdDraft): CreateAdInput | null {
  if (!draft.jobOfferId || draft.channelFormatId === null) return null;
  const input: CreateAdInput = {
    job_offer_id: draft.jobOfferId,
    channel_format_id: draft.channelFormatId,
    variants: draft.angles.map((a) => ({ angle: a.trim() || null })),
  };
  if (draft.customLocation) {
    const clean = (v: string) => v.trim() || null;
    const location: LocationInput = {
      street_name: clean(draft.location.street_name),
      street_number: clean(draft.location.street_number),
      postal_code: clean(draft.location.postal_code),
      locality: clean(draft.location.locality),
      province: clean(draft.location.province),
      province_code: clean(draft.location.province_code),
      region: clean(draft.location.region),
      country_code: "IT",
    };
    input.location = location;
  }
  if (draft.precision) input.location_precision = draft.precision;
  return input;
}
