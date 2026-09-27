import { z } from "zod";
import { charLimit, line, list, rangeSchema } from "./primitives.js";

/*
 * Ogni blocco ha tre elementi:
 * - uno schema dei limiti (validato quando si leggono le `specs` dal DB)
 * - i limiti di default: scelte editoriali, sovrascrivibili per riga in `channel_formats.specs`
 * - una factory che, dati i limiti, costruisce lo schema Zod del blocco
 *
 * I blocchi contengono SOLO testo generato. I dati deterministici (RAL, contratto,
 * esperienza, skill) stanno in `facts`; il luogo sta sull'annuncio.
 */

// ─── JobDescription: Indeed e corpo del foglio WhatsApp ─────────────────────

export const jobDescriptionLimits = z.object({
  headline_max: charLimit,
  role_title_max: charLimit,
  bullet_max: charLimit,
  company_bullets: rangeSchema,
  role_bullets: rangeSchema,
  offer_bullets: rangeSchema, // la riga RAL la aggiunge il renderer da `facts`
  profile_bullets: rangeSchema,
});
export type JobDescriptionLimits = z.infer<typeof jobDescriptionLimits>;

export const JOB_DESCRIPTION_DEFAULTS: JobDescriptionLimits = {
  headline_max: 90,
  role_title_max: 60,
  bullet_max: 160,
  company_bullets: [2, 3],
  role_bullets: [2, 4],
  offer_bullets: [1, 3],
  profile_bullets: [2, 4],
};

export const jobDescription = (l: JobDescriptionLimits) =>
  z.object({
    headline: line(l.headline_max),
    company: list(line(l.bullet_max), l.company_bullets),
    role: z.object({
      title: line(l.role_title_max),
      bullets: list(line(l.bullet_max), l.role_bullets),
    }),
    offer: list(line(l.bullet_max), l.offer_bullets),
    profile: list(line(l.bullet_max), l.profile_bullets),
  });
export type JobDescription = z.infer<ReturnType<typeof jobDescription>>;

// ─── ChatMessage: testo WhatsApp ────────────────────────────────────────────

export const chatMessageLimits = z.object({
  opening_max: charLimit,
  bullet_max: charLimit,
  bullets: rangeSchema,
  cta_max: charLimit,
});
export type ChatMessageLimits = z.infer<typeof chatMessageLimits>;

export const CHAT_MESSAGE_DEFAULTS: ChatMessageLimits = {
  opening_max: 200,
  bullet_max: 120,
  bullets: [0, 6],
  cta_max: 120,
};

export const chatMessage = (l: ChatMessageLimits) =>
  z.object({
    opening: line(l.opening_max),
    bullets: list(line(l.bullet_max), l.bullets),
    cta: line(l.cta_max),
  });
export type ChatMessage = z.infer<ReturnType<typeof chatMessage>>;

// ─── JobSheet: immagine A4 WhatsApp ─────────────────────────────────────────

export const jobSheetLimits = z.object({
  title_max: charLimit,
  subtitle_max: charLimit,
  tag_max: charLimit,
  tags: rangeSchema, // chip testuali; RAL, contratto e luogo li compone il renderer
  description: jobDescriptionLimits,
});
export type JobSheetLimits = z.infer<typeof jobSheetLimits>;

export const JOB_SHEET_DEFAULTS: JobSheetLimits = {
  title_max: 40,
  subtitle_max: 60,
  tag_max: 40,
  tags: [1, 2],
  description: JOB_DESCRIPTION_DEFAULTS,
};

export const jobSheet = (l: JobSheetLimits) =>
  z.object({
    title: line(l.title_max),
    subtitle: line(l.subtitle_max),
    tags: list(line(l.tag_max), l.tags),
    description: jobDescription(l.description),
  });
export type JobSheet = z.infer<ReturnType<typeof jobSheet>>;

// ─── Caption: testo del post social ─────────────────────────────────────────

export const captionLimits = z.object({
  primary_max: charLimit,
  cta_max: charLimit,
  hashtags: rangeSchema,
});
export type CaptionLimits = z.infer<typeof captionLimits>;

export const CAPTION_DEFAULTS: CaptionLimits = {
  primary_max: 600,
  cta_max: 80,
  hashtags: [0, 5],
};

const hashtag = z.string().regex(/^#[\p{L}\p{N}_]{1,40}$/u, "hashtag non valido");

export const caption = (l: CaptionLimits) =>
  z.object({
    primary: line(l.primary_max),
    cta: line(l.cta_max),
    hashtags: list(hashtag, l.hashtags),
  });
export type Caption = z.infer<ReturnType<typeof caption>>;

// ─── Creative: immagine social ──────────────────────────────────────────────

export const creativeLimits = z.object({
  title_max: charLimit,
  hook_max: charLimit,
  subline_max: charLimit,
  visual_brief_max: charLimit,
});
export type CreativeLimits = z.infer<typeof creativeLimits>;

export const CREATIVE_DEFAULTS: CreativeLimits = {
  title_max: 30,
  hook_max: 30,
  subline_max: 30,
  visual_brief_max: 200,
};

export const creative = (l: CreativeLimits) =>
  z.object({
    title: z
      .object({
        text: line(l.title_max),
        highlight: z.string().trim().min(1), // porzione del titolo da evidenziare
      })
      .refine((t) => t.text.includes(t.highlight), {
        message: "highlight deve essere contenuto nel titolo",
        path: ["highlight"],
      }),
    hook: line(l.hook_max),
    subline: line(l.subline_max),
    visual_brief: line(l.visual_brief_max), // descrive la foto; la foto non si genera
  });
export type Creative = z.infer<ReturnType<typeof creative>>;
