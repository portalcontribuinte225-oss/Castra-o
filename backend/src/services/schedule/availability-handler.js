import { pool } from "../../db/index.js";
import { requireMunicipality } from "../../tenant.js";
import { availabilityRange, getAvailability } from "./schedule-booking.js";

export async function availability(req, res) {
  const municipalityId = requireMunicipality(req, res);
  if (!municipalityId) return;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId)) return res.status(400).json({ error: "Município inválido." });
  try {
    const { rows } = await pool.query("SELECT id FROM municipalities WHERE id = $1 AND active = TRUE", [municipalityId]);
    if (!rows.length) return res.status(404).json({ error: "Agenda indisponível." });
    res.set("Cache-Control", "no-store");
    res.json(await getAvailability(pool, { municipalityId, ...availabilityRange(req.query) }));
  } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : "Não foi possível consultar a agenda." }); }
}
