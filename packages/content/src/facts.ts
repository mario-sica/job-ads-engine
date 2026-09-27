import { z } from "zod";

/*
 * I facts sono dati, non copy: si copiano dalla job offer, non li genera l'LLM.
 * L'unica scelta lasciata al modello è COME presentare la RAL (`framing`),
 * mai i numeri.
 */

export const SALARY_FRAMINGS = ["range", "from", "up_to"] as const;
export type SalaryFraming = (typeof SALARY_FRAMINGS)[number];

const years = z.number().int().min(0).nullable();
const amount = z.number().int().positive().nullable();

export const salarySchema = z
  .object({
    min: amount,
    max: amount,
    currency: z.string().length(3),
    framing: z.enum(SALARY_FRAMINGS),
  })
  .refine((s) => s.min === null || s.max === null || s.min <= s.max, {
    message: "min supera max",
    path: ["min"],
  })
  .refine(
    (s) =>
      (s.framing === "range" && s.min !== null && s.max !== null) ||
      (s.framing === "from" && s.min !== null) ||
      (s.framing === "up_to" && s.max !== null),
    { message: "framing incompatibile con i valori disponibili", path: ["framing"] },
  );
export type Salary = z.infer<typeof salarySchema>;

export const factsSchema = z.object({
  company_name: z.string().trim().min(1),
  contract_type: z.string().trim().min(1).nullable(),
  experience: z
    .object({ min_years: years, max_years: years })
    .refine((e) => e.min_years === null || e.max_years === null || e.min_years <= e.max_years, {
      message: "min_years supera max_years",
      path: ["min_years"],
    }),
  salary: salarySchema.nullable(),
  skills: z.array(z.string().trim().min(1)),
});
export type Facts = z.infer<typeof factsSchema>;

/** I campi della job offer da cui nascono i facts. */
export interface FactsSource {
  company_name: string;
  contract_type: string | null;
  min_exp_years: number | null;
  max_exp_years: number | null;
  ral_min: number | null;
  ral_max: number | null;
  currency: string | null;
  required_skills: string[];
}

/** Framing di ripiego quando quello richiesto non è compatibile con i dati. */
function fallbackFraming(min: number | null, max: number | null): SalaryFraming {
  if (min !== null && max !== null) return "range";
  return min !== null ? "from" : "up_to";
}

export function buildFacts(src: FactsSource, framing: SalaryFraming | null): Facts {
  const hasSalary = src.currency !== null && (src.ral_min !== null || src.ral_max !== null);
  const compatible =
    framing === "range" ? src.ral_min !== null && src.ral_max !== null
    : framing === "from" ? src.ral_min !== null
    : framing === "up_to" ? src.ral_max !== null
    : false;

  return factsSchema.parse({
    company_name: src.company_name,
    contract_type: src.contract_type,
    experience: { min_years: src.min_exp_years, max_years: src.max_exp_years },
    salary: hasSalary
      ? {
          min: src.ral_min,
          max: src.ral_max,
          currency: src.currency,
          framing: compatible && framing ? framing : fallbackFraming(src.ral_min, src.ral_max),
        }
      : null,
    skills: src.required_skills,
  });
}
