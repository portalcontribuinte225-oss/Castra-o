import { Router } from "express";
import { auth, requireConfigItem, requireMaster } from "../middleware/auth.js";
import { isMasterUser, pickMunicipalityId } from "../tenant.js";
import { auditCtx } from "../services/audit.js";
import { getPublicSmsConfig, getSmsIntegrationSettings, saveSmsAccount, sendSmsTestMessage, testSmsConnection } from "../services/sms-integration-settings.js";
import { setSmsUseActive } from "../services/sms-uses.js";
import { IntegrationConfigItem } from "../../../shared/config-permission-contract.js";

const router = Router();
const requireSmsItem = requireConfigItem(IntegrationConfigItem.SMS);
// What the follow-up form of a visitor reads: only whether SMS can reach the tutors of the municipality.
router.get("/availability", async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json(await getPublicSmsConfig(req.query?.municipalityId));
  } catch (error) { next(error); }
});
// The master reads the platform's account (and, with a municipality, its messages); whoever has the SMS permission reads the messages.
router.get("/settings", auth, requireSmsItem, async (req, res, next) => {
  try {
    res.set("Cache-Control", "no-store").json(await getSmsIntegrationSettings({ municipalityId: pickMunicipalityId(req), master: isMasterUser(req.user) }));
  } catch (error) { next(error); }
});
router.put("/account", auth, requireMaster, async (req, res, next) => {
  try {
    await saveSmsAccount({ input: req.body, actor: req.user });
    res.set("Cache-Control", "no-store").json(await getSmsIntegrationSettings({ municipalityId: pickMunicipalityId(req), master: true }));
  } catch (error) { next(error); }
});
router.post("/test-connection", auth, requireMaster, async (req, res, next) => {
  try {
    const result = await testSmsConnection({ token: req.body?.token, actor: req.user });
    res.set("Cache-Control", "no-store").json(result);
  } catch (error) { next(error); }
});
// Sends one test SMS to the phone typed on the screen and answers only whether it went: never the text, the token or the provider's body.
router.post("/test-message", auth, requireMaster, async (req, res, next) => {
  try {
    const result = await sendSmsTestMessage({ municipalityId: pickMunicipalityId(req), phone: req.body?.phone, actor: req.user });
    res.set("Cache-Control", "no-store").json({ status: result.status, ...(result.reason ? { reason: result.reason } : {}),
      ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}), ...(result.detail ? { detail: result.detail } : {}) });
  } catch (error) { next(error); }
});
// Turns one SMS message on or off for the municipality of the operation, and answers with the whole screen.
router.put("/uses/active", auth, requireSmsItem, async (req, res, next) => {
  try {
    const municipalityId = pickMunicipalityId(req);
    await setSmsUseActive({ municipalityId, use: req.body?.use, active: req.body?.active, audit: auditCtx(req) });
    res.set("Cache-Control", "no-store").json(await getSmsIntegrationSettings({ municipalityId, master: isMasterUser(req.user) }));
  } catch (error) { next(error); }
});
router.use((error, _req, res, _next) => {
  res.set("Cache-Control", "no-store").status(error.status || 503).json({
    error: error.status ? error.message : "Não foi possível concluir a operação de SMS.",
    ...(error.status && error.code ? { code: error.code } : {}),
  });
});
export default router;
