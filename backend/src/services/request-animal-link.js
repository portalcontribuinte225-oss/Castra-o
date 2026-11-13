// Reuse the scoped pg entrypoint supplied by the request transaction; never create another pool.
import { isInternalUser } from "../tenant.js";

export async function validateRequestAnimalLink(client, { body, user, municipalityId }) {
  const animalIds = [...new Set([
    body.animal_id, body.animalId,
    ...(Array.isArray(body.animals) ? body.animals.map((animal) => animal?.id) : []),
  ].filter(Boolean))];
  if (!animalIds.length) return;
  if (!user) throw Object.assign(new Error("Entre na sua conta para vincular um animal cadastrado."), { status: 403 });
  if (animalIds.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw Object.assign(new Error("Identificador do animal inválido."), { status: 400 });
  }
  const internal = isInternalUser(user);
  const { rows } = await client.query(
    `SELECT a.id FROM animals a WHERE a.id = ANY($2::uuid[])
     AND EXISTS (SELECT 1 FROM animal_records r WHERE r.animal_id = a.id AND r.municipality_id = $1)
     ${internal ? "" : "AND EXISTS (SELECT 1 FROM animal_tutors t WHERE t.animal_id = a.id AND t.user_id = $3 AND t.active = TRUE)"}`,
    internal ? [municipalityId, animalIds] : [municipalityId, animalIds, user.id],
  );
  if (rows.length !== animalIds.length) throw Object.assign(new Error("Animal indisponível para esta conta e município."), { status: 403 });
}
