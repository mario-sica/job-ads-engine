/*
 * Guardrail di tono sull'output LLM, come quello sulla RAL: un testo che non li
 * rispetta non si salva, provoca il retry. Non si applicano agli edit manuali.
 *
 * - Contrapposizioni: frasi costruite per contrasto con altri lavori, luoghi o
 *   persone ("…, non Y", "niente Y", "lavoro vero"). Sminuiscono qualcuno per
 *   valorizzare l'offerta: il prompt le vieta, questo controllo lo garantisce.
 * - Emoji: nessuna, in nessun campo.
 */

const CONTRAST = /[,;:–—-]\s*non\s+\p{L}/iu;
const NEGATIVE_OPENING = /(?:^|[.!?]\s+)(?:niente|basta|addio)\s+\p{L}/iu;
const IMPLIED_COMPARISON = /\b(?:vero|vera|veri|vere)\b/iu;
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;

function* strings(value: unknown, path: string[] = []): Generator<[string, string]> {
  if (typeof value === "string") yield [path.join("."), value];
  else if (Array.isArray(value)) for (const [i, v] of value.entries()) yield* strings(v, [...path, String(i)]);
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) yield* strings(v, [...path, k]);
}

/** Errori di tono per campo, pronti per il messaggio di retry. */
export function findToneIssues(generated: unknown): string[] {
  const issues: string[] = [];
  for (const [path, text] of strings(generated)) {
    if (CONTRAST.test(text) || NEGATIVE_OPENING.test(text) || IMPLIED_COMPARISON.test(text)) {
      issues.push(
        `${path}: frase costruita per contrasto o confronto ("${text}"). Riscrivila dicendo solo ciò che l'offerta è, senza "non…", "niente…" o "vero".`,
      );
    }
    if (EMOJI.test(text)) issues.push(`${path}: contiene emoji ("${text}"). Toglile: niente emoji in nessun campo.`);
  }
  return issues;
}
