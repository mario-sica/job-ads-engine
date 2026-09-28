import { contentSchemaFor, type ContentTarget } from "@job-ads-engine/content";
import { z } from "zod";

/*
 * Il modulo di edit nasce dallo schema del formato, lo stesso usato dal server:
 * nessun codice per kind. Le stringhe diventano caselle, le liste di stringhe
 * un'area con un elemento per riga. I `facts` restano quelli della revisione
 * corrente: sono dati della job offer, non copy.
 */

export interface Field {
  /** Percorso nel contenuto, es. `text.role.title`. */
  key: string;
  path: string[];
  type: "line" | "list";
  /** Caratteri massimi: della riga, o di ogni elemento per le liste. */
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export type FormValues = Record<string, string>;

/** Errori per campo; la chiave "" raccoglie quelli che non appartengono a un campo. */
export type FormErrors = Record<string, string[]>;

interface JsonSchemaNode {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

const EDITABLE_PARTS = ["text", "image"] as const;

export function editableFields(target: ContentTarget): Field[] {
  const root = z.toJSONSchema(contentSchemaFor(target), { io: "input" }) as JsonSchemaNode;
  const fields: Field[] = [];

  const walk = (node: JsonSchemaNode, path: string[]) => {
    if (node.type === "object") {
      for (const [name, child] of Object.entries(node.properties ?? {})) walk(child, [...path, name]);
    } else if (node.type === "string") {
      fields.push({ key: path.join("."), path, type: "line", maxLength: node.maxLength });
    } else if (node.type === "array" && node.items?.type === "string") {
      fields.push({
        key: path.join("."),
        path,
        type: "list",
        maxLength: node.items.maxLength,
        minItems: node.minItems,
        maxItems: node.maxItems,
      });
    }
  };

  for (const part of EDITABLE_PARTS) {
    const node = root.properties?.[part];
    if (node) walk(node, [part]);
  }
  return fields;
}

const getAt = (value: unknown, path: string[]): unknown =>
  path.reduce<unknown>((v, k) => (typeof v === "object" && v !== null ? (v as Record<string, unknown>)[k] : undefined), value);

function setAt(target: Record<string, unknown>, path: string[], value: unknown): void {
  let node = target;
  for (const k of path.slice(0, -1)) {
    const next = node[k];
    if (typeof next !== "object" || next === null) node[k] = {};
    node = node[k] as Record<string, unknown>;
  }
  node[path[path.length - 1]!] = value;
}

export function toValues(fields: Field[], content: unknown): FormValues {
  return Object.fromEntries(
    fields.map((f) => {
      const v = getAt(content, f.path);
      if (f.type === "list") return [f.key, Array.isArray(v) ? v.map(String).join("\n") : ""];
      return [f.key, typeof v === "string" ? v : ""];
    }),
  );
}

export const splitLines = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

/** Il contenuto completo da inviare: quello di partenza con i campi del modulo sostituiti. */
export function fromValues(fields: Field[], values: FormValues, base: Record<string, unknown>): Record<string, unknown> {
  const content = structuredClone(base);
  for (const f of fields) {
    const raw = values[f.key] ?? "";
    setAt(content, f.path, f.type === "list" ? splitLines(raw) : raw);
  }
  return content;
}

export function validate(target: ContentTarget, fields: Field[], content: unknown): FormErrors {
  const result = contentSchemaFor(target).safeParse(content);
  if (result.success) return {};
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.map(String);
    // Il campo più specifico che contiene il percorso dell'errore.
    const field = fields
      .filter((f) => f.path.every((k, i) => path[i] === k))
      .sort((a, b) => b.path.length - a.path.length)[0];
    const key = field?.key ?? "";
    const rest = field ? path.slice(field.path.length) : path;
    const where = field?.type === "list" && rest[0] !== undefined ? `riga ${Number(rest[0]) + 1}: ` : field ? "" : `${path.join(".")}: `;
    (errors[key] ??= []).push(where + issue.message);
  }
  return errors;
}
