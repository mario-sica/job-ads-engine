import type { ContentTarget, Format, Kind } from "@job-ads-engine/content";

/*
 * Tipi delle risposte dell'API, limitati ai campi che la UI usa. Il contenuto
 * resta `unknown`: la sua forma la dà lo schema di `@job-ads-engine/content`.
 */

export const AD_STATUSES = ["draft", "active", "closed", "archived"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

// Le stesse transizioni del backend, per mostrare solo i pulsanti ammessi.
export const NEXT_STATUSES: Record<AdStatus, readonly AdStatus[]> = {
  draft: ["active", "archived"],
  active: ["closed"],
  closed: ["active", "archived"],
  archived: [],
};

export const LOCATION_PRECISIONS = ["address", "locality", "province"] as const;
export type LocationPrecision = (typeof LOCATION_PRECISIONS)[number];

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

export interface JobOfferSummary {
  id: string;
  title: string;
  company_name: string;
  location: LocationInput;
}

export interface ChannelFormat extends ContentTarget {
  id: number;
  channel_code: string;
  channel_name: string;
  aspect_ratio: string | null;
}

export interface Revision {
  id: number;
  variant_id: number;
  content: Record<string, unknown>;
  source: "llm" | "manual";
  model: string | null;
  prompt_version: string | null;
  created_at: string;
}

export interface Variant {
  id: number;
  ad_id: number;
  label: string;
  angle: string | null;
  is_active: boolean;
  current_revision: Revision;
}

export interface Ad {
  id: number;
  job_offer_id: string;
  channel_format_id: number;
  channel_code: string;
  kind: Kind;
  format: Format;
  aspect_ratio: string | null;
  location: LocationInput;
  location_precision: LocationPrecision;
  status: AdStatus;
  updated_at: string;
}

export interface AdWithVariants extends Ad {
  variants: Variant[];
}

export interface Preview {
  text: { fields?: Record<string, string>; body: string } | null;
  html: string | null;
}

export interface AdFilters {
  job_offer_id?: string;
  channel?: string;
  status?: AdStatus | "";
}

export interface CreateAdInput {
  job_offer_id: string;
  channel_format_id: number;
  location?: LocationInput;
  location_precision?: LocationPrecision;
  variants: { angle: string | null }[];
}

/** Errore nel formato unico dell'API: `{ error: { code, message, details } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Fetch = typeof fetch;

function isErrorBody(value: unknown): value is { error: { code: string; message: string; details?: unknown } } {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

export function createApi(fetchFn: Fetch = (...args) => fetch(...args)) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`/api${path}`, {
        method,
        headers: body === undefined ? {} : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "network_error", "backend non raggiungibile: è avviato?", null);
    }
    const data: unknown = await res.json().catch(() => null);
    if (res.ok) return data as T;
    if (isErrorBody(data)) throw new ApiError(res.status, data.error.code, data.error.message, data.error.details ?? null);
    // Il proxy di Vite risponde così quando il backend è spento.
    throw new ApiError(res.status, "unexpected_response", `risposta inattesa dal backend (HTTP ${res.status})`, null);
  }

  const query = (params: Record<string, string | undefined>) => {
    const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
    return entries.length ? `?${new URLSearchParams(entries)}` : "";
  };

  return {
    jobOffers: () => request<JobOfferSummary[]>("GET", "/job-offers"),
    channelFormats: () => request<ChannelFormat[]>("GET", "/channel-formats"),
    ads: (filters: AdFilters = {}) => request<Ad[]>("GET", `/ads${query({ ...filters })}`),
    ad: (id: number) => request<AdWithVariants>("GET", `/ads/${id}`),
    createAd: (input: CreateAdInput) => request<AdWithVariants>("POST", "/ads", input),
    addVariant: (adId: number, angle: string | null) => request<Variant>("POST", `/ads/${adId}/variants`, { angle }),
    setStatus: (adId: number, status: AdStatus) => request<AdWithVariants>("PATCH", `/ads/${adId}`, { status }),
    setVariantActive: (variantId: number, is_active: boolean) =>
      request<Variant>("PATCH", `/variants/${variantId}`, { is_active }),
    revisions: (variantId: number) => request<Revision[]>("GET", `/variants/${variantId}/revisions`),
    addRevision: (variantId: number, content: unknown) =>
      request<Revision>("POST", `/variants/${variantId}/revisions`, { content }),
    restoreRevision: (variantId: number, revision_id: number) =>
      request<Variant>("PUT", `/variants/${variantId}/current-revision`, { revision_id }),
    preview: (variantId: number) => request<Preview>("GET", `/variants/${variantId}/preview`),
  };
}

export type Api = ReturnType<typeof createApi>;

/** L'HTML dell'anteprima si carica in un iframe direttamente dall'API. */
export const previewHtmlUrl = (variantId: number, revisionId: number) =>
  `/api/variants/${variantId}/preview?as=html&rev=${revisionId}`;

export const api = createApi();
