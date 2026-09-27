import { z } from "zod";
import * as b from "./blocks.js";
import { factsSchema, SALARY_FRAMINGS } from "./facts.js";
import { deepMerge } from "./primitives.js";
import type { Specs } from "./specs.js";
import {
  InvalidSpecsError,
  PARTS_BY_FORMAT,
  UnsupportedFormatError,
  type Format,
  type Kind,
  type Part,
} from "./types.js";

/** Versione della forma del contenuto, salvata su ogni revisione. */
export const SCHEMA_VERSION = 1;

interface PartDefinition {
  resolve(overrides: unknown): z.ZodType;
}

/** Lega limiti, default e factory di un blocco, nascondendo il tipo dei limiti. */
function definePart<L>(def: {
  limits: z.ZodType<L>;
  defaults: L;
  build: (limits: L) => z.ZodType;
}): PartDefinition {
  return {
    resolve(overrides) {
      const result = def.limits.safeParse(deepMerge(def.defaults, overrides));
      if (!result.success) throw new InvalidSpecsError(z.prettifyError(result.error));
      return def.build(result.data);
    },
  };
}

/** Il kind decide com'è fatta ogni parte. */
const PARTS: Record<Kind, Partial<Record<Part, PartDefinition>>> = {
  job_board: {
    text: definePart({ limits: b.jobDescriptionLimits, defaults: b.JOB_DESCRIPTION_DEFAULTS, build: b.jobDescription }),
  },
  messaging: {
    text: definePart({ limits: b.chatMessageLimits, defaults: b.CHAT_MESSAGE_DEFAULTS, build: b.chatMessage }),
    image: definePart({ limits: b.jobSheetLimits, defaults: b.JOB_SHEET_DEFAULTS, build: b.jobSheet }),
  },
  social: {
    text: definePart({ limits: b.captionLimits, defaults: b.CAPTION_DEFAULTS, build: b.caption }),
    image: definePart({ limits: b.creativeLimits, defaults: b.CREATIVE_DEFAULTS, build: b.creative }),
  },
};

/** Riga di `channel_formats` già risolta: tutto ciò che serve per costruire gli schemi. */
export interface ContentTarget {
  kind: Kind;
  format: Format;
  specs: Specs;
}

/** Il formato decide quali parti ci sono. */
function partShapes({ kind, format, specs }: ContentTarget): Partial<Record<Part, z.ZodType>> {
  const shapes: Partial<Record<Part, z.ZodType>> = {};
  for (const part of PARTS_BY_FORMAT[format]) {
    const def = PARTS[kind][part];
    if (!def) throw new UnsupportedFormatError(kind, part);
    shapes[part] = def.resolve(specs.limits?.[part]);
  }
  return shapes;
}

/** Contenuto salvato su `ad_revisions.content`: facts + parti richieste dal formato. */
export function contentSchemaFor(target: ContentTarget) {
  return z.strictObject({ facts: factsSchema, ...partShapes(target) });
}

/** Output atteso dall'LLM: solo parti generate, più la scelta del framing della RAL. */
export function llmOutputSchemaFor(target: ContentTarget) {
  return z.strictObject({
    salary_framing: z.enum(SALARY_FRAMINGS).nullable(),
    ...partShapes(target),
  });
}
