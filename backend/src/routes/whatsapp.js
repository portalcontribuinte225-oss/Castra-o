import { Router } from "express";
import { auth, requireMaster } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { isValidPhone } from "../utils.js";
import { DeliveryCode, NotificationEvent } from "../../../shared/notification-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../services/whatsapp.js";
import { isWhatsappReady } from "../services/whatsapp-credentials.js";
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
    if (!isWhatsappReady(config)) {
      return res.json({ status: "skipped", reason: "Escolha a key do token e informe o ID do número antes de testar." });
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
      components: buildBodyComponents(resolved.template.fields, { ...previewRequest(), tutor_name: "Teste" }),
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
