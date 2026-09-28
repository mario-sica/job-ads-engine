export const KINDS = ["job_board", "messaging", "social"] as const;
export type Kind = (typeof KINDS)[number];

export const FORMATS = ["text", "image", "image_text"] as const;
export type Format = (typeof FORMATS)[number];

/** Le parti di cui è composto un contenuto. Il formato decide quali sono presenti. */
export type Part = "text" | "image";

export const PARTS_BY_FORMAT: Record<Format, readonly Part[]> = {
  text: ["text"],
  image: ["image"],
  image_text: ["text", "image"],
};

export class UnsupportedFormatError extends Error {
  constructor(kind: Kind, part: Part) {
    super(`Il kind "${kind}" non prevede una parte "${part}"`);
    this.name = "UnsupportedFormatError";
  }
}

export class InvalidSpecsError extends Error {
  constructor(message: string) {
    super(`specs non valide: ${message}`);
    this.name = "InvalidSpecsError";
  }
}
