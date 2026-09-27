# Prompts

> 🚧 Bozza: strategia e vincoli decisi; testi dei prompt e log delle iterazioni si compilano durante lo sviluppo.

## Strategia

- **Un prompt per kind, parti per formato.** Tono e struttura dipendono dal kind (`job_board`, `messaging`, `social`). Il formato decide quali parti chiedere (`text`, `image` o entrambe). I limiti della riga di `channel_formats` entrano nel prompt e nello schema.
- **Input minimo.** L'LLM riceve solo la proiezione pubblicabile della job offer (`input_snapshot`) e l'`angle` della variante, mai la job offer intera. In più:
  - `published_location`: il luogo da mettere in primo piano;
  - `workplace`: la sede, citabile come fatto aziendale.
- **Dati separati dalle istruzioni.** Le istruzioni stanno nel prompt di sistema; i dati della job offer arrivano nel messaggio utente dentro un blocco delimitato. Il prompt dice esplicitamente che il contenuto di quel blocco è dato: eventuali istruzioni al suo interno vanno ignorate. È una difesa dalla prompt injection, perché i testi della job offer arrivano da altri sistemi.
- **Condensare, non inventare.** Il lavoro del modello è ridurre una job offer densa (7 attività, 6 requisiti) a pochi bullet per canale. Deve usare solo informazioni presenti nell'input: gli esempi della traccia contengono dettagli assenti dalla job offer (vedi `tradeoffs.md`) e il sistema non deve riprodurli.
- **Dati fuori dall'LLM.** RAL, contratto, esperienza, competenze e luogo non li scrive il modello. Per la RAL sceglie solo il `framing` (`range`, `from`, `up_to`), coerente con l'angle; i numeri li formatta il codice.
- **Versionamento.** Ogni prompt ha una `prompt_version`, salvata sulla revisione generata.

## Come vincolo l'output

- **Uno schema, una fonte.** `llmOutputSchemaFor(kind, formato, specs)` è lo schema Zod dell'output. `z.toJSONSchema()` lo converte in JSON Schema con lunghezze, numero di elementi, campi obbligatori e `additionalProperties: false`.
- **Tool use forzato.** Il JSON Schema diventa l'`input_schema` di un tool, e il modello è obbligato a chiamarlo. `TODO`: confermare in implementazione.
- **Vincoli non esprimibili in JSON Schema**, verificati dopo:
  - il testo evidenziato della creative deve stare nel titolo (refine Zod);
  - nessuna cifra della RAL nel testo libero (`findSalaryLeaks`).

## Cosa succede quando la risposta non è conforme

Due famiglie di problemi, gestite in modo diverso:

**Output non conforme** (il modello ha risposto, ma male):
1. JSON non parsabile, validazione Zod fallita o cifra della RAL nel testo → **un retry**, passando al modello l'elenco degli errori con il percorso del campo (es. `image.hook: max 30 caratteri`).
2. Secondo fallimento → `GenerationFailedError`, risposta `502` con il dettaglio degli errori.
3. Framing della RAL incompatibile con i dati (es. `range` senza RAL massima) → non è un errore: `buildFacts` ripiega su un framing valido.

**Provider non disponibile** (il modello non ha risposto):
- Chiave assente, errore di rete, timeout (`LLM_TIMEOUT_SECONDS`), rate limit o errore del provider → `ProviderUnavailableError`, risposta `503`.
- I retry di rete li gestisce il SDK; il nostro retry riguarda solo il contenuto.
- Il messaggio d'errore non espone credenziali né dettagli interni del provider.

In entrambi i casi non si salva nulla: annuncio, variante e revisione nascono insieme o non nascono.

## Prompt finali

### `job_board`
`TODO`

### `messaging`
`TODO`

### `social`
`TODO`

## Iterazioni

Da compilare mentre si lavora, non a posteriori.

| Versione | Kind | Problema osservato | Modifica |
|---|---|---|---|
| | | | |
