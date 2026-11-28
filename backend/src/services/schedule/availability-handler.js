import { pool } from "../../db/index.js";
import { isInternalUser, requireMunicipality } from "../../tenant.js";
import { isUuid } from "../../repositories/request-tracking.js";
import { availabilityRange, getAvailability } from "./schedule-booking.js";

export async function availability(req, res) {
  const municipalityId = requireMunicipality(req, res);
  if (!municipalityId) return;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId)) return res.status(400).json({ error: "Município inválido." });
  const excludeId = req.query.excludeRequestId;
  if (excludeId !== undefined && !isInternalUser(req.user)) return res.status(403).json({ error: "Operação restrita à equipe de atendimento." });
  if (excludeId !== undefined && !isUuid(excludeId)) return res.status(400).json({ error: "Identificador do processo inválido." });
  try {
    const { rows } = await pool.query("SELECT id FROM municipalities WHERE id = $1 AND active = TRUE", [municipalityId]);
    if (!rows.length) return res.status(404).json({ error: "Agenda indisponível." });
    res.set("Cache-Control", "no-store");
    res.json(await getAvailability(pool, { municipalityId, excludeId, ...availabilityRange(req.query) }));
  } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Não foi possível consultar a agenda." }); }
}
