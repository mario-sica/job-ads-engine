import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AdArchivedError, InvalidContentError, InvalidTransitionError, NotFoundError } from "../errors.js";
import { GenerationFailedError, ProviderUnavailableError } from "../llm/errors.js";
import { InvalidInputError } from "./validation.js";

export interface ErrorBody {
  code: string;
  message: string;
  details: unknown;
}

const body = (code: string, message: string, details: unknown = null): ErrorBody => ({ code, message, details });

/** Errore → stato HTTP e corpo. I messaggi sono quelli delle classi: nessun dettaglio del provider. */
export function toHttpError(error: unknown): { status: number; body: ErrorBody } {
  if (error instanceof InvalidInputError) return { status: 400, body: body("invalid_input", error.message, error.issues) };
  if (error instanceof NotFoundError) return { status: 404, body: body("not_found", error.message, { entity: error.entity, id: error.id }) };
  if (error instanceof InvalidTransitionError) {
    return { status: 409, body: body("invalid_transition", error.message, { from: error.from, to: error.to }) };
  }
  if (error instanceof AdArchivedError) return { status: 409, body: body("ad_archived", error.message, { ad_id: error.adId }) };
  if (error instanceof InvalidContentError) return { status: 422, body: body("invalid_content", error.message, error.issues) };
  if (error instanceof GenerationFailedError) return { status: 502, body: body("generation_failed", error.message, error.errors) };
  if (error instanceof ProviderUnavailableError) {
    return { status: 503, body: body("provider_unavailable", error.message, { reason: error.reason }) };
  }
  // Errori di Fastify sulla richiesta (JSON malformato, content-type non supportato…).
  const statusCode = (error as Partial<FastifyError>).statusCode;
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return { status: statusCode, body: body("invalid_input", (error as FastifyError).message) };
  }
  return { status: 500, body: body("internal_error", "errore interno") };
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  const { status, body } = toHttpError(error);
  // La causa completa resta nel log del server, mai nella risposta.
  if (status >= 500) request.log.error({ err: error }, body.message);
  return reply.status(status).send({ error: body });
}

export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.status(404).send({ error: body("not_found", `${request.method} ${request.url}: route inesistente`) });
}
