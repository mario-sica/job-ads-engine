import type Anthropic from "@anthropic-ai/sdk";
import { validContent } from "@job-ads-engine/content/testing";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { LlmClient, LlmResponse } from "../src/llm/client.js";
import type { InputSnapshot } from "../src/llm/snapshot.js";
import { seededDb } from "./helpers.js";
import { withoutEmoji } from "./llm-fixtures.js";

/**
 * LLM finto che risponde con un output valido per il canale richiesto, letto
 * dal blocco dati del prompt. `fail` fa fallire le chiamate a partire dalla n-esima.
 */
export function fakeLlm(options: { fail?: Error; failFrom?: number } = {}) {
  const calls: string[] = [];
  const client: LlmClient = {
    async complete({ messages, tool }) {
      calls.push(tool.name);
      if (options.fail && calls.length >= (options.failFrom ?? 1)) throw options.fail;
      const user = messages[0]!.content as string;
      const json = user.slice(user.indexOf("<job_offer>") + "<job_offer>".length, user.lastIndexOf("</job_offer>"));
      const { channel } = JSON.parse(json) as InputSnapshot;
      const { facts: _, ...parts } = withoutEmoji(validContent(channel));
      const block = { type: "tool_use", id: `toolu_${calls.length}`, name: tool.name, input: { salary_framing: "range", ...parts } };
      return { model: "modello-finto", stop_reason: "tool_use", content: [block as Anthropic.ContentBlock] } satisfies LlmResponse;
    },
  };
  return { client, calls };
}

/** App con DB in memoria seedato e LLM finto. */
export function testApp(llm: LlmClient = fakeLlm().client): { app: FastifyInstance; db: ReturnType<typeof seededDb> } {
  const db = seededDb();
  return { app: buildApp({ db, llm }), db };
}
