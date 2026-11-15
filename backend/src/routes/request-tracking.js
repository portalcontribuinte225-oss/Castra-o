import { Router } from "express";
import { createTrackingHandlers, requireTrackingToken } from "../services/request-tracking/tracking-handlers.js";

const endpoint = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

export function createRequestTrackingRouter(dependencies) {
  const handlers = createTrackingHandlers(dependencies);
  const router = Router();
  router.post("/challenges", endpoint(handlers.start));
  router.post("/challenges/:id/confirm", endpoint(handlers.confirm));
  router.get("/request", requireTrackingToken, endpoint(handlers.view));
  router.use((error, _req, res, _next) => {
    const status = error.status || 500;
    res.status(status).set("Cache-Control", "no-store").json({
      error: error.status ? error.message : "Não foi possível concluir a consulta.",
      ...(status === 429 && error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    });
  });
  return router;
}

export default createRequestTrackingRouter();
