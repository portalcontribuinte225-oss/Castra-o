import { Router } from "express";
import { auth, requireConfigItem, requireMaster } from "../middleware/auth.js";
import { assertActiveMunicipality } from "../repositories/municipality-identity.js";
import { isUuid } from "../repositories/request-tracking.js";
import { auditCtx } from "../services/audit.js";
import { getQuotaStatus, resetQuotaUsage, saveQuota, setServiceEnabled } from "../services/message-quota.js";
import { CHANNEL_CONFIG_ITEMS } from "../../../shared/config-permission-contract.js";
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

// Reading the counter takes the permission of the channel's tab, which also decides who switches its messages.
function requireChannelItem(req, res, next) {
  if (!isMessageChannel(req.params.channel)) return res.status(400).json({ error: "Canal de mensagens inválido." });
  return requireConfigItem(CHANNEL_CONFIG_ITEMS[req.params.channel])(req, res, next);
}

// A staff member with the channel's permission reads the contract of their own municipality; a global user chooses which one. Only the
// platform's administrator (the master) changes it, and only for an active municipality.
router.get("/:channel", requireChannelItem, async (req, res) => {
  try {
    const channel = channelOf(req);
    const municipalityId = pickMunicipalityId(req);
    if (municipalityId && !isUuid(municipalityId)) throw Object.assign(new Error("Município inválido."), { status: 400 });
    res.set("Cache-Control", "no-store").json(municipalityId ? await getQuotaStatus(channel, municipalityId) : null);
  } catch (error) {
    sendFailure(res, error);
  }
});

router.put("/:channel", requireMaster, async (req, res) => {
  try {
    const channel = channelOf(req);
    const municipalityId = pickMunicipalityId(req);
    await assertActiveMunicipality(municipalityId);
    res.set("Cache-Control", "no-store").json(await saveQuota({ channel, municipalityId, input: req.body, audit: auditCtx(req) }));
  } catch (error) {
    sendFailure(res, error);
  }
});

// The service of SMS or e-mail for one municipality, on or off.
router.put("/:channel/enabled", requireMaster, async (req, res) => {
  try {
    const channel = channelOf(req);
    const municipalityId = pickMunicipalityId(req);
    await assertActiveMunicipality(municipalityId);
    res.set("Cache-Control", "no-store").json(await setServiceEnabled({ channel, municipalityId, input: req.body, audit: auditCtx(req) }));
  } catch (error) {
    sendFailure(res, error);
  }
});

router.post("/:channel/reset", requireMaster, async (req, res) => {
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
