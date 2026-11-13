import { pool } from "../../db/index.js";
import { isGlobalUser } from "../../tenant.js";
import { lockMunicipalSchedule } from "./schedule-lock.js";

export async function mutateSchedule({ municipalityId, user, rowId }, operation) {
  const client = await pool.connect();
  try {
    let lockedDay;
    await client.query("BEGIN");
    if (rowId) {
      const scope = isGlobalUser(user) ? "" : " AND municipality_id = $2";
      const values = isGlobalUser(user) ? [rowId] : [rowId, user.municipalityId];
      const { rows } = await client.query(`SELECT * FROM schedule_days WHERE id = $1${scope}`, values);
      if (!rows[0]) throw Object.assign(new Error("Agenda não encontrada."), { status: 404 });
      lockedDay = rows[0];
      municipalityId = rows[0].municipality_id;
    }
    await lockMunicipalSchedule(client, municipalityId);
    if (rowId) {
      const { rows } = await client.query("SELECT * FROM schedule_days WHERE id = $1 AND municipality_id = $2 FOR UPDATE", [rowId, municipalityId]);
      if (!rows[0]) throw Object.assign(new Error("Agenda não encontrada."), { status: 404 });
      lockedDay = rows[0];
    }
    const result = await operation(client, municipalityId, lockedDay);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); }
}
