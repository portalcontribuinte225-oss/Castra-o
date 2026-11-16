import { Router } from "express";
import { auth, requireMunicipalAdmin } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { auditCtx } from "../services/audit.js";
import { getSmsIntegrationSettings, testSmsConnection } from "../services/sms-integration-settings.js";
import { setSmsUseActive } from "../services/sms-uses.js";

const router = Router();
router.post("/test-connection", auth, requireMunicipalAdmin, async (req, res, next) => {
  try {
    const result = await testSmsConnection({ municipalityId: pickMunicipalityId(req), token: req.body?.token, actor: req.user });
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) { next(error); }
});
// Turns one SMS message on or off for the municipality of the operation, and answers with the whole screen.
router.put("/uses/active", auth, requireMunicipalAdmin, async (req, res, next) => {
  try {
    const municipalityId = pickMunicipalityId(req);
    await setSmsUseActive({ municipalityId, use: req.body?.use, active: req.body?.active, audit: auditCtx(req) });
    res.set("Cache-Control", "no-store").json(await getSmsIntegrationSettings(municipalityId));
  } catch (error) { next(error); }
});
router.use((error, _req, res, _next) => {
  res.set("Cache-Control", "no-store").status(error.status || 503).json({
    error: error.status ? error.message : "Não foi possível concluir a operação de SMS.",
    ...(error.status && error.code ? { code: error.code } : {}),
  });
});
export default router;
