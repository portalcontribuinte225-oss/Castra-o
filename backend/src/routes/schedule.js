import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { isGlobalUser, pickMunicipalityId, requireMunicipality } from "../tenant.js";

const router = Router();

router.get("/", optionalAuth, async (req, res) => {
  const municipalityId = pickMunicipalityId(req);
  if (!municipalityId && !isGlobalUser(req.user)) return res.json([]);
  const query = municipalityId
    ? { text: "SELECT * FROM schedule_days WHERE municipality_id = $1 ORDER BY date ASC", values: [municipalityId] }
    : { text: "SELECT * FROM schedule_days ORDER BY date ASC", values: [] };
  const { rows } = await pool.query(query.text, query.values);
  res.json(rows);
});

router.post("/", auth, async (req, res) => {
  const { date, weekday, vacancies, slots, locationName, location_name, locationAddress, location_address, addressUrl, address_url, active, scheduleRuleId, schedule_rule_id } = req.body;
  const municipalityId = requireMunicipality(req, res);
  if (!municipalityId) return;
  const { rows } = await pool.query(
    "INSERT INTO schedule_days (date, weekday, vacancies, slots, municipality_id, location_name, location_address, address_url, active, schedule_rule_id) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10) RETURNING *",
    [date, weekday, vacancies, JSON.stringify(Array.isArray(slots) ? slots : []), municipalityId, location_name || locationName || "", location_address || locationAddress || "", address_url || addressUrl || "", active !== false, schedule_rule_id || scheduleRuleId || ""]
  );
  res.status(201).json(rows[0]);
});

router.post("/bulk", auth, async (req, res) => {
  const municipalityId = requireMunicipality(req, res);
  if (!municipalityId) return;
  const days = Array.isArray(req.body?.days) ? req.body.days : [];
  const replaceRuleId = String(req.body?.replaceRuleId || req.body?.replace_rule_id || "").trim();
  const normalizedDays = days.map((day) => ({
    date: day.date,
    weekday: day.weekday || "",
    vacancies: Math.max(Number(day.vacancies) || 0, 0),
    slots: Array.isArray(day.slots) ? day.slots : [],
    location_name: day.location_name || day.locationName || "",
    location_address: day.location_address || day.locationAddress || "",
    address_url: day.address_url || day.addressUrl || "",
    active: day.active !== false,
    schedule_rule_id: day.schedule_rule_id || day.scheduleRuleId || replaceRuleId || "",
  })).filter((day) => day.date);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (replaceRuleId) {
      await client.query(
        "DELETE FROM schedule_days WHERE municipality_id=$1 AND schedule_rule_id=$2",
        [municipalityId, replaceRuleId],
      );
    }
    if (!normalizedDays.length) {
      await client.query("COMMIT");
      return res.json([]);
    }
    const { rows } = await client.query(
      `INSERT INTO schedule_days (
         date, weekday, vacancies, slots, municipality_id, location_name, location_address, address_url, active, schedule_rule_id
       )
       SELECT
         item.date,
         item.weekday,
         item.vacancies,
         item.slots,
         $2,
         item.location_name,
         item.location_address,
         item.address_url,
         item.active,
         item.schedule_rule_id
       FROM jsonb_to_recordset($1::jsonb) AS item(
         date TEXT,
         weekday TEXT,
         vacancies INT,
         slots JSONB,
         location_name TEXT,
         location_address TEXT,
         address_url TEXT,
         active BOOLEAN,
         schedule_rule_id TEXT
       )
       RETURNING *`,
      [JSON.stringify(normalizedDays), municipalityId],
    );
    await client.query("COMMIT");
    res.status(201).json(rows);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.patch("/:id", auth, async (req, res) => {
  const { vacancies, slots, locationName, location_name, locationAddress, location_address, addressUrl, address_url, active, scheduleRuleId, schedule_rule_id } = req.body;
  const scope = isGlobalUser(req.user) ? "" : " AND municipality_id = $9";
  const values = [
    vacancies,
    Array.isArray(slots) ? JSON.stringify(slots) : null,
    location_name || locationName || null,
    location_address || locationAddress || null,
    address_url || addressUrl || null,
    active !== undefined ? active !== false : null,
    schedule_rule_id || scheduleRuleId || null,
    req.params.id,
  ];
  if (!isGlobalUser(req.user)) values.push(req.user.municipalityId);
  const { rows } = await pool.query(
    `UPDATE schedule_days SET vacancies=$1, slots=COALESCE($2::jsonb, slots), location_name=COALESCE($3, location_name), location_address=COALESCE($4, location_address), address_url=COALESCE($5, address_url), active=COALESCE($6, active), schedule_rule_id=COALESCE($7, schedule_rule_id) WHERE id=$8${scope} RETURNING *`,
    values
  );
  if (!rows[0]) return res.status(404).json({ error: "Agenda nao encontrada." });
  res.json(rows[0]);
});

router.delete("/:id", auth, async (req, res) => {
  const scope = isGlobalUser(req.user) ? "" : " AND municipality_id = $2";
  const values = isGlobalUser(req.user) ? [req.params.id] : [req.params.id, req.user.municipalityId];
  await pool.query(`DELETE FROM schedule_days WHERE id=$1${scope}`, values);
  res.status(204).end();
});

export default router;
