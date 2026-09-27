import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Root del monorepo, indipendente dalla cartella di lancio. */
export const ROOT_DIR = fileURLToPath(new URL("../../../", import.meta.url));

export class ConfigError extends Error {
  constructor(message: string) {
    super(`configurazione non valida: ${message}`);
    this.name = "ConfigError";
  }
}

// Una variabile vuota nel .env (es. `ANTHROPIC_API_KEY=` di .env.example) vale come assente.
const blankAsMissing = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const envSchema = z.object({
  DATABASE_PATH: blankAsMissing(z.string().default("apps/api/data/gyver.db")),
  PORT: blankAsMissing(z.coerce.number().int().min(1).max(65535).default(3000)),
  LLM_MODEL: blankAsMissing(z.string().optional()),
  LLM_TIMEOUT_SECONDS: blankAsMissing(z.coerce.number().positive().default(60)),
  ANTHROPIC_API_KEY: blankAsMissing(z.string().optional()),
});

export interface Config {
  databasePath: string;
  port: number;
  llmModel: string | undefined;
  llmTimeoutSeconds: number;
  /** Serve solo per generare: senza, l'app si avvia e le letture funzionano. */
  anthropicApiKey: string | undefined;
}

/** Carica il `.env` della root, se presente. Le variabili già definite nell'ambiente prevalgono. */
export function loadEnvFile(path = resolve(ROOT_DIR, ".env")): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    // Solo nome della variabile e regola violata: i valori (chiave compresa) non finiscono nei log.
    const details = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new ConfigError(details);
  }
  const e = result.data;
  return {
    databasePath: resolveDatabasePath(e.DATABASE_PATH),
    port: e.PORT,
    llmModel: e.LLM_MODEL,
    llmTimeoutSeconds: e.LLM_TIMEOUT_SECONDS,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
  };
}

function resolveDatabasePath(path: string): string {
  return path === ":memory:" || isAbsolute(path) ? path : resolve(ROOT_DIR, path);
}
