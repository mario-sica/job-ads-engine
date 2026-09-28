import type Anthropic from "@anthropic-ai/sdk";
import type { LlmClient } from "../llm/client.js";
import type { InputSnapshot } from "../llm/snapshot.js";

export interface SampleAd {
  jobOffer: string;
  channel: string;
  format: "text" | "image" | "image_text";
  aspectRatio: string | null;
  /** Due angle diversi per annuncio, fattuali (niente contrapposizioni) e sostenuti dai dati della job offer. */
  angles: [string, string];
}

/**
 * jo_001 (la job offer della traccia) su un annuncio per kind e tutti i formati;
 * le job offer fittizie ciascuna su un formato diverso, per provare casi che
 * jo_001 non ha: RAL solo minima o assente, apprendistato, dati scarni, injection.
 */
export const SAMPLES: SampleAd[] = [
  {
    jobOffer: "jo_001",
    channel: "indeed",
    format: "text",
    aspectRatio: null,
    angles: ["crescita professionale in una multinazionale", "stabilità: tempo indeterminato e condizioni economiche"],
  },
  {
    jobOffer: "jo_001",
    channel: "whatsapp",
    format: "image_text",
    aspectRatio: "A4",
    angles: ["proposta diretta a un tecnico FV esperto", "trasferte: indennità, ticket e ore di viaggio pagate"],
  },
  {
    jobOffer: "jo_001",
    channel: "instagram",
    format: "image",
    aspectRatio: "4:5",
    angles: ["il mestiere sul campo: grandi impianti fotovoltaici", "entrare in una multinazionale delle rinnovabili"],
  },
  {
    jobOffer: "jo_001",
    channel: "tiktok",
    format: "image_text",
    aspectRatio: "9:16",
    angles: ["lavoro in campo: cantieri, sopralluoghi e collaudi", "un gruppo presente in 20 Paesi"],
  },
  {
    jobOffer: "jo_101",
    channel: "whatsapp",
    format: "text",
    aspectRatio: null,
    angles: ["retribuzione di partenza e furgone attrezzato", "cantieri in provincia di Bergamo con rientro ogni giorno"],
  },
  {
    jobOffer: "jo_102",
    channel: "indeed",
    format: "text",
    aspectRatio: null,
    angles: ["competenze su PLC e manutenzione predittiva", "stabilità in un grande stabilimento produttivo"],
  },
  {
    jobOffer: "jo_103",
    channel: "instagram",
    format: "image_text",
    aspectRatio: "1:1",
    angles: ["imparare il mestiere in apprendistato", "climatizzazione e pompe di calore"],
  },
  {
    jobOffer: "jo_104",
    channel: "whatsapp",
    format: "image",
    aspectRatio: "A4",
    angles: ["furgone aziendale e corsi di aggiornamento", "impianti civili e domotica KNX"],
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
