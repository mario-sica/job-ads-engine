import { useEffect, useState } from "react";
import { api, type Ad, type AdFilters, type ChannelFormat, type JobOfferSummary } from "./api.js";
import { AdList } from "./components/AdList.js";
import { ErrorMessage } from "./components/ErrorMessage.js";

export function App() {
  const [jobOffers, setJobOffers] = useState<JobOfferSummary[]>([]);
  const [formats, setFormats] = useState<ChannelFormat[]>([]);
  const [filters, setFilters] = useState<AdFilters>({});
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    Promise.all([api.jobOffers(), api.channelFormats()])
      .then(([offers, fmts]) => {
        setJobOffers(offers);
        setFormats(fmts);
      })
      .catch(setError);
  }, []);

  useEffect(() => {
    api.ads(filters).then(setAds).catch(setError);
  }, [filters]);

  return (
    <div className="layout">
      <header>
        <h1>Gyver · Annunci</h1>
      </header>
      <aside>
        <ErrorMessage error={error} />
        <AdList
          ads={ads}
          jobOffers={jobOffers}
          formats={formats}
          filters={filters}
          onFilters={setFilters}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </aside>
      <main>{selectedId === null && <p className="muted">Seleziona un annuncio dall'elenco.</p>}</main>
    </div>
  );
}
