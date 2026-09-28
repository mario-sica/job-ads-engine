import { z } from "zod";
import type { ApiRoutes } from "../../app.js";
import { parseInput } from "../../http/validation.js";
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
};
