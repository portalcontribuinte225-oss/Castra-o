import { scheduleDate, displayScheduleDate } from "../../../shared/schedule-contract.js";

// Uses the established pg transaction, with an explicit municipality in every query.
export async function loadScheduleAvailability(database, { municipalityId, from, to, excludeId = null }) {
  const dates = [];
  for (let instant = Date.parse(`${from}T00:00:00Z`); instant <= Date.parse(`${to}T00:00:00Z`); instant += 86400000) {
    const iso = scheduleDate(new Date(instant).toISOString().slice(0, 10));
    dates.push(iso, displayScheduleDate(iso));
  }
  const { rows: days } = await database.query("SELECT * FROM schedule_days WHERE municipality_id = $1", [municipalityId]);
  const { rows: configuration } = await database.query("SELECT value FROM config WHERE key = $1 AND municipality_id = $2", ["castragestao:schedule-rules", municipalityId]);
  const { rows: requests } = await database.query(
    `SELECT id, status, schedule_date, animals, workflow_data FROM requests
     WHERE municipality_id = $1 AND schedule_date = ANY($2::text[]) AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [municipalityId, dates, excludeId],
  );
  return { days, rules: Array.isArray(configuration[0]?.value) ? configuration[0].value : [], requests };
}
