import { useState } from "react";
import type { AnyRecord } from "../types";
import { mergeTags, normalizeRequest } from "../domain";
import { getNotificationNotice } from "./notifications/notification-results";
import type { NotificationResult } from "./notifications/notification-results";
import { normalizeText } from "../utils";

export function canEditRequests(role = ""): boolean {
  return ["master", "suporte", "admin_municipal", "analista", "servidor_publico"].includes(normalizeText(role));
}

export function getPerformedProceduresLabel(request: AnyRecord = {}) {
  const animals = Array.isArray(request.animals) ? request.animals : [];
  const procedures = animals.map((animal: AnyRecord) => animal.procedure).filter(Boolean);
  const uniqueProcedures = [...new Set(procedures)];
  return uniqueProcedures.length ? uniqueProcedures.join(", ") : request.type || request.request_type || "Procedimento realizado";
}

type ShowToast = (message: string, type?: "success" | "error" | "info" | "warning") => void;

function getActionUserSectorIds(user: AnyRecord = {}) {
  const ids = Array.isArray(user.sectorIds) ? user.sectorIds : [];
  return [...new Set([...ids, user.sectorId].filter(Boolean))];
}
export function useRequestActions({
  patchRequest,
  currentUser,
  teams = { sectors: [], users: [] },
  showToast,
  setSelectedId,
}: {
  patchRequest?: (id: string, patch: AnyRecord, note?: string) => Promise<AnyRecord>;
  currentUser: AnyRecord;
  teams?: AnyRecord;
  showToast: ShowToast;
  setSelectedId?: (id: string) => void;
}) {
  const [previewRequest, setPreviewRequest] = useState<AnyRecord | null>(null);

  const activeUsers = teams.users?.filter((user: AnyRecord) => user.active !== false) || [];
  const activeSectors = teams.sectors?.filter((sector: AnyRecord) => sector.active !== false) || [];
  const currentTeamUser = activeUsers.find((user: AnyRecord) => user.email && currentUser?.email && user.email.toLowerCase() === currentUser.email.toLowerCase())
    || activeUsers.find((user: AnyRecord) => user.id === currentUser?.id);
  const currentUserSector = activeSectors.find((sector: AnyRecord) => getActionUserSectorIds(currentTeamUser).includes(sector.id));

  function showNotificationNotice(updated: AnyRecord, precedingResults: NotificationResult[] = []) {
    const notice = getNotificationNotice(updated?.notificationResults, precedingResults);
    if (notice) showToast(notice.message, notice.type);
  }

  function openRequest(request: AnyRecord) {
    setSelectedId?.(request.id);
    setPreviewRequest(request);
  }

  function closePreview() {
    setPreviewRequest(null);
  }

  async function approveRequest(request: AnyRecord, precedingResults: NotificationResult[] = []) {
    const patch = { status: "AGENDADA" };
    try {
      const updated = await patchRequest?.(request.id, patch, `Agenda confirmada por ${currentUser.name}`);
      showToast("Agenda confirmada com sucesso", "success");
      showNotificationNotice(updated, precedingResults);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch, ...updated }) : current);
      return true;
    } catch (failure) { showToast(failure?.message || "Erro ao confirmar agenda", "error"); return false; }
  }

  async function archiveWithTag(request: AnyRecord, tag: string, note?: string) {
    const cancelReason = tag === "NAO_COMPARECEU" ? "Não compareceu" : tag === "CANCELADA" ? "Cancelado" : "";
    const patch = cancelReason
      ? { status: "CANCELADA", workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason } }
      : { status: "CANCELADA", workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: tag } };
    try {
      await patchRequest?.(request.id, patch, note);
      showToast("Processo cancelado", "info");
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
    } catch (failure) { showToast(failure?.message || "Erro ao cancelar processo", "error"); }
  }

  async function rescheduleFromPreview(request: AnyRecord, date: string, reason = "", selection?: { occurrenceKey: string; time: string }) {
    if (!request || !date) return;
    const note = String(reason || "").trim();
    const patch = {
      status: request.status,
      tags: mergeTags(request.tags, ["REAGENDADA"]),
      previousSchedule: request.preferredSchedule || request.appointment || "Não informado",
      preferredSchedule: date,
      appointment: date,
      ...(selection ? { workflow_data: { ...(request.workflow_data || request.workflowData || {}), scheduleOccurrenceKey: selection.occurrenceKey, scheduleSlotTime: selection.time, scheduleTime: selection.time } } : {}),
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Reagendada por ${currentUser.name}: ${request.preferredSchedule || "sem data"} -> ${date}${note ? `. Motivo: ${note}` : ""}`);
      showToast(`Processo reagendado para ${date}`, "success");
      showNotificationNotice(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch, ...updated }) : current);
      return true;
    } catch (failure) { showToast(failure?.message || "Erro ao reagendar processo", "error"); return false; }
  }

  async function assignFromPreview(request: AnyRecord, assignment: AnyRecord = {}) {
    if (!request) return;
    const sector = activeSectors.find((item: AnyRecord) => item.id === assignment.sectorId);
    const user = activeUsers.find((item: AnyRecord) => item.id === assignment.userId);
    if (!sector || !user) return;
    const patch = {
      status: request.status,
      assignedSectorId: sector.id,
      assignedSectorName: sector.name,
      assignedUserId: user.id,
      responsible: user.name || sector.name || "Equipe",
      tags: mergeTags(request.tags, ["ATRIBUIDA"]),
    };
    try {
      await patchRequest?.(request.id, patch, `Atribuída para ${sector.name} / ${user.name}`);
      showToast(`Atribuído para ${user.name} — ${sector.name}`, "success");
    } catch { showToast("Erro ao atribuir processo", "error"); }
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }

  async function assumeFromPreview(request: AnyRecord) {
    if (!request) return;
    const currentAssignedSector = activeSectors.find((sector: AnyRecord) => sector.id === request.assignedSectorId);
    const sector = currentUserSector || currentAssignedSector || activeSectors[0];
    if (!sector) {
      showToast("Nenhum setor ativo disponivel para assumir o processo", "error");
      return;
    }
    const userId = currentTeamUser?.id || currentUser?.id || "";
    const userName = currentTeamUser?.name || currentUser?.name || "Usuario atual";
    const patch = {
      status: request.status,
      assignedSectorId: sector.id,
      assignedSectorName: sector.name,
      assignedUserId: userId,
      responsible: userName,
      tags: mergeTags(request.tags, ["ATRIBUIDA"]),
    };
    try {
      await patchRequest?.(request.id, patch, `Assumida por ${userName}`);
      showToast("Processo assumido com sucesso", "success");
    } catch { showToast("Erro ao assumir processo", "error"); }
    setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
  }
  async function rejectRequestFromProcess(request: AnyRecord, data: AnyRecord = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    const patch = {
      status: "CANCELADA",
      rejectionReason: data.category || note || "Indeferido",
      rejectionNote: note,
      workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: "Indeferido" },
    };
    try {
      await patchRequest?.(request.id, patch, `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`);
      showToast("Processo indeferido", "warning");
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch }) : current);
    } catch (failure) { showToast(failure?.message || "Erro ao indeferir processo", "error"); }
  }

  async function confirmSpecialRequest(request: AnyRecord, data: AnyRecord = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    const patch: AnyRecord = { status: "REALIZADA" };
    if (note) patch.workflow_data = { ...((request.workflow_data || request.workflowData) || {}), complaintResolutionNote: note };
    try {
      const updated = await patchRequest?.(request.id, patch, `Confirmado por ${currentUser.name}${note ? `. Conclusão: ${note}` : ""}`);
      showToast("Processo confirmado com sucesso", "success");
      showNotificationNotice(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch, ...updated }) : current);
    } catch (failure) { showToast(failure?.message || "Erro ao confirmar processo", "error"); }
  }

  async function confirmAttendanceFromProcess(request: AnyRecord, data: AnyRecord = {}) {
    if (!request) return;
    const normalized = normalizeRequest(request);
    const microchip = String(data.microchip || "").trim();
    const note = String(data.note || "").trim();
    const receita = String(data.receita || "").trim();
    const performedProcedures = getPerformedProceduresLabel(normalized);
    const animalData = data.animalData && typeof data.animalData === "object" ? data.animalData : {};
    const hasAnimalData = Object.keys(animalData).length > 0;
    const currentAnimals = Array.isArray(normalized.animals) ? normalized.animals : [];
    const animals = currentAnimals.length > 0
      ? currentAnimals.map((animal: AnyRecord, index: number) => index === 0 ? {
        ...animal,
        ...(hasAnimalData ? animalData : {}),
        ...(microchip ? { hasChip: "Sim", microchip, confirmedMicrochip: microchip } : {}),
      } : { ...animal, ...(data.confirmedAnimalChips?.[animal.id] ? { confirmedMicrochip: String(data.confirmedAnimalChips[animal.id]).trim() } : {}) })
      : hasAnimalData || microchip
        ? [{ ...(hasAnimalData ? animalData : {}), ...(microchip ? { hasChip: "Sim", microchip } : {}) }]
        : currentAnimals;
    const patch = {
      status: "REALIZADA",
      animalMicrochip: microchip,
      animals,
      workflow_data: { performedProcedures, attendanceMicrochip: microchip, attendanceNote: note, attendancePrescription: receita },
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Comparecimento confirmado${microchip ? `. Microchip: ${microchip}` : ""}${receita ? `. Receita registrada` : ""}${note ? `. Observação: ${note}` : ""}`);
      showToast("Comparecimento confirmado — procedimento realizado", "success");
      showNotificationNotice(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest({ ...current, ...patch, ...updated }) : current);
    } catch (failure) { showToast(failure?.message || "Erro ao confirmar comparecimento", "error"); }
  }

  return {
    previewRequest,
    openRequest,
    closePreview,
    activeSectors,
    activeUsers,
    approveRequest,
    archiveWithTag,
    rescheduleFromPreview,
    assignFromPreview,
    assumeFromPreview,
    rejectRequestFromProcess,
    confirmAttendanceFromProcess,
    confirmSpecialRequest,
  };
}
