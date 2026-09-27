import { parseSpecs, type ContentTarget, type Format, type Kind } from "@job-ads-engine/content";
import type { Db } from "../../db/connection.js";
import { NotFoundError } from "../../errors.js";

/** Combinazione pubblicabile, già pronta per `contentSchemaFor` / `llmOutputSchemaFor`. */
export interface ChannelFormat extends ContentTarget {
  id: number;
  channel_code: string;
  channel_name: string;
  aspect_ratio: string | null;
}

type ChannelFormatRow = Omit<ChannelFormat, "specs" | "kind" | "format"> & { kind: Kind; format: Format; specs: string };

const SELECT = `
  SELECT cf.id, cf.channel_code, c.name AS channel_name, c.kind, cf.format, cf.aspect_ratio, cf.specs
  FROM channel_formats cf
  JOIN channels c ON c.code = cf.channel_code
`;

// Specs non valide sono un errore di configurazione: parseSpecs solleva InvalidSpecsError.
const toChannelFormat = (row: ChannelFormatRow): ChannelFormat => ({ ...row, specs: parseSpecs(row.specs) });

export function createChannelFormatsRepository(db: Db) {
  const all = db.prepare(`${SELECT} ORDER BY cf.id`);
  const byId = db.prepare(`${SELECT} WHERE cf.id = ?`);

  return {
    list(): ChannelFormat[] {
      return (all.all() as ChannelFormatRow[]).map(toChannelFormat);
    },

    get(id: number): ChannelFormat {
      const row = byId.get(id) as ChannelFormatRow | undefined;
      if (!row) throw new NotFoundError("channel format", id);
      return toChannelFormat(row);
    },
  };
}

export type ChannelFormatsRepository = ReturnType<typeof createChannelFormatsRepository>;
