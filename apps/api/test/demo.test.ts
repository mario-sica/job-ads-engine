import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_SOURCE, prepareDemoDatabase } from "../src/db/demo.js";

describe("DB della demo", () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const setup = () => {
    dir = mkdtempSync(join(tmpdir(), "jae-demo-"));
    const source = join(dir, "demo.db");
    writeFileSync(source, "originale");
    return { source, target: join(dir, "data", "demo.db") };
  };

  it("copia la demo se la copia di lavoro manca, creando la cartella", () => {
    const paths = setup();
    expect(prepareDemoDatabase(paths)).toBe("copied");
    expect(readFileSync(paths.target, "utf8")).toBe("originale");
  });

  it("riusa la copia di lavoro esistente, con le sue modifiche", () => {
    const paths = setup();
    prepareDemoDatabase(paths);
    writeFileSync(paths.target, "modificata");
    expect(prepareDemoDatabase(paths)).toBe("kept");
    expect(readFileSync(paths.target, "utf8")).toBe("modificata");
  });

  it("reset la riporta all'originale ed elimina i file temporanei di SQLite", () => {
    const paths = setup();
    prepareDemoDatabase(paths);
    writeFileSync(paths.target, "modificata");
    writeFileSync(`${paths.target}-journal`, "x");
    expect(prepareDemoDatabase(paths, true)).toBe("copied");
    expect(readFileSync(paths.target, "utf8")).toBe("originale");
    expect(existsSync(`${paths.target}-journal`)).toBe(false);
  });

  it("senza il DB demo è un errore esplicito", () => {
    const paths = setup();
    rmSync(paths.source);
    expect(() => prepareDemoDatabase(paths)).toThrow(/DB demo non trovato/);
  });

  it("il DB demo versionato contiene annunci su tutti i formati", () => {
    const db = new Database(DEMO_SOURCE, { readonly: true });
    try {
      const covered = db.prepare("SELECT COUNT(DISTINCT channel_format_id) FROM ads").pluck().get();
      const formats = db.prepare("SELECT COUNT(*) FROM channel_formats").pluck().get();
      expect(covered).toBe(formats);
    } finally {
      db.close();
    }
  });
});
