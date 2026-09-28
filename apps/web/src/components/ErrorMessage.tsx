import { ApiError } from "../api.js";

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return `${error.message} (${error.code})`;
  return error instanceof Error ? error.message : String(error);
}

export function ErrorMessage({ error }: { error: unknown }) {
  if (error === null || error === undefined) return null;
  return <p className="error">{errorText(error)}</p>;
}
