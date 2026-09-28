import type { Facts, Salary } from "@job-ads-engine/content";
import type { LocationPrecision } from "../modules/ads/types.js";
import type { LocationInput } from "../modules/locations/repository.js";

/*
 * Dati deterministici resi come testo, in it-IT. Il copy dell'LLM non li contiene:
 * li compone il renderer da `facts` e dal luogo dell'annuncio.
 */

// "always": in it-IT i numeri di 4 cifre non si raggruppano ("5000 €" invece di "5.000 €").
const numberFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0, useGrouping: "always" });
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency, maximumFractionDigits: 0, useGrouping: "always" }).format(amount);

const join = (parts: (string | null | undefined)[], separator: string) => parts.filter(Boolean).join(separator);

export function formatLocation(location: LocationInput, precision: LocationPrecision): string {
  const { street_name, street_number, postal_code, locality, province, province_code, region } = location;
  const provinceLabel = province ? `Provincia di ${province}` : region;
  const place = locality ? join([locality, province_code && `(${province_code})`], " ") : provinceLabel;

  switch (precision) {
    case "address":
      return join([join([street_name, street_number], " "), join([postal_code, place], " ")], ", ");
    case "locality":
      return place ?? "";
    case "province":
      return provinceLabel ?? "";
  }
}

/** Solo l'importo, per i campi che hanno già l'etichetta (es. il campo RAL di Indeed). */
export function formatSalaryAmount({ min, max, currency, framing }: Salary): string {
  switch (framing) {
    case "range":
      // Una RAL fissa non è un intervallo: "28.000 €", non "28.000–28.000 €".
      return min === max ? money(max!, currency) : `${numberFormat.format(min!)}–${money(max!, currency)}`;
    case "from":
      return `da ${money(min!, currency)}`;
    case "up_to":
      return `fino a ${money(max!, currency)}`;
  }
}

export const formatSalary = (salary: Salary): string => `RAL ${formatSalaryAmount(salary)}`;

export function formatExperience({ min_years, max_years }: Facts["experience"]): string | null {
  const years = (n: number) => `${n} ${n === 1 ? "anno" : "anni"}`;
  const min = min_years === 0 ? null : min_years;
  if (min !== null && max_years !== null) {
    return min === max_years ? `${years(min)} di esperienza` : `${min}–${years(max_years)} di esperienza`;
  }
  if (min !== null) return `almeno ${years(min)} di esperienza`;
  if (max_years !== null) return `fino a ${years(max_years)} di esperienza`;
  return null;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
