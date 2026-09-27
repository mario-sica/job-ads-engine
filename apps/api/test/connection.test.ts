import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";

describe("openDatabase", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("attiva le foreign key", () => {
    const db = openDatabase(":memory:");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.exec("CREATE TABLE p (id INTEGER PRIMARY KEY); CREATE TABLE c (p_id INTEGER REFERENCES p (id));");
    expect(() => db.exec("INSERT INTO c VALUES (42)")).toThrow(/FOREIGN KEY/);
  });

  it("crea la cartella del file se manca, senza WAL", () => {
    dir = mkdtempSync(join(tmpdir(), "jae-db-"));
    const path = join(dir, "nested", "test.db");
    const db = openDatabase(path);
    expect(existsSync(path)).toBe(true);
    expect(db.pragma("journal_mode", { simple: true })).toBe("delete");
    db.close();
  });
});
