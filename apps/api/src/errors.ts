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
