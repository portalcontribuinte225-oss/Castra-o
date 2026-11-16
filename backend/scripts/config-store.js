// Shared by the one-off scripts that load defaults into municipalities that already exist.
export async function readValue(client, key, municipalityId) {
  const { rows } = await client.query("SELECT value FROM config WHERE key=$1 AND municipality_id=$2", [key, municipalityId]);
  return rows[0]?.value;
}

export async function writeValue(client, key, municipalityId, value) {
  await client.query(
    `INSERT INTO config (key, municipality_id, value, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
     DO UPDATE SET value=$3, updated_at=NOW()`,
    [key, municipalityId, JSON.stringify(value)],
  );
}

export function describeTarget() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.hostname}:${url.port || "(default)"}${url.pathname}`;
  } catch {
    return "DATABASE_URL ausente ou inválida";
  }
}
