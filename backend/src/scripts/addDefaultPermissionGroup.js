import { pool } from "../db/index.js";
import { buildDefaultPermissionGroup, DEFAULT_PERMISSION_GROUP_ID } from "../municipalityDefaults.js";

async function run() {
  const client = await pool.connect();
  try {
    // Busca o município
    const { rows: munRows } = await client.query(
      "SELECT id, name, state FROM municipalities WHERE lower(name) LIKE '%criciuma%' OR lower(name) LIKE '%criciúma%' LIMIT 1",
    );
    if (!munRows[0]) {
      console.error("Município Criciúma não encontrado.");
      process.exitCode = 1;
      return;
    }
    const municipality = munRows[0];
    console.log(`Município encontrado: ${municipality.name} / ${municipality.state} (${municipality.id})`);

    // Insere o grupo de permissão padrão
    const group = buildDefaultPermissionGroup();
    await client.query(
      `INSERT INTO config (key, municipality_id, value, updated_at)
       VALUES ('permission_groups', $1, $2, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$2, updated_at=NOW()`,
      [municipality.id, JSON.stringify([group])],
    );
    console.log(`Grupo "${group.name}" criado.`);

    // Atualiza o teams para vincular o admin_municipal ao grupo
    const { rows: teamsRows } = await client.query(
      "SELECT value FROM config WHERE key='castragestao:teams' AND municipality_id=$1",
      [municipality.id],
    );
    if (teamsRows[0]?.value) {
      const teams = teamsRows[0].value;
      const updatedUsers = (teams.users || []).map((u) =>
        u.role === "admin_municipal" || u.defaultMunicipalityUser
          ? { ...u, permissionGroupId: DEFAULT_PERMISSION_GROUP_ID }
          : u,
      );
      await client.query(
        `UPDATE config SET value=$1, updated_at=NOW()
         WHERE key='castragestao:teams' AND municipality_id=$2`,
        [JSON.stringify({ ...teams, users: updatedUsers }), municipality.id],
      );
      console.log(`Usuário admin_municipal vinculado ao grupo.`);
    }

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
