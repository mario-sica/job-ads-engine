import { loadConfig, loadEnvFile } from "../config.js";
import { createAnthropicClient } from "../llm/client.js";
import { PROMPT_VERSION } from "../llm/prompts.js";
import { createAdsService } from "../modules/ads/service.js";
import { createChannelFormatsRepository } from "../modules/channel-formats/repository.js";
import { openDatabase } from "./connection.js";
import { migrate } from "./migrate.js";
import { SAMPLE_JOB_OFFER, SAMPLES, withAttemptLog } from "./samples.js";
import { seed } from "./seed.js";

/*
 * Genera gli annunci d'esempio con l'API reale, attraverso lo stesso service
 * dell'API. Parte solo su un DB senza annunci: `npm run db:reset` prima.
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
    if (service.list({}).length > 0) throw new Error("il DB contiene già annunci: lancia prima `npm run db:reset`");

    const formats = createChannelFormatsRepository(db).list();
    console.log(`Modello ${config.llmModel} · prompt ${PROMPT_VERSION} · DB ${config.databasePath}\n`);

    for (const sample of SAMPLES) {
      const target = formats.find(
        (f) => f.channel_code === sample.channel && f.format === sample.format && f.aspect_ratio === sample.aspectRatio,
      );
      if (!target) throw new Error(`formato ${sample.channel} ${sample.format} ${sample.aspectRatio ?? ""} assente dal seed`);
      const ad = await service.create({
        job_offer_id: SAMPLE_JOB_OFFER,
        channel_format_id: target.id,
        variants: sample.angles.map((angle) => ({ angle })),
      });
      console.log(`→ annuncio ${ad.id} (${target.channel_name} ${target.format}): varianti ${ad.variants.map((v) => `${v.label}=${v.id}`).join(", ")}\n`);
    }
  } finally {
    db.close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
