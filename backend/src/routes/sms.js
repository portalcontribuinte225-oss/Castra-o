import { Router } from "express";
import { auth, requireMunicipalAdmin } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { testSmsConnection } from "../services/sms-integration-settings.js";

const router = Router();
router.post("/test-connection", auth, requireMunicipalAdmin, async (req, res, next) => {
  try {
    const result = await testSmsConnection({ municipalityId: pickMunicipalityId(req), token: req.body?.token, actor: req.user });
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) { next(error); }
});
router.use((error, _req, res, _next) => {
  res.set("Cache-Control", "no-store").status(error.status || 503).json({
    error: error.status ? error.message : "Não foi possível consultar a conexão de SMS.",
    ...(error.status && error.code ? { code: error.code } : {}),
  });
});
export default router;
