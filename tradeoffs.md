# Tradeoffs

> 🚧 Bozza: decisioni prese finora; tempi, limiti e priorità si completano a fine sviluppo.

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

La traccia chiede di non superare le quattro ore e mezza complessive. Le ho superate, e lo dichiaro. Tempo effettivo: `TODO`.

Distinguo il lavoro che serviva a rispettare la traccia da quello fatto oltre, per scelta.

**Necessario: il modulo obbligatorio.** È la parte che avrebbe dovuto stare nelle quattro ore e mezza.
- Modello dati con la gerarchia job offer → annuncio → variante → revisione, vincoli nel DB e seed della job offer della traccia.
- Contratto del contenuto per kind e formato, usato sia per l'output dell'LLM sia per gli edit manuali.
- API: annunci interrogabili per job offer e canale, generazione di annunci e varianti, edit manuale come nuova revisione, stato dell'annuncio.
- Generazione con output strutturato, validazione, un retry con gli errori, guardrail sulla RAL ed errori distinti per provider non disponibile e output non conforme.
- Rendering essenziale: testo per canale e un template HTML per i formati con immagine.
- Un DB già popolato con annunci generati davvero, e i documenti richiesti.

**Facoltativo: fatto oltre il tempo.**
- **L'affinamento dei prompt per la coerenza del copy.** Nove giri di generazione reale, circa 150 chiamate, dalla v2 alla v10. Un solo giro avrebbe dato annunci validi per lo schema, ma con errori che un recruiter deve correggere a mano:
  - qualifiche dell'azienda sbagliate;
  - giudizi assenti dalla job offer;
  - frasi costruite per contrasto con altri lavori;
  - testi troppo lunghi per le creative.

  È la parte che ha preso più tempo. L'ho considerata la più utile, perché la qualità del copy è un criterio di valutazione.
- **I guardrail di tono** (contrapposizioni, emoji, età) e i **limiti morbidi** delle creative, con il font ridotto dal renderer.
- **Quattro job offer fittizie** per i casi che `jo_001` non copre: RAL parziale o assente, apprendistato, dati scarni, un tentativo di prompt injection.
- **La UI**, che la traccia indica come modulo opzionale.

**Compromessi fatti per contenere i tempi**, che restano anche nella versione consegnata:
- un solo template HTML per kind, che si adatta alle proporzioni, invece di uno per formato;
- UI minimale: una pagina, niente router né componenti grafici, un modulo di edit generato dallo schema invece di moduli su misura per canale;
- test della UI solo sulla logica pura (client, modulo di edit, creazione); i componenti li ho verificati a mano;
- negli esempi manca Instagram 4:5: ho scelto di non fare un altro giro di prompt per quel solo formato;
- due giudizi non supportati corretti con l'edit manuale invece che con un altro giro;
- nessun export PNG delle creative, nessuna pubblicazione reale sui canali, nessuna autenticazione.

## Cosa ho sacrificato

- **UI volutamente minimale**, come consente la traccia: il tempo va alla generazione reale e alla verifica del copy, che sono criteri di valutazione.
- `TODO`

## Limiti tecnici

- I limiti di default sono scelte editoriali ragionevoli, non limiti delle piattaforme verificati.
- Il guardrail RAL riconosce solo le cifre esatte; formulazioni come "da 32 a 38 mila" possono sfuggire in parte.
- Il guardrail di tono (contrapposizioni, emoji, età) è euristico: riconosce strutture, non il significato, e può bloccare una precisazione legittima; il costo è un retry.
- La regola sulla fedeltà ai dati riduce i giudizi non supportati ("in continua espansione") ma non li azzera: la revisione umana, con l'edit manuale, resta necessaria prima della pubblicazione.
- I testi dentro le creative hanno limiti stretti: alcuni angle portano il modello oltre il massimo anche dopo il retry (Instagram 4:5 negli esempi). I limiti morbidi e il font adattato riducono il problema, non lo eliminano.
- La separazione tra dati e istruzioni riduce il rischio di prompt injection ma non lo elimina. L'output resta vincolato dallo schema e va comunque rivisto da una persona prima della pubblicazione.
- `TODO`

## Con un giorno in più (in ordine di priorità)

`TODO`: da ordinare a fine lavoro. Candidati raccolti finora:

- Export PNG delle creative (HTML → immagine).
- Libreria di asset per risolvere `visual_brief` in una foto, e logo aziendale nei dati.
- Verifica di tutti i numeri del testo generato contro l'input (grounding numerico), oltre alla sola RAL.
- Log dei tentativi di generazione falliti.
- `parent_revision_id` per sapere da quale revisione nasce un edit manuale.
- Storico dei cambi di stato.
- Metriche per variante, per chiudere il ciclo dell'A/B test.
