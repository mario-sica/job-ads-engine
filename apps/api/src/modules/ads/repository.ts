import { SCHEMA_VERSION } from "@job-ads-engine/content";
import type { Db } from "../../db/connection.js";
import { NotFoundError } from "../../errors.js";
import { locationJson, type Location } from "../locations/repository.js";
import { assertTransition, type AdStatus } from "./status.js";
import type { Ad, AdFilters, AdWithVariants, Json, NewAd, Revision, RevisionInput, Variant, VariantInput } from "./types.js";

const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

const AD_SELECT = `
  SELECT a.id, a.job_offer_id, a.channel_format_id, cf.channel_code, c.kind, cf.format, cf.aspect_ratio,
         ${locationJson("l")} AS location, a.location_precision, a.status, a.created_at, a.updated_at
  FROM ads a
  JOIN channel_formats cf ON cf.id = a.channel_format_id
  JOIN channels c         ON c.code = cf.channel_code
  JOIN locations l        ON l.id = a.location_id
`;

const VARIANT_SELECT = `
  SELECT id, ad_id, label, angle, is_active, created_at, current_revision_id
  FROM ad_variants
`;

type AdRow = Omit<Ad, "location"> & { location: string };
type VariantRow = Omit<Variant, "is_active" | "current_revision"> & { is_active: 0 | 1; current_revision_id: number };
type RevisionRow = Omit<Revision, "content" | "input_snapshot"> & { content: string; input_snapshot: string | null };

const toAd = (row: AdRow): Ad => ({ ...row, location: JSON.parse(row.location) as Location });

const toRevision = (row: RevisionRow): Revision => ({
  ...row,
  content: JSON.parse(row.content) as Json,
  input_snapshot: row.input_snapshot === null ? null : (JSON.parse(row.input_snapshot) as Json),
});

export function createAdsRepository(db: Db) {
  const stmt = {
    insertAd: db.prepare(`
      INSERT INTO ads (job_offer_id, channel_format_id, location_id, location_precision)
      VALUES (@job_offer_id, @channel_format_id, @location_id, @location_precision)
    `),
    insertVariant: db.prepare("INSERT INTO ad_variants (ad_id, label, angle) VALUES (?, ?, ?)"),
    insertRevision: db.prepare(`
      INSERT INTO ad_revisions (variant_id, content, schema_version, source, model, prompt_version, input_snapshot)
      VALUES (@variant_id, @content, @schema_version, @source, @model, @prompt_version, @input_snapshot)
    `),
    setCurrentRevision: db.prepare("UPDATE ad_variants SET current_revision_id = ? WHERE id = ?"),
    adById: db.prepare(`${AD_SELECT} WHERE a.id = ?`),
    adsFiltered: db.prepare(`
      ${AD_SELECT}
      WHERE (@job_offer_id IS NULL OR a.job_offer_id = @job_offer_id)
        AND (@channel IS NULL OR cf.channel_code = @channel)
        AND (@status IS NULL OR a.status = @status)
      ORDER BY a.updated_at DESC, a.id DESC
    `),
    variantsOfAd: db.prepare(`${VARIANT_SELECT} WHERE ad_id = ? ORDER BY id`),
    variantById: db.prepare(`${VARIANT_SELECT} WHERE id = ?`),
    revisionById: db.prepare("SELECT * FROM ad_revisions WHERE id = ?"),
    revisionsOfVariant: db.prepare("SELECT * FROM ad_revisions WHERE variant_id = ? ORDER BY id DESC"),
    revisionOfVariant: db.prepare("SELECT id FROM ad_revisions WHERE id = ? AND variant_id = ?").pluck(),
    adIdOfVariant: db.prepare("SELECT ad_id FROM ad_variants WHERE id = ?").pluck(),
    statusOfAd: db.prepare("SELECT status FROM ads WHERE id = ?").pluck(),
    setStatus: db.prepare(`UPDATE ads SET status = ?, updated_at = ${NOW} WHERE id = ?`),
    setActive: db.prepare("UPDATE ad_variants SET is_active = ? WHERE id = ?"),
    touchAd: db.prepare(`UPDATE ads SET updated_at = ${NOW} WHERE id = ?`),
  };

  /** Id dell'annuncio a cui appartiene la variante; NotFoundError se non esiste. */
  function adIdOf(variantId: number): number {
    const adId = stmt.adIdOfVariant.get(variantId) as number | undefined;
    if (adId === undefined) throw new NotFoundError("variant", variantId);
    return adId;
  }

  function insertRevision(variantId: number, revision: RevisionInput): number {
    const llm = revision.source === "llm" ? revision : null;
    const result = stmt.insertRevision.run({
      variant_id: variantId,
      content: JSON.stringify(revision.content),
      schema_version: SCHEMA_VERSION,
      source: revision.source,
      model: llm?.model ?? null,
      prompt_version: llm?.prompt_version ?? null,
      input_snapshot: llm ? JSON.stringify(llm.input_snapshot) : null,
    });
    return Number(result.lastInsertRowid);
  }

  /** Variante, prima revisione e puntatore. Va chiamata dentro una transazione. */
  function insertVariant(adId: number, variant: VariantInput): number {
    const variantId = Number(stmt.insertVariant.run(adId, variant.label, variant.angle).lastInsertRowid);
    stmt.setCurrentRevision.run(insertRevision(variantId, variant.revision), variantId);
    return variantId;
  }

  function toVariant(row: VariantRow): Variant {
    const { current_revision_id, is_active, ...rest } = row;
    const revision = stmt.revisionById.get(current_revision_id) as RevisionRow;
    return { ...rest, is_active: is_active === 1, current_revision: toRevision(revision) };
  }

  const createAd = db.transaction((input: NewAd): number => {
    const { variants, ...ad } = input;
    const adId = Number(stmt.insertAd.run(ad).lastInsertRowid);
    for (const variant of variants) insertVariant(adId, variant);
    return adId;
  });

  const addVariant = db.transaction((adId: number, variant: VariantInput): number => {
    if (stmt.statusOfAd.get(adId) === undefined) throw new NotFoundError("ad", adId);
    const variantId = insertVariant(adId, variant);
    stmt.touchAd.run(adId);
    return variantId;
  });

  const addRevision = db.transaction((variantId: number, revision: RevisionInput): number => {
    const adId = adIdOf(variantId);
    const revisionId = insertRevision(variantId, revision);
    stmt.setCurrentRevision.run(revisionId, variantId);
    stmt.touchAd.run(adId);
    return revisionId;
  });

  const restoreRevision = db.transaction((variantId: number, revisionId: number): void => {
    const adId = adIdOf(variantId);
    // Anche la FK composta lo impedirebbe; qui diventa un 404 leggibile invece di un errore SQL.
    if (stmt.revisionOfVariant.get(revisionId, variantId) === undefined) throw new NotFoundError("revision", revisionId);
    stmt.setCurrentRevision.run(revisionId, variantId);
    stmt.touchAd.run(adId);
  });

  const setVariantActive = db.transaction((variantId: number, active: boolean): void => {
    const adId = adIdOf(variantId);
    stmt.setActive.run(active ? 1 : 0, variantId);
    stmt.touchAd.run(adId);
  });

  const updateStatus = db.transaction((adId: number, to: AdStatus): void => {
    const from = stmt.statusOfAd.get(adId) as AdStatus | undefined;
    if (from === undefined) throw new NotFoundError("ad", adId);
    assertTransition(from, to);
    stmt.setStatus.run(to, adId);
  });

  const repo = {
    list(filters: AdFilters = {}): Ad[] {
      const rows = stmt.adsFiltered.all({
        job_offer_id: filters.job_offer_id ?? null,
        channel: filters.channel ?? null,
        status: filters.status ?? null,
      }) as AdRow[];
      return rows.map(toAd);
    },

    get(id: number): AdWithVariants {
      const row = stmt.adById.get(id) as AdRow | undefined;
      if (!row) throw new NotFoundError("ad", id);
      const variants = (stmt.variantsOfAd.all(id) as VariantRow[]).map(toVariant);
      return { ...toAd(row), variants };
    },

    getVariant(id: number): Variant {
      const row = stmt.variantById.get(id) as VariantRow | undefined;
      if (!row) throw new NotFoundError("variant", id);
      return toVariant(row);
    },

    /** Annuncio, varianti, revisioni e puntatori in un'unica transazione. */
    create(input: NewAd): AdWithVariants {
      return repo.get(createAd(input));
    },

    /** Nuova variante con la sua prima revisione. La label la sceglie il chiamante. */
    addVariant(adId: number, variant: VariantInput): Variant {
      return repo.getVariant(addVariant(adId, variant));
    },

    /** Nuova revisione (edit manuale o rigenerazione) che diventa la corrente. */
    addRevision(variantId: number, revision: RevisionInput): Revision {
      return toRevision(stmt.revisionById.get(addRevision(variantId, revision)) as RevisionRow);
    },

    /** Storico della variante, dalla revisione più recente. */
    listRevisions(variantId: number): Revision[] {
      adIdOf(variantId);
      return (stmt.revisionsOfVariant.all(variantId) as RevisionRow[]).map(toRevision);
    },

    /** Ripristino: il puntatore torna su una revisione esistente, senza crearne una nuova. */
    restoreRevision(variantId: number, revisionId: number): Variant {
      restoreRevision(variantId, revisionId);
      return repo.getVariant(variantId);
    },

    setVariantActive(variantId: number, active: boolean): Variant {
      setVariantActive(variantId, active);
      return repo.getVariant(variantId);
    },

    /** Cambio di stato; InvalidTransitionError se il ciclo di vita non lo ammette. */
    updateStatus(adId: number, to: AdStatus): AdWithVariants {
      updateStatus(adId, to);
      return repo.get(adId);
    },
  };
  return repo;
}

export type AdsRepository = ReturnType<typeof createAdsRepository>;
