/** Risorsa inesistente. */
export class NotFoundError extends Error {
  readonly entity: string;
  readonly id: string | number;

  constructor(entity: string, id: string | number) {
    super(`${entity} ${id} non trovato`);
    this.name = "NotFoundError";
    this.entity = entity;
    this.id = id;
  }
}

/** Un campo da correggere, con il suo percorso (es. `image.hook`). */
export interface Issue {
  path: string;
  message: string;
}

/** Contenuto di un edit manuale non valido per il formato dell'annuncio. */
export class InvalidContentError extends Error {
  readonly issues: Issue[];

  constructor(issues: Issue[]) {
    super("contenuto non valido per il formato dell'annuncio");
    this.name = "InvalidContentError";
    this.issues = issues;
  }
}

/** Un annuncio archiviato è in sola lettura. */
export class AdArchivedError extends Error {
  readonly adId: number;

  constructor(adId: number) {
    super(`l'annuncio ${adId} è archiviato: non si può modificare`);
    this.name = "AdArchivedError";
    this.adId = adId;
  }
}

/** Cambio di stato non ammesso dal ciclo di vita dell'annuncio. */
export class InvalidTransitionError extends Error {
  readonly from: string;
  readonly to: string;

  constructor(from: string, to: string) {
    super(`transizione di stato non ammessa: ${from} → ${to}`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.to = to;
  }
}
