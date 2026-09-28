# AI workflows

## Flusso

### Fase 1: analisi della traccia e modellazione

- **Strumento**: Claude (chat).
- **Uso**: sparring partner. Gli ho fatto estrarre dalla traccia le decisioni di modellazione da prendere; ho valutato le proposte e preso le decisioni finali. Esempio: la proposta iniziale trattava le varianti come annunci fratelli. Ho scelto invece la gerarchia annuncio → variante → revisione, che rispecchia meglio il dominio.
- **Analisi degli esempi**: con Claude ho confrontato gli annunci d'esempio (Indeed, immagine WhatsApp, creative social) con la job offer. È emerso che:
  - il corpo del foglio WhatsApp coincide con Indeed, da cui nasce il blocco condiviso;
  - gli esempi contengono informazioni non supportate dai dati (vedi `tradeoffs.md`).
- **Output**: schema SQL generato sullo schema concordato e verificato con test sui vincoli (DB in memoria), più la bozza dei documenti.

### Fase 2: implementazione

- **Contratto del contenuto** (`packages/content`): generato da Claude sul design concordato (composizione kind × formato, facts deterministici, limiti in `specs`), poi estratto in un pacchetto condiviso quando il progetto è diventato un monorepo.
- **Verifica**: typecheck strict e test automatici su tutte le combinazioni seedate, sui limiti per riga, sui vincoli dei blocchi e sul guardrail RAL.
- **Da qui in poi: Claude Code**, guidato dalle regole di progetto in `CLAUDE.md`:
  - un piano a step;
  - un branch per step, con merge su `dev` solo dopo la mia approvazione;
  - commit piccoli e test verdi prima di ogni merge.
- **Backend, LLM e renderer**: uno step per volta, ciascuno con un piano presentato prima del codice (file, scelte, dubbi) e approvato da me. Le decisioni non coperte dai documenti le ho prese io su proposta di Claude Code. Alcuni esempi:
  - le transizioni di stato;
  - il formato unico degli errori;
  - Sonnet come modello;
  - titoli e sezioni del foglio A4 come negli esempi della traccia.
- **Verifica a ogni step**: test su DB in memoria e con un client LLM finto, typecheck strict, poi un riepilogo prima di ogni merge. I bug trovati in revisione sono diventati test. Un esempio: la RAL scritta a mano nel copy, che ha portato al guardrail.

### Fase 3: prompt engineering

- **Generazione reale, non prompt scritti "a tavolino".** Uno script genera gli annunci d'esempio con l'API vera, attraverso lo stesso service dell'API, e un registro dei tentativi mostra per ogni chiamata latenza e, nei retry, gli errori mandati al modello. Undici giri, circa 180 chiamate e circa 2,50 $ in tutto, dal prompt v2 al v11, su `jo_001` e su nove job offer fittizie scritte per mettere alla prova casi diversi (RAL parziale o assente, apprendistato, dati scarni, un tentativo di prompt injection, part-time, ruolo senior, descrizione lunga, nessuna esperienza). Dettaglio in [prompts.md](prompts.md#iterazioni).
- **Revisione a due livelli.** Dopo ogni giro Claude Code rendeva i testi e faceva gli screenshot delle creative (Firefox headless), con le sue osservazioni; io decidevo cosa era un problema e come correggerlo.
- **Cosa ha trovato l'AI:** lunghezze oltre i limiti, il contratto ripetuto nei bullet, aggettivi non supportati dai dati ("in crescita"), tempi verbali incoerenti, il difetto di impaginazione di "MT/BT".
- **Cosa ha trovato solo la revisione umana:** il tono. Frasi come "grandi impianti, non tetti" o "le trasferte qui sono gestite bene, non a caso" valorizzano l'offerta sminuendo altre categorie. Claude le aveva segnalate come "caso limite accettabile"; per me erano poco professionali e discriminatorie. Anche due degli angle d'esempio scelti da Claude erano costruiti per contrapposizione.
- **Cosa non ha funzionato al primo colpo:** la prima regola di tono citava le frasi vietate come esempi, e il modello le ha riprodotte quasi identiche. La soluzione è stata doppia: regola riscritta in positivo, senza esempi testuali, e un controllo deterministico sull'output (come quello sulla RAL), perché un divieto affidato solo al prompt non dà garanzie.
- **Verificare prima di correggere.** Quando nel giro 6 una headline ha scritto "leader nel fotovoltaico" per un'azienda leader in cogenerazione, biogas e rinnovabili, ho chiesto di verificare che l'errore non fosse nella lettura dell'AI. Claude Code ha ricostruito la richiesta esatta dall'`input_snapshot` salvato sulla revisione: l'errore era reale, e il meccanismo (il dominio del ruolo entrato nella qualifica dell'azienda) ha guidato la regola. L'esempio nel prompt l'ho voluto astratto, con lettere, perché uno reale avrebbe suggerito la risposta proprio al caso di prova.
- **Le linee guida non bastano da sole.** Su mia richiesta Claude Code ha rivisto il prompt sulla guida Anthropic alla scrittura dei prompt (regole in prosa con il loro perché, contesto su chi legge, niente nomi di strumenti nel prompt di sistema). Il copy è diventato più naturale, ma sono tornati due problemi già risolti, perché con la riscrittura erano spariti gli esempi di singole parole da evitare. Ogni modifica al prompt va verificata sulla generazione reale, non solo sul testo.
- **Una modifica ritirata.** Ho chiesto le cifre della RAL anche nel copy quando l'angle parla di retribuzione; Claude Code ha segnalato che contraddiceva un principio del progetto e proposto un segnaposto `{RAL}` riempito dai dati. Nel giro successivo il modello lo usava ovunque e raddoppiava il prefisso ("da da 26.000 €"): ho deciso il rollback, fatto con `git revert` per lasciarlo nella storia.
- **Cercare la causa, non correggere il sintomo.** Dopo dieci giri gli stessi formati fallivano ancora per lunghezza. Ho chiesto di smettere di ritoccare il prompt caso per caso e di trovare la causa. Claude Code ha analizzato i registri di tutti i giri (164 chiamate). Le proporzioni non c'entravano. Il modello univa due informazioni in un campo da una e, nel retry, tagliava una parola o rimandava lo stesso testo, perché non sa contare i caratteri. Con i limiti espressi in parole e un retry che chiede di riscrivere (v11), il giro di verifica non ha avuto fallimenti.
- **Decisioni mie, non dell'AI:** niente emoji in nessun punto; attività alla seconda persona; titoli come nome semplice del ruolo; limiti morbidi con font adattato invece di far fallire testi di poco più lunghi; azienda e ruolo distinti con un esempio astratto; nessun controllo sull'età nella descrizione della foto; rollback del segnaposto `{RAL}`; lasciare fuori dai dati d'esempio l'annuncio Instagram 4:5, che fallisce quasi sempre per lunghezza; nessuna formulazione inclusiva per ora (non richiesta dalla traccia); i fallimenti per lunghezza affrontati alla radice invece che formato per formato.

### Fase 4: interfaccia

- **UI minimale su richiesta esplicita della traccia** ("brutta e scrappy"): una pagina React con elenco, creazione, dettaglio, anteprima, edit e storico. Il modulo di edit lo genera lo schema del contenuto condiviso: nessun codice per canale.
- **Verifica nel browser**: Claude Code ha pilotato Firefox headless (WebDriver BiDi) su una copia del DB. Ha controllato elenco e filtri, un edit non valido e uno valido, il ripristino e la generazione senza chiave (503). Ne sono usciti due difetti: gli errori 400 non spiegavano la causa, e l'elenco diceva "nessun annuncio" mentre caricava.
- **DB di lavoro separato dalla demo**: le prove locali modificavano il DB versionato (un annuncio è finito archiviato per sbaglio). Ora si parte da un DB pulito, e gli esempi stanno in `demo_db/`: si aprono sempre su una copia.

## Strumenti

| Strumento | Per cosa | Perché |
|---|---|---|
| Claude (chat) | Analisi traccia ed esempi, modellazione, codice del contratto del contenuto, bozze documenti | Confronto rapido sulle scelte di design; generazione di codice su decisioni già prese |
| Claude Code + `CLAUDE.md` | Implementazione step per step | Regole di progetto versionate: struttura, principi di design e workflow git restano coerenti tra sessioni |
| Claude API (`claude-sonnet-5`) | Generazione degli annunci nel prodotto e degli esempi | Scelto dallo sviluppatore; accetta il tool use forzato su cui si basa la validazione dell'output |
| Firefox headless | Anteprime delle creative dopo ogni giro di generazione; verifica della UI | Vedere il risultato reale, non solo il JSON, senza dipendenze aggiuntive nel progetto |

## Cosa ho verificato a mano

- Ogni giro di generazione reale: testi resi e anteprime HTML, prima di decidere le correzioni al prompt.
- L'errore sulle qualifiche dell'azienda, confrontando l'output con l'`input_snapshot` salvato e con la richiesta ricostruita.
- L'edit manuale, provato da me via API: leggere il contenuto, modificarlo, reinviarlo; e i vincoli dello schema (per esempio un minimo che non può superare il massimo).
- Il flusso completo dalla UI e l'avvio da un clone pulito del repository (`npm install`, `npm run dev` e `npm run dev:demo`), prima della consegna.
