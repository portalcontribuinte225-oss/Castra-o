import { useCallback, useState } from "react";
import type { AnyRecord } from "../types";
import { getItemMunicipalityId, mergeTags, normalizeRequest } from "../domain";
import { getNotificationNotice } from "./notifications/notification-results";
import { normalizeText } from "../utils";
import { REJECTED_CANCEL_REASON } from "../../shared/notification-contract.js";

export function canEditRequests(role = ""): boolean {
  return ["master", "suporte", "admin_municipal", "analista", "servidor_publico"].includes(normalizeText(role));
}

type ShowToast = (message: string, type?: "success" | "error" | "info" | "warning") => void;

function getActionUserSectorIds(user: AnyRecord = {}) {
  const ids = Array.isArray(user.sectorIds) ? user.sectorIds : [];
  return [...new Set([...ids, user.sectorId].filter(Boolean))];
}
export function useRequestActions({
  patchRequest,
  runProcedureAction,
  currentUser,
  teams = { sectors: [], users: [] },
  showToast,
  setSelectedId,
}: {
  patchRequest?: (id: string, patch: AnyRecord, note?: string) => Promise<AnyRecord>;
  runProcedureAction?: (id: string, action: AnyRecord) => Promise<AnyRecord>;
  currentUser: AnyRecord;
  teams?: AnyRecord;
  showToast: ShowToast;
  setSelectedId?: (id: string) => void;
}) {
  const [previewRequest, setPreviewRequest] = useState<AnyRecord | null>(null);

  const activeUsers = teams.users?.filter((user: AnyRecord) => user.active !== false) || [];
  const activeSectors = teams.sectors?.filter((sector: AnyRecord) => sector.active !== false) || [];
  const currentTeamUser = activeUsers.find((user: AnyRecord) => user.id === currentUser?.id)
    || activeUsers.find((user: AnyRecord) => user.email && currentUser?.email && user.email.toLowerCase() === currentUser.email.toLowerCase());

  function showNotificationNotice(updated: AnyRecord) {
    const notice = getNotificationNotice(updated?.notificationResults);
    if (notice) showToast(notice.message, notice.type);
  }

  const openRequest = useCallback((request: AnyRecord) => {
    setSelectedId?.(request.id);
    setPreviewRequest(request);
  }, [setSelectedId]);

  function closePreview() {
    setPreviewRequest(null);
  }

  // The tutor data saved in the attendance replaces the data of the request on screen, which is a copy taken when it was opened.
  function updatePreviewTutor(tutor: AnyRecord) {
    setPreviewRequest((current) => current ? normalizeRequest({ ...current, tutor: tutor.name, tutor_name: tutor.name, email: tutor.email, tutor_email: tutor.email,
      phone: tutor.phone, address: tutor.address, neighborhood: tutor.neighborhood, city: tutor.city, state: tutor.state, cep: tutor.cep }) : current);
  }

  // One action on one procedure of the request; the request the server answers replaces the one on screen and is returned (or null).
  async function applyProcedureAction(request: AnyRecord, action: AnyRecord, successMessage: string): Promise<AnyRecord | null> {
    try {
      const updated = await runProcedureAction?.(request.id, action);
      if (!updated) return null;
      if (successMessage) showToast(successMessage, "success");
      showNotificationNotice(updated);
      const normalized = normalizeRequest(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalized : current);
      return normalized;
    } catch (failure) { showToast(failure?.message || "Não foi possível atualizar o procedimento.", "error"); return null; }
  }

  // The attachments tab saves each document decision and each evidence as soon as it is made.
  async function updateDocuments(request: AnyRecord, patch: AnyRecord, note: string) {
    try {
      const updated = await patchRequest?.(request.id, patch, note);
      if (!updated) return false;
      showNotificationNotice(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      return true;
    } catch (failure) { showToast(failure?.message || "Não foi possível salvar a conferência do documento.", "error"); return false; }
  }

  async function assignFromPreview(request: AnyRecord, assignment: AnyRecord = {}) {
    if (!request) return;
    const sector = activeSectors.find((item: AnyRecord) => item.id === assignment.sectorId);
    const user = activeUsers.find((item: AnyRecord) => item.id === assignment.userId);
    if (!sector || !user) return;
    const patch = {
      assignedSectorId: sector.id,
      assignedSectorName: sector.name,
      assignedUserId: user.id,
      responsible: user.name || sector.name || "Equipe",
      tags: mergeTags(request.tags, ["ATRIBUIDA"]),
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Atribuída para ${sector.name} / ${user.name}`);
      if (!updated) return false;
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      showToast(`Atribuído para ${user.name} — ${sector.name}`, "success");
      return true;
    } catch { showToast("Erro ao atribuir processo", "error"); return false; }
  }

  async function assumeFromPreview(request: AnyRecord) {
    if (!request) return;
    const municipalityId = getItemMunicipalityId(request);
    const sectors = activeSectors.filter((sector: AnyRecord) => !getItemMunicipalityId(sector) || getItemMunicipalityId(sector) === municipalityId);
    const userSectorIds = getActionUserSectorIds(currentTeamUser);
    const sector = sectors.find((item: AnyRecord) => userSectorIds.includes(item.id))
      || sectors.find((item: AnyRecord) => item.id === request.assignedSectorId) || sectors[0];
    if (!sector) {
      showToast("Nenhum setor ativo disponivel para assumir o processo", "error");
      return;
    }
    const userId = currentTeamUser?.id || currentUser?.id || "";
    const userName = currentTeamUser?.name || currentUser?.name || "Usuario atual";
    const patch = {
      assignedSectorId: sector.id,
      assignedSectorName: sector.name,
      assignedUserId: userId,
      responsible: userName,
      tags: mergeTags(request.tags, ["ATRIBUIDA"]),
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Assumida por ${userName}`);
      if (!updated) return;
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      showToast("Processo assumido com sucesso", "success");
    } catch { showToast("Erro ao assumir processo", "error"); }
  }
  async function rejectRequestFromProcess(request: AnyRecord, data: AnyRecord = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    const patch = {
      status: "CANCELADA",
      rejectionReason: data.category || note || REJECTED_CANCEL_REASON,
      rejectionNote: note,
      workflow_data: { ...((request.workflow_data || request.workflowData) || {}), cancelReason: REJECTED_CANCEL_REASON },
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`);
      showToast("Processo indeferido", "warning");
      showNotificationNotice(updated);
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

  return {
    previewRequest,
    openRequest,
    closePreview,
    updatePreviewTutor,
    activeSectors,
    activeUsers,
    applyProcedureAction,
    updateDocuments,
    assignFromPreview,
    assumeFromPreview,
    rejectRequestFromProcess,
    confirmSpecialRequest,
  };
}
