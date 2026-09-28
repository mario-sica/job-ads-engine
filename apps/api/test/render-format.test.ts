import type { Salary } from "@job-ads-engine/content";
import { describe, expect, it } from "vitest";
import type { LocationInput } from "../src/modules/locations/repository.js";
import { escapeHtml, formatExperience, formatLocation, formatSalary } from "../src/render/format.js";

// Intl separa cifra e simbolo con uno spazio indivisibile: nei test lo si confronta come spazio normale.
const plain = (s: string | null) => s?.replace(/ /g, " ") ?? null;

const ORZINUOVI: LocationInput = {
  street_name: "Via Artigianato",
  street_number: "27",
  postal_code: "25034",
  locality: "Orzinuovi",
  province: "Brescia",
  province_code: "BS",
  region: "Lombardia",
  country_code: "IT",
};

describe("formatLocation", () => {
  it.each([
    ["address", "Via Artigianato 27, 25034 Orzinuovi (BS)"],
    ["locality", "Orzinuovi (BS)"],
    ["province", "Provincia di Brescia"],
  ] as const)("%s → %s", (precision, expected) => {
    expect(formatLocation(ORZINUOVI, precision)).toBe(expected);
  });

  it("degrada quando mancano dei campi", () => {
    expect(formatLocation({ ...ORZINUOVI, street_number: null, postal_code: null }, "address")).toBe("Via Artigianato, Orzinuovi (BS)");
    expect(formatLocation({ ...ORZINUOVI, province_code: null }, "locality")).toBe("Orzinuovi");
    expect(formatLocation({ ...ORZINUOVI, locality: null }, "locality")).toBe("Provincia di Brescia");
    expect(formatLocation({ ...ORZINUOVI, province: null }, "province")).toBe("Lombardia");
  });
});

describe("formatSalary", () => {
  const salary = (framing: Salary["framing"], currency = "EUR"): Salary => ({ min: 32000, max: 38000, currency, framing });

  it.each([
    ["range", "RAL 32.000–38.000 €"],
    ["from", "RAL da 32.000 €"],
    ["up_to", "RAL fino a 38.000 €"],
  ] as const)("%s → %s", (framing, expected) => {
    expect(plain(formatSalary(salary(framing)))).toBe(expected);
  });

  it("una RAL fissa si scrive come un solo importo", () => {
    expect(plain(formatSalary({ min: 28000, max: 28000, currency: "EUR", framing: "range" }))).toBe("RAL 28.000 €");
  });

  it("raggruppa anche le cifre a 4 cifre e usa la valuta dei facts", () => {
    expect(plain(formatSalary({ min: 5000, max: null, currency: "EUR", framing: "from" }))).toBe("RAL da 5.000 €");
    expect(plain(formatSalary(salary("up_to", "USD")))).toBe("RAL fino a 38.000 USD");
  });
});

describe("formatExperience", () => {
  it.each([
    [3, 5, "3–5 anni di esperienza"],
    [3, 3, "3 anni di esperienza"],
    [3, null, "almeno 3 anni di esperienza"],
    [1, null, "almeno 1 anno di esperienza"],
    [null, 5, "fino a 5 anni di esperienza"],
    [0, 2, "fino a 2 anni di esperienza"],
    [null, null, null],
  ])("%s–%s → %s", (min_years, max_years, expected) => {
    expect(formatExperience({ min_years, max_years })).toBe(expected);
  });
});

describe("escapeHtml", () => {
  it("escapa i caratteri speciali", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });
});
