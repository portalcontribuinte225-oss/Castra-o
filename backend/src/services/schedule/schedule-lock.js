// A single municipal lock orders booking, source-document and animal locks consistently.
// Transactions end before providers run; the coarse lock also covers calendar rule edits.
export async function lockMunicipalSchedule(client, municipalityId) {
  if (!municipalityId) throw Object.assign(new Error("Município obrigatório."), { status: 400 });
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`schedule:${municipalityId}`]);
}
