import { pool } from "../db/index.js";

// The columns of an animal that the public adoption page already shows; the interests come only to be counted.
const PUBLIC_COLUMNS = `a.id, a.animal_name, a.species, a.sex, a.age, a.description, a.health, a.photo_url, a.photos,
  a.main_photo_index, a.status, a.municipality_id, a.adopted_at, a.created_at, a.interests`;

// An animal for adoption of an active municipality, by id; null when there is none.
export async function loadPublicAdoption(id, database = pool) {
  const { rows } = await database.query(
    `SELECT ${PUBLIC_COLUMNS}
       FROM adoptions a
       JOIN municipalities m ON m.id = a.municipality_id AND m.active = TRUE
      WHERE a.id = $1`,
    [id],
  );
  return rows[0] || null;
}
