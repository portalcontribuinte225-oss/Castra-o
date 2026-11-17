import { Router } from "express";
import { createAccessHandlers, requireAccessToken } from "../services/request-access/access-handlers.js";

const endpoint = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

// "Acessar minha solicitação": protocol, CPF and a code sent to the request's contact open the request document and, on the first
// access, the creation of the tutor's password.
export function createRequestAccessRouter(dependencies) {
  const handlers = createAccessHandlers(dependencies);
  const router = Router();
  router.post("/challenges", endpoint(handlers.start));
  router.post("/challenges/:id/confirm", endpoint(handlers.confirm));
  router.get("/request", requireAccessToken, endpoint(handlers.view));
  router.post("/password", requireAccessToken, endpoint(handlers.createPassword));
  router.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).set("Cache-Control", "no-store").json({
      error: error.status ? error.message : "Não foi possível concluir o acesso.",
      ...(status === 429 && error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    });
  });
  return router;
}

export default createRequestAccessRouter();
