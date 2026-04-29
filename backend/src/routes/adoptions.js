import { Router } from "express";
import { pool } from "../db/index.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { normalizeCpf } from "../utils.js";

const router = Router();
const MAX_ADOPTION_PHOTOS = 5;
const MAX_ADOPTION_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_ADOPTION_TOTAL_BYTES = 8 * 1024 * 1024;

function estimatePhotoBytes(photo = "") {
  if (typeof photo !== "string" || !photo) return 0;
  const commaIndex = photo.indexOf(",");
  if (photo.startsWith("data:") && commaIndex !== -1) {
    return Buffer.byteLength(photo.slice(commaIndex + 1), "base64");
  }
  return Buffer.byteLength(photo, "utf8");
}

function validatePhotos(photos = []) {
  if (!Array.isArray(photos)) {
    return { ok: false, status: 400, error: "Formato de fotos invalido." };
  }

  if (photos.length > MAX_ADOPTION_PHOTOS) {
    return { ok: false, status: 400, error: `Limite de ${MAX_ADOPTION_PHOTOS} imagens por animal.` };
  }

  const sizes = photos.map((photo) => estimatePhotoBytes(photo));
  if (sizes.some((size) => size > MAX_ADOPTION_PHOTO_BYTES)) {
    return {
      ok: false,
      status: 413,
      error: `Cada imagem pode ter no maximo ${Math.floor(MAX_ADOPTION_PHOTO_BYTES / (1024 * 1024))}MB.`,
    };
  }

  const total = sizes.reduce((acc, size) => acc + size, 0);
  if (total > MAX_ADOPTION_TOTAL_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `Total de imagens excedido. Limite: ${Math.floor(MAX_ADOPTION_TOTAL_BYTES / (1024 * 1024))}MB.`,
    };
  }

  return { ok: true };
}

router.get("/by-key/:validationKey", async (req, res) => {
  try {
    const cleanCpf = normalizeCpf(req.query.cpf);
    if (cleanCpf.length !== 11) {
      return res.status(400).json({ error: "CPF obrigatorio para consulta." });
    }

    const { rows: keyRows } = await pool.query(
      "SELECT cpf FROM request_validation_keys WHERE cpf = $1 AND validation_key = $2",
      [cleanCpf, req.params.validationKey]
    );
    if (!keyRows[0]) return res.json([]);
    const cpf = keyRows[0].cpf;
    const { rows } = await pool.query(
      `SELECT * FROM adoptions
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(interests) AS elem
         WHERE elem->>'cpf' = $1
       )
       ORDER BY created_at DESC`,
      [cpf]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/consult", async (req, res) => {
  try {
    const { validationKey, cpf } = req.body || {};
    const cleanCpf = normalizeCpf(cpf);
    if (cleanCpf.length !== 11) return res.status(400).json({ error: "CPF obrigatorio para consulta." });
    if (!validationKey) return res.status(400).json({ error: "Chave de consulta obrigatoria." });

    const { rows: keyRows } = await pool.query(
      "SELECT cpf FROM request_validation_keys WHERE cpf = $1 AND validation_key = $2",
      [cleanCpf, String(validationKey).trim()],
    );
    if (!keyRows[0]) return res.status(404).json({ error: "CPF e chave de validacao nao conferem." });

    const { rows } = await pool.query(
      `SELECT * FROM adoptions
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(interests) AS elem
         WHERE elem->>'cpf' = $1
       )
       ORDER BY created_at DESC`,
      [cleanCpf],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM adoptions ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", auth, async (req, res) => {
  const { animal_name, species, sex, age, description, health, photo_url, photos, main_photo_index } = req.body;
  try {
    const safePhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
    const photosValidation = validatePhotos(safePhotos);
    if (!photosValidation.ok) return res.status(photosValidation.status).json({ error: photosValidation.error });

    const safeMainPhotoIndex = Number.isInteger(main_photo_index) ? main_photo_index : 0;
    const selectedPhoto = safePhotos[safeMainPhotoIndex] || safePhotos[0] || photo_url || "";
    const { rows } = await pool.query(
      `INSERT INTO adoptions (animal_name, species, sex, age, description, health, photo_url, photos, main_photo_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [animal_name, species, sex, age, description, JSON.stringify(health || []), selectedPhoto, JSON.stringify(safePhotos), safeMainPhotoIndex],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/interest", optionalAuth, async (req, res) => {
  const { name, phone, visit_date, cpf } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Nome e telefone sao obrigatorios." });

  try {
    const { rows: current } = await pool.query("SELECT interests, status FROM adoptions WHERE id=$1", [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: "Animal nao encontrado." });

    const interests = Array.isArray(current[0].interests) ? current[0].interests : [];
    const normalizedCpf = normalizeCpf(cpf);
    const newInterest = { name, phone, visit_date: visit_date || null, ...(normalizedCpf ? { cpf: normalizedCpf } : {}), created_at: new Date().toISOString() };
    const updatedInterests = [...interests, newInterest];
    const newStatus = current[0].status === "adotado" ? "adotado" : "em_processo";

    const { rows } = await pool.query(
      "UPDATE adoptions SET interests=$1, status=$2 WHERE id=$3 RETURNING *",
      [JSON.stringify(updatedInterests), newStatus, req.params.id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/interests", auth, async (req, res) => {
  const { rows } = await pool.query("SELECT interests FROM adoptions WHERE id=$1", [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "Animal nao encontrado." });
  const interests = rows[0].interests;
  res.json(Array.isArray(interests) ? interests : []);
});

router.delete("/:id/interest/:index", auth, async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  try {
    const { rows: current } = await pool.query("SELECT interests, status FROM adoptions WHERE id=$1", [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: "Animal nao encontrado." });

    const interests = Array.isArray(current[0].interests) ? current[0].interests : [];
    const updated = interests.filter((_, i) => i !== idx);
    const newStatus = updated.length === 0 && current[0].status === "em_processo" ? "disponivel" : current[0].status;

    const { rows } = await pool.query(
      "UPDATE adoptions SET interests=$1, status=$2 WHERE id=$3 RETURNING *",
      [JSON.stringify(updated), newStatus, req.params.id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", auth, async (req, res) => {
  const allowed = ["status", "animal_name", "species", "sex", "age", "description", "health", "photo_url", "photos", "main_photo_index", "adopted_at"];
  const entries = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ error: "Nenhum campo valido." });

  if (Object.prototype.hasOwnProperty.call(req.body, "photos")) {
    const safePhotos = Array.isArray(req.body.photos) ? req.body.photos.filter(Boolean) : req.body.photos;
    const photosValidation = validatePhotos(safePhotos);
    if (!photosValidation.ok) return res.status(photosValidation.status).json({ error: photosValidation.error });
  }

  const fields = entries.map(([k, v]) => [k, k === "health" || k === "photos" ? JSON.stringify(v || []) : v]);
  const set = fields.map(([k], i) => `${k}=$${i + 1}`).join(", ");
  const vals = fields.map(([, v]) => v);

  try {
    const { rows } = await pool.query(
      `UPDATE adoptions SET ${set} WHERE id=$${fields.length + 1} RETURNING *`,
      [...vals, req.params.id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    await pool.query("DELETE FROM adoptions WHERE id=$1", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
