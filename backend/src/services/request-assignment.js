import { readMunicipalityPermissions, requestsMenuAllowed } from "./config-permission.js";
import { isUuid } from "../repositories/request-tracking.js";
import { isClosedRequest } from "../../../shared/request-procedure-contract.js";

function fail(message, status = 409) {
  throw Object.assign(new Error(message), { status });
}

export async function resolveRequestAssignment(database, request, incoming) {
  const current = request.workflow_data || {};
  const sectorId = incoming.assignedSectorId ?? current.assignedSectorId ?? "";
  const userId = incoming.assignedUserId ?? current.assignedUserId ?? "";
  if (sectorId === (current.assignedSectorId || "") && userId === (current.assignedUserId || "")) return null;
  if (isClosedRequest(request)) fail("Este atendimento já foi encerrado.");
  if (typeof sectorId !== "string" || !sectorId || sectorId.length > 200 || (userId !== "" && !isUuid(userId))) {
    fail("Informe um setor e um responsável válidos.", 400);
  }
  const municipalityId = request.municipality_id;
  if (!municipalityId) fail("Vincule o processo a uma prefeitura antes de definir o responsável.");
  const permissions = await readMunicipalityPermissions(municipalityId, database);
  const sectors = Array.isArray(permissions.teams?.sectors) ? permissions.teams.sectors : [];
  const sector = sectors.find((item) => item?.id === sectorId && item.active !== false
    && (!item.municipalityId || item.municipalityId === municipalityId));
  if (!sector) fail("Selecione um setor ativo da prefeitura.");
  let responsible = "";
  if (userId) {
    const users = Array.isArray(permissions.teams?.users) ? permissions.teams.users : [];
    const membership = users.find((item) => item?.id === userId && item.active !== false
      && (item.sectorId === sectorId || (Array.isArray(item.sectorIds) && item.sectorIds.includes(sectorId))));
    if (!membership) fail("O responsável deve fazer parte do setor escolhido.");
    const { rows } = await database.query(
      `SELECT u.id, u.name, u.role, u.active, u.must_change_password
       FROM users u JOIN municipalities m ON m.id = u.municipality_id AND m.active = TRUE
       WHERE u.municipality_id = $1 AND u.id = $2`, [municipalityId, userId],
    );
    const user = rows[0];
    if (!user?.active || user.must_change_password || !requestsMenuAllowed(user, permissions)) {
      fail("O responsável precisa ter acesso ativo aos processos da prefeitura.");
    }
    responsible = user.name || membership.name || "";
  }
  return { assignedSectorId: sectorId, assignedUserId: userId, assignedSectorName: sector.name, responsible };
}
