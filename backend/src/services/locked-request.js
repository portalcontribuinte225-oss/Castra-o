import { isGlobalUser } from "../tenant.js";
import { lockMunicipalSchedule } from "./schedule/schedule-lock.js";

// Inside a transaction: takes the municipality's agenda lock and then the request row, scoped to the user's municipality (a global
// user reaches the request of any municipality). Answers the row, or null when the user cannot reach it.
export async function lockRequestForUpdate(client, { id, user }) {
  const global = isGlobalUser(user);
  const lockMunicipality = global
    ? (await client.query("SELECT municipality_id FROM requests WHERE id = $1", [id])).rows[0]?.municipality_id
    : user.municipalityId;
  if (lockMunicipality) await lockMunicipalSchedule(client, lockMunicipality);
  const { rows } = await client.query(
    `SELECT * FROM requests WHERE id = $1${global ? "" : " AND municipality_id = $2"} FOR UPDATE`,
    global ? [id] : [id, user.municipalityId],
  );
  return rows[0] || null;
}
