/**
 * Corrige dados padrão do município sem apagar dados criados pelo usuário.
 * - Corrige nome do setor padrão
 * - Corrige campos do usuário padrão (cargo, role, sectorIds, permissionGroupId)
 * - Recria o grupo de permissão padrão
 * Usage: node --experimental-vm-modules backend/src/scripts/repairDefaults.js
 */
import { pool } from "../db/index.js";
import {
  DEFAULT_MUNICIPALITY_SECTOR_ID,
  DEFAULT_MUNICIPALITY_SECTOR_NAME,
  DEFAULT_PERMISSION_GROUP_ID,
  buildDefaultPermissionGroup,
} from "../municipalityDefaults.js";

async function run() {
  const client = await pool.connect();
  try {
    const { rows: munRows } = await client.query(
      "SELECT id, name, state FROM municipalities WHERE lower(name) LIKE '%criciuma%' OR lower(name) LIKE '%criciúma%' LIMIT 1",
    );
    if (!munRows[0]) {
      console.error("Município Criciúma não encontrado.");
      process.exitCode = 1;
      return;
    }
    const municipality = munRows[0];
    console.log(`Município: ${municipality.name} / ${municipality.state} (${municipality.id})`);

    // ── 1. Corrige setor padrão e usuário padrão em castragestao:teams ──
    const { rows: teamsRows } = await client.query(
      "SELECT value FROM config WHERE key='castragestao:teams' AND municipality_id=$1",
      [municipality.id],
    );
    if (teamsRows[0]?.value) {
      const teams = teamsRows[0].value;

      const updatedSectors = (teams.sectors || []).map((s) =>
        s.id === DEFAULT_MUNICIPALITY_SECTOR_ID
          ? { ...s, name: DEFAULT_MUNICIPALITY_SECTOR_NAME, defaultMunicipalitySector: true }
          : s,
      );

      const updatedUsers = (teams.users || []).map((u) => {
        if (!u.defaultMunicipalityUser) return u;
        return {
          ...u,
          cargo: u.cargo || "Administrador municipal",
          role: u.role || "admin_municipal",
          sectorIds: u.sectorIds?.length ? u.sectorIds : [DEFAULT_MUNICIPALITY_SECTOR_ID],
          sectorId: u.sectorId || DEFAULT_MUNICIPALITY_SECTOR_ID,
          permissionGroupId: u.permissionGroupId || DEFAULT_PERMISSION_GROUP_ID,
          active: u.active !== false,
        };
      });

      await client.query(
        "UPDATE config SET value=$1, updated_at=NOW() WHERE key='castragestao:teams' AND municipality_id=$2",
        [JSON.stringify({ ...teams, sectors: updatedSectors, users: updatedUsers }), municipality.id],
      );
      console.log(`✓ Setor padrão corrigido para "${DEFAULT_MUNICIPALITY_SECTOR_NAME}"`);
      console.log(`✓ Usuário padrão revisado`);
    } else {
      console.warn("⚠ castragestao:teams não encontrado para este município.");
    }

    // ── 2. Recria grupo de permissão padrão ──
    const group = buildDefaultPermissionGroup();
    const { rows: pgRows } = await client.query(
      "SELECT value FROM config WHERE key='permission_groups' AND municipality_id=$1",
      [municipality.id],
    );
    const existing = pgRows[0]?.value || [];
    const hasDefault = existing.some((g) => g.id === DEFAULT_PERMISSION_GROUP_ID);
    const updatedGroups = hasDefault
      ? existing.map((g) => (g.id === DEFAULT_PERMISSION_GROUP_ID ? { ...g, ...group } : g))
      : [...existing, group];

    await client.query(
      `INSERT INTO config (key, municipality_id, value, updated_at)
       VALUES ('permission_groups', $1, $2, NOW())
       ON CONFLICT (key, (COALESCE(municipality_id, '00000000-0000-0000-0000-000000000000'::uuid)))
       DO UPDATE SET value=$2, updated_at=NOW()`,
      [municipality.id, JSON.stringify(updatedGroups)],
    );
    console.log(`✓ Grupo de permissão padrão "${group.name}" atualizado`);

    console.log("\nConcluído. Reinicie o servidor para aplicar as mudanças.");
  } catch (err) {
    console.error("Erro:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
