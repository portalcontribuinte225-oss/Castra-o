import { Router } from "express";
import { pool } from "../db/index.js";
import { auth } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM adoptions ORDER BY created_at DESC");
  res.json(rows);
});

router.post("/", auth, async (req, res) => {
  const { animal_name, species, size, age, description, photo_url } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO adoptions (animal_name, species, size, age, description, photo_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
    [animal_name, species, size, age, description, photo_url]
  );
  res.status(201).json(rows[0]);
});

router.patch("/:id", auth, async (req, res) => {
  const { status } = req.body;
  const { rows } = await pool.query("UPDATE adoptions SET status=$1 WHERE id=$2 RETURNING *", [status, req.params.id]);
  res.json(rows[0]);
});

router.delete("/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM adoptions WHERE id=$1", [req.params.id]);
  res.status(204).end();
});

export default router;
