import { contentSchemaFor, type Salary } from "@job-ads-engine/content";
import type { AppDeps } from "../../app.js";
import { AdArchivedError, InvalidContentError, issuesOf } from "../../errors.js";
import { InvalidInputError } from "../../http/validation.js";
import { generateContent } from "../../llm/generate.js";
import { renderPreview, type Preview } from "../../render/index.js";
import { findUnfillablePlaceholders } from "../../render/salary-placeholder.js";
import { createChannelFormatsRepository } from "../channel-formats/repository.js";
import { createJobOffersRepository } from "../job-offers/repository.js";
import { createLocationsRepository, type Location, type LocationInput } from "../locations/repository.js";
import { createAdsRepository } from "./repository.js";
import type { AdStatus } from "./status.js";
import type { AdFilters, AdWithVariants, Json, LocationPrecision, Revision, Variant, VariantInput } from "./types.js";

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export interface CreateAdInput {
  job_offer_id: string;
  channel_format_id: number;
  /** Se assente, il luogo della job offer. */
  location?: LocationInput | undefined;
  /** Se assente, dipende dal kind: indirizzo per le job board, località per gli altri. */
  location_precision?: LocationPrecision | undefined;
  variants: { angle: string | null }[];
}

const withoutId = ({ id: _, ...location }: Location): LocationInput => location;

export function createAdsService({ db, llm }: AppDeps) {
  const ads = createAdsRepository(db);
  const jobOffers = createJobOffersRepository(db);
  const formats = createChannelFormatsRepository(db);
  const locations = createLocationsRepository(db);

  /** Un annuncio archiviato è in sola lettura. */
  function editableAd(adId: number): AdWithVariants {
    const ad = ads.get(adId);
    if (ad.status === "archived") throw new AdArchivedError(adId);
    return ad;
  }

  /** La variante e il suo annuncio, che non deve essere archiviato. */
  function editableVariant(variantId: number): { variant: Variant; ad: AdWithVariants } {
    const variant = ads.getVariant(variantId);
    return { variant, ad: editableAd(variant.ad_id) };
  }

  return {
    list: (filters: AdFilters) => ads.list(filters),
    get: (id: number) => ads.get(id),
    updateStatus: (id: number, status: AdStatus) => ads.updateStatus(id, status),

    async create(input: CreateAdInput): Promise<AdWithVariants> {
      const jobOffer = jobOffers.get(input.job_offer_id);
      const target = formats.get(input.channel_format_id);
      const location = input.location ?? withoutId(jobOffer.location);
      const precision = input.location_precision ?? (target.kind === "job_board" ? "address" : "locality");

      // L'LLM sta fuori dalla transazione: è lento e può fallire. Se una variante fallisce, non si salva nulla.
      const revisions = await Promise.all(
        input.variants.map(({ angle }) => generateContent({ target, jobOffer, location, precision, angle }, llm)),
      );
      const variants = revisions.map((revision, i) => ({ label: LABELS[i]!, angle: input.variants[i]!.angle, revision }));

      return db.transaction(() =>
        ads.create({
          job_offer_id: jobOffer.id,
          channel_format_id: target.id,
          location_id: locations.findOrCreate(location),
          location_precision: precision,
          variants: variants as [VariantInput, ...VariantInput[]],
        }),
      )();
    },

    async addVariant(adId: number, angle: string | null): Promise<Variant> {
      const ad = editableAd(adId);
      const revision = await generateContent(
        {
          target: formats.get(ad.channel_format_id),
          jobOffer: jobOffers.get(ad.job_offer_id),
          location: withoutId(ad.location),
          precision: ad.location_precision,
          angle,
        },
        llm,
      );
      // Si rilegge dopo la generazione: nel frattempo l'annuncio può essere cambiato.
      const used = new Set(editableAd(adId).variants.map((v) => v.label));
      const label = LABELS.find((l) => !used.has(l));
      if (!label) throw new InvalidInputError([{ path: "angle", message: "numero massimo di varianti raggiunto" }]);
      return ads.addVariant(adId, { label, angle, revision });
    },

    setVariantActive(variantId: number, active: boolean): Variant {
      editableVariant(variantId);
      return ads.setVariantActive(variantId, active);
    },

    listRevisions: (variantId: number) => ads.listRevisions(variantId),

    /** Edit manuale: lo stesso schema dell'output salvato, costruito dal formato dell'annuncio. */
    addManualRevision(variantId: number, content: unknown): Revision {
      const { ad } = editableVariant(variantId);
      const parsed = contentSchemaFor(formats.get(ad.channel_format_id)).safeParse(content);
      if (!parsed.success) throw new InvalidContentError(issuesOf(parsed.error));
      const { facts, ...parts } = parsed.data as Json & { facts: { salary: Salary | null } };
      const unfillable = findUnfillablePlaceholders(parts, facts.salary);
      if (unfillable.length > 0) {
        throw new InvalidContentError(
          unfillable.map((line) => ({ path: line.slice(0, line.indexOf(": ")), message: line.slice(line.indexOf(": ") + 2) })),
        );
      }
      return ads.addRevision(variantId, { source: "manual", content: parsed.data as Json });
    },

    restoreRevision(variantId: number, revisionId: number): Variant {
      editableVariant(variantId);
      return ads.restoreRevision(variantId, revisionId);
    },

    preview(variantId: number): Preview {
      const variant = ads.getVariant(variantId);
      const ad = ads.get(variant.ad_id);
      return renderPreview({
        target: formats.get(ad.channel_format_id),
        content: variant.current_revision.content,
        location: withoutId(ad.location),
        precision: ad.location_precision,
        jobTitle: jobOffers.get(ad.job_offer_id).title,
      });
    },
  };
}

export type AdsService = ReturnType<typeof createAdsService>;
