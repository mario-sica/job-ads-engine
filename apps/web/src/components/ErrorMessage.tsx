import { describeError } from "../api.js";

export function ErrorMessage({ error }: { error: unknown }) {
  if (error === null || error === undefined) return null;
  return <p className="error">{describeError(error)}</p>;
}
