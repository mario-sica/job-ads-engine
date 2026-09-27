import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { parseSpecs, type ContentTarget, type Format, type Kind } from "@job-ads-engine/content";

/** Percorso di un file del pacchetto api, indipendente dalla cartella di lancio. */
export const apiPath = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

/** DB in memoria con migrazioni e seed dei canali. */
export function seededDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(readFileSync(apiPath("db/migrations/001_init.sql"), "utf8"));
  db.exec(readFileSync(apiPath("db/seed/001_channels.sql"), "utf8"));
  return db;
}

export interface ChannelFormatRow extends ContentTarget {
  channel_code: string;
  aspect_ratio: string | null;
}

export function channelFormats(db: Database.Database): ChannelFormatRow[] {
  const rows = db
    .prepare(
      `SELECT cf.channel_code, c.kind, cf.format, cf.aspect_ratio, cf.specs
       FROM channel_formats cf JOIN channels c ON c.code = cf.channel_code`,
    )
    .all() as { channel_code: string; kind: Kind; format: Format; aspect_ratio: string | null; specs: string }[];
  return rows.map((r) => ({ ...r, specs: parseSpecs(r.specs) }));
}

export const seedJobOffers = JSON.parse(readFileSync(apiPath("db/seed/job_offers.json"), "utf8")) as Record<
  string,
  unknown
>[];
