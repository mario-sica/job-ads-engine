import { buildApp } from "./app.js";
import { loadConfig, loadEnvFile } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { createAnthropicClient } from "./llm/client.js";

/*
 * Avvio del backend. Migrazioni e seed li applica lo script `dev` prima di
 * lanciare il server (`npm run db:seed`), così questo file resta solo l'avvio.
 */
async function main() {
  loadEnvFile();
  const config = loadConfig();
  const db = openDatabase(config.databasePath);
  // Senza chiave il client si crea lo stesso: letture ed edit funzionano, la generazione risponde 503.
  const llm = createAnthropicClient({
    apiKey: config.anthropicApiKey,
    model: config.llmModel,
    timeoutSeconds: config.llmTimeoutSeconds,
  });

  const app = buildApp({ db, llm, logger: true });
  app.addHook("onClose", async () => db.close());
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void app.close());

  await app.listen({ port: config.port, host: "localhost" });
  app.log.info(`database: ${config.databasePath} · modello: ${config.llmModel}`);
  if (!config.anthropicApiKey) app.log.warn("ANTHROPIC_API_KEY assente: letture ed edit funzionano, la generazione risponde 503");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
