import { useState } from "react";
import { api, LOCATION_PRECISIONS, type ChannelFormat, type JobOfferSummary, type LocationPrecision } from "../api.js";
import { EMPTY_LOCATION, LOCATION_FIELDS, MAX_VARIANTS, toCreateInput, type CreateAdDraft } from "../create-ad.js";
import { formatLabel, locationLabel } from "../labels.js";
import { ErrorMessage } from "./ErrorMessage.js";

interface Props {
  jobOffers: JobOfferSummary[];
  formats: ChannelFormat[];
  onCreated: (adId: number) => void;
  onCancel: () => void;
}

const PRECISION_LABELS: Record<LocationPrecision, string> = {
  address: "indirizzo completo",
  locality: "località",
  province: "solo provincia",
};

export function CreateAdForm({ jobOffers, formats, onCreated, onCancel }: Props) {
  const [draft, setDraft] = useState<CreateAdDraft>({
    jobOfferId: "",
    channelFormatId: null,
    customLocation: false,
    location: EMPTY_LOCATION,
    precision: "",
    angles: [""],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const input = toCreateInput(draft);
  const jobOffer = jobOffers.find((jo) => jo.id === draft.jobOfferId);
  const update = (patch: Partial<CreateAdDraft>) => setDraft({ ...draft, ...patch });
  const setAngle = (i: number, value: string) => update({ angles: draft.angles.map((a, j) => (j === i ? value : a)) });

  async function submit() {
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      onCreated((await api.createAd(input)).id);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel create">
      <h2>Nuovo annuncio</h2>
      <label className="field">
        Job offer
        <select value={draft.jobOfferId} onChange={(e) => update({ jobOfferId: e.target.value })}>
          <option value="">Scegli…</option>
          {jobOffers.map((jo) => (
            <option key={jo.id} value={jo.id}>
              {jo.id} · {jo.title} · {jo.company_name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Canale e formato
        <select
          value={draft.channelFormatId ?? ""}
          onChange={(e) => update({ channelFormatId: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Scegli…</option>
          {formats.map((f) => (
            <option key={f.id} value={f.id}>
              {formatLabel(f)}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend>Luogo pubblicato</legend>
        <label>
          <input type="radio" checked={!draft.customLocation} onChange={() => update({ customLocation: false })} /> quello della
          job offer{jobOffer && ` (${locationLabel(jobOffer.location)})`}
        </label>
        <label>
          <input type="radio" checked={draft.customLocation} onChange={() => update({ customLocation: true })} /> un altro luogo
        </label>
        {draft.customLocation && (
          <div className="location-grid">
            {LOCATION_FIELDS.map(([key, label]) => (
              <label key={key} className="field">
                {label}
                <input
                  value={draft.location[key]}
                  onChange={(e) => update({ location: { ...draft.location, [key]: e.target.value } })}
                />
              </label>
            ))}
          </div>
        )}
        <label className="field">
          Precisione mostrata
          <select value={draft.precision} onChange={(e) => update({ precision: e.target.value as CreateAdDraft["precision"] })}>
            <option value="">predefinita (indirizzo per Indeed, località per gli altri)</option>
            {LOCATION_PRECISIONS.map((p) => (
              <option key={p} value={p}>
                {PRECISION_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset>
        <legend>Varianti (una per angle)</legend>
        <p className="muted">L'angle orienta il copy della variante, per esempio "stabilità del contratto". Vuoto: nessun angle.</p>
        {draft.angles.map((angle, i) => (
          <div key={i} className="row">
            <span>{String.fromCharCode(65 + i)}</span>
            <input value={angle} maxLength={200} size={50} onChange={(e) => setAngle(i, e.target.value)} />
            {draft.angles.length > 1 && (
              <button onClick={() => update({ angles: draft.angles.filter((_, j) => j !== i) })}>Rimuovi</button>
            )}
          </div>
        ))}
        {draft.angles.length < MAX_VARIANTS && <button onClick={() => update({ angles: [...draft.angles, ""] })}>+ Variante</button>}
      </fieldset>

      <div className="row">
        <button className="primary" disabled={!input || busy} onClick={submit}>
          {busy ? "Generazione in corso…" : "Genera annuncio"}
        </button>
        <button disabled={busy} onClick={onCancel}>
          Annulla
        </button>
        {busy && <span className="muted">La generazione può richiedere qualche decina di secondi.</span>}
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}
