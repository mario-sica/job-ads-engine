import type { Ad, AdStatus, ChannelFormat, LocationInput } from "./api.js";

export const STATUS_LABELS: Record<AdStatus, string> = {
  draft: "bozza",
  active: "attivo",
  closed: "chiuso",
  archived: "archiviato",
};

const FORMAT_LABELS = { text: "testo", image: "immagine", image_text: "immagine + testo" } as const;

export function formatLabel(f: Pick<ChannelFormat, "format" | "aspect_ratio"> & { channel_name?: string; channel_code?: string }): string {
  const channel = f.channel_name ?? f.channel_code ?? "";
  return [channel, FORMAT_LABELS[f.format], f.aspect_ratio].filter(Boolean).join(" · ");
}

export function locationLabel(l: LocationInput): string {
  const place = l.locality ?? l.province ?? l.region ?? "";
  return l.province_code && l.locality ? `${place} (${l.province_code})` : place;
}

export const adTitle = (ad: Ad, formats: ChannelFormat[]): string => {
  const format = formats.find((f) => f.id === ad.channel_format_id);
  return `#${ad.id} · ${format ? formatLabel(format) : formatLabel(ad)}`;
};
