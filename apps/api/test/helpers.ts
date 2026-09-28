import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseSpecs, type ContentTarget, type Format, type Kind } from "@job-ads-engine/content";
import { openDatabase, type Db } from "../src/db/connection.js";
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";

/** Percorso di un file del pacchetto api, indipendente dalla cartella di lancio. */
export const apiPath = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

/** DB in memoria preparato come quello reale: migrazioni e seed. */
export function seededDb(): Db {
  const db = openDatabase(":memory:");
  migrate(db);
  seed(db);
  return db;
}

export interface ChannelFormatRow extends ContentTarget {
  channel_code: string;
  aspect_ratio: string | null;
}

export function channelFormats(db: Db): ChannelFormatRow[] {
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
