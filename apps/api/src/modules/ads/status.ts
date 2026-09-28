import { InvalidTransitionError } from "../../errors.js";

export const AD_STATUSES = ["draft", "active", "closed", "archived"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

// Un annuncio attivo si chiude prima di essere archiviato; `archived` è terminale.
const TRANSITIONS: Record<AdStatus, readonly AdStatus[]> = {
  draft: ["active", "archived"],
  active: ["closed"],
  closed: ["active", "archived"],
  archived: [],
};

export const canTransition = (from: AdStatus, to: AdStatus): boolean => TRANSITIONS[from].includes(to);

export function assertTransition(from: AdStatus, to: AdStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}
