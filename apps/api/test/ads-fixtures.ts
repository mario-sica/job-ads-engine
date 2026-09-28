import { validContent } from "@job-ads-engine/content/testing";
import { createAdsRepository } from "../src/modules/ads/repository.js";
import type { NewAd, RevisionInput } from "../src/modules/ads/types.js";
import { createChannelFormatsRepository, type ChannelFormat } from "../src/modules/channel-formats/repository.js";
import { seededDb } from "./helpers.js";

/** DB seedato, repository degli annunci e costruttori di input validi. */
export function adsSetup() {
  const db = seededDb();
  const formats = createChannelFormatsRepository(db).list();
  const locationId = db.prepare("SELECT location_id FROM job_offers WHERE id = 'jo_001'").pluck().get() as number;

  const format = (channel: string, fmt: string, ratio: string | null = null): ChannelFormat => {
    const found = formats.find((f) => f.channel_code === channel && f.format === fmt && f.aspect_ratio === ratio);
    if (!found) throw new Error(`formato ${channel} ${fmt} ${ratio} assente dal seed`);
    return found;
  };

  const llmRevision = (f: ChannelFormat): RevisionInput => ({
    source: "llm",
    content: validContent(f),
    model: "modello-di-test",
    prompt_version: "test-1",
    input_snapshot: { angle: "crescita", published_location: "Orzinuovi (BS)" },
  });

  const manualRevision = (f: ChannelFormat): RevisionInput => ({ source: "manual", content: validContent(f) });

  const newAd = (f: ChannelFormat, overrides: Partial<NewAd> = {}): NewAd => ({
    job_offer_id: "jo_001",
    channel_format_id: f.id,
    location_id: locationId,
    location_precision: "locality",
    variants: [
      { label: "A", angle: "crescita", revision: llmRevision(f) },
      { label: "B", angle: "stabilità", revision: llmRevision(f) },
    ],
    ...overrides,
  });

  const count = (table: string) => db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get() as number;

  return { db, ads: createAdsRepository(db), format, llmRevision, manualRevision, newAd, count };
}
