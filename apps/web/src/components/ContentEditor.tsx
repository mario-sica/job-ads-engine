import { useMemo, useState } from "react";
import { api, ApiError, type ChannelFormat, type Variant } from "../api.js";
import { editableFields, fromValues, splitLines, toValues, validate, type Field, type FormValues } from "../content-form.js";
import { ErrorMessage } from "./ErrorMessage.js";

interface Props {
  variant: Variant;
  format: ChannelFormat;
  readOnly: boolean;
  onSaved: () => Promise<unknown>;
}

function counter(field: Field, value: string): string | null {
  if (field.type === "line") return field.maxLength ? `${value.trim().length}/${field.maxLength}` : null;
  const items = splitLines(value);
  const range = field.maxItems !== undefined ? ` (${field.minItems ?? 0}–${field.maxItems})` : "";
  const longest = field.maxLength ? ` · riga più lunga ${Math.max(0, ...items.map((i) => i.length))}/${field.maxLength}` : "";
  return `${items.length} elementi${range}${longest}`;
}

/** 422 del server: stessi percorsi dello schema, mostrati come elenco. */
function serverIssues(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code !== "invalid_content" || !Array.isArray(error.details)) return null;
  return error.details.map((d: { path?: string; message?: string }) => `${d.path ?? ""}: ${d.message ?? ""}`).join("\n");
}

export function ContentEditor({ variant, format, readOnly, onSaved }: Props) {
  const base = variant.current_revision.content;
  const fields = useMemo(() => editableFields(format), [format]);
  const initial = useMemo(() => toValues(fields, base), [fields, base]);
  const [values, setValues] = useState<FormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const content = useMemo(() => fromValues(fields, values, base), [fields, values, base]);
  const errors = useMemo(() => validate(format, fields, content), [format, fields, content]);
  const changed = fields.some((f) => values[f.key] !== initial[f.key]);
  const valid = Object.keys(errors).length === 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.addRevision(variant.id, content);
      await onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor">
      <details>
        <summary className="muted">Dati della job offer (facts, non modificabili)</summary>
        <pre>{JSON.stringify(base.facts, null, 2)}</pre>
      </details>
      {fields.map((f) => {
        const value = values[f.key] ?? "";
        const fieldErrors = errors[f.key];
        const long = f.type === "list" || (f.maxLength ?? 0) > 80;
        return (
          <label key={f.key} className={fieldErrors ? "field invalid" : "field"}>
            <span className="field-head">
              <code>{f.key}</code>
              <span className="muted">
                {f.type === "list" && "una riga per elemento · "}
                {counter(f, value)}
              </span>
            </span>
            {long ? (
              <textarea
                rows={f.type === "list" ? Math.max(2, splitLines(value).length + 1) : 3}
                value={value}
                disabled={readOnly}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            ) : (
              <input value={value} disabled={readOnly} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
            )}
            {fieldErrors?.map((m) => (
              <span key={m} className="error">
                {m}
              </span>
            ))}
          </label>
        );
      })}
      {errors[""] && <p className="error">{errors[""].join("\n")}</p>}
      {!readOnly && (
        <div className="row">
          <button className="primary" disabled={!changed || !valid || saving} onClick={save}>
            {saving ? "Salvataggio…" : "Salva come nuova revisione"}
          </button>
          <button disabled={!changed || saving} onClick={() => setValues(initial)}>
            Annulla modifiche
          </button>
          {changed && !valid && <span className="error">Correggi gli errori per salvare.</span>}
        </div>
      )}
      {serverIssues(error) !== null ? <p className="error">{serverIssues(error)}</p> : <ErrorMessage error={error} />}
    </div>
  );
}
