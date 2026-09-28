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
| `LLM_MODEL` | no | `claude-sonnet-5` | Modello usato per la generazione. Deve accettare il tool use forzato: Opus 5.5 e Fable 5.1 non lo accettano (dettagli in [prompts.md](prompts.md)). |
| `LLM_TIMEOUT_SECONDS` | no | `60` | Timeout della chiamata al modello |
| `DATABASE_PATH` | no | `apps/api/data/gyver.db` | Percorso del file SQLite, relativo alla root |
| `PORT` | no | `3000` | Porta del backend |

## Database

- `apps/api/db/migrations/`: schema, file SQL applicati in ordine numerico.
- `apps/api/db/seed/001_channels.sql`: canali, combinazioni canale/formato pubblicabili e relativi limiti (`specs`).
- `apps/api/db/seed/job_offers.json`: la job offer di esempio della traccia (`jo_001`), invariata.
- `apps/api/db/seed/job_offers.fictional.json`: quattro job offer inventate (`jo_101`–`jo_104`) per provare la generazione su casi diversi: RAL solo minima, assente o solo massima, apprendistato, dati scarni, un tentativo di prompt injection.
- `apps/api/data/gyver.db`: il database già popolato con gli annunci d'esempio, versionato per vedere subito il risultato anche senza chiave API.

`npm run dev` applica migrazioni e seed se mancano. `npm run db:reset` ricrea il database da zero, senza gli annunci generati.

Migrazioni e seed sono ripetibili: le migrazioni applicate sono registrate in `schema_migrations`, e il seed non tocca ciò che esiste già. Si possono lanciare anche singolarmente:

```bash
npm run db:migrate -w @job-ads-engine/api   # solo migrazioni
npm run db:seed -w @job-ads-engine/api      # migrazioni e seed
```

## Annunci d'esempio

`apps/api/data/gyver.db` contiene annunci generati con `claude-sonnet-5` e il prompt `v10`, ciascuno con due varianti di angle diverso:

| Annuncio | Job offer | Canale e formato | Varianti |
|---|---|---|---|
| 1 | `jo_001` Tecnico elettricista fotovoltaico | Indeed, testo | 1, 2 |
| 2 | `jo_001` | WhatsApp, immagine A4 + testo | 3, 4 |
| 3 | `jo_001` | TikTok, immagine + testo 9:16 | 5, 6 |
| 4 | `jo_101` Idraulico termotecnico (solo RAL minima) | WhatsApp, testo | 7, 8 |
| 5 | `jo_102` Manutentore elettromeccanico (senza RAL) | Indeed, testo | 9, 10 |
| 6 | `jo_103` Installatore climatizzazione (apprendistato, dati scarni) | Instagram, immagine + testo 1:1 | 11, 12 |
| 7 | `jo_104` Elettricista civile (con un tentativo di prompt injection) | WhatsApp, immagine A4 | 13, 14 |

- Le varianti 1 e 7 hanno anche **revisioni manuali**: correggono due giudizi che la job offer non sostiene. Lo storico (`GET /api/variants/1/revisions`) mostra la revisione generata e quelle manuali; si può ripristinare l'una o l'altra.
- L'anteprima delle immagini si apre nel browser: `http://localhost:3000/api/variants/3/preview?as=html`.
- Manca un annuncio Instagram 4:5 per `jo_001`: fallisce quasi sempre per lunghezza dei testi dentro l'immagine (dettagli in [prompts.md](prompts.md#limiti-noti-a-fine-step-10)).

Per rigenerarli serve la chiave API (circa 20 chiamate): `npm run db:reset && npm run samples -w @job-ads-engine/api`. Lo script salta gli annunci già presenti, quindi rilanciato dopo un fallimento genera solo quelli mancanti.

## API

Il backend risponde su `http://localhost:3000/api`: l'elenco degli endpoint e degli errori è in [architecture.md](architecture.md#endpoint). Due esempi:

```bash
curl "localhost:3000/api/ads?channel=whatsapp"           # annunci WhatsApp
curl "localhost:3000/api/variants/3/preview?as=html"     # anteprima HTML (aprendo l'URL nel browser si vede la pagina)
```

Senza `ANTHROPIC_API_KEY` il backend si avvia lo stesso: consultazione, edit manuali, ripristini e anteprime funzionano, la generazione risponde `503`.

## Test

```bash
npm test             # tutti i pacchetti
npm run typecheck
```

## Percorso per vedere il flusso completo

`TODO`: dalla creazione di un annuncio al contenuto generato, passo per passo.

## Modulo opzionale (UI)

`npm run dev` avvia anche l'interfaccia su `http://localhost:5173`. È volutamente essenziale, come consente la traccia: una sola pagina con l'elenco a sinistra e il dettaglio a destra.

- **Elenco**: filtri per job offer, canale e stato; per ogni annuncio canale, formato, luogo e stato.
- **Nuovo annuncio**: job offer, canale e formato, luogo pubblicato (quello della job offer o un altro) con la sua precisione, da 1 a 4 angle, uno per variante. *Genera annuncio* chiama l'LLM e richiede qualche decina di secondi; senza chiave API compare il messaggio del `503`.
- **Dettaglio**: stato con le sole transizioni ammesse, varianti (attiva o disattiva, nuova variante con il suo angle), anteprima del testo per il canale e dell'immagine.
- **Modifica del contenuto**: un campo per ogni testo generato, una riga per elemento nelle liste, contatore sul limite del formato. La validazione usa lo stesso schema del server (`packages/content`) prima dell'invio; *Salva* crea una revisione manuale. I `facts` (RAL, contratto, esperienza, competenze) sono dati della job offer e nella UI restano in sola lettura; l'API accetta comunque il contenuto completo.
- **Storico**: le revisioni della variante, generate o manuali, con il contenuto e il ripristino di una precedente.

Un annuncio archiviato si consulta ma non si modifica.
