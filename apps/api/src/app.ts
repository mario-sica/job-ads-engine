import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Db } from "./db/connection.js";
import { errorHandler, notFoundHandler } from "./http/errors.js";
import type { LlmClient } from "./llm/client.js";
import { channelFormatRoutes } from "./modules/channel-formats/routes.js";
import { jobOfferRoutes } from "./modules/job-offers/routes.js";

export interface AppDeps {
  db: Db;
  llm: LlmClient;
  logger?: FastifyServerOptions["logger"];
}

export type ApiRoutes = (api: FastifyInstance, deps: AppDeps) => void;

const ROUTES: ApiRoutes[] = [jobOfferRoutes, channelFormatRoutes];

/** L'app senza avvio: il server la mette in ascolto, i test la usano con `inject`. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false });
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);
  app.register(
    async (api) => {
      for (const register of ROUTES) register(api, deps);
    },
    { prefix: "/api" },
  );
  return app;
}
