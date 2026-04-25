import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const query = req.user.role === "tutor"
      ? { text: "SELECT * FROM requests WHERE tutor_id = $1 ORDER BY created_at DESC", values: [req.user.id] }
      : { text: "SELECT * FROM requests ORDER BY created_at DESC", values: [] };
    const { rows } = await pool.query(query.text, query.values);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  const { animal_name, species, size, request_type, municipality, notes, tutor_name, tutor_email } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO requests (tutor_id, tutor_name, tutor_email, animal_name, species, size, request_type, municipality, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'RASCUNHO') RETURNING *`,
      [req.user.id, tutor_name, tutor_email, animal_name, species, size, request_type, municipality, notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/status", auth, async (req, res) => {
  const { status, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE requests SET status = $1, updated_at = NOW(),
       history = history || $2::jsonb
       WHERE id = $3 RETURNING *`,
      [status, JSON.stringify([{ status, notes, by: req.user.id, at: new Date() }]), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth, async (req, res) => {
  const fields = req.body;
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  try {
    const { rows } = await pool.query(
      `UPDATE requests SET ${set}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Não encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM requests WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
