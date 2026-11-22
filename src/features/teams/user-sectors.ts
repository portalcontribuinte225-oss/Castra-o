import type { AnyRecord } from "../../types";

export function getUserSectorIds(user: AnyRecord = {}) {
  const ids = Array.isArray(user.sectorIds) ? user.sectorIds : [];
  return [...new Set([...ids, user.sectorId].filter(Boolean))];
}

export function userBelongsToSector(user: AnyRecord = {}, sectorId = "") {
  return Boolean(sectorId && getUserSectorIds(user).includes(sectorId));
}
