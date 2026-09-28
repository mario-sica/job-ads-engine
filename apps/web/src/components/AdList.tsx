import { AD_STATUSES, type Ad, type AdFilters, type ChannelFormat, type JobOfferSummary } from "../api.js";
import { adTitle, locationLabel, STATUS_LABELS } from "../labels.js";

interface Props {
  /** null finché la prima risposta non arriva. */
  ads: Ad[] | null;
  jobOffers: JobOfferSummary[];
  formats: ChannelFormat[];
  filters: AdFilters;
  onFilters: (filters: AdFilters) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function AdList({ ads, jobOffers, formats, filters, onFilters, selectedId, onSelect }: Props) {
  const channels = [...new Map(formats.map((f) => [f.channel_code, f.channel_name])).entries()];
  return (
    <section>
      <div className="filters">
        <select value={filters.job_offer_id ?? ""} onChange={(e) => onFilters({ ...filters, job_offer_id: e.target.value })}>
          <option value="">Tutte le job offer</option>
          {jobOffers.map((jo) => (
            <option key={jo.id} value={jo.id}>
              {jo.id} · {jo.title}
            </option>
          ))}
        </select>
        <select value={filters.channel ?? ""} onChange={(e) => onFilters({ ...filters, channel: e.target.value })}>
          <option value="">Tutti i canali</option>
          {channels.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={filters.status ?? ""}
          onChange={(e) => onFilters({ ...filters, status: e.target.value as AdFilters["status"] })}
        >
          <option value="">Tutti gli stati</option>
          {AD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {ads === null ? (
        <p className="muted">Caricamento…</p>
      ) : ads.length === 0 ? (
        <p className="muted">Nessun annuncio con questi filtri.</p>
      ) : (
        <ul className="ad-list">
          {ads.map((ad) => (
            <li key={ad.id}>
              <button className={ad.id === selectedId ? "selected" : ""} onClick={() => onSelect(ad.id)}>
                <strong>{adTitle(ad, formats)}</strong>
                <span className="muted">
                  {ad.job_offer_id} · {locationLabel(ad.location)} · <span className={`status ${ad.status}`}>{STATUS_LABELS[ad.status]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
