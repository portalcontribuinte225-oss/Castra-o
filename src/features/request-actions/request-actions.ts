import { useCallback, useState } from "react";
import { RequestStatus, RequestTag } from "../../../shared/request-contract.js";
import type { AnyRecord } from "../../types";
import { mergeTags, normalizeRequest } from "../../domain";
import { getNotificationNotice } from "../notifications/notification-results";
import { normalizeText } from "../../utils";
import { REJECTED_CANCEL_REASON } from "../../../shared/notification-contract.js";
import type { ProcedureOperation } from "../process-modal/process-types";

export function canEditRequests(role = ""): boolean {
  return ["master", "suporte", "admin_municipal", "analista", "servidor_publico"].includes(normalizeText(role));
}

type ShowToast = (message: string, type?: "success" | "error" | "info" | "warning") => void;

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
  async function updatePreviewTutor(tutor: AnyRecord, refresh?: () => Promise<AnyRecord[] | undefined>) {
    const id = previewRequest?.id;
    setPreviewRequest((current) => current ? normalizeRequest({ ...current, tutor: tutor.name, tutor_name: tutor.name, email: tutor.email, tutor_email: tutor.email,
      phone: tutor.phone, address: tutor.address, neighborhood: tutor.neighborhood, city: tutor.city, state: tutor.state, cep: tutor.cep }) : current);
    const refreshed = (await refresh?.())?.find((item) => item.id === id);
    if (refreshed) setPreviewRequest((current) => current?.id === id ? refreshed : current);
  }

  async function applyProcedureAction(request: AnyRecord, action: ProcedureOperation, successMessage: string): Promise<AnyRecord | null> {
    try {
      const updated = await runProcedureAction?.(request.id, { ...action, expectedUpdatedAt: request.updated_at || request.updatedAt || "" });
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
    if (!sector || (assignment.userId && !user)) return false;
    const patch = {
      assignedSectorId: sector.id,
      assignedUserId: user?.id || "",
      expectedUpdatedAt: request.updated_at || request.updatedAt || "",
      tags: mergeTags(request.tags, [RequestTag.ASSIGNED]),
    };
    try {
      const label = [sector.name, user?.name || "Fila do setor"].join(" · ");
      const updated = await patchRequest?.(request.id, patch, user?.id === currentUser?.id ? `Atendimento assumido · ${label}` : `Atendimento atribuído · ${label}`);
      if (!updated) return false;
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      showToast("Setor e responsável atualizados.", "success");
      return true;
    } catch (failure) { showToast(failure?.message || "Erro ao atribuir processo", "error"); return false; }
  }

  async function rejectRequestFromProcess(request: AnyRecord, data: AnyRecord = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    const patch = {
      status: RequestStatus.CANCELLED,
      rejectionReason: data.category || note || REJECTED_CANCEL_REASON,
      rejectionNote: note,
      workflow_data: { cancelReason: REJECTED_CANCEL_REASON },
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`);
      if (!updated) return false;
      showToast("Processo indeferido", "warning");
      showNotificationNotice(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      return true;
    } catch (failure) { showToast(failure?.message || "Erro ao indeferir processo", "error"); return false; }
  }

  async function confirmSpecialRequest(request: AnyRecord, data: AnyRecord = {}) {
    if (!request) return;
    const note = String(data.note || "").trim();
    const patch: AnyRecord = { status: RequestStatus.COMPLETED };
    if (note) patch.workflow_data = { complaintResolutionNote: note };
    try {
      const updated = await patchRequest?.(request.id, patch, `Confirmado por ${currentUser.name}${note ? `. Conclusão: ${note}` : ""}`);
      if (!updated) return false;
      showToast("Processo confirmado com sucesso", "success");
      showNotificationNotice(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      return true;
    } catch (failure) { showToast(failure?.message || "Erro ao confirmar processo", "error"); return false; }
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
    rejectRequestFromProcess,
    confirmSpecialRequest,
  };
}
