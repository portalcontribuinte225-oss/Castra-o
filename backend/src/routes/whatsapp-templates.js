import { Router } from "express";
import { auth, requireConfigItem, requireMaster } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { auditCtx } from "../services/audit.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../services/whatsapp.js";
import { syncWhatsappCatalog } from "../services/whatsapp-catalog.js";
import { listWhatsappTemplates, setWhatsappTemplateActive, setWhatsappTemplateLink } from "../services/whatsapp-active-templates.js";
import { IntegrationConfigItem } from "../../../shared/config-permission-contract.js";

const router = Router();
router.use(auth);
const requireWhatsappItem = requireConfigItem(IntegrationConfigItem.WHATSAPP);

// Unexpected failures never echo provider or database messages to the client.
function sendFailure(res, error, fallback) {
  res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback, ...(error?.status && error.code ? { code: error.code } : {}) });
}

function municipalityOf(req, res) {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) res.status(400).json({ error: "Município não identificado." });
  return municipalityId;
}

router.get("/templates", requireWhatsappItem, async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    res.set("Cache-Control", "no-store").json(await listWhatsappTemplates(municipalityId));
  } catch (error) {
    sendFailure(res, error, "Não foi possível consultar os templates do WhatsApp.");
  }
});

router.post("/templates/sync", requireMaster, async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    const runtime = getRuntimeConfig(await getMunicipalityWhatsappConfig(municipalityId));
    await syncWhatsappCatalog({ municipalityId, runtime, audit: auditCtx(req) });
    res.set("Cache-Control", "no-store").json(await listWhatsappTemplates(municipalityId));
  } catch (error) {
    sendFailure(res, error, "Não foi possível sincronizar os templates.");
  }
});

router.put("/templates/active", requireWhatsappItem, async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    const { name, language, active } = req.body || {};
    res.set("Cache-Control", "no-store").json(await setWhatsappTemplateActive({ municipalityId, name, language, active, audit: auditCtx(req) }));
  } catch (error) {
    sendFailure(res, error, "Não foi possível alterar o template.");
  }
});

// Which notice a template sends and which field fills each number: an integration setting, so only the master changes it.
router.put("/templates/link", requireMaster, async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    const { name, language, use, fields } = req.body || {};
    res.set("Cache-Control", "no-store").json(await setWhatsappTemplateLink({ municipalityId, name, language, use, fields, audit: auditCtx(req) }));
  } catch (error) {
    sendFailure(res, error, "Não foi possível salvar a configuração do template.");
  }
});

export default router;
