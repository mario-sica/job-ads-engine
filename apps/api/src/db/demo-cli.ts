import { spawn } from "node:child_process";
import { relative } from "node:path";
import { ROOT_DIR } from "../config.js";
import { DEMO_DATABASE, DEMO_SOURCE, prepareDemoDatabase } from "./demo.js";

/*
 * `dev`: prepara la copia di lavoro della demo e avvia api e web su di essa.
 * `reset`: riporta la copia di lavoro allo stato di `demo_db/gyver.db`.
 */
const command = process.argv[2];
const paths = { source: DEMO_SOURCE, target: DEMO_DATABASE };
const shown = relative(ROOT_DIR, DEMO_DATABASE);

try {
  if (command === "reset") {
    prepareDemoDatabase(paths, true);
    console.log(`Demo ripristinata: ${shown} è di nuovo una copia di demo_db/gyver.db`);
  } else if (command === "dev") {
    const result = prepareDemoDatabase(paths);
    console.log(result === "copied" ? `Demo: copiato demo_db/gyver.db in ${shown}` : `Demo: riuso ${shown} (per ripartire: npm run demo:reset)`);
    // Lo stesso avvio di `npm run dev`, con il DB della demo al posto di quello di lavoro.
    const child = spawn("npm", ["run", "dev"], {
      cwd: ROOT_DIR,
      stdio: "inherit",
      env: { ...process.env, DATABASE_PATH: DEMO_DATABASE },
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
      process.exitCode = code ?? 0;
    });
  } else {
    console.error("Uso: tsx src/db/demo-cli.ts <dev|reset>");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
