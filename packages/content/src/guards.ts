import type { Salary } from "./facts.js";

/*
 * Guardrail sull'output LLM: le cifre della RAL non devono comparire nel testo
 * libero. La RAL si mostra solo tramite `facts`, formattata dal renderer.
 * Si applica all'output generato, non agli edit manuali (lì decide l'umano).
 */

// "38.000" / "38'000" / "38 000" oppure "38" / "38,5", con eventuale "k" o "mila"
const AMOUNT = /(\d{1,3}(?:[.'’ ]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|mila)?(?![\p{L}\d])/giu;

export function parseAmounts(text: string): number[] {
  return [...text.matchAll(AMOUNT)].map(([, num = "", suffix]) => {
    const grouped = /^\d{1,3}(?:[.'’ ]\d{3})+$/.test(num);
    const value = grouped ? Number(num.replace(/[.'’ ]/g, "")) : Number(num.replace(",", "."));
    return suffix ? value * 1000 : value;
  });
}

function* strings(value: unknown, path: string[] = []): Generator<[string, string]> {
  if (typeof value === "string") yield [path.join("."), value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, [...path, String(i)]);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) yield* strings(v, [...path, k]);
}

/** Percorsi dei campi che contengono una cifra della RAL. */
export function findSalaryLeaks(generated: unknown, salary: Salary | null): string[] {
  if (!salary) return [];
  const figures = new Set([salary.min, salary.max].filter((v): v is number => v !== null));
  const leaks: string[] = [];
  for (const [path, text] of strings(generated)) {
    if (parseAmounts(text).some((n) => figures.has(n))) leaks.push(path);
  }
  return leaks;
}
