import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_LLM_MODEL, loadConfig, loadEnvFile, ROOT_DIR } from "../src/config.js";

describe("loadConfig", () => {
  it("applica i default con un ambiente vuoto", () => {
    expect(loadConfig({})).toEqual({
      databasePath: resolve(ROOT_DIR, "apps/api/data/gyver.db"),
      port: 3000,
      llmModel: "claude-sonnet-5",
      llmTimeoutSeconds: 60,
      anthropicApiKey: undefined,
    });
  });

  it("la root è quella del monorepo", () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT_DIR, "package.json"), "utf8")) as { name: string };
    expect(pkg.name).toBe("job-ads-engine");
  });

  it("risolve DATABASE_PATH relativo dalla root, lascia invariati assoluto e :memory:", () => {
    expect(loadConfig({ DATABASE_PATH: "tmp/x.db" }).databasePath).toBe(resolve(ROOT_DIR, "tmp/x.db"));
    expect(loadConfig({ DATABASE_PATH: "/var/x.db" }).databasePath).toBe("/var/x.db");
    expect(loadConfig({ DATABASE_PATH: ":memory:" }).databasePath).toBe(":memory:");
  });

  it("converte i numeri e legge le stringhe", () => {
    const config = loadConfig({ PORT: "8080", LLM_TIMEOUT_SECONDS: "90", LLM_MODEL: "modello", ANTHROPIC_API_KEY: "sk-x" });
    expect(config).toMatchObject({ port: 8080, llmTimeoutSeconds: 90, llmModel: "modello", anthropicApiKey: "sk-x" });
  });

  it("tratta le variabili vuote come assenti", () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: "", LLM_MODEL: "  ", PORT: "" });
    expect(config).toMatchObject({ anthropicApiKey: undefined, llmModel: DEFAULT_LLM_MODEL, port: 3000 });
  });

  it.each([["PORT", "abc"], ["PORT", "70000"], ["LLM_TIMEOUT_SECONDS", "0"]])(
    "%s=%s solleva ConfigError con il nome della variabile",
    (name, value) => {
      expect(() => loadConfig({ [name]: value })).toThrow(ConfigError);
      expect(() => loadConfig({ [name]: value })).toThrow(name);
    },
  );

  it("il messaggio d'errore non contiene i valori delle variabili", () => {
    const secret = "sk-segretissima";
    expect(() => loadConfig({ ANTHROPIC_API_KEY: secret, PORT: "abc" })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
});

describe("loadEnvFile", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    delete process.env.JAE_TEST_FROM_FILE;
    delete process.env.JAE_TEST_FROM_SHELL;
  });

  it("carica il file senza sovrascrivere l'ambiente", () => {
    dir = mkdtempSync(join(tmpdir(), "jae-env-"));
    const file = join(dir, ".env");
    writeFileSync(file, "JAE_TEST_FROM_FILE=file\nJAE_TEST_FROM_SHELL=file\n");
    process.env.JAE_TEST_FROM_SHELL = "shell";
    loadEnvFile(file);
    expect(process.env.JAE_TEST_FROM_FILE).toBe("file");
    expect(process.env.JAE_TEST_FROM_SHELL).toBe("shell");
  });

  it("non fallisce se il file non esiste", () => {
    expect(() => loadEnvFile(join(tmpdir(), "jae-inesistente", ".env"))).not.toThrow();
  });
});
