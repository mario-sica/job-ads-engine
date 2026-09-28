import { useEffect, useState } from "react";
import { api, type Ad, type AdFilters, type ChannelFormat, type JobOfferSummary } from "./api.js";
import { AdDetail } from "./components/AdDetail.js";
import { AdList } from "./components/AdList.js";
import { CreateAdForm } from "./components/CreateAdForm.js";
import { ErrorMessage } from "./components/ErrorMessage.js";

export function App() {
  const [jobOffers, setJobOffers] = useState<JobOfferSummary[]>([]);
  const [formats, setFormats] = useState<ChannelFormat[]>([]);
  const [filters, setFilters] = useState<AdFilters>({});
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [listVersion, setListVersion] = useState(0);

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
  }, [filters, listVersion]);

  return (
    <div className="layout">
      <header>
        <h1>Gyver · Annunci</h1>
        <button className="primary" onClick={() => setCreating(true)}>
          + Nuovo annuncio
        </button>
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
          onSelect={(id) => {
            setCreating(false);
            setSelectedId(id);
          }}
        />
      </aside>
      <main>
        {creating ? (
          <CreateAdForm
            jobOffers={jobOffers}
            formats={formats}
            onCancel={() => setCreating(false)}
            onCreated={(id) => {
              setCreating(false);
              setSelectedId(id);
              setListVersion((v) => v + 1);
            }}
          />
        ) : selectedId === null ? (
          <p className="muted">Seleziona un annuncio dall'elenco.</p>
        ) : (
          <AdDetail key={selectedId} adId={selectedId} formats={formats} onChanged={() => setListVersion((v) => v + 1)} />
        )}
      </main>
    </div>
  );
}
