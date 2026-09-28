import { loadConfig, loadEnvFile } from "../config.js";
import { createAnthropicClient } from "../llm/client.js";
import { GenerationFailedError } from "../llm/errors.js";
import { PROMPT_VERSION } from "../llm/prompts.js";
import { createAdsService } from "../modules/ads/service.js";
import { createChannelFormatsRepository } from "../modules/channel-formats/repository.js";
import { openDatabase } from "./connection.js";
import { migrate } from "./migrate.js";
import { SAMPLES, withAttemptLog } from "./samples.js";
import { seed } from "./seed.js";

/*
 * Genera gli annunci d'esempio con l'API reale, attraverso lo stesso service
 * dell'API. Salta quelli già presenti: rilanciato dopo un fallimento genera solo
 * i mancanti. Per rigenerare tutto: `npm run db:reset` prima.
 */
async function main() {
  loadEnvFile();
  const config = loadConfig();
  if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY assente: serve per generare gli annunci d'esempio");

  const db = openDatabase(config.databasePath);
  try {
    migrate(db);
    seed(db);
    const llm = withAttemptLog(
      createAnthropicClient({ apiKey: config.anthropicApiKey, model: config.llmModel, timeoutSeconds: config.llmTimeoutSeconds }),
      (line) => console.log(line),
    );
    const service = createAdsService({ db, llm });
    const existing = new Set(service.list({}).map((ad) => `${ad.job_offer_id}:${ad.channel_format_id}`));

    const formats = createChannelFormatsRepository(db).list();
    console.log(`Modello ${config.llmModel} · prompt ${PROMPT_VERSION} · DB ${config.databasePath}\n`);

    const failures: string[] = [];
    for (const sample of SAMPLES) {
      const target = formats.find(
        (f) => f.channel_code === sample.channel && f.format === sample.format && f.aspect_ratio === sample.aspectRatio,
      );
      if (!target) throw new Error(`formato ${sample.channel} ${sample.format} ${sample.aspectRatio ?? ""} assente dal seed`);
      const name = `${sample.jobOffer} · ${target.channel_name} ${target.format}${target.aspect_ratio ? ` ${target.aspect_ratio}` : ""}`;
      if (existing.has(`${sample.jobOffer}:${target.id}`)) {
        console.log(`· ${name}: già presente, saltato\n`);
        continue;
      }
      // Un annuncio fallito non ferma gli altri: un giro deve mostrare tutti i problemi.
      try {
        const ad = await service.create({
          job_offer_id: sample.jobOffer,
          channel_format_id: target.id,
          variants: sample.angles.map((angle) => ({ angle })),
        });
        console.log(`→ annuncio ${ad.id} (${name}): varianti ${ad.variants.map((v) => `${v.label}=${v.id}`).join(", ")}\n`);
      } catch (err) {
        const errors = err instanceof GenerationFailedError ? err.errors.map((e) => `\n    - ${e}`).join("") : "";
        failures.push(name);
        console.log(`✗ ${name}: ${err instanceof Error ? err.message : String(err)}${errors}\n`);
      }
    }
    if (failures.length > 0) {
      console.log(`Annunci falliti: ${failures.join(", ")}`);
      process.exitCode = 1;
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
