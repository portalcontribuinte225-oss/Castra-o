import { Router } from "express";
import { auth, requireMunicipalAdmin } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { auditCtx } from "../services/audit.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../services/whatsapp.js";
import { loadWhatsappCatalog, syncWhatsappCatalog } from "../services/whatsapp-catalog.js";
import { loadWhatsappBindings, removeWhatsappBinding, saveWhatsappBinding } from "../services/whatsapp-bindings.js";

const router = Router();
router.use(auth, requireMunicipalAdmin);

// Unexpected failures never echo provider or database messages to the client.
function sendFailure(res, error, fallback) {
  res.status(error?.status || 500).json({ error: error?.status ? error.message : fallback, ...(error?.status && error.code ? { code: error.code } : {}) });
}

function municipalityOf(req, res) {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) res.status(400).json({ error: "Município não identificado." });
  return municipalityId;
}

router.get("/catalog", async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    res.set("Cache-Control", "no-store").json(await loadWhatsappCatalog(municipalityId));
  } catch (error) {
    sendFailure(res, error, "Não foi possível consultar o catálogo de templates.");
  }
});

router.post("/catalog/sync", async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    const runtime = getRuntimeConfig(await getMunicipalityWhatsappConfig(municipalityId));
    const catalog = await syncWhatsappCatalog({ municipalityId, runtime, audit: auditCtx(req) });
    res.set("Cache-Control", "no-store").json(catalog);
  } catch (error) {
    sendFailure(res, error, "Não foi possível sincronizar os templates.");
  }
});

router.get("/bindings", async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    res.set("Cache-Control", "no-store").json({ bindings: await loadWhatsappBindings(municipalityId) });
  } catch (error) {
    sendFailure(res, error, "Não foi possível consultar os vínculos de templates.");
  }
});

router.put("/bindings/:event", async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    const bindings = await saveWhatsappBinding({ municipalityId, event: req.params.event, input: req.body, audit: auditCtx(req) });
    res.set("Cache-Control", "no-store").json({ bindings });
  } catch (error) {
    sendFailure(res, error, "Não foi possível salvar o vínculo.");
  }
});

router.delete("/bindings/:event", async (req, res) => {
  const municipalityId = municipalityOf(req, res);
  if (!municipalityId) return;
  try {
    const bindings = await removeWhatsappBinding({ municipalityId, event: req.params.event, audit: auditCtx(req) });
    res.set("Cache-Control", "no-store").json({ bindings });
  } catch (error) {
    sendFailure(res, error, "Não foi possível remover o vínculo.");
  }
});

export default router;
