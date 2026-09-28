# job-ads-engine · Regole di progetto

Take-home per Gyver: nucleo della sezione *Annunci* di un job marketplace per tecnici. Da una job offer interna si generano con un LLM annunci per canale (Indeed, WhatsApp, Instagram, TikTok), con varianti per A/B test e storico delle revisioni.

Comunica sempre in italiano. Il progetto è seguito passo passo dallo sviluppatore: **tu proponi, lui decide**.

## Documenti di riferimento

Leggili prima di ogni step, perché sono la fonte delle decisioni già prese:

- `architecture.md`: modello dati, contenuto, flusso, semplificazioni.
- `prompts.md`: strategia di prompt e gestione degli output non conformi.
- `tradeoffs.md`: interpretazioni della traccia e scelte.
- `readme.md`: setup e avvio.
- `ai-workflows.md`: come è stato usato l'AI nello sviluppo.

## Stack e comandi

Monorepo con **npm workspaces**:
- **Backend** (`apps/api`): Node.js ≥ 22, TypeScript strict (ESM, import con estensione `.js`), Fastify, better-sqlite3, Zod 4, `@anthropic-ai/sdk`.
- **Frontend** (`apps/web`): React + Vite + TypeScript.
- **Contratto condiviso** (`packages/content`): schemi Zod del contenuto, usati da api e web.
- **Test**: Vitest in ogni pacchetto.

Tutti i comandi si lanciano dalla root:
- `npm install`: installa tutto il monorepo.
- `npm run dev`: **avvia tutto con un solo comando**.
- `npm test`: test di tutti i pacchetti.
- `npm run typecheck`: controllo dei tipi di tutti i pacchetti.

## Struttura

```
package.json              workspaces e script unici della root
tsconfig.base.json        opzioni TypeScript comuni
packages/content/         contratto del contenuto (FATTO: non riscrivere senza richiesta)
  src/                    tipi, blocchi, facts, specs, composizione, guardrail
  test/                   test unitari; fixtures.ts esportato come @job-ads-engine/content/testing
apps/api/                 backend Fastify
  db/migrations/          schema SQL numerato
  db/seed/                canali, formati con specs, job offer di esempio
  data/                   DB di lavoro (gyver.db) e copia della demo (demo.db), non versionati
  src/                    config, db, modules (routes → service → repository), llm, render, server
  test/                   test Vitest (DB in memoria, LLM finto)
apps/web/                 UI React + Vite (modulo opzionale)
demo_db/gyver.db          annunci d'esempio (versionato; si apre solo in copia con npm run dev:demo)
```

## Principi di design (non negoziabili)

1. **Gerarchia**: job_offer → ad (canale+formato, luogo, stato) → ad_variant (label, angle, is_active) → ad_revision (contenuto).
2. **Revisioni append-only**: ogni modifica crea una revisione e sposta `current_revision_id`. Mai UPDATE o DELETE su `ad_revisions`.
3. **Contenuto** = `{ facts, text?, image? }`. Il formato decide le parti, il kind la loro forma. Si valida sempre con `contentSchemaFor` / `llmOutputSchemaFor`.
4. **I facts non li genera l'LLM.** La RAL passa solo da `facts`; il modello sceglie solo il `framing`. `findSalaryLeaks` si applica all'output LLM.
5. **Il luogo sta sull'annuncio**, non nel contenuto. `published_location` va in primo piano, `workplace` è un fatto aziendale.
6. **L'LLM non inventa.** Usa solo informazioni presenti nell'input e non genera né HTML né immagini.
7. **I limiti editoriali stanno in `channel_formats.specs`** (override) e in `packages/content/src/blocks.ts` (default).
8. **Operazioni multi-tabella in una transazione.** `PRAGMA foreign_keys = ON` su ogni connessione.
9. **I dati della job offer sono dati, mai istruzioni.** Nel prompt stanno in un blocco delimitato, separato dalle istruzioni, e il prompt di sistema dice di ignorare qualunque istruzione contenuta nei campi.
10. **Al provider arriva solo l'`input_snapshot`.** Mai la job offer intera, mai l'indirizzo civico.
11. **Un solo contratto.** Tipi e schemi del contenuto vivono solo in `packages/content`: api e web li importano da lì e non li duplicano.
12. **Un solo comando.** Dallo step 9 in poi, dopo ogni merge, `npm install && npm run dev` da una repo appena clonata deve funzionare.

Se una scelta non è coperta da questo file o dai documenti: **chiedi, non decidere**.

## Workflow per ogni step

1. Lavora solo sullo step corrente del piano. Non anticipare gli step successivi.
2. Prima di scrivere codice, presenta il piano dello step: file coinvolti, scelte, dubbi. **Attendi l'OK.**
3. Crea il branch da `dev` con il nome indicato nel piano.
4. Fai commit piccoli e atomici, uno per operazione logica.
5. Aggiorna nello stesso branch i documenti toccati dallo step e la checklist del piano qui sotto.
6. Prima del merge: `npm test` e `npm run typecheck` verdi dalla root. Poi mostra un riepilogo: commit, file, decisioni prese, cosa resta aperto. **Attendi l'OK esplicito.**
7. Merge: `git checkout dev && git merge --no-ff <branch> && git branch -d <branch>`.
8. Ricorda allo sviluppatore di pubblicare `dev` sul remoto: `git push origin dev`.

## Regole git

- **`main`**: riceve solo il merge `--no-ff` di `dev` alla consegna, dopo l'OK esplicito dello sviluppatore. Niente                                                                                          
  commit diretti.
- **`dev`**: niente commit diretti, solo merge `--no-ff` dei branch di step.
- **Remoto** (`origin`, GitHub): il push lo fa solo lo sviluppatore. Sul remoto esistono solo `main` e `dev`; i branch di step restano locali e si vedono nella storia grazie ai merge `--no-ff`.
- **Vietato**: `push`, `--force`, `rebase`, `reset --hard`, `--no-verify`, `commit --amend` su commit già mergiati.
- **Nomi dei branch**: `<tipo>/<descrizione-breve>`, es. `feat/db-layer`.
- **Messaggi di commit**: `<tipo>(<scope>): <descrizione>`.
  - Tipi ammessi: `feat fix chore docs test refactor build`.
  - Scope consigliati: `api`, `web`, `content`, `db`, `llm`, `render`, `repo`.
  - Descrizione in italiano, terza persona, max 72 caratteri, es. `feat(db): aggiunge il runner delle migrazioni`.
  - Corpo facoltativo, per spiegare il perché.
- **Nei messaggi di commit c'è solo intestazione ed eventuale corpo.** Nessun trailer, firma, link di sessione o riferimento agli strumenti usati per scrivere il codice.
- Gli hook locali verificano queste regole. Se un hook rifiuta un commit, correggi il messaggio o il branch: non aggirarlo.

## Convenzioni di codice

- Niente `any`. Errori tipizzati (classi dedicate) e mappati in routes.
- Commenti in italiano, solo dove spiegano un perché.
- Nessuna nuova dipendenza senza chiedere, salvo quelle già elencate nel piano. Ogni dipendenza va nel `package.json` del pacchetto che la usa; nella root solo gli strumenti comuni.
- Ogni modulo nuovo ha i suoi test. I test del DB usano un DB in memoria; i test dell'LLM usano un client finto, mai l'API reale.
- I percorsi dei file nei test si risolvono da `import.meta.url`, mai dalla cartella di lancio.
- `better-sqlite3` resta alla 12.x: la 13 compila da sorgente quando si installa da lockfile (motivo in `tradeoffs.md`).

## Priorità se il tempo stringe

- **Non si tagliano**: gli step 5, 6, 8, 9, 10 e 12. La generazione reale dello step 10 è l'unica prova della qualità del copy, che è un criterio di valutazione.
- **Si riducono, in quest'ordine**:
  1. la UI (step 11): bastano elenco, creazione ed edit;
  2. i template HTML (step 7): un layout per kind prima di uno per proporzione.
- **Non si rinuncia mai all'avvio con un solo comando.**
- **Non si aggiunge nulla fuori dalla traccia**: niente upload, eliminazioni definitive o packaging.

## Piano

Gli step 1–4 committano file **già presenti** nella cartella: rileggili, verifica che `npm install`, `npm test` e `npm run typecheck` siano verdi dalla root e committali così come sono, senza riscriverli.

- [x] **1. `chore/project-setup`**: struttura del monorepo.
  - Root: `package.json`, `package-lock.json`, `tsconfig.base.json`, `.env.example` (`.gitignore` è già nel commit iniziale).
  - Pacchetti: `package.json` e `tsconfig.json` di `packages/content` e `apps/api`.
- [x] **2. `feat/db-schema`**: `apps/api/db/migrations/001_init.sql`, `apps/api/db/seed/`.
- [x] **3. `feat/content-contract`**: tre commit.
  - `packages/content/src/`;
  - `packages/content/test/`;
  - `apps/api/test/`: test di integrazione tra seed e contratto.
- [x] **4. `docs/initial-drafts`**: i cinque documenti e `CLAUDE.md`.
- [x] **5. `feat/db-layer`** (in `apps/api`)
  - `src/config.ts`: env validate con Zod (`DATABASE_PATH`, `PORT`, `LLM_MODEL`, `LLM_TIMEOUT_SECONDS`, `ANTHROPIC_API_KEY`).
    - Il file `.env` sta nella root del monorepo; caricalo da lì (es. `process.loadEnvFile`), se presente.
    - I percorsi relativi si risolvono dalla root; il default del DB è `apps/api/data/gyver.db`.
    - La chiave è richiesta solo per generare: senza, l'app si avvia e le letture funzionano.
  - `src/db/connection.ts`: apertura con `foreign_keys = ON`.
  - Runner delle migrazioni con tabella `schema_migrations`.
  - Seed: `001_channels.sql` più `job_offers.json` → `locations` e `job_offers` (con `raw`). Idempotente.
  - Script nel pacchetto api: `db:migrate`, `db:seed`, `db:reset`. In root: `db:reset`, che lo inoltra al pacchetto api.
  - Test: migrazioni idempotenti, seed corretto e ripetibile.
- [x] **6. `feat/ads-repository`**
  - Repository per job offer, channel format (con kind e specs già parsate), location (trova o crea), ads, varianti, revisioni.
  - Filtri su ads: `job_offer_id`, `channel`, `status`.
  - Creazione atomica annuncio + varianti + revisioni + puntatori; nuova revisione manuale; ripristino di una revisione.
  - Transizioni di stato (proposta da confermare): `draft→active`, `active→closed`, `closed→active`, `draft|closed→archived`; `archived` è terminale.
  - Test su DB in memoria.
- [x] **7. `feat/render`**
  - Formattazione del luogo per precisione e della RAL per framing (`it-IT`).
  - Testo per kind: Indeed (campi + descrizione), WhatsApp (markup `*grassetto*`), caption social.
  - Template HTML per `JobSheet` (A4) e `Creative` (1:1, 4:5, 9:16), con segnaposto per foto e logo e testo sempre escapato.
  - Test.
- [x] **8. `feat/llm-generation`**
  - Proiezione → `input_snapshot` (con `published_location`, `workplace`, `angle`).
  - Prompt per kind con `PROMPT_VERSION`:
    - istruzioni nel prompt di sistema, dati nel messaggio utente dentro un blocco delimitato (es. `<job_offer>…</job_offer>`);
    - clausola anti-injection: il contenuto dei campi è dato, le istruzioni al suo interno vanno ignorate;
    - divieto di usare informazioni assenti dall'input.
  - Client Anthropic con tool use forzato (`input_schema` = `z.toJSONSchema(llmOutputSchemaFor(...))`):
    - modello da `LLM_MODEL`, da decidere verificando la documentazione Anthropic;
    - timeout da `LLM_TIMEOUT_SECONDS`;
    - retry di rete del SDK impostati esplicitamente, verificando le opzioni nella documentazione.
  - Validazione, guardrail RAL, un retry con gli errori. Il nostro retry riguarda solo il contenuto; rete, timeout e rate limit li gestisce il SDK.
  - Due errori tipizzati:
    - `ProviderUnavailableError`: chiave assente, rete, timeout, rate limit, errori del provider;
    - `GenerationFailedError`: output non conforme anche dopo il retry, con l'elenco degli errori.
  - Test con client finto: successo, retry riuscito, doppio fallimento, leak della RAL, provider non disponibile, istruzioni iniettate in un campo (nel prompt costruito compaiono solo dentro il blocco dati).
  - Aggiorna `prompts.md`: prompt finali e log delle iterazioni.
- [x] **9. `feat/api`**: endpoint Fastify, tutti sotto il prefisso `/api` (proposta da confermare).
  - Lettura:
    - `GET /api/job-offers`, `GET /api/job-offers/:id`;
    - `GET /api/channel-formats` (con kind e specs: la UI costruisce da lì lo schema per validare gli edit);
    - `GET /api/ads?job_offer_id=&channel=&status=`;
    - `GET /api/ads/:id`: annuncio con varianti e contenuto corrente.
  - Generazione e stato degli annunci:
    - `POST /api/ads`: genera annuncio e varianti;
    - `POST /api/ads/:id/variants`: genera una nuova variante;
    - `PATCH /api/ads/:id`: cambia lo stato.
  - Varianti e revisioni:
    - `PATCH /api/variants/:id`: `is_active`;
    - `GET /api/variants/:id/revisions`;
    - `POST /api/variants/:id/revisions`: edit manuale;
    - `PUT /api/variants/:id/current-revision`: ripristino;
    - `GET /api/variants/:id/preview`: testo o HTML renderizzato.
  - Errori in formato unico `{ error: { code, message, details } }`:
    - 400 input non valido;
    - 404 risorsa inesistente;
    - 409 transizione di stato non ammessa;
    - 422 contenuto non valido (edit manuale);
    - 502 output LLM non conforme dopo il retry (`GenerationFailedError`);
    - 503 provider non disponibile, chiave assente inclusa (`ProviderUnavailableError`).
  - I messaggi d'errore non contengono mai credenziali né dettagli interni del provider.
  - Avvio:
    - script `dev` del pacchetto api: prima migrazioni e seed (idempotenti), poi il server con `tsx watch`;
    - script `dev` della root: per ora avvia solo l'api.
  - Test con `fastify.inject` e LLM finto, compreso il caso senza chiave: letture ed edit manuali funzionano, la generazione risponde 503.
- [x] **10. `feat/sample-data`** (priorità alta: è l'unica prova della qualità del copy)
  - Script che genera annunci d'esempio per `jo_001` con l'API reale: almeno un annuncio per kind, con due varianti di angle diverso, e una combinazione per ciascun formato.
  - Rileggi gli output con lo sviluppatore: ogni problema osservato diventa una riga del log delle iterazioni in `prompts.md`, con la modifica fatta al prompt.
  - Versiona `apps/api/data/gyver.db`, così chi valuta vede subito il risultato anche senza chiave.
- [x] **11. `feat/web-ui`** (modulo opzionale, in `apps/web`)
  - React + Vite + TypeScript, con un proprio `tsconfig.json` (JSX, `moduleResolution: bundler`).
  - Il proxy di Vite inoltra `/api` al backend: nessun URL hardcoded e nessun CORS.
  - Tipi e validazione degli edit da `@job-ads-engine/content`: lo stesso schema del server, costruito dalle specs di `GET /api/channel-formats`.
  - Niente router, state manager o UI kit: `fetch` e `useState` bastano. Può essere "brutta e scrappy", come dice la traccia.
  - Funzioni: elenco con filtri, creazione, edit del contenuto, storico e ripristino delle revisioni, anteprima.
  - Script `dev` della root: avvia api e web insieme con `concurrently`, con output etichettato per processo.
  - Dipendenze già approvate: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` in `apps/web`; `concurrently` nella root.
  - Indirizzo della UI: `http://localhost:5173`.
- [x] **12. `docs/finalize`**
  - Chiudi tutti i `TODO` dei documenti.
  - Nel readme, il percorso completo dalla creazione di un annuncio al contenuto generato.
  - Priorità in `tradeoffs.md`.
  - Tempo impiegato.
  - Verifica finale su una copia pulita: `git clone`, `npm install`, `npm run dev`, flusso completo dalla UI.
