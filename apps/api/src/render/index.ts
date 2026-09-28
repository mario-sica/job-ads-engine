import {
  contentSchemaFor,
  UnsupportedFormatError,
  type Caption,
  type ChatMessage,
  type ContentTarget,
  type Creative,
  type Facts,
  type JobDescription,
  type JobSheet,
} from "@job-ads-engine/content";
import type { LocationPrecision } from "../modules/ads/types.js";
import type { LocationInput } from "../modules/locations/repository.js";
import { formatLocation } from "./format.js";
import { renderCreativeHtml } from "./html/creative.js";
import { renderJobSheetHtml } from "./html/job-sheet.js";
import { fillSalaryPlaceholder } from "./salary-placeholder.js";
import {
  renderCaptionText,
  renderChatMessageText,
  renderJobBoardText,
  type RenderContext,
  type RenderedText,
} from "./text.js";

export type { RenderedText } from "./text.js";

export interface PreviewInput {
  target: ContentTarget;
  content: unknown;
  /** Luogo dell'annuncio: non sta nel contenuto, si rende da qui. */
  location: LocationInput;
  precision: LocationPrecision;
  jobTitle: string;
}

export interface Preview {
  text: RenderedText | null;
  html: string | null;
}

interface ValidatedContent {
  facts: Facts;
  text?: unknown;
  image?: unknown;
}

export function renderPreview({ target, content, location, precision, jobTitle }: PreviewInput): Preview {
  // Il contenuto salvato è già valido; rileggerlo con lo schema dà tipi certi al renderer.
  const parsed = contentSchemaFor(target).parse(content) as ValidatedContent;
  const ctx: RenderContext = { facts: parsed.facts, location: formatLocation(location, precision), jobTitle };
  // Prima si riempie {RAL}, poi si rende: anche l'adattamento del font misura il testo finale.
  const text = fillSalaryPlaceholder(parsed.text, parsed.facts.salary);
  const image = fillSalaryPlaceholder(parsed.image, parsed.facts.salary);
  return {
    text: text === undefined ? null : renderText(target, text, ctx),
    html: image === undefined ? null : renderImage(target, image, ctx),
  };
}

function renderText({ kind }: ContentTarget, part: unknown, ctx: RenderContext): RenderedText {
  switch (kind) {
    case "job_board":
      return renderJobBoardText(part as JobDescription, ctx);
    case "messaging":
      return renderChatMessageText(part as ChatMessage, ctx);
    case "social":
      return renderCaptionText(part as Caption);
  }
}

function renderImage({ kind, specs }: ContentTarget, part: unknown, ctx: RenderContext): string {
  switch (kind) {
    case "messaging":
      return renderJobSheetHtml(part as JobSheet, ctx, specs);
    case "social":
      return renderCreativeHtml(part as Creative, ctx.facts, specs);
    case "job_board":
      throw new UnsupportedFormatError(kind, "image");
  }
}
