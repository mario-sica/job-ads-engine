import Anthropic from "@anthropic-ai/sdk";
import { ProviderUnavailableError } from "./errors.js";

export interface LlmRequest {
  system: string;
  messages: Anthropic.MessageParam[];
  /** Lo strumento che il modello è obbligato a chiamare. */
  tool: Anthropic.Tool;
}

export interface LlmResponse {
  /** Il modello che ha risposto davvero, salvato sulla revisione. */
  model: string;
  stop_reason: Anthropic.Message["stop_reason"];
  content: Anthropic.ContentBlock[];
}

/** Interfaccia minima: nei test la implementa un client finto, mai l'API reale. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}

export interface AnthropicClientConfig {
  apiKey: string | undefined;
  model: string;
  timeoutSeconds: number;
  /** Solo per i test: trasporto HTTP finto e retry di rete. */
  fetch?: typeof fetch;
  maxRetries?: number;
}

// I retry di rete, timeout e rate limit li fa il SDK; il nostro retry riguarda solo il contenuto.
const NETWORK_RETRIES = 2;
const MAX_TOKENS = 16000;

/** Errori del SDK → ProviderUnavailableError. L'ordine conta: le sottoclassi prima. */
function toProviderError(err: unknown): unknown {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new ProviderUnavailableError("timeout", { cause: err });
  if (err instanceof Anthropic.APIConnectionError) return new ProviderUnavailableError("network", { cause: err });
  if (err instanceof Anthropic.RateLimitError) return new ProviderUnavailableError("rate_limit", { cause: err });
  if (err instanceof Anthropic.APIError) return new ProviderUnavailableError("provider", { cause: err });
  return err;
}

export function createAnthropicClient(config: AnthropicClientConfig): LlmClient {
  // Senza chiave il client non si costruisce: il SDK altrimenti cercherebbe credenziali altrove.
  const anthropic = config.apiKey
    ? new Anthropic({
        apiKey: config.apiKey,
        timeout: config.timeoutSeconds * 1000, // in TypeScript il timeout è in millisecondi
        maxRetries: config.maxRetries ?? NETWORK_RETRIES,
        ...(config.fetch ? { fetch: config.fetch } : {}),
      })
    : null;

  return {
    async complete({ system, messages, tool }) {
      if (!anthropic) throw new ProviderUnavailableError("missing_key");
      try {
        const response = await anthropic.messages.create({
          model: config.model,
          max_tokens: MAX_TOKENS,
          system,
          messages,
          tools: [tool],
          tool_choice: { type: "tool", name: tool.name },
          // Copy breve: "medium" basta e riduce la latenza rispetto al default "high".
          output_config: { effort: "medium" },
        });
        return { model: response.model, stop_reason: response.stop_reason, content: response.content };
      } catch (err) {
        throw toProviderError(err);
      }
    },
  };
}
