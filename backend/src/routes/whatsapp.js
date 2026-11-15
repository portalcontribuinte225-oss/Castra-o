import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, requireMunicipalAdmin, requireRole } from "../middleware/auth.js";
import { pickMunicipalityId } from "../tenant.js";
import { isValidPhone } from "../utils.js";
import { DeliveryCode, NotificationEvent } from "../../../shared/notification-contract.js";
import { getWhatsappUse } from "../../../shared/whatsapp-templates-contract.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig } from "../services/whatsapp.js";
import { resolveActiveTemplate } from "../services/whatsapp-active-templates.js";
import { sendResolvedTemplate } from "../services/whatsapp-template-sender.js";
import { buildBodyComponents, previewRequest } from "../services/notifications/whatsapp-template-parameters.js";
import { getQuotaStatus } from "../services/whatsappQuota.js";

const router = Router();

router.get("/quota-status", auth, requireRole("admin_municipal", "analista", "servidor_publico"), async (req, res) => {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) return res.json(null);
  try {
    const status = await getQuotaStatus(municipalityId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reset-quota", auth, requireMunicipalAdmin, async (req, res) => {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId) return res.status(400).json({ error: "Município não identificado." });
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const { rows } = await client.query(
      "SELECT value FROM config WHERE key=$1 AND municipality_id=$2 FOR UPDATE",
      ["whatsapp_quota", municipalityId],
    );
    const current = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
    const next = { ...current, currentPeriodUsed: 0, currentPeriodStart: "" };
    await client.query(
      `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$3, updated_at=NOW()`,
      ["whatsapp_quota", municipalityId, JSON.stringify(next)],
    );
    await client.query("COMMIT");
    transactionStarted = false;
    res.json({ ok: true });
  } catch (err) {
    if (transactionStarted) await client.query("ROLLBACK").catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.post("/test", auth, requireMunicipalAdmin, async (req, res) => {
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
