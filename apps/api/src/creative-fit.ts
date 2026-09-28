import { CREATIVE_DEFAULTS, type Specs } from "@job-ads-engine/content";

/*
 * Limiti morbidi per i testi della creative. Nelle `specs` delle righe social il
 * massimo validato è l'obiettivo editoriale più il 20%: il prompt chiede
 * l'obiettivo, un testo che lo supera di poco resta valido e il renderer riduce
 * il font invece di farlo fallire.
 */
export const LENGTH_TOLERANCE = 1.2;

/** Il minimo a cui il renderer riduce il font di un testo lungo. */
const MIN_SCALE = 0.8;

export const SOFT_FIELDS = ["title", "hook", "subline"] as const;
export type SoftField = (typeof SOFT_FIELDS)[number];

/** L'obiettivo editoriale per un massimo validato: 36 → 30. */
export const targetLength = (max: number): number => Math.round(max / LENGTH_TOLERANCE);

/** Il massimo validato di un campo per la riga, con i default del blocco se la riga non lo sovrascrive. */
export function maxLength(field: SoftField, specs: Specs): number {
  const key = `${field}_max` as const;
  const override = specs.limits?.image?.[key];
  return typeof override === "number" ? override : CREATIVE_DEFAULTS[key];
}

/** Scala del font: 1 fino all'obiettivo, poi in proporzione, mai sotto l'80%. */
export const fitScale = (length: number, max: number): number =>
  Math.max(MIN_SCALE, Math.min(1, targetLength(max) / length));
