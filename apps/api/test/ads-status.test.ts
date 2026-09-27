import { describe, expect, it } from "vitest";
import { InvalidTransitionError } from "../src/errors.js";
import { AD_STATUSES, assertTransition, canTransition, type AdStatus } from "../src/modules/ads/status.js";

const ALLOWED = new Set(["draft→active", "draft→archived", "active→closed", "closed→active", "closed→archived"]);

const PAIRS = AD_STATUSES.flatMap((from) => AD_STATUSES.map((to) => [from, to] as [AdStatus, AdStatus]));

describe("transizioni di stato degli annunci", () => {
  it.each(PAIRS)("%s → %s", (from, to) => {
    const allowed = ALLOWED.has(`${from}→${to}`);
    expect(canTransition(from, to)).toBe(allowed);
    if (allowed) expect(() => assertTransition(from, to)).not.toThrow();
    else expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
  });
});
