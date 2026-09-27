import { z } from "zod";
import { InvalidSpecsError } from "./types.js";

/*
 * `channel_formats.specs`: dimensioni della tela e override dei limiti editoriali.
 * Gli override sono parziali e vengono fusi con i default del blocco; la
 * validazione completa avviene dopo il merge, quando si conosce il kind.
 */
const overrides = z.record(z.string(), z.unknown());

export const specsSchema = z.strictObject({
  width_px: z.number().int().positive().optional(),
  height_px: z.number().int().positive().optional(),
  limits: z
    .strictObject({
      text: overrides.optional(),
      image: overrides.optional(),
    })
    .optional(),
});
export type Specs = z.infer<typeof specsSchema>;

export function parseSpecs(raw: unknown): Specs {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  const result = specsSchema.safeParse(value);
  if (!result.success) throw new InvalidSpecsError(z.prettifyError(result.error));
  return result.data;
}
