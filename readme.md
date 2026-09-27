# job-ads-engine

Gyver · sezione *Annunci*.

Nucleo della sezione *Annunci*. Da una job offer interna si generano, tramite LLM, annunci adattati al canale di pubblicazione (job board, social ads, WhatsApp). Ogni annuncio può avere più varianti per A/B test e conserva lo storico delle modifiche.

> Il lavoro è sul branch `dev`; `main` contiene solo il commit iniziale.

> 🚧 Bozza: le parti marcate `TODO` vengono completate a fine sviluppo.

## Avvio rapido

```bash
npm install
cp .env.example .env    # facoltativo: inserisci la chiave API per generare nuovi annunci
npm run dev             # avvia backend e interfaccia
```

- Interfaccia: `http://localhost:5173`
- API: `http://localhost:3000/api`

Il database incluso contiene già annunci generati: senza chiave API si possono consultare e modificare. `TODO`: verificare a fine sviluppo.

## Stack

Monorepo con npm workspaces:

| Pacchetto | Contenuto | Tecnologie |
|---|---|---|
| `packages/content` | Contratto del contenuto, condiviso da api e web | TypeScript, Zod |
| `apps/api` | Backend: API, persistenza, generazione | Node.js, Fastify, SQLite (better-sqlite3), Anthropic API |
| `apps/web` | Interfaccia minima (modulo opzionale) | React, Vite |

Test con Vitest in ogni pacchetto.

## Documenti

| File | Contenuto |
|---|---|
| [architecture.md](architecture.md) | Struttura, modello dati, flusso dati, semplificazioni |
| [prompts.md](prompts.md) | Prompt finali, iterazioni, gestione output non conformi |
| [tradeoffs.md](tradeoffs.md) | Scelte, sacrifici, interpretazione della traccia |
| [ai-workflows.md](ai-workflows.md) | Come ho usato l'AI durante lo sviluppo |

## Requisiti

- Node.js >= 22
- npm

## Variabili d'ambiente

Il file `.env` sta nella root del monorepo.

| Variabile | Obbligatoria | Default | Descrizione |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | solo per generare | — | Chiave API, dalla Console Anthropic → API Keys (`TODO: link`). Senza chiave consultazione e modifica funzionano; la generazione risponde `503`. |
| `LLM_MODEL` | no | `TODO` | Modello usato per la generazione |
| `LLM_TIMEOUT_SECONDS` | no | `60` | Timeout della chiamata al modello |
| `DATABASE_PATH` | no | `apps/api/data/gyver.db` | Percorso del file SQLite, relativo alla root |
| `PORT` | no | `3000` | Porta del backend |

## Database

- `apps/api/db/migrations/`: schema, file SQL applicati in ordine numerico.
- `apps/api/db/seed/001_channels.sql`: canali, combinazioni canale/formato pubblicabili e relativi limiti (`specs`).
- `apps/api/db/seed/job_offers.json`: la job offer di esempio della traccia, invariata.
- `apps/api/data/gyver.db`: il database già popolato con annunci generati, versionato per vedere subito il risultato. `TODO`

`npm run dev` applica migrazioni e seed se mancano. `npm run db:reset` ricrea il database da zero, senza gli annunci generati.

Migrazioni e seed sono ripetibili: le migrazioni applicate sono registrate in `schema_migrations`, e il seed non tocca ciò che esiste già. Si possono lanciare anche singolarmente:

```bash
npm run db:migrate -w @job-ads-engine/api   # solo migrazioni
npm run db:seed -w @job-ads-engine/api      # migrazioni e seed
```

## Test

```bash
npm test             # tutti i pacchetti
npm run typecheck
```

## Percorso per vedere il flusso completo

`TODO`: dalla creazione di un annuncio al contenuto generato, passo per passo.

## Modulo opzionale (UI)

`TODO`
