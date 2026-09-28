import { describe, expect, it } from "vitest";
import { createAnthropicClient, type LlmRequest } from "../src/llm/client.js";
import { ProviderUnavailableError } from "../src/llm/errors.js";

const KEY = "sk-ant-test-chiave-finta";

const request: LlmRequest = {
  system: "istruzioni",
  messages: [{ role: "user", content: "<job_offer>{}</job_offer>" }],
  tool: { name: "submit_ad", description: "invia", input_schema: { type: "object", properties: {} } },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });

const MESSAGE = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5",
  content: [{ type: "tool_use", id: "toolu_1", name: "submit_ad", input: { salary_framing: null } }],
  stop_reason: "tool_use",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
};

/** Trasporto finto: registra le richieste e risponde con `respond`. */
function fakeFetch(respond: (init: RequestInit) => Promise<Response> | Response) {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return respond(init);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const client = (fetch: typeof globalThis.fetch, overrides: { apiKey?: string | undefined; timeoutSeconds?: number } = {}) =>
  createAnthropicClient({ apiKey: KEY, model: "claude-sonnet-5", timeoutSeconds: 60, fetch, maxRetries: 0, ...overrides });

describe("client Anthropic", () => {
  it("forza lo strumento, usa il modello configurato e restituisce la risposta", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, MESSAGE));
    const response = await client(fetch).complete(request);

    expect(response).toEqual({ model: "claude-sonnet-5", stop_reason: "tool_use", content: MESSAGE.content });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toMatch(/\/v1\/messages$/);
    expect(calls[0]!.headers.get("x-api-key")).toBe(KEY);
    expect(calls[0]!.body).toMatchObject({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: "istruzioni",
      messages: request.messages,
      tools: [request.tool],
      tool_choice: { type: "tool", name: "submit_ad" },
      output_config: { effort: "medium" },
    });
  });

  it("senza chiave solleva missing_key e non fa richieste", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, MESSAGE));
    await expect(client(fetch, { apiKey: undefined }).complete(request)).rejects.toMatchObject({
      name: "ProviderUnavailableError",
      reason: "missing_key",
    });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [429, "rate_limit_error", "rate_limit"],
    [401, "authentication_error", "provider"],
    [400, "invalid_request_error", "provider"],
    [500, "api_error", "provider"],
    [529, "overloaded_error", "provider"],
  ] as const)("HTTP %s → %s", async (status, type, reason) => {
    const { fetch } = fakeFetch(() => json(status, { type: "error", error: { type, message: `dettaglio interno con ${KEY}` } }));
    const err = await client(fetch).complete(request).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect(err).toMatchObject({ reason });
    expect((err as Error).message).not.toContain(KEY);
    expect((err as Error).message).not.toContain("dettaglio interno");
  });

  it("errore di rete → network", async () => {
    const { fetch } = fakeFetch(() => {
      throw new TypeError("fetch failed");
    });
    await expect(client(fetch).complete(request)).rejects.toMatchObject({ reason: "network" });
  });

  it("timeout → timeout", async () => {
    const { fetch } = fakeFetch(
      (init) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    await expect(client(fetch, { timeoutSeconds: 0.05 }).complete(request)).rejects.toMatchObject({ reason: "timeout" });
  });
});
