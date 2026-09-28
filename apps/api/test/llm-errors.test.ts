import { describe, expect, it } from "vitest";
import { GenerationFailedError, ProviderUnavailableError } from "../src/llm/errors.js";

describe("errori della generazione", () => {
  it.each(["missing_key", "network", "timeout", "rate_limit", "provider"] as const)(
    "ProviderUnavailableError(%s) ha un messaggio fisso",
    (reason) => {
      const err = new ProviderUnavailableError(reason, { cause: new Error("sk-ant-segreta: dettagli interni") });
      expect(err).toMatchObject({ name: "ProviderUnavailableError", reason });
      expect(err.message).not.toMatch(/sk-ant|dettagli interni/);
    },
  );

  it("GenerationFailedError porta l'elenco degli errori", () => {
    const err = new GenerationFailedError(["image.hook: troppo lungo", "text.cta: obbligatorio"]);
    expect(err).toMatchObject({ name: "GenerationFailedError", errors: ["image.hook: troppo lungo", "text.cta: obbligatorio"] });
  });
});
