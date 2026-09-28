import { z } from "zod";
import type { ApiRoutes } from "../../app.js";
import { parseInput } from "../../http/validation.js";
import { createJobOffersRepository } from "./repository.js";

const params = z.object({ id: z.string().min(1) });

export const jobOfferRoutes: ApiRoutes = (api, { db }) => {
  const jobOffers = createJobOffersRepository(db);

  api.get("/job-offers", async () => jobOffers.list());

  api.get("/job-offers/:id", async (request) => jobOffers.get(parseInput(params, request.params).id));
};
