import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";
import { getMunicipalityWhatsappConfig, getRuntimeConfig, sendCloudApiTemplate } from "../services/whatsapp.js";
import { getQuotaStatus } from "../services/whatsappQuota.js";

const router = Router();

router.get("/quota-status", auth, async (req, res) => {
  const municipalityId = req.query.municipalityId || req.user?.municipalityId;
  if (!municipalityId) return res.json(null);
  try {
    const status = await getQuotaStatus(municipalityId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reset-quota", auth, async (req, res) => {
  const municipalityId = req.body?.municipalityId || req.user?.municipalityId;
  if (!municipalityId) return res.status(400).json({ error: "Município não identificado." });
  try {
    const { rows } = await pool.query(
      "SELECT value FROM config WHERE key=$1 AND municipality_id=$2",
      ["whatsapp_quota", municipalityId],
    );
    const current = rows[0]?.value && typeof rows[0].value === "object" ? rows[0].value : {};
    const next = { ...current, currentPeriodUsed: 0, currentPeriodStart: "" };
    await pool.query(
      `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$3, updated_at=NOW()`,
      ["whatsapp_quota", municipalityId, JSON.stringify(next)],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/test", auth, async (req, res) => {
  const { municipalityId, phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "Informe o número de telefone." });
  const mId = municipalityId || req.user?.municipalityId;
  if (!mId) return res.status(400).json({ error: "Município não identificado." });
  try {
    const rawConfig = await getMunicipalityWhatsappConfig(mId);
    const config = getRuntimeConfig(rawConfig);
    if (rawConfig.active === false) {
      return res.json({ status: "skipped", reason: "WhatsApp desativado para o município" });
    }
    if (!config.accessToken || !config.phoneNumberId || !config.templateName) {
      return res.json({ status: "skipped", reason: "Credenciais ou template do WhatsApp incompletos" });
    }
    const today = new Date().toLocaleDateString("pt-BR");
    const result = await sendCloudApiTemplate(config, {
      phone,
      tutor_name: "Teste",
      schedule_date: `${today} (mensagem de teste)`,
      municipality_id: mId,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
