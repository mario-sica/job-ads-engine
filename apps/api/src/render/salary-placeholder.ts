import type { Salary } from "@job-ads-engine/content";
import { formatSalaryAmount } from "./format.js";

/*
 * Il segnaposto della RAL: chi scrive il testo (il modello o una persona) mette
 * {RAL} dove vuole la cifra, e il renderer la compone dai facts. Così le cifre
 * compaiono anche nel copy, ma vengono sempre dai dati verificati: il modello
 * continua a non scrivere numeri e findSalaryLeaks resta valido.
 */
export const SALARY_PLACEHOLDER = "{RAL}";

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
  }
  return value;
}

function* strings(value: unknown, path: string[] = []): Generator<[string, string]> {
  if (typeof value === "string") yield [path.join("."), value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, [...path, String(i)]);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* strings(v, [...path, k]);
}

/** Sostituisce il segnaposto con l'importo formattato secondo il framing dei facts. */
export function fillSalaryPlaceholder<T>(value: T, salary: Salary | null): T {
  if (salary === null) return value;
  const amount = formatSalaryAmount(salary);
  return mapStrings(value, (s) => s.replaceAll(SALARY_PLACEHOLDER, amount)) as T;
}

/** Campi che usano il segnaposto quando nei facts non c'è una RAL da metterci. */
export function findUnfillablePlaceholders(value: unknown, salary: Salary | null): string[] {
  if (salary !== null) return [];
  return [...strings(value)]
    .filter(([, text]) => text.includes(SALARY_PLACEHOLDER))
    .map(([path]) => `${path}: usa ${SALARY_PLACEHOLDER}, ma l'offerta non indica una RAL`);
}
