export type ProviderUnavailableReason = "missing_key" | "network" | "timeout" | "rate_limit" | "provider";

const MESSAGES: Record<ProviderUnavailableReason, string> = {
  missing_key: "chiave API assente: la generazione non è disponibile",
  network: "il provider LLM non è raggiungibile",
  timeout: "il provider LLM non ha risposto in tempo",
  rate_limit: "limite di richieste del provider LLM raggiunto",
  provider: "il provider LLM ha restituito un errore",
};

/**
 * Il modello non ha risposto (503). Il messaggio è fisso per motivo: non riporta
 * mai credenziali né dettagli interni del provider.
 */
export class ProviderUnavailableError extends Error {
  readonly reason: ProviderUnavailableReason;

  constructor(reason: ProviderUnavailableReason, options?: { cause?: unknown }) {
    super(MESSAGES[reason], options);
    this.name = "ProviderUnavailableError";
    this.reason = reason;
  }
}

/** Il modello ha risposto, ma l'output non è conforme nemmeno dopo il retry (502). */
export class GenerationFailedError extends Error {
  readonly errors: string[];

  constructor(errors: string[]) {
    super(`output del modello non conforme dopo il retry: ${errors.length} errori`);
    this.name = "GenerationFailedError";
    this.errors = errors;
  }
}
