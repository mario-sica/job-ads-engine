import type { Caption, ChatMessage, Facts, JobDescription } from "@job-ads-engine/content";
import { formatExperience, formatSalary, formatSalaryAmount } from "./format.js";

export interface RenderContext {
  facts: Facts;
  /** Luogo dell'annuncio, già formattato secondo la precisione. */
  location: string;
}

export interface RenderedText {
  /** Campi strutturati del canale (es. i campi di Indeed), se previsti. */
  fields?: Record<string, string>;
  body: string;
}

export interface Section {
  title: string;
  bullets: string[];
}

const present = <T>(value: T | null | undefined | ""): value is T => value !== null && value !== undefined && value !== "";

/** Struttura della JobDescription, condivisa da Indeed e dal foglio A4 WhatsApp. */
export function jobDescriptionSections(description: JobDescription, facts: Facts): Section[] {
  return [
    { title: description.headline, bullets: description.company },
    { title: description.role.title, bullets: description.role.bullets },
    // La riga RAL viene dai facts e apre la sezione offerta: l'LLM non la scrive.
    { title: "Quello che ti offrirà l'azienda:", bullets: [facts.salary && formatSalary(facts.salary), ...description.offer].filter(present) },
    { title: "Il tuo profilo:", bullets: description.profile },
  ];
}

const bulletList = (bullets: string[], marker: string) => bullets.map((b) => `${marker} ${b}`).join("\n");

const blocks = (...parts: (string | null | undefined)[]) => parts.filter(present).join("\n\n");

export function renderJobBoardText(description: JobDescription, { facts, location }: RenderContext): RenderedText {
  const fields = Object.fromEntries(
    Object.entries({
      Titolo: description.role.title,
      Azienda: facts.company_name,
      Luogo: location,
      RAL: facts.salary && formatSalaryAmount(facts.salary),
      Contratto: facts.contract_type,
      Esperienza: formatExperience(facts.experience),
      Competenze: facts.skills.join(", "),
    }).filter((entry): entry is [string, string] => present(entry[1])),
  );
  const body = blocks(
    ...jobDescriptionSections(description, facts).map((s) => `${s.title}\n${bulletList(s.bullets, "•")}`),
  );
  return { fields, body };
}

export function renderChatMessageText(message: ChatMessage, { facts, location }: RenderContext): RenderedText {
  const factsLine = [location && `📍 ${location}`, facts.salary && formatSalary(facts.salary), facts.contract_type]
    .filter(present)
    .join(" · ");
  return {
    body: blocks(`*${message.opening}*`, bulletList(message.bullets, "•"), factsLine, message.cta),
  };
}

export function renderCaptionText(caption: Caption): RenderedText {
  return { body: blocks(caption.primary, caption.cta, caption.hashtags.join(" ")) };
}
