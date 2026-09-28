import { useEffect, useState } from "react";
import { api, type Revision, type Variant } from "../api.js";
import { ErrorMessage } from "./ErrorMessage.js";

interface Props {
  variant: Variant;
  readOnly: boolean;
  onRestored: () => Promise<unknown>;
}

const when = (iso: string) => new Date(iso).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });

export function RevisionHistory({ variant, readOnly, onRestored }: Props) {
  const currentId = variant.current_revision.id;
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.revisions(variant.id).then(setRevisions).catch(setError);
  }, [variant.id, currentId]);

  async function restore(revisionId: number) {
    setBusy(true);
    setError(null);
    try {
      await api.restoreRevision(variant.id, revisionId);
      await onRestored();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted">
        Le revisioni non si modificano né si cancellano: il ripristino rende di nuovo corrente una revisione precedente.
      </p>
      <ul className="revisions">
        {revisions.map((r) => (
          <li key={r.id} className={r.id === currentId ? "current" : ""}>
            <div className="row">
              <strong>#{r.id}</strong>
              <span>{r.source === "llm" ? `generata (${r.model}, prompt ${r.prompt_version})` : "modifica manuale"}</span>
              <span className="muted">{when(r.created_at)}</span>
              {r.id === currentId ? (
                <span className="badge">corrente</span>
              ) : (
                !readOnly && (
                  <button disabled={busy} onClick={() => restore(r.id)}>
                    Ripristina
                  </button>
                )
              )}
              <button onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Nascondi" : "Contenuto"}</button>
            </div>
            {open === r.id && <pre>{JSON.stringify(r.content, null, 2)}</pre>}
          </li>
        ))}
      </ul>
      <ErrorMessage error={error} />
    </div>
  );
}
