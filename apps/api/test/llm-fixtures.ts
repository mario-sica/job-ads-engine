import { createChannelFormatsRepository, type ChannelFormat } from "../src/modules/channel-formats/repository.js";
import { createJobOffersRepository } from "../src/modules/job-offers/repository.js";
import { seededDb } from "./helpers.js";

/** Job offer e formati seedati, letti come li leggerà il service. */
export function llmSetup() {
  const db = seededDb();
  const jobOffer = createJobOffersRepository(db).get("jo_001");
  const formats = createChannelFormatsRepository(db).list();
  const format = (channel: string, fmt: string, ratio: string | null = null): ChannelFormat => {
    const found = formats.find((f) => f.channel_code === channel && f.format === fmt && f.aspect_ratio === ratio);
    if (!found) throw new Error(`formato ${channel} ${fmt} ${ratio} assente dal seed`);
    return found;
  };
  return { jobOffer, formats, format, location: jobOffer.location };
}

/**
 * Le fixture di `@job-ads-engine/content` hanno un'emoji nel messaggio WhatsApp
 * ("☀️"): come output LLM finto non passerebbero il guardrail di tono.
 */
export function withoutEmoji<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(/\s*[\p{Extended_Pictographic}\uFE0F]/gu, "")) as T;
}
