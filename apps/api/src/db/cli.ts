import { rmSync } from "node:fs";
import { loadConfig, loadEnvFile } from "../config.js";
import { openDatabase } from "./connection.js";
import { migrate } from "./migrate.js";
import { logSeedWarnings, seed } from "./seed.js";

const COMMANDS = ["migrate", "seed", "reset"] as const;
type Command = (typeof COMMANDS)[number];

const isCommand = (value: string | undefined): value is Command =>
  (COMMANDS as readonly (string | undefined)[]).includes(value);

function run(command: Command): void {
  loadEnvFile();
  const { databasePath } = loadConfig();

  if (command === "reset" && databasePath !== ":memory:") {
    for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(databasePath + suffix, { force: true });
    console.log(`Database eliminato: ${databasePath}`);
  }

  const db = openDatabase(databasePath);
  try {
    const applied = migrate(db);
    console.log(applied.length ? `Migrazioni applicate: ${applied.join(", ")}` : "Nessuna migrazione da applicare");
    if (command !== "migrate") {
      const warnings = seed(db);
      console.log("Seed applicato");
      logSeedWarnings(warnings);
    }
  } finally {
    db.close();
  }
}

const command = process.argv[2];
if (!isCommand(command)) {
  console.error(`Uso: tsx src/db/cli.ts <${COMMANDS.join("|")}>`);
  process.exitCode = 1;
} else {
  try {
    run(command);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}
