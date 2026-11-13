import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, optionalAuth, requireInternalUser } from "../middleware/auth.js";
import { isGlobalUser, pickMunicipalityId, requireMunicipality } from "../tenant.js";
import { availability } from "../services/schedule/availability-handler.js";
import { mutateSchedule } from "../services/schedule/schedule-mutation.js";
import { displayScheduleDate, normalizeSlots, resizeScheduleSlots } from "../../../shared/schedule-contract.js";

const router = Router();
router.get("/availability", optionalAuth, availability);
router.get("/", optionalAuth, async (req, res) => {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId && !isGlobalUser(req.user)) return res.json([]);
  const query = municipalityId
    ? { text: "SELECT * FROM schedule_days WHERE municipality_id = $1 ORDER BY date ASC", values: [municipalityId] }
    : { text: "SELECT * FROM schedule_days ORDER BY date ASC", values: [] };
  const { rows } = await pool.query(query.text, query.values);
  res.json(rows);
});

async function write(req, res, operation, status = 200, rowId = undefined) {
  const municipalityId = rowId ? undefined : requireMunicipality(req, res);
  if (!rowId && !municipalityId) return;
  try {
    const result = await mutateSchedule({ municipalityId, user: req.user, rowId }, operation);
    if (status === 204) return res.status(204).end();
    res.status(status).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.status ? error.message : "Não foi possível salvar a agenda." });
  }
}
function normalizeDay(day, replaceRuleId = "") {
  const date = displayScheduleDate(day.date);
  if (!date) throw Object.assign(new Error("Data de agenda inválida."), { status: 400 });
  const slots = normalizeSlots(day.slots, day.startTime || day.time || "08:00", Number(day.vacancies || 0));
  if (Array.isArray(day.slots) && day.slots.length && slots.length !== day.slots.length) throw Object.assign(new Error("Horários de agenda inválidos."), { status: 400 });
  return { date, weekday: String(day.weekday || "").slice(0, 20), vacancies: slots.reduce((sum, slot) => sum + slot.vacancies, 0), slots,
    location_name: day.location_name || day.locationName || "", location_address: day.location_address || day.locationAddress || "",
    address_url: day.address_url || day.addressUrl || "", active: day.active !== false,
    schedule_rule_id: day.schedule_rule_id || day.scheduleRuleId || replaceRuleId };
}
router.post("/", auth, requireInternalUser, async (req, res) => write(req, res, async (client, municipalityId) => {
  const day = normalizeDay(req.body);
  const { rows } = await client.query(
    "INSERT INTO schedule_days (date, weekday, vacancies, slots, municipality_id, location_name, location_address, address_url, active, schedule_rule_id) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING *",
    [day.date, day.weekday, day.vacancies, JSON.stringify(day.slots), municipalityId, day.location_name, day.location_address, day.address_url, day.active, day.schedule_rule_id]);
  return rows[0];
}, 201));

router.post("/bulk", auth, requireInternalUser, async (req, res) => write(req, res, async (client, municipalityId) => {
  const input = Array.isArray(req.body.days) ? req.body.days : [];
  if (input.length > 1000) throw Object.assign(new Error("A agenda excede o limite de datas por operação."), { status: 400 });
  const replaceRuleId = String(req.body.replaceRuleId || req.body.replace_rule_id || "");
  const days = input.map((day) => normalizeDay(day, replaceRuleId));
  if (replaceRuleId) await client.query("DELETE FROM schedule_days WHERE municipality_id=$1 AND schedule_rule_id=$2", [municipalityId, replaceRuleId]);
  if (!days.length) return [];
  const { rows } = await client.query(
    `INSERT INTO schedule_days (date, weekday, vacancies, slots, municipality_id, location_name, location_address, address_url, active, schedule_rule_id)
     SELECT item.date,item.weekday,item.vacancies,item.slots,$2,item.location_name,item.location_address,item.address_url,item.active,item.schedule_rule_id
     FROM jsonb_to_recordset($1::jsonb) AS item(date TEXT,weekday TEXT,vacancies INT,slots JSONB,location_name TEXT,location_address TEXT,address_url TEXT,active BOOLEAN,schedule_rule_id TEXT) RETURNING *`,
    [JSON.stringify(days), municipalityId]);
  return rows;
}, 201));

router.patch("/:id", auth, requireInternalUser, async (req, res) => write(req, res, async (client, municipalityId, current) => {
  const body = req.body;
  if (body.vacancies !== undefined && (!Number.isSafeInteger(Number(body.vacancies)) || Number(body.vacancies) < 0)) throw Object.assign(new Error("Quantidade de vagas inválida."), { status: 400 });
  if (Array.isArray(body.slots) && normalizeSlots(body.slots).length !== body.slots.length) throw Object.assign(new Error("Horários de agenda inválidos."), { status: 400 });
  const slots = Array.isArray(body.slots) ? normalizeSlots(body.slots)
    : body.vacancies !== undefined ? resizeScheduleSlots(current.slots, Number(body.vacancies), current.start_time || current.time || "08:00") : null;
  const { rows } = await client.query(
    `UPDATE schedule_days SET vacancies=COALESCE($1,vacancies), slots=COALESCE($2::jsonb,slots), location_name=COALESCE($3,location_name),
      location_address=COALESCE($4,location_address), address_url=COALESCE($5,address_url), active=COALESCE($6,active),
      schedule_rule_id=COALESCE($7,schedule_rule_id) WHERE id=$8 AND municipality_id=$9 RETURNING *`,
    [slots ? slots.reduce((sum, slot) => sum + slot.vacancies, 0) : null, slots ? JSON.stringify(slots) : null,
      body.location_name ?? body.locationName ?? null, body.location_address ?? body.locationAddress ?? null,
      body.address_url ?? body.addressUrl ?? null, body.active === undefined ? null : body.active !== false,
      body.schedule_rule_id ?? body.scheduleRuleId ?? null, req.params.id, municipalityId]);
  return rows[0];
}, 200, req.params.id));

router.delete("/:id", auth, requireInternalUser, async (req, res) => write(req, res, async (client, municipalityId) => {
  await client.query("DELETE FROM schedule_days WHERE id=$1 AND municipality_id=$2", [req.params.id, municipalityId]);
}, 204, req.params.id));
export default router;
