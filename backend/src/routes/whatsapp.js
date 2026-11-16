import { Router } from "express";
import { auth, requireMaster } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { isValidPhone } from "../utils.js";
import { DeliveryCode, NotificationEvent } from "../../../shared/notification-contract.js";
import { getWhatsappUse } from "../../../shared/whatsapp-templates-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../services/whatsapp.js";
import { resolveActiveTemplate } from "../services/whatsapp-active-templates.js";
import { sendResolvedTemplate } from "../services/whatsapp-template-sender.js";
import { buildBodyComponents, previewRequest } from "../services/notifications/whatsapp-template-parameters.js";

const router = Router();

router.post("/test", auth, requireMaster, async (req, res) => {
  const { phone } = req.body || {};
  if (typeof phone !== "string" || !isValidPhone(phone)) {
    return res.status(400).json({ error: "Informe um telefone válido com DDD." });
  }
  const mId = pickMunicipalityId(req);
  if (!mId) return res.status(400).json({ error: "Município não identificado." });
  try {
    const rawConfig = await getMunicipalityWhatsappConfig(mId);
    const config = getRuntimeConfig(rawConfig);
    if (rawConfig.active === false) {
      return res.json({ status: "skipped", reason: "WhatsApp desativado para o município" });
    }
    if (!config.accessToken || !config.phoneNumberId) {
      return res.json({ status: "skipped", reason: "Credenciais do WhatsApp incompletas" });
    }
    const resolved = await resolveActiveTemplate(mId, NotificationEvent.SCHEDULE_CONFIRMED);
    if (!resolved.ok) {
      return res.json({
        status: "skipped",
        reason: resolved.code === DeliveryCode.NOT_CONFIGURED
          ? "Ative o template do aviso de agendamento confirmado na lista de templates antes de testar."
          : "O template ativo do aviso de agendamento confirmado não está aprovado ou mudou.",
      });
    }
    const result = await sendResolvedTemplate({
      municipalityId: mId, runtime: config, template: resolved.template, phone,
      components: buildBodyComponents(getWhatsappUse(NotificationEvent.SCHEDULE_CONFIRMED).fields, { ...previewRequest(), tutor_name: "Teste" }),
    });
    res.json({
      status: result.status,
      reason: result.status === "failed" && !result.templateStatus && result.code !== "template_unavailable" ? "O provedor recusou o envio de teste." : result.reason,
      providerMessageId: result.providerMessageId || "",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
