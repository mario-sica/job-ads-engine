import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase, type Db } from "../src/db/connection.js";
import { migrate, MigrationError } from "../src/db/migrate.js";

const tables = (db: Db) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all() as string[];

describe("migrate", () => {
  it("applica lo schema e lo registra", () => {
    const db = openDatabase(":memory:");
    expect(migrate(db)).toEqual(["001_init.sql"]);
    expect(tables(db)).toEqual(
      expect.arrayContaining(["ad_revisions", "ad_variants", "ads", "channel_formats", "channels", "job_offers", "locations"]),
    );
    expect(db.prepare("SELECT name FROM schema_migrations").pluck().all()).toEqual(["001_init.sql"]);
  });

  it("è idempotente", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    const before = tables(db);
    expect(migrate(db)).toEqual([]);
    expect(tables(db)).toEqual(before);
  });

  it("lascia le FK attive dopo le migrazioni", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  describe("con migrazioni di prova", () => {
    let dir: string | undefined;
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    const withMigrations = (files: Record<string, string>) => {
      dir = mkdtempSync(join(tmpdir(), "jae-migrations-"));
      for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql);
      return dir;
    };

    it("applica in ordine di nome, ignorando i file non .sql", () => {
      const d = withMigrations({
        "002_b.sql": "CREATE TABLE b (a_id INTEGER REFERENCES a (id));",
        "001_a.sql": "CREATE TABLE a (id INTEGER PRIMARY KEY);",
        "README.md": "non è una migrazione",
      });
      expect(migrate(openDatabase(":memory:"), d)).toEqual(["001_a.sql", "002_b.sql"]);
    });

    it("una migrazione che fallisce non lascia nulla a metà", () => {
      const d = withMigrations({
        "001_ok.sql": "CREATE TABLE ok (x);",
        "002_bad.sql": "CREATE TABLE half (x); INSERT INTO missing VALUES (1);",
      });
      const db = openDatabase(":memory:");
      expect(() => migrate(db, d)).toThrow(MigrationError);
      expect(() => migrate(db, d)).toThrow(expect.objectContaining({ migration: "002_bad.sql" }));
      expect(tables(db)).not.toContain("half");
      expect(db.prepare("SELECT name FROM schema_migrations").pluck().all()).toEqual(["001_ok.sql"]);
    });
  });
});
