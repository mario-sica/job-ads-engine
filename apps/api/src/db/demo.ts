import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ROOT_DIR } from "../config.js";

/*
 * Il DB con gli annunci d'esempio è versionato in `demo_db/` e non si apre mai
 * direttamente: la demo lavora su una copia non versionata, così edit, ripristini
 * e generazioni non modificano il file consegnato.
 */
export const DEMO_SOURCE = resolve(ROOT_DIR, "demo_db/gyver.db");
export const DEMO_DATABASE = resolve(ROOT_DIR, "apps/api/data/demo.db");

export interface DemoPaths {
  source: string;
  target: string;
}

/** Crea la copia di lavoro se manca, o la ricrea con `reset`. Le modifiche fatte nella demo restano tra un avvio e l'altro. */
export function prepareDemoDatabase({ source, target }: DemoPaths, reset = false): "copied" | "kept" {
  if (!existsSync(source)) throw new Error(`DB demo non trovato: ${source}`);
  if (existsSync(target) && !reset) return "kept";
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(target + suffix, { force: true });
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return "copied";
}
