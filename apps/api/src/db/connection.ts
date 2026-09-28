import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

/*
 * Journal mode lasciato al default: con WAL le scritture recenti restano nel file
 * `-wal`, e il DB della demo copiato in `demo_db/` potrebbe non contenerle.
 */
export function openDatabase(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  // Per-connessione: senza, SQLite ignora tutte le FK.
  db.pragma("foreign_keys = ON");
  return db;
}
