# Tradeoffs

## Linguaggio e struttura

- **Monorepo con npm workspaces.** Backend e frontend condividono il contratto del contenuto (`packages/content`) invece di duplicarlo, con una sola installazione e un solo comando di avvio. Niente Turborepo o Nx: con tre pacchetti aggiungerebbero configurazione senza beneficio.
- **TypeScript + Fastify.** È lo stack su cui sono più rapido. Fastify è leggero e ha validazione degli schemi nativa.
- **React + Vite per la UI.** È il mio stack principale, quindi il più rapido anche per un'interfaccia minima. Il costo è un secondo processo in sviluppo, assorbito da `npm run dev`, che avvia tutto, e dal proxy di Vite verso l'API.
- **Zod.** Uno schema per kind e formato fa da contratto per cinque usi: output dell'LLM (convertito in JSON Schema), edit manuali lato server, validazione degli edit nella UI, rendering, tipi TypeScript.
- **SQLite.** Zero setup e un file consegnabile già popolato. Le funzioni JSON native coprono il contenuto variabile per canale. Il limite sulla concorrenza in scrittura è irrilevante in questo contesto.
- **better-sqlite3 invece di sqlite3.** È sincrono, quindi transazioni semplici: creare revisione e aggiornare il puntatore deve essere atomico.
- **better-sqlite3 fermo alla 12.x.** Con la 13, un'installazione da lockfile (`npm install` o `npm ci` su una repo clonata) compila il modulo da sorgente e richiede un compilatore C++. La 12 scarica binari precompilati, quindi l'avvio funziona anche su macchine senza toolchain.
- **Vincoli nel DB, non solo nel codice.** FK, CHECK e trigger rendono impossibili gli stati incoerenti anche se un bug li lascia passare lato applicazione.
- **Contenuto in JSON, non in tabelle per canale.** Una tabella per canale moltiplicherebbe schema e migrazioni a ogni canale nuovo. Il costo è che la forma del contenuto la garantisce l'applicazione, non il DB.

## Come ho interpretato le parti ambigue

1. **Annuncio e variante.** L'annuncio definisce dove e come esce la job offer (canale, formato, luogo, stato). La variante definisce cosa contiene: una composizione diversa del contenuto, orientata da un `angle`, per l'A/B test. L'alternativa (varianti come annunci fratelli) appiattiva il modello, ma perdeva il raggruppamento necessario a confrontare le varianti tra loro.
2. **"Sovrascrivere il contenuto generato".** Non sovrascrivo mai: ogni modifica è una nuova revisione, e la precedente resta consultabile. Distruggere l'output dell'LLM impedirebbe di valutare la qualità dei prompt.
3. **Luoghi diversi dalla job offer.** Il luogo dell'annuncio è quello mostrato (il chip 📍 del foglio WhatsApp), con un livello di precisione. Uso un luogo per annuncio, come richiedono le job board: più aree significano più annunci. Nel copy il modello mette in primo piano il luogo dell'annuncio e può citare la sede come fatto aziendale, senza contraddizioni.
4. **Formati con immagine.** L'LLM genera i campi testuali, un template HTML li impagina. Non genero immagini con AI né faccio generare HTML all'LLM: layout coerente, nessun markup rotto, e un cambio di grafica non richiede rigenerazioni. La foto è descritta (`visual_brief`), non generata: nelle creative d'esempio è una foto reale di un tecnico, non un'illustrazione.
5. **Cosa è pubblicabile.** La job offer non contiene segreti evidenti: il problema è la densità. La proiezione esclude i metadati interni e riduce l'indirizzo alla località. Il resto è compito del prompt, cioè condensare scegliendo le informazioni che attraggono per quel canale e quell'angle.
6. **Stati.** `draft`, `active`, `closed`, `archived` sull'annuncio. Un annuncio chiuso si può riattivare (una ricerca che riparte), uno attivo va chiuso prima di essere archiviato, e `archived` è terminale. Le varianti si accendono e si spengono con un flag. Contenuto e stato sono indipendenti, con un'eccezione: un annuncio archiviato è in sola lettura, perché "archiviato" deve voler dire che nessuno lo tocca più.
7. **Luogo di default e precisione.** Se la richiesta non indica un luogo, l'annuncio usa quello della job offer. La precisione di default dipende dal canale: indirizzo completo per le job board, che lo richiedono, località per gli altri. Al modello arriva comunque al massimo la località.
8. **Ripristino di una revisione.** Sposta il puntatore su una revisione esistente invece di copiarla in una nuova: niente contenuti duplicati, e una revisione generata resta tracciabile come `llm`. Il costo è che lo storico non registra quando è avvenuto il ripristino.
9. **Le trappole negli esempi.** Gli annunci d'esempio contengono informazioni che la job offer non supporta:
   - "RAL iniziale da €38'000", mentre il minimo è 32.000;
   - una crescita professionale mai citata, e descritta in due modi diversi su Indeed e su WhatsApp;
   - "trasferte di 2/3 giorni", dove la job offer dice "più giorni".

   Le leggo come conoscenza dell'account manager o come errori di copia-incolla. In entrambi i casi il sistema non deve riprodurle. Per questo:
   - la RAL passa solo da `facts`;
   - un guardrail blocca le sue cifre nel testo libero;
   - il prompt vieta informazioni assenti dall'input;
   - un dettaglio legittimo ma non presente nei dati resta possibile con l'edit manuale.
10. **Il formato decide le parti, il kind la loro forma.** Dagli esempi emerge che il foglio WhatsApp contiene lo stesso corpo di Indeed, più intestazione ed etichette. Invece di uno schema per canale, compongo blocchi riusabili.
11. **Proporzioni.** 1:1, 4:5 e 9:16 cambiano layout e limiti (override in `specs`), non la forma del contenuto: una sola `Creative` e un solo template HTML che si adatta alle dimensioni. Template distinti per proporzione sarebbero più curati, ma la priorità va alla generazione.

## Cosa ho scartato strada facendo

- **Cifre della RAL nel copy tramite un segnaposto `{RAL}`.** Provato nel giro v9: il modello lo usava anche fuori contesto, raddoppiava il prefisso ("da da 26.000 €") e ripeteva la RAL già mostrata. Ritirato: la RAL resta composta solo dal renderer.
- **Un endpoint per modificare singoli campi.** Valutato per l'edit manuale; l'edit a contenuto completo, copiato dalla lettura e reinviato, si è rivelato sufficiente.

## Tempo: cosa era necessario e cosa no

La traccia chiede di non superare le quattro ore e mezza complessive. Il lavoro ha richiesto **circa 5 ore**:
- circa 1 ora di analisi della traccia e modellazione;
- circa mezz'ora per definire le conoscenze di progetto per Claude Code (`CLAUDE.md`: principi, piano a step, regole git);
- circa 3 ore e mezza di implementazione di tutti gli step.

Il tempo in più è andato soprattutto ad **affinare i prompt**, per una generazione di buona qualità, e a **validare appieno il modello** su casi diversi. Le generazioni reali sono costate in tutto circa 2,50 $, per circa 180 chiamate ([dettaglio in prompts.md](prompts.md#i-giri-di-generazione-reale)).

**Per stare nelle quattro ore e mezza rinuncerei alla UI e ai giri di affinamento dei prompt dalla v3 in poi.** Modello dati e struttura sono validi e funzionanti già con il prompt v2, alla fine dello step 9: quella versione genera annunci validi per lo schema, con RAL, luogo e dati deterministici corretti; gli affinamenti successivi migliorano la qualità del copy, non la correttezza del sistema.

**Necessario: il modulo obbligatorio.**
- Modello dati con la gerarchia job offer → annuncio → variante → revisione, vincoli nel DB e seed della job offer della traccia.
- Contratto del contenuto per kind e formato, usato sia per l'output dell'LLM sia per gli edit manuali.
- API: annunci interrogabili per job offer e canale, generazione di annunci e varianti, edit manuale come nuova revisione, stato dell'annuncio.
- Generazione con output strutturato, validazione, un retry con gli errori, guardrail sulla RAL ed errori distinti per provider non disponibile e output non conforme.
- Rendering essenziale: testo per canale e un template HTML per i formati con immagine.
- Un DB con annunci generati davvero, e i documenti richiesti.

**Facoltativo: fatto oltre il tempo.**
- **L'affinamento dei prompt per la coerenza del copy.** Undici giri di generazione reale, dalla v2 alla v11. Un solo giro avrebbe dato annunci validi per lo schema, ma con errori che un recruiter deve correggere a mano:
  - qualifiche dell'azienda sbagliate;
  - giudizi assenti dalla job offer;
  - frasi costruite per contrasto con altri lavori;
  - testi troppo lunghi per le creative, fino all'analisi della causa nella v11.

  È la parte che ha preso più tempo. L'ho considerata la più utile, perché la qualità del copy è un criterio di valutazione.
- **I guardrail di tono** (contrapposizioni, emoji, età) e i **limiti morbidi** delle creative, con il font ridotto dal renderer.
- **Nove job offer fittizie** per i casi che `jo_001` non copre: RAL parziale o assente, apprendistato, dati scarni, un tentativo di prompt injection, part-time, ruolo senior, descrizione lunga, nessuna esperienza, sedi al Centro-Sud.
- **La UI**, che la traccia indica come modulo opzionale.

**Compromessi fatti per contenere i tempi**, che restano anche nella versione consegnata:
- un solo template HTML per kind, che si adatta alle proporzioni, invece di uno per formato;
- UI minimale: una pagina, niente router né componenti grafici, un modulo di edit generato dallo schema invece di moduli su misura per canale;
- test della UI solo sulla logica pura (client, modulo di edit, creazione); i componenti li ho verificati nel browser;
- tre giudizi non supportati e una contrapposizione corretti con l'edit manuale invece che con altri giri di prompt;
- nessun export PNG delle creative, nessuna pubblicazione reale sui canali, nessuna autenticazione.

## Cosa ho sacrificato

- **UI volutamente minimale**, come consente la traccia: il tempo va alla generazione reale e alla verifica del copy, che sono criteri di valutazione.
- **Un template per proporzione**: 1:1, 4:5 e 9:16 condividono un layout che si adatta, meno curato di tre layout dedicati.
- **Foto e loghi**: la creative mostra la descrizione della foto da scegliere e un segnaposto per i loghi, non immagini reali.
- **Test dei componenti della UI**: richiederebbero `jsdom` e Testing Library; sono testati il client, il modulo di edit e la creazione.
- **Storico completo delle azioni**: si conservano le revisioni del contenuto, non i cambi di stato né i ripristini.

## Limiti tecnici

- I limiti di default sono scelte editoriali ragionevoli, non limiti delle piattaforme verificati.
- Il guardrail RAL riconosce solo le cifre esatte; formulazioni come "da 32 a 38 mila" possono sfuggire in parte.
- Il guardrail di tono (contrapposizioni, emoji, età) è euristico: riconosce strutture, non il significato, e può bloccare una precisazione legittima; il costo è un retry.
- La regola sulla fedeltà ai dati riduce i giudizi non supportati ("in continua espansione", "cresci in…") ma non li azzera: la revisione umana, con l'edit manuale, resta necessaria prima della pubblicazione.
- I testi dentro le creative hanno limiti stretti: con la v11 il retry li riporta nel limite, ma il primo tentativo sfora ancora spesso. Se anche il retry fallisce l'utente riceve un `502` e rigenera.
- La separazione tra dati e istruzioni riduce il rischio di prompt injection ma non lo elimina. L'output resta vincolato dallo schema e va comunque rivisto da una persona prima della pubblicazione.
- Le varianti di un annuncio si generano in parallelo: se una fallisce non si salva nulla, ma la chiamata dell'altra è già stata pagata.
- Il ripristino sposta il puntatore su una revisione esistente: lo storico non registra quando è avvenuto.
- SQLite con un solo processo che scrive: adatto a questo servizio, non a più istanze dell'API.

## Con un giorno in più (in ordine di priorità)

1. **Verifica di tutti i numeri** del testo generato contro l'input (grounding numerico), oltre alla sola RAL.
2. **Export PNG delle creative** (HTML → immagine), per pubblicarle davvero.
3. **Libreria di asset** per risolvere `visual_brief` in una foto, e logo aziendale nei dati.
4. **Metriche per variante**, per chiudere il ciclo dell'A/B test.
5. **Log dei tentativi di generazione falliti**, oggi visibili solo nel registro dello script degli esempi.
6. **`parent_revision_id` e storico dei cambi di stato**, per sapere da quale revisione nasce un edit e chi ha cambiato cosa.
7. **Un template per proporzione** per le creative.
