import type { z } from "zod";
import { issuesOf, type Issue } from "../errors.js";

/** Parametri, query o body della richiesta non validi (400). */
export class InvalidInputError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    super("richiesta non valida");
    this.name = "InvalidInputError";
    this.issues = issues;
  }
}

/** Valida l'input HTTP con Zod: in caso di errore, 400 con l'elenco dei campi. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) throw new InvalidInputError(issuesOf(result.error));
  return result.data;
}
