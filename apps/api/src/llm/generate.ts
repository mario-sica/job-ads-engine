import type Anthropic from "@anthropic-ai/sdk";
import {
  buildFacts,
  contentSchemaFor,
  findSalaryLeaks,
  llmOutputSchemaFor,
  type Salary,
  type SalaryFraming,
} from "@job-ads-engine/content";
import type { z } from "zod";
import type { Json, RevisionInput } from "../modules/ads/types.js";
import type { LlmClient, LlmResponse } from "./client.js";
import { GenerationFailedError } from "./errors.js";
import { findToneIssues } from "./guards.js";
import { buildPrompt, PROMPT_VERSION, TOOL_NAME } from "./prompts.js";
import { buildInputSnapshot, type SnapshotInput } from "./snapshot.js";

export type LlmRevision = Extract<RevisionInput, { source: "llm" }>;

type LlmOutput = { salary_framing: SalaryFraming | null } & Json;

type Check = { ok: true; output: LlmOutput } | { ok: false; errors: string[]; toolUseId: string | null };

const MAX_ATTEMPTS = 2;

const issuesOf = (error: z.ZodError) => error.issues.map((i) => `${i.path.join(".") || "(radice)"}: ${i.message}`);

const valueAt = (input: unknown, path: PropertyKey[]): unknown =>
  path.reduce<unknown>((node, key) => (node !== null && typeof node === "object" ? (node as Record<PropertyKey, unknown>)[key] : undefined), input);

/**
 * Errori per il retry. Per un testo troppo lungo il modello riceve lunghezza e
 * testo: "max 30" da solo non gli dice di quanto ha sforato né cosa accorciare.
 */
function retryIssuesOf(error: z.ZodError, input: unknown): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(radice)";
    const value = valueAt(input, issue.path);
    if (issue.code === "too_big" && issue.origin === "string" && typeof value === "string") {
      return `${path}: ${value.length} caratteri, massimo ${String(issue.maximum)}. Accorcia: "${value}"`;
    }
    return `${path}: ${issue.message}`;
  });
}

function toolUseOf(response: LlmResponse): Anthropic.ToolUseBlock | undefined {
  return response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME);
}

/** Schema dell'output, guardrail RAL e di tono. Un output troncato o senza strumento è non conforme. */
function check(response: LlmResponse, schema: z.ZodType, salary: Salary | null): Check {
  const toolUse = toolUseOf(response);
  if (!toolUse) return { ok: false, errors: [`nessuna chiamata allo strumento ${TOOL_NAME}`], toolUseId: null };

  const errors: string[] = [];
  if (response.stop_reason === "max_tokens") errors.push("risposta troncata: output incompleto");
  const parsed = schema.safeParse(toolUse.input);
  if (!parsed.success) errors.push(...retryIssuesOf(parsed.error, toolUse.input));
  for (const path of findSalaryLeaks(toolUse.input, salary)) {
    errors.push(`${path}: contiene una cifra della RAL, che non va scritta nel testo`);
  }
  errors.push(...findToneIssues(toolUse.input));
  return errors.length === 0 && parsed.success
    ? { ok: true, output: parsed.data as LlmOutput }
    : { ok: false, errors, toolUseId: toolUse.id };
}

/** Il turno di correzione: l'output precedente e gli errori, come risultato dello strumento. */
function retryTurn(response: LlmResponse, errors: string[], toolUseId: string | null): Anthropic.MessageParam[] {
  // Senza una chiamata a cui rispondere si ripete la richiesta così com'è.
  if (toolUseId === null) return [];
  return [
    { role: "assistant", content: response.content },
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          is_error: true,
          content: `L'annuncio non rispetta i vincoli. Correggi questi errori e reinvia l'annuncio completo:\n${errors
            .map((e) => `- ${e}`)
            .join("\n")}`,
        },
      ],
    },
  ];
}

/**
 * Genera il contenuto di una variante: prompt, chiamata, validazione, un retry con
 * gli errori, composizione con i facts. Non salva nulla: restituisce la revisione.
 */
export async function generateContent(input: SnapshotInput, client: LlmClient): Promise<LlmRevision> {
  const snapshot = buildInputSnapshot(input);
  const prompt = buildPrompt(input.target, snapshot);
  const schema = llmOutputSchemaFor(input.target);
  // Le cifre da cercare non dipendono dal framing.
  const salary = buildFacts(input.jobOffer, null).salary;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt.user }];
  let errors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await client.complete({ system: prompt.system, messages, tool: prompt.tool });
    // Un rifiuto non si corregge ripetendo la stessa richiesta.
    if (response.stop_reason === "refusal") throw new GenerationFailedError(["il modello ha rifiutato la richiesta"]);

    const result = check(response, schema, salary);
    if (result.ok) {
      const { salary_framing, ...parts } = result.output;
      const content = contentSchemaFor(input.target).safeParse({ facts: buildFacts(input.jobOffer, salary_framing), ...parts });
      if (!content.success) throw new GenerationFailedError(issuesOf(content.error));
      return {
        source: "llm",
        content: content.data as Json,
        model: response.model,
        prompt_version: PROMPT_VERSION,
        input_snapshot: snapshot,
      };
    }
    errors = result.errors;
    if (attempt < MAX_ATTEMPTS) messages.push(...retryTurn(response, errors, result.toolUseId));
  }
  throw new GenerationFailedError(errors);
}
