import { pool } from "../db/index.js";
import { DEFAULT_MUNICIPALITY_SECTOR_ID, DEFAULT_MUNICIPALITY_SECTOR_NAME } from "../municipalityDefaults.js";

async function run() {
  const client = await pool.connect();
  try {
    const { rows: munRows } = await client.query(
      "SELECT id, name FROM municipalities WHERE lower(name) LIKE '%criciuma%' OR lower(name) LIKE '%criciúma%' LIMIT 1",
    );
    if (!munRows[0]) {
      console.error("Município Criciúma não encontrado.");
      process.exitCode = 1;
      return;
    }
    const municipality = munRows[0];
    console.log(`Município: ${municipality.name} (${municipality.id})`);

    const { rows } = await client.query(
      "SELECT value FROM config WHERE key='castragestao:teams' AND municipality_id=$1",
      [municipality.id],
    );
    if (!rows[0]?.value) {
      console.error("Config castragestao:teams não encontrada.");
      process.exitCode = 1;
      return;
    }

    const teams = rows[0].value;
    const updatedSectors = (teams.sectors || []).map((s) =>
      s.id === DEFAULT_MUNICIPALITY_SECTOR_ID
        ? { ...s, name: DEFAULT_MUNICIPALITY_SECTOR_NAME }
        : s,
    );
    const updatedUsers = (teams.users || []).map((u) =>
      u.sectorId === DEFAULT_MUNICIPALITY_SECTOR_ID || (u.sectorIds || []).includes(DEFAULT_MUNICIPALITY_SECTOR_ID)
        ? { ...u, sectorId: DEFAULT_MUNICIPALITY_SECTOR_ID }
        : u,
    );

    await client.query(
      "UPDATE config SET value=$1, updated_at=NOW() WHERE key='castragestao:teams' AND municipality_id=$2",
      [JSON.stringify({ ...teams, sectors: updatedSectors, users: updatedUsers }), municipality.id],
    );

    console.log(`Setor corrigido para "${DEFAULT_MUNICIPALITY_SECTOR_NAME}".`);
    console.log("Concluído.");
  } catch (err) {
    console.error("Erro:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
