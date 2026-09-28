import { useEffect, useState } from "react";
import { api, NEXT_STATUSES, type AdStatus, type AdWithVariants, type ChannelFormat } from "../api.js";
import { formatLabel, locationLabel, STATUS_LABELS } from "../labels.js";
import { ContentEditor } from "./ContentEditor.js";
import { ErrorMessage } from "./ErrorMessage.js";
import { Preview } from "./Preview.js";

interface Props {
  adId: number;
  formats: ChannelFormat[];
  /** Avvisa l'elenco che qualcosa è cambiato. */
  onChanged: () => void;
}

const PRECISION_LABELS = { address: "indirizzo", locality: "località", province: "provincia" } as const;

export function AdDetail({ adId, formats, onChanged }: Props) {
  const [ad, setAd] = useState<AdWithVariants | null>(null);
  const [variantId, setVariantId] = useState<number | null>(null);
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = (selectVariant?: number) =>
    api.ad(adId).then((loaded) => {
      setAd(loaded);
      setVariantId((current) => selectVariant ?? (loaded.variants.some((v) => v.id === current) ? current : loaded.variants[0]?.id ?? null));
    });

  useEffect(() => {
    setAd(null);
    setError(null);
    load().catch(setError);
  }, [adId]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  if (!ad) return error ? <ErrorMessage error={error} /> : <p className="muted">Caricamento…</p>;

  const format = formats.find((f) => f.id === ad.channel_format_id);
  const variant = ad.variants.find((v) => v.id === variantId) ?? null;
  const readOnly = ad.status === "archived";

  const changeStatus = (status: AdStatus) => run("status", async () => setAd(await api.setStatus(ad.id, status)));
  const toggleActive = (id: number, active: boolean) => run("active", async () => {
    await api.setVariantActive(id, active);
    await load();
  });
  const addVariant = () => run("variant", async () => {
    const created = await api.addVariant(ad.id, angle.trim() || null);
    setAngle("");
    await load(created.id);
  });

  return (
    <div>
      <div className="panel">
        <h2>
          #{ad.id} · {format ? formatLabel(format) : formatLabel(ad)}
        </h2>
        <p className="muted">
          {ad.job_offer_id} · {locationLabel(ad.location)} (precisione: {PRECISION_LABELS[ad.location_precision]})
        </p>
        <div className="row">
          Stato: <span className={`status ${ad.status}`}>{STATUS_LABELS[ad.status]}</span>
          {NEXT_STATUSES[ad.status].map((next) => (
            <button key={next} disabled={busy !== null} onClick={() => changeStatus(next)}>
              → {STATUS_LABELS[next]}
            </button>
          ))}
          {readOnly && <span className="muted">annuncio archiviato: sola lettura</span>}
        </div>
        <ErrorMessage error={error} />
      </div>

      <div className="panel">
        <div className="row tabs">
          {ad.variants.map((v) => (
            <button key={v.id} className={v.id === variantId ? "selected" : ""} onClick={() => setVariantId(v.id)}>
              Variante {v.label}
              {!v.is_active && " (disattiva)"}
            </button>
          ))}
        </div>
        {!readOnly && (
          <div className="row">
            <input
              placeholder="Angle della nuova variante (facoltativo)"
              value={angle}
              maxLength={200}
              onChange={(e) => setAngle(e.target.value)}
              size={40}
            />
            <button disabled={busy !== null} onClick={addVariant}>
              {busy === "variant" ? "Generazione in corso…" : "+ Genera variante"}
            </button>
          </div>
        )}
      </div>

      {variant && format && (
        <div className="panel">
          <div className="row">
            <strong>Variante {variant.label}</strong>
            <span className="muted">angle: {variant.angle ?? "nessuno"}</span>
            <label>
              <input
                type="checkbox"
                checked={variant.is_active}
                disabled={readOnly || busy !== null}
                onChange={(e) => toggleActive(variant.id, e.target.checked)}
              />{" "}
              attiva
            </label>
          </div>
          <h3>Anteprima</h3>
          <Preview variant={variant} format={format} />
          <h3>Modifica del contenuto</h3>
          {/* La key riparte dalla revisione corrente dopo ogni salvataggio o ripristino. */}
          <ContentEditor
            key={variant.current_revision.id}
            variant={variant}
            format={format}
            readOnly={readOnly}
            onSaved={() => load().then(onChanged)}
          />
        </div>
      )}
    </div>
  );
}
