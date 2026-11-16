import { Router } from "express";
import { auth, requireGlobal, requireRole } from "../middleware/auth.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { isUuid } from "../repositories/request-tracking.js";
import { auditCtx } from "../services/audit.js";
import { getQuotaStatus, resetQuotaUsage, saveQuota } from "../services/message-quota.js";
import { isMessageChannel } from "../../../shared/message-quota-contract.js";
import { pickMunicipalityId } from "../tenant.js";

const router = Router();
router.use(auth);

function sendFailure(res, error) {
  res.status(error?.status || 500).json({ error: error?.status ? error.message : "Não foi possível concluir a operação do contrato de mensagens." });
}

function channelOf(req) {
  if (!isMessageChannel(req.params.channel)) throw Object.assign(new Error("Canal de mensagens inválido."), { status: 400 });
  return req.params.channel;
}

// A staff member reads the contract of their own municipality; a global user chooses which one. Only the global administration
// changes it, and only for an active municipality.
router.get("/:channel", requireRole("admin_municipal", "analista", "servidor_publico"), async (req, res) => {
  try {
    const channel = channelOf(req);
    const municipalityId = pickMunicipalityId(req);
    if (municipalityId && !isUuid(municipalityId)) throw Object.assign(new Error("Município inválido."), { status: 400 });
    res.set("Cache-Control", "no-store").json(municipalityId ? await getQuotaStatus(channel, municipalityId) : null);
  } catch (error) {
    sendFailure(res, error);
  }
});

router.put("/:channel", requireGlobal, async (req, res) => {
  try {
    const channel = channelOf(req);
    const municipalityId = pickMunicipalityId(req);
    await assertActiveMunicipality(municipalityId);
    res.set("Cache-Control", "no-store").json(await saveQuota({ channel, municipalityId, input: req.body, audit: auditCtx(req) }));
  } catch (error) {
    sendFailure(res, error);
  }
});

router.post("/:channel/reset", requireGlobal, async (req, res) => {
  try {
    const channel = channelOf(req);
    const municipalityId = pickMunicipalityId(req);
    await assertActiveMunicipality(municipalityId);
    res.set("Cache-Control", "no-store").json(await resetQuotaUsage({ channel, municipalityId }));
  } catch (error) {
    sendFailure(res, error);
  }
});

export default router;
