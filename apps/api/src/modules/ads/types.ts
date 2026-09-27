import type { Format, Kind } from "@job-ads-engine/content";
import type { Location } from "../locations/repository.js";
import type { AdStatus } from "./status.js";

export const LOCATION_PRECISIONS = ["address", "locality", "province"] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

export type Json = Record<string, unknown>;

/*
 * Il contenuto arriva già validato dal service (`contentSchemaFor`): il repository
 * lo salva e basta. Una revisione `llm` porta sempre i metadati di generazione.
 */
export type RevisionInput =
  | { source: "llm"; content: Json; model: string; prompt_version: string; input_snapshot: Json }
  | { source: "manual"; content: Json };

export interface Revision {
  id: number;
  variant_id: number;
  content: Json;
  schema_version: number;
  source: "llm" | "manual";
  model: string | null;
  prompt_version: string | null;
  input_snapshot: Json | null;
  created_at: string;
}

export interface VariantInput {
  label: string;
  angle: string | null;
  revision: RevisionInput;
}

export interface Variant {
  id: number;
  ad_id: number;
  label: string;
  angle: string | null;
  is_active: boolean;
  created_at: string;
  current_revision: Revision;
}

export interface NewAd {
  job_offer_id: string;
  channel_format_id: number;
  location_id: number;
  location_precision: LocationPrecision;
  /** Almeno una: un annuncio senza varianti non ha contenuto. */
  variants: [VariantInput, ...VariantInput[]];
}

export interface Ad {
  id: number;
  job_offer_id: string;
  channel_format_id: number;
  channel_code: string;
  kind: Kind;
  format: Format;
  aspect_ratio: string | null;
  location: Location;
  location_precision: LocationPrecision;
  status: AdStatus;
  created_at: string;
  updated_at: string;
}

export interface AdWithVariants extends Ad {
  variants: Variant[];
}

export interface AdFilters {
  job_offer_id?: string;
  channel?: string;
  status?: AdStatus;
}
