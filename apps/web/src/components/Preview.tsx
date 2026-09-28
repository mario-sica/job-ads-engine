import { useEffect, useState } from "react";
import { api, previewHtmlUrl, type ChannelFormat, type Preview as PreviewData, type Variant } from "../api.js";
import { ErrorMessage } from "./ErrorMessage.js";

// Stesse tele di ripiego del renderer, se le specs non le indicano.
const FALLBACK = { messaging: { width: 1240, height: 1754 }, social: { width: 1080, height: 1080 } } as const;
const PREVIEW_WIDTH = 380;

export function Preview({ variant, format }: { variant: Variant; format: ChannelFormat }) {
  const revisionId = variant.current_revision.id;
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setError(null);
    api.preview(variant.id).then(setPreview).catch(setError);
  }, [variant.id, revisionId]);

  if (error) return <ErrorMessage error={error} />;
  if (!preview) return <p className="muted">Caricamento anteprima…</p>;

  const fallback = format.kind === "messaging" ? FALLBACK.messaging : FALLBACK.social;
  const width = format.specs.width_px ?? fallback.width;
  const height = format.specs.height_px ?? fallback.height;
  const scale = PREVIEW_WIDTH / width;

  return (
    <div className="preview">
      {preview.html !== null && (
        <div className="preview-frame" style={{ width: PREVIEW_WIDTH, height: height * scale }}>
          {/* L'HTML arriva dall'API già escapato e senza script; la sandbox lo isola comunque. */}
          <iframe
            title="Anteprima immagine"
            sandbox=""
            src={previewHtmlUrl(variant.id, revisionId)}
            width={width}
            height={height}
            style={{ transform: `scale(${scale})` }}
          />
        </div>
      )}
      {preview.text !== null && (
        <div className="preview-text">
          {preview.text.fields && (
            <dl>
              {Object.entries(preview.text.fields).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <pre>{preview.text.body}</pre>
        </div>
      )}
    </div>
  );
}
