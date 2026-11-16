import { Router } from "express";
import { auth, requireMaster, requireMunicipalAdmin } from "../middleware/auth.js";
import { isUuid } from "../repositories/request-tracking.js";
import { auditCtx } from "../services/audit.js";
import { saveEmailAccount } from "../services/email-account.js";
import { getEmailSettings } from "../services/email-settings.js";
import { saveEmailTemplateIds, setEmailUseActive } from "../services/email-templates.js";
import { isMasterUser, pickMunicipalityId } from "../tenant.js";

const router = Router();
router.use(auth);

// Unexpected failures never echo provider or database messages to the client.
function sendFailure(res, error, fallback) {
  res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback });
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// Non-global users are held to their own municipality by pickMunicipalityId; a global one may choose any valid id.
function municipalityOf(req, { required }) {
  const municipalityId = pickMunicipalityId(req) || null;
  if (municipalityId && !isUuid(municipalityId)) throw badRequest("Município inválido.");
  if (required && !municipalityId) throw badRequest("Município não identificado.");
  return municipalityId;
}

// The master sees the account and the template ids; everyone else only the municipal view.
async function respondWithSettings(req, res, municipalityId) {
  res.set("Cache-Control", "no-store").json(await getEmailSettings({ municipalityId, master: isMasterUser(req.user) }));
}

router.get("/settings", requireMunicipalAdmin, async (req, res) => {
  try {
    await respondWithSettings(req, res, municipalityOf(req, { required: !isMasterUser(req.user) }));
  } catch (error) {
    sendFailure(res, error, "Não foi possível consultar a integração de e-mail.");
  }
});

router.put("/account", requireMaster, async (req, res) => {
  try {
    const municipalityId = municipalityOf(req, { required: false });
    await saveEmailAccount({ input: req.body, audit: auditCtx(req) });
    await respondWithSettings(req, res, municipalityId);
  } catch (error) {
    sendFailure(res, error, "Não foi possível salvar a conta de e-mail.");
  }
});

router.put("/templates", requireMaster, async (req, res) => {
  try {
    const municipalityId = municipalityOf(req, { required: false });
    await saveEmailTemplateIds({ patch: req.body?.templates, audit: auditCtx(req) });
    await respondWithSettings(req, res, municipalityId);
  } catch (error) {
    sendFailure(res, error, "Não foi possível salvar os templates de e-mail.");
  }
});

router.put("/templates/active", requireMunicipalAdmin, async (req, res) => {
  try {
    const municipalityId = municipalityOf(req, { required: true });
    await setEmailUseActive({ municipalityId, use: req.body?.use, active: req.body?.active, audit: auditCtx(req) });
    await respondWithSettings(req, res, municipalityId);
  } catch (error) {
    sendFailure(res, error, "Não foi possível alterar a mensagem de e-mail.");
  }
});

export default router;
