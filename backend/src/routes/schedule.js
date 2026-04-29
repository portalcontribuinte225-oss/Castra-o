import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM schedule_days ORDER BY date ASC");
  res.json(rows);
});

router.post("/", auth, async (req, res) => {
  const { date, weekday, vacancies, locationName, location_name, addressUrl, address_url } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO schedule_days (date, weekday, vacancies, location_name, address_url) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [date, weekday, vacancies, location_name || locationName || "", address_url || addressUrl || ""]
  );
  res.status(201).json(rows[0]);
});

router.patch("/:id", auth, async (req, res) => {
  const { vacancies, locationName, location_name, addressUrl, address_url } = req.body;
  const { rows } = await pool.query(
    "UPDATE schedule_days SET vacancies=$1, location_name=COALESCE($2, location_name), address_url=COALESCE($3, address_url) WHERE id=$4 RETURNING *",
    [vacancies, location_name || locationName || null, address_url || addressUrl || null, req.params.id]
  );
  res.json(rows[0]);
});

router.delete("/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM schedule_days WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

export default router;
