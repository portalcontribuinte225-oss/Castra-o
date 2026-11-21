import { updateConfigValueInTransaction } from "../../repositories/config-values.js";
import { authError } from "./auth-security.js";

const TEAMS_CONFIG_KEY = "castragestao:teams";

export function readTeamDetails(value) {
  if (value === undefined) return null;
  if (!Array.isArray(value?.sectorIds) || value.sectorIds.some((id) => typeof id !== "string" || !id)
    || [value.matricula, value.cargo, value.permissionGroupId].some((field) => typeof field !== "string")) {
    throw authError(400, "Informe os dados da equipe corretamente.");
  }
  const sectorIds = [...new Set(value.sectorIds)];
  return {
    sectorIds, sectorId: sectorIds[0] || "",
    matricula: value.matricula.trim(), cargo: value.cargo.trim(), permissionGroupId: value.permissionGroupId,
  };
}

export async function saveTeamUser(client, user, details) {
  const municipalityId = user.municipality_id;
  if (!municipalityId) return null;
  const config = await updateConfigValueInTransaction(client, TEAMS_CONFIG_KEY, municipalityId, (current) => {
    const users = Array.isArray(current?.users) ? current.users : [];
    const previous = users.find((entry) => entry?.id === user.id);
    if (!previous && !details) return undefined;
    const entry = { ...previous, ...details, id: user.id, municipalityId, name: user.name, email: user.email, role: user.role, active: user.active };
    return {
      ...current,
      sectors: Array.isArray(current?.sectors) ? current.sectors : [],
      users: previous ? users.map((item) => item?.id === user.id ? entry : item) : [...users, entry],
    };
  });
  return Array.isArray(config?.users) ? config.users.find((entry) => entry?.id === user.id) || null : null;
}
