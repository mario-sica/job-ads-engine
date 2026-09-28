import type Anthropic from "@anthropic-ai/sdk";
import type { LlmClient } from "../llm/client.js";
import type { InputSnapshot } from "../llm/snapshot.js";

export interface SampleAd {
  channel: string;
  format: "text" | "image" | "image_text";
  aspectRatio: string | null;
  /** Due angle diversi per annuncio, tutti sostenuti da dati presenti in jo_001. */
  angles: [string, string];
}

export const SAMPLE_JOB_OFFER = "jo_001";

/** Un annuncio per kind, e insieme tutti e tre i formati. */
export const SAMPLES: SampleAd[] = [
  {
    channel: "indeed",
    format: "text",
    aspectRatio: null,
    angles: ["crescita professionale in una multinazionale", "stabilità: tempo indeterminato e condizioni economiche"],
  },
  {
    channel: "whatsapp",
    format: "image_text",
    aspectRatio: "A4",
    angles: ["proposta diretta a un tecnico FV esperto", "trasferte gestite: indennità, ticket, ore di viaggio pagate"],
  },
  {
    channel: "instagram",
    format: "image",
    aspectRatio: "4:5",
    angles: ["il mestiere sul campo: grandi impianti fotovoltaici", "entrare in una multinazionale delle rinnovabili"],
  },
  {
    channel: "tiktok",
    format: "image_text",
    aspectRatio: "9:16",
    angles: ["lavoro sul campo, non in ufficio", "un gruppo presente in 20 Paesi"],
  },
];

/** Chi chiama il modello, letto dal blocco dati del prompt: le varianti girano in parallelo. */
function callerOf(messages: Anthropic.MessageParam[]): string {
  const user = messages[0]?.content;
  if (typeof user !== "string") return "?";
  const json = user.slice(user.indexOf("<job_offer>") + "<job_offer>".length, user.lastIndexOf("</job_offer>"));
  const { channel, angle } = JSON.parse(json) as InputSnapshot;
  return `${channel.name} ${channel.format}${channel.aspect_ratio ? ` ${channel.aspect_ratio}` : ""} · "${angle ?? "—"}"`;
}

/** Gli errori mandati al modello in un retry, se la richiesta è un retry. */
function retryErrors(messages: Anthropic.MessageParam[]): string | null {
  const last = messages.at(-1);
  if (messages.length < 2 || !last || typeof last.content === "string") return null;
  const result = last.content.find((b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result" && b.is_error === true);
  return typeof result?.content === "string" ? result.content : null;
}

/**
 * Registro dei tentativi attorno al client reale: latenza, stop_reason e, nei
 * retry, gli errori che hanno causato il nuovo tentativo. Serve al log delle
 * iterazioni in prompts.md; il codice di produzione non cambia.
 */
export function withAttemptLog(client: LlmClient, log: (line: string) => void): LlmClient {
  return {
    async complete(request) {
      const who = callerOf(request.messages);
      const errors = retryErrors(request.messages);
      if (errors) log(`↻ retry ${who}\n${errors.replace(/^/gm, "    ")}`);
      const start = Date.now();
      const response = await client.complete(request);
      log(`✓ ${who}: ${Date.now() - start} ms, stop_reason=${response.stop_reason}`);
      return response;
    },
  };
}
