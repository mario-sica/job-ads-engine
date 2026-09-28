import { describe, expect, it } from "vitest";
import { InvalidTransitionError, NotFoundError } from "../src/errors.js";

describe("errori di dominio", () => {
  it("NotFoundError porta entità e id", () => {
    const err = new NotFoundError("ad", 7);
    expect(err).toBeInstanceOf(Error);
    expect(err).toMatchObject({ name: "NotFoundError", entity: "ad", id: 7, message: "ad 7 non trovato" });
  });

  it("InvalidTransitionError porta gli stati coinvolti", () => {
    const err = new InvalidTransitionError("archived", "active");
    expect(err).toMatchObject({ name: "InvalidTransitionError", from: "archived", to: "active" });
    expect(err.message).toContain("archived → active");
  });
});
