import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./connection.js";

export const MIGRATIONS_DIR = fileURLToPath(new URL("../../db/migrations/", import.meta.url));

export class MigrationError extends Error {
  readonly migration: string;

  constructor(migration: string, cause: unknown) {
    super(`migrazione ${migration} fallita: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "MigrationError";
    this.migration = migration;
  }
}

/** Applica in ordine di nome i file `.sql` non ancora registrati. Restituisce quelli applicati. */
export function migrate(db: Db, dir = MIGRATIONS_DIR): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  const applied = new Set(db.prepare("SELECT name FROM schema_migrations").pluck().all() as string[]);
  const pending = readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && !applied.has(name))
    .sort();

  const record = db.prepare("INSERT INTO schema_migrations (name) VALUES (?)");
  for (const name of pending) {
    const sql = readFileSync(join(dir, name), "utf8");
    // Migrazione e registrazione insieme: se una fallisce, non resta nulla a metà.
    try {
      db.transaction(() => {
        db.exec(sql);
        record.run(name);
      })();
    } catch (err) {
      throw new MigrationError(name, err);
    }
  }
  return pending;
}
