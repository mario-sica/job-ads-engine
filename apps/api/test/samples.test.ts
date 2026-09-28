import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { SAMPLES, withAttemptLog } from "../src/db/samples.js";
import type { LlmRequest } from "../src/llm/client.js";
import { buildPrompt } from "../src/llm/prompts.js";
import { buildInputSnapshot } from "../src/llm/snapshot.js";
import { llmSetup } from "./llm-fixtures.js";

const { formats } = llmSetup();

describe("annunci d'esempio", () => {
  const targets = SAMPLES.map((s) => formats.find((f) => f.channel_code === s.channel && f.format === s.format && f.aspect_ratio === s.aspectRatio));

  it("ogni annuncio corrisponde a un formato del seed", () => {
    expect(targets.every(Boolean)).toBe(true);
  });

  it("coprono tutti i kind e tutti i formati", () => {
    expect(new Set(targets.map((t) => t!.kind))).toEqual(new Set(["job_board", "messaging", "social"]));
    expect(new Set(targets.map((t) => t!.format))).toEqual(new Set(["text", "image", "image_text"]));
  });

  it("ogni esempio punta a una job offer del seed, e ogni job offer ne ha almeno uno", () => {
    const ids = new Set(llmSetup().jobOffers.map((o) => o.id));
    expect(SAMPLES.every((s) => ids.has(s.jobOffer))).toBe(true);
    expect(new Set(SAMPLES.map((s) => s.jobOffer))).toEqual(ids);
  });

  it("ogni annuncio ha due angle diversi", () => {
    for (const { angles } of SAMPLES) expect(new Set(angles).size).toBe(2);
  });
});

describe("registro dei tentativi", () => {
  const { jobOffer, format, location } = llmSetup();
  const target = format("tiktok", "image_text", "9:16");
  const prompt = buildPrompt(target, buildInputSnapshot({ target, jobOffer, location, precision: "locality", angle: "sul campo" }));
  const first: LlmRequest = { system: prompt.system, messages: [{ role: "user", content: prompt.user }], tool: prompt.tool };
  const retry: LlmRequest = {
    ...first,
    messages: [
      ...first.messages,
      { role: "assistant", content: [] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", is_error: true, content: "- image.hook: troppo lungo" }] },
    ],
  };
  const client = {
    complete: async () => ({ model: "m", stop_reason: "tool_use" as const, content: [] as Anthropic.ContentBlock[] }),
  };

  it("registra chi chiama, e nei retry gli errori mandati al modello", async () => {
    const lines: string[] = [];
    const logged = withAttemptLog(client, (l) => lines.push(l));
    await logged.complete(first);
    await logged.complete(retry);

    expect(lines[0]).toMatch(/^✓ TikTok image_text 9:16 · "sul campo": \d+ ms, stop_reason=tool_use$/);
    expect(lines[1]).toContain("↻ retry TikTok image_text 9:16");
    expect(lines[1]).toContain("image.hook: troppo lungo");
    expect(lines).toHaveLength(3);
  });
});
