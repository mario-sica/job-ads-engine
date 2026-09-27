# AI workflows

> 🚧 Bozza: aggiornato fase per fase durante lo sviluppo.

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
- `TODO`: backend, LLM, renderer.

### Fase 3: prompt engineering

`TODO`

## Strumenti

| Strumento | Per cosa | Perché |
|---|---|---|
| Claude (chat) | Analisi traccia ed esempi, modellazione, codice del contratto del contenuto, bozze documenti | Confronto rapido sulle scelte di design; generazione di codice su decisioni già prese |
| Claude Code + `CLAUDE.md` | Implementazione step per step | Regole di progetto versionate: struttura, principi di design e workflow git restano coerenti tra sessioni |
| `TODO` | | |

## Cosa ho verificato a mano

`TODO`
