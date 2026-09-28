import { z } from "zod";
import type { ApiRoutes } from "../../app.js";
import { InvalidInputError, parseInput } from "../../http/validation.js";
import { createAdsService } from "./service.js";
import { AD_STATUSES } from "./status.js";
import { LOCATION_PRECISIONS } from "./types.js";

export const idParams = z.object({ id: z.coerce.number().int().positive() });

// In query string un parametro vuoto (`?status=`) vale come assente.
const optionalQuery = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const listQuery = z.object({
  job_offer_id: optionalQuery(z.string()),
  channel: optionalQuery(z.string()),
  status: optionalQuery(z.enum(AD_STATUSES)),
});

const text = z.string().trim().min(1).nullish().transform((v) => v ?? null);

const locationBody = z
  .strictObject({
    street_name: text,
    street_number: text,
    postal_code: text,
    locality: text,
    province: text,
    province_code: text,
    region: text,
    country_code: z.string().length(2).default("IT"),
  })
  .refine((l) => l.locality || l.province || l.region, "serve almeno località, provincia o regione");

export const angle = z.string().trim().min(1).max(200).nullish().transform((v) => v ?? null);

const createBody = z.strictObject({
  job_offer_id: z.string().min(1),
  channel_format_id: z.number().int().positive(),
  location: locationBody.optional(),
  location_precision: z.enum(LOCATION_PRECISIONS).optional(),
  variants: z.array(z.strictObject({ angle })).min(1).max(4),
});

export const adRoutes: ApiRoutes = (api, deps) => {
  const service = createAdsService(deps);

  api.get("/ads", async (request) => service.list(parseInput(listQuery, request.query)));

  api.get("/ads/:id", async (request) => service.get(parseInput(idParams, request.params).id));

  api.post("/ads", async (request, reply) => {
    const ad = await service.create(parseInput(createBody, request.body));
    return reply.status(201).send(ad);
  });

  api.post("/ads/:id/variants", async (request, reply) => {
    const { id } = parseInput(idParams, request.params);
    const body = parseInput(z.strictObject({ angle }), request.body ?? {});
    return reply.status(201).send(await service.addVariant(id, body.angle));
  });

  api.patch("/ads/:id", async (request) => {
    const { id } = parseInput(idParams, request.params);
    const { status } = parseInput(z.strictObject({ status: z.enum(AD_STATUSES) }), request.body);
    return service.updateStatus(id, status);
  });

  api.patch("/variants/:id", async (request) => {
    const { id } = parseInput(idParams, request.params);
    const { is_active } = parseInput(z.strictObject({ is_active: z.boolean() }), request.body);
    return service.setVariantActive(id, is_active);
  });

  api.get("/variants/:id/revisions", async (request) => service.listRevisions(parseInput(idParams, request.params).id));

  api.post("/variants/:id/revisions", async (request, reply) => {
    const { id } = parseInput(idParams, request.params);
    // La forma del contenuto la valida il service con lo schema del formato (422, non 400).
    const { content } = parseInput(z.strictObject({ content: z.record(z.string(), z.unknown()) }), request.body);
    return reply.status(201).send(service.addManualRevision(id, content));
  });

  api.put("/variants/:id/current-revision", async (request) => {
    const { id } = parseInput(idParams, request.params);
    const { revision_id } = parseInput(z.strictObject({ revision_id: z.number().int().positive() }), request.body);
    return service.restoreRevision(id, revision_id);
  });

  api.get("/variants/:id/preview", async (request, reply) => {
    const { id } = parseInput(idParams, request.params);
    const { as } = parseInput(z.object({ as: optionalQuery(z.enum(["json", "html"])) }), request.query);
    const preview = service.preview(id);
    if (as !== "html") return preview;
    if (preview.html === null) {
      throw new InvalidInputError([{ path: "as", message: "il formato di questo annuncio non ha un'immagine" }]);
    }
    // L'HTML è escapato e non ha script: la CSP lo garantisce anche se qualcosa sfuggisse.
    return reply
      .type("text/html; charset=utf-8")
      .header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'")
      .send(preview.html);
  });
};
