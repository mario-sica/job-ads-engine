# job-ads-engine

Gyver · sezione *Annunci*.

Nucleo della sezione *Annunci*. Da una job offer interna si generano, tramite LLM, annunci adattati al canale di pubblicazione (job board, social ads, WhatsApp). Ogni annuncio può avere più varianti per A/B test e conserva lo storico delle modifiche.

## Requisiti

- **Node.js 22.12 o successivo** (verifica con `node -v`) e npm. Con Node 22.0–22.11 test e interfaccia non partono.
- Le porte **3000** (API) e **5173** (interfaccia) libere.
- Una chiave API Anthropic **solo per generare nuovi annunci**. Senza chiave tutto il resto funziona.

## Avvio rapido

Tutti i comandi si lanciano **dalla cartella principale del repository** (quella con questo readme).

```bash
npm install            # 1. installa tutto il monorepo
npm run dev:demo       # 2. avvia API e interfaccia con gli annunci d'esempio
```

Poi apri **`http://localhost:5173`** nel browser. L'API risponde su `http://localhost:3000/api`. Per fermare tutto: `Ctrl+C` nel terminale.

Ci sono due modi di avviare, che differiscono solo per il database:

| Comando | Database | Quando usarlo |
|---|---|---|
| `npm run dev:demo` | Copia di lavoro di `demo_db/gyver.db`: **14 annunci d'esempio** già generati, su tutti i 12 formati | Per vedere subito il risultato, anche senza chiave API |
| `npm run dev` | DB pulito: 10 job offer, 4 canali, 12 formati, **nessun annuncio** | Per partire da zero e generare annunci (serve la chiave) |

In entrambi i casi il primo avvio crea il database da solo. Le modifiche fatte (edit, generazioni, cambi di stato) restano tra un avvio e l'altro e **non toccano file versionati**.

### Chiave API (facoltativa)

Serve solo per generare annunci e varianti. Senza chiave la generazione risponde `503` con "chiave API assente"; consultazione, edit, ripristini, cambi di stato e anteprime funzionano.

1. Crea una chiave nella Console Anthropic: <https://platform.claude.com/settings/keys>.
2. Nella cartella principale copia il file d'esempio:
   - Linux e macOS: `cp .env.example .env`
   - Windows (PowerShell): `Copy-Item .env.example .env`
3. Apri `.env` e incolla la chiave dopo `ANTHROPIC_API_KEY=`.
4. Riavvia (`Ctrl+C`, poi di nuovo `npm run dev` o `npm run dev:demo`).

Ogni generazione chiama l'API a pagamento: un annuncio con due varianti costa pochi centesimi.

## Percorso per vedere il flusso completo

Con l'interfaccia su `http://localhost:5173`:

1. **Consulta gli esempi** (`npm run dev:demo`, senza chiave).
   - A sinistra c'è l'elenco degli annunci. Filtralo per job offer, canale o stato e cliccane uno.
   - A destra compaiono canale, formato, luogo e stato, le schede delle varianti (A e B, con il loro angle) e l'anteprima: il testo del canale e, per i formati con immagine, la pagina impaginata.
2. **Crea un annuncio** (serve la chiave).
   - Premi **+ Nuovo annuncio** e scegli una job offer (per esempio `jo_001`, oppure [una tua](#aggiungere-una-job-offer)) e un canale con formato (per esempio *WhatsApp · testo*).
   - Lascia il luogo della job offer, oppure scegli *un altro luogo* e compila almeno la località.
   - Scrivi un angle per ogni variante, per esempio "trasferte pagate" per A e "stabilità del contratto" per B.
   - Premi **Genera annuncio**. Dopo qualche decina di secondi l'annuncio compare in elenco, già aperto, in stato *bozza*.
3. **Leggi il contenuto generato**: anteprima di ogni variante. Il contenuto grezzo è in *Storico delle revisioni → Contenuto*: la prima revisione è `generata`, con modello e versione del prompt.
4. **Modifica il testo**.
   - In *Modifica del contenuto* cambia un campo. Contatori ed errori seguono gli stessi limiti del server, e *Salva* resta spento finché il contenuto non è valido.
   - *Salva come nuova revisione* crea una revisione `modifica manuale`: l'anteprima si aggiorna, la revisione generata resta nello storico.
5. **Ripristina**: nello storico, *Ripristina* sulla revisione generata la rende di nuovo corrente.
6. **Aggiungi una variante**: scrivi un angle e premi *+ Genera variante* (serve la chiave). *attiva* accende o spegne una variante per l'A/B test.
7. **Pubblica e chiudi**: i pulsanti di stato mostrano solo le transizioni ammesse (*bozza → attivo → chiuso → archiviato*). Un annuncio archiviato si consulta ma non si modifica.

Lo stesso flusso con l'API è nella sezione [API](#api).

## Aggiungere una job offer

Le job offer non si creano dall'interfaccia né dall'API: per questo servizio sono un input che arriva da altri sistemi, e qui si caricano da file JSON (il *seed*). Per aggiungerne una bastano un file e un comando, **senza riavviare l'app**.

### 1. Crea il file

Crea un file nella cartella `apps/api/db/seed/`. Il nome deve **iniziare con `job_offers` e finire con `.json`**, per esempio `apps/api/db/seed/job_offers.mie.json`: un file con un altro nome viene ignorato. Meglio non modificare `job_offers.json` e `job_offers.fictional.json`, che sono i dati consegnati.

Il file contiene **un array** (tra `[` e `]`), anche per una sola job offer. Copia questo modello e cambia i valori:

```json
[
  {
    "job_offer_id": "jo_200",
    "title": "Elettricista industriale",
    "company_name": "Impianti Rossi Srl",
    "status": "active",
    "created_at": "2026-09-28T09:00:00.000Z",
    "location": {
      "street_name": "Via Roma",
      "street_number": "10",
      "postal_code": "25121",
      "locality": "Brescia",
      "province": "Brescia",
      "province_code": "BS",
      "region": "Lombardia",
      "country_code": "IT"
    },
    "contract_type": "Tempo indeterminato",
    "min_exp_years": 3,
    "max_exp_years": null,
    "ral_min": 28000,
    "ral_max": 32000,
    "currency": "EUR",
    "required_skills": ["Quadri elettrici", "PLC Siemens"],
    "role_description": "Ti occuperai di:\n\n- Cablare quadri elettrici di automazione\n- Fare manutenzione sulle linee dei clienti",
    "location_and_hours": "- Sede di Brescia, cantieri in provincia\n- Dal lunedì al venerdì, 8:00-17:00",
    "company_description": "Impianti Rossi, dal 1990 a Brescia\n\n- 40 dipendenti\n- Impianti elettrici industriali",
    "requirements_description": "- Almeno 3 anni di esperienza come elettricista\n- Patente B",
    "compensation_package": "- RAL da 28.000 a 32.000 €\n- Buoni pasto\n- Furgone aziendale"
  }
]
```

Per più job offer, separa gli oggetti con una virgola: `[ {...}, {...} ]`.

| Campo | Obbligatorio | Regole |
|---|---|---|
| `job_offer_id` | sì | Testo **unico** tra tutti i file, per esempio `jo_200`. Gli id già usati sono `jo_001` e `jo_101`–`jo_109` |
| `title`, `company_name`, `status`, `created_at` | sì | Testo non vuoto. `status` è informativo (per esempio `active`), `created_at` è una data ISO e ordina l'elenco, dalla più recente |
| `location` | sì | Almeno uno tra `locality`, `province` e `region`; gli altri campi si possono omettere. `country_code` vale `IT` se manca. Via e civico non arrivano mai al modello |
| `ral_min`, `ral_max` | no | Numeri interi **senza virgolette** (`28000`, non `"28.000"`), positivi, con `ral_min` non maggiore di `ral_max`. Basta anche uno solo dei due |
| `currency` | se c'è una RAL | Codice di tre lettere, per esempio `EUR`. Senza valuta la RAL viene ignorata: non entra nei dati dell'annuncio |
| `min_exp_years`, `max_exp_years` | no | Anni interi, con il minimo non maggiore del massimo |
| `contract_type` | no | Testo non vuoto, oppure `null` |
| `required_skills` | no | Elenco di testi non vuoti; se manca vale `[]` |
| `role_description`, `location_and_hours`, `company_description`, `requirements_description`, `compensation_package` | no | Testo libero, con `\n` per andare a capo e `- ` per gli elenchi. È il materiale da cui il modello scrive il copy: usa solo informazioni vere, perché il modello non ne aggiunge |

Un campo facoltativo si può omettere oppure mettere a `null`.

### 2. Carica la job offer

- **Con l'app accesa** (`npm run dev`): apri un **secondo terminale** nella cartella principale e lancia il seed; poi **ricarica la pagina** del browser. Non serve riavviare.

  ```bash
  npm run db:seed -w @job-ads-engine/api
  ```

- **Con l'app accesa in modalità demo** (`npm run dev:demo`): il comando sopra scrive nel DB di `npm run dev`. Per la demo indica il suo database:
  - Linux e macOS: `DATABASE_PATH=apps/api/data/demo.db npm run db:seed -w @job-ads-engine/api`
  - Windows (PowerShell): `$env:DATABASE_PATH="apps/api/data/demo.db"; npm run db:seed -w @job-ads-engine/api`
- **Con l'app spenta**: avviala normalmente (`npm run dev` o `npm run dev:demo`). Entrambi gli avvii caricano il seed da soli.

Il seed è ripetibile: carica solo le job offer nuove e non tocca annunci, varianti e revisioni.

### 3. Controlla l'esito

Se è tutto a posto, il comando stampa `Seed applicato` e nient'altro. Se qualcosa non va, **l'app non si blocca**: la job offer sbagliata viene scartata, le altre si caricano, e il comando stampa un avviso con file, id e campo da correggere, per esempio:

```
Attenzione, seed delle job offer: 1 avviso
  - job_offers.mie.json › jo_200: scartata. ral_min: min supera max
Le altre job offer sono state caricate. Correggi il file e rilancia: npm run db:seed -w @job-ads-engine/api
```

Con l'app accesa gli stessi avvisi compaiono all'avvio, nelle righe `[api]`. Correggi il file e rilancia il comando del passo 2.

Quando la job offer è caricata, compare nel menu **+ Nuovo annuncio** dell'interfaccia, e l'API la restituisce:

```bash
curl -s "localhost:3000/api/job-offers/jo_200" | jq
```

### Modificare o togliere una job offer già caricata

Una job offer caricata **non si aggiorna** dal file: se lo modifichi, il seed lo segnala con un avviso (`già caricata con dati diversi`) e lascia i dati com'erano. È voluto, perché gli annunci già generati si basano su quei dati. Hai due strade:

- **Senza perdere nulla**: salva i dati corretti con un **nuovo `job_offer_id`** (per esempio `jo_200b`) e genera gli annunci da quella.
- **Ripartendo da zero**: ferma l'app e lancia `npm run db:reset` (per la demo `npm run demo:reset`, poi `npm run dev:demo`). Il DB si ricrea dai file, con le modifiche e senza le job offer tolte, ma **si perdono tutti gli annunci generati**.

## Annunci d'esempio

`demo_db/gyver.db` contiene 14 annunci, due varianti ciascuno, generati con `claude-sonnet-5`. Si aprono con `npm run dev:demo`.

| Annuncio | Job offer | Canale e formato | Varianti | Prompt |
|---|---|---|---|---|
| 1 | `jo_001` Tecnico elettricista fotovoltaico | Indeed, testo | 1, 2 | v10 |
| 2 | `jo_001` | WhatsApp, immagine A4 + testo | 3, 4 | v10 |
| 3 | `jo_001` | TikTok, immagine + testo 9:16 | 5, 6 | v10 |
| 4 | `jo_101` Idraulico termotecnico (solo RAL minima) | WhatsApp, testo | 7, 8 | v10 |
| 5 | `jo_102` Manutentore elettromeccanico (senza RAL) | Indeed, testo | 9, 10 | v10 |
| 6 | `jo_103` Installatore climatizzazione (apprendistato, dati scarni) | Instagram, immagine + testo 1:1 | 11, 12 | v10 |
| 7 | `jo_104` Elettricista civile (tentativo di prompt injection) | WhatsApp, immagine A4 | 13, 14 | v10 |
| 8 | `jo_105` Installatore sistemi di sicurezza (part-time) | Instagram, immagine 1:1 | 15, 16 | v10 |
| 9 | `jo_106` Capo squadra impianti elettrici (senior) | Instagram, immagine 4:5 | 17, 18 | v10 |
| 10 | `jo_107` Manutentore ascensori (descrizione lunga) | Instagram, immagine 9:16 | 19, 20 | v10 |
| 11 | `jo_108` Installatore fibra ottica (nessuna esperienza) | Instagram, immagine + testo 4:5 | 21, 22 | v10 |
| 12 | `jo_109` Tecnico frigorista | Instagram, immagine + testo 9:16 | 23, 24 | v10 |
| 13 | `jo_001` | Instagram, immagine 4:5 | 25, 26 | v11 |
| 14 | `jo_108`, pubblicato a Lecce invece che a Bari | TikTok, immagine 9:16 | 27, 28 | v11 |

- `jo_001` è la job offer della traccia; le altre sono inventate per provare casi diversi (`apps/api/db/seed/job_offers.fictional.json`).
- Le varianti 1, 7, 15 e 26 hanno anche **revisioni manuali**, che correggono giudizi non sostenuti dalla job offer o una frase costruita per contrasto. Nello storico si vedono la revisione generata e quelle manuali.
- **Per ripartire dagli esempi originali**: ferma l'avvio e lancia `npm run demo:reset`.
- **Per rigenerarli** con la chiave (circa 35 chiamate): `npm run db:reset && npm run samples -w @job-ads-engine/api`. Il comando genera nel DB di lavoro di `npm run dev`, non in `demo_db/`.

## Comandi

Tutti dalla cartella principale.

| Comando | Cosa fa |
|---|---|
| `npm install` | Installa tutto il monorepo |
| `npm run dev:demo` | Avvia API e interfaccia sulla copia degli annunci d'esempio (`apps/api/data/demo.db`, creata al primo avvio) |
| `npm run demo:reset` | Riporta la copia degli esempi allo stato di `demo_db/gyver.db` (a server fermo) |
| `npm run dev` | Avvia API e interfaccia sul DB di lavoro (`apps/api/data/gyver.db`): migrazioni e seed si applicano da soli |
| `npm run db:reset` | **Cancella** il DB di lavoro e lo ricrea pulito, senza annunci (a server fermo) |
| `npm test` | Test di tutti i pacchetti |
| `npm run typecheck` | Controllo dei tipi di tutti i pacchetti |

Gli avvii mostrano l'output dei due processi con le etichette `[api]` e `[web]`. Se uno dei due si ferma (per esempio perché la sua porta è occupata), si ferma anche l'altro: libera la porta e rilancia.

## Variabili d'ambiente

Tutte facoltative. Il file `.env` sta nella cartella principale; le variabili già definite nell'ambiente prevalgono sul file.

| Variabile | Default | Descrizione |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Chiave API, necessaria solo per generare ([dove crearla](#chiave-api-facoltativa)) |
| `LLM_MODEL` | `claude-sonnet-5` | Modello usato per la generazione. Deve accettare il tool use forzato: Opus 5.5 e Fable 5.1 non lo accettano (dettagli in [prompts.md](prompts.md)) |
| `LLM_TIMEOUT_SECONDS` | `60` | Timeout della chiamata al modello |
| `DATABASE_PATH` | `apps/api/data/gyver.db` | File SQLite di `npm run dev`, relativo alla cartella principale. `npm run dev:demo` usa sempre `apps/api/data/demo.db` |
| `PORT` | `3000` | Porta dell'API; l'interfaccia la legge dallo stesso `.env`. L'interfaccia resta sulla 5173 |

## Database

- `apps/api/db/migrations/`: schema, file SQL applicati in ordine numerico.
- `apps/api/db/seed/001_channels.sql`: canali, combinazioni canale e formato pubblicabili e relativi limiti (`specs`).
- `apps/api/db/seed/job_offers.json`: la job offer della traccia (`jo_001`), invariata.
- `apps/api/db/seed/job_offers.fictional.json`: nove job offer inventate (`jo_101`–`jo_109`).
- `apps/api/db/seed/job_offers*.json`: il seed legge tutti i file con questo nome, quindi anche quelli aggiunti da te ([come aggiungere una job offer](#aggiungere-una-job-offer)).
- `demo_db/gyver.db`: gli annunci d'esempio. È versionato e non si apre mai direttamente: `npm run dev:demo` ne usa una copia.
- `apps/api/data/`: i due database di lavoro (`gyver.db` e `demo.db`), creati all'avvio e non versionati.

Migrazioni e seed sono ripetibili: le migrazioni applicate sono registrate in `schema_migrations`, e il seed non tocca ciò che esiste già. Una job offer non valida non blocca il seed: viene scartata con un avviso. Si possono lanciare anche singolarmente:

```bash
npm run db:migrate -w @job-ads-engine/api   # solo migrazioni
npm run db:seed -w @job-ads-engine/api      # migrazioni e seed
```

## Modulo opzionale (UI)

L'interfaccia su `http://localhost:5173` parte insieme all'API con entrambi i comandi di avvio. È volutamente essenziale, come consente la traccia: una sola pagina, con l'elenco a sinistra e il dettaglio a destra.

- **Elenco**: filtri per job offer, canale e stato; per ogni annuncio canale, formato, luogo e stato.
- **Nuovo annuncio**:
  - si sceglie la job offer, il canale e formato, il luogo pubblicato (quello della job offer o un altro) con la sua precisione, e da 1 a 4 angle, uno per variante;
  - *Genera annuncio* chiama l'LLM e richiede qualche decina di secondi;
  - senza chiave API compare il messaggio del `503`.
- **Dettaglio**: stato con le sole transizioni ammesse, varianti (attiva o disattiva, nuova variante con il suo angle), anteprima del testo per il canale e dell'immagine.
- **Modifica del contenuto**:
  - un campo per ogni testo generato, una riga per elemento nelle liste, con il contatore sul limite del formato;
  - la validazione usa lo stesso schema del server (`packages/content`) prima dell'invio;
  - *Salva* crea una revisione manuale;
  - i `facts` (RAL, contratto, esperienza, competenze) sono dati della job offer e nella UI restano in sola lettura. L'API accetta comunque il contenuto completo.
- **Storico**: le revisioni della variante, generate o manuali, con il loro contenuto e il ripristino di una precedente.

## API

L'API risponde su `http://localhost:3000/api` (anche attraverso l'interfaccia, su `http://localhost:5173/api`). L'elenco completo degli endpoint e degli errori è in [architecture.md](architecture.md#endpoint).

Il flusso completo da terminale, con `npm run dev:demo` avviato:

```bash
# Consultare: annunci per canale e per job offer, un annuncio con varianti e contenuto corrente
curl "localhost:3000/api/ads?channel=whatsapp"
curl "localhost:3000/api/ads?job_offer_id=jo_001"
curl "localhost:3000/api/ads/1"

# Generare un annuncio con due varianti (serve la chiave): WhatsApp testo è il formato 2 di /api/channel-formats
curl -X POST "localhost:3000/api/ads" -H 'content-type: application/json' \
  -d '{"job_offer_id":"jo_001","channel_format_id":2,"variants":[{"angle":"trasferte pagate"},{"angle":"stabilità del contratto"}]}'

# Anteprima di una variante: testo, oppure la pagina HTML (da aprire nel browser)
curl "localhost:3000/api/variants/3/preview"
curl "localhost:3000/api/variants/3/preview?as=html"

# Edit manuale: si rimanda il contenuto completo, modificato (qui con jq, che va installato a parte)
curl -s "localhost:3000/api/ads/1" \
  | jq '{content: (.variants[0].current_revision.content | .text.headline = "Headline scritta a mano")}' \
  | curl -X POST "localhost:3000/api/variants/1/revisions" -H 'content-type: application/json' -d @-

# Storico e ripristino di una revisione precedente
curl "localhost:3000/api/variants/1/revisions"
curl -X PUT "localhost:3000/api/variants/1/current-revision" -H 'content-type: application/json' -d '{"revision_id":1}'

# Stato dell'annuncio e variante attiva
curl -X PATCH "localhost:3000/api/ads/1" -H 'content-type: application/json' -d '{"status":"active"}'
curl -X PATCH "localhost:3000/api/variants/2" -H 'content-type: application/json' -d '{"is_active":false}'
```

Gli errori hanno sempre la forma `{ "error": { "code", "message", "details" } }`: `400` input non valido, `404` risorsa inesistente, `409` transizione non ammessa o annuncio archiviato, `422` contenuto non valido, `502` output del modello non conforme dopo il retry, `503` provider non disponibile o chiave assente.

## Problemi comuni

- **`npm run dev` si ferma subito con un errore di porta**: la 3000 o la 5173 è occupata, spesso da un avvio precedente rimasto aperto. Chiudilo, oppure cambia `PORT` nel `.env` per l'API.
- **Avvisi `EBADENGINE` durante `npm install`, o test e interfaccia che non partono**: la versione di Node è precedente alla 22.12.
- **"chiave API assente" (`503`) quando generi**: manca `ANTHROPIC_API_KEY` nel `.env`, oppure il server non è stato riavviato dopo averla aggiunta.
- **"output del modello non conforme" (`502`)**: il modello ha sbagliato due volte di fila (di solito per la lunghezza dei testi nell'immagine). Non si salva nulla: rigenera.
- **La job offer che ho aggiunto non compare**: controlla che il file sia in `apps/api/db/seed/` e che il nome inizi con `job_offers` e finisca con `.json`; leggi gli avvisi del seed; ricarica la pagina del browser. Con `npm run dev:demo` accesa il seed va lanciato sul DB della demo ([passo 2](#2-carica-la-job-offer)).
- **Ho modificato una job offer ma non cambia nulla**: una job offer già caricata non si aggiorna dal file ([cosa fare](#modificare-o-togliere-una-job-offer-già-caricata)).
- **Nell'elenco non ci sono annunci**: hai avviato con `npm run dev`, che parte senza annunci. Per gli esempi usa `npm run dev:demo`.

## Test

```bash
npm test             # tutti i pacchetti
npm run typecheck
```

I test usano un database in memoria e un client LLM finto: non serve la chiave e non si fanno chiamate a pagamento.

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
| [architecture.md](architecture.md) | Struttura, modello dati, flusso dati, endpoint, semplificazioni |
| [prompts.md](prompts.md) | Prompt finali, iterazioni, gestione degli output non conformi, costo delle generazioni |
| [tradeoffs.md](tradeoffs.md) | Scelte, interpretazione della traccia, tempo impiegato, sacrifici, priorità |
| [ai-workflows.md](ai-workflows.md) | Come ho usato l'AI durante lo sviluppo |
