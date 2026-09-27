import { z } from "zod";

/** Intervallo [min, max] sul numero di elementi di una lista. */
export type Range = readonly [number, number];

export const rangeSchema = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([min, max]) => min <= max, "il minimo supera il massimo");

export const charLimit = z.number().int().positive();

/** Una riga di testo non vuota con lunghezza massima. */
export const line = (max: number) => z.string().trim().min(1).max(max);

/** Una lista con numero di elementi vincolato. */
export const list = <T extends z.ZodType>(item: T, [min, max]: Range) =>
  z.array(item).min(min).max(max);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Merge ricorsivo per gli override di `specs`: gli oggetti si fondono, tutto il resto si sostituisce. */
export function deepMerge(base: unknown, override: unknown): unknown {
  if (override === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = deepMerge(base[key], value);
  }
  return out;
}
