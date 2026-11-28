import { useCallback, useState } from "react";
import { RequestKind, RequestStatus, RequestTag } from "../../../shared/request-contract.js";
import { ApiError } from "../../api";
import type { AnyRecord } from "../../types";
import { mergeTags, normalizeRequest } from "../../domain";
import { buildActionNotice } from "../notifications/notification-results";
import { normalizeText } from "../../utils";
import { REJECTED_CANCEL_REASON } from "../../../shared/notification-contract.js";
import type { ProcessActionResult, ProcedureOperation } from "../process-modal/process-types";
import type { ToastNotice } from "../../components/toast-container";

export function canEditRequests(role = ""): boolean {
  return ["master", "suporte", "admin_municipal", "analista", "servidor_publico"].includes(normalizeText(role));
}

function actionFailure(fallback: string, failure?: unknown): ProcessActionResult {
  return {
    ok: false,
    message: failure instanceof ApiError ? failure.message : fallback,
    code: failure instanceof ApiError ? failure.code : undefined,
  };
}

const specialConfirmTitles = {
  [RequestKind.DEATH]: "Óbito confirmado",
  [RequestKind.TRANSFER]: "Troca de tutor concluída",
  [RequestKind.COMPLAINT]: "Denúncia deferida",
};

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
  showToast?: (notice: ToastNotice) => void;
  setSelectedId?: (id: string) => void;
}) {
  const [previewRequest, setPreviewRequest] = useState<AnyRecord | null>(null);

  const activeUsers = teams.users?.filter((user: AnyRecord) => user.active !== false) || [];
  const activeSectors = teams.sectors?.filter((sector: AnyRecord) => sector.active !== false) || [];

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

  async function applyProcedureAction(request: AnyRecord, action: ProcedureOperation, title: string, detail?: string): Promise<ProcessActionResult> {
    const fallback = "Não foi possível atualizar o procedimento.";
    try {
      const updated = await runProcedureAction?.(request.id, { ...action, expectedUpdatedAt: request.updated_at || request.updatedAt || "" });
      if (!updated) return actionFailure(fallback);
      const normalized = normalizeRequest(updated);
      setPreviewRequest((current) => current?.id === request.id ? normalized : current);
      showToast?.(buildActionNotice(title, updated, detail));
      return { ok: true };
    } catch (failure) {
      return actionFailure(fallback, failure);
    }
  }

  // The attachments tab saves each document decision and each evidence as soon as it is made.
  async function updateDocuments(request: AnyRecord, patch: AnyRecord, note: string): Promise<ProcessActionResult> {
    const fallback = "Não foi possível salvar a conferência do documento.";
    try {
      const updated = await patchRequest?.(request.id, patch, note);
      if (!updated) return actionFailure(fallback);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      return { ok: true };
    } catch (failure) { return actionFailure(fallback, failure); }
  }

  async function assignFromPreview(request: AnyRecord, assignment: AnyRecord = {}): Promise<ProcessActionResult> {
    const fallback = "Não foi possível atribuir o processo.";
    const sector = activeSectors.find((item: AnyRecord) => item.id === assignment.sectorId);
    const user = activeUsers.find((item: AnyRecord) => item.id === assignment.userId);
    if (!sector || (assignment.userId && !user)) return actionFailure("Selecione um setor e um responsável válidos.");
    const patch = {
      assignedSectorId: sector.id,
      assignedUserId: user?.id || "",
      expectedUpdatedAt: request.updated_at || request.updatedAt || "",
      tags: mergeTags(request.tags, [RequestTag.ASSIGNED]),
    };
    try {
      const label = [sector.name, user?.name || "Fila do setor"].join(" · ");
      const assumed = Boolean(user && user.id === currentUser?.id);
      const updated = await patchRequest?.(request.id, patch, assumed ? `Atendimento assumido · ${label}` : `Atendimento atribuído · ${label}`);
      if (!updated) return actionFailure(fallback);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      const title = assumed ? "Processo assumido" : user ? "Responsável definido" : "Processo enviado à fila do setor";
      showToast?.(buildActionNotice(title, updated));
      return { ok: true };
    } catch (failure) { return actionFailure(fallback, failure); }
  }

  async function rejectRequestFromProcess(request: AnyRecord, data: AnyRecord = {}): Promise<ProcessActionResult> {
    const fallback = "Não foi possível indeferir a solicitação.";
    const note = String(data.note || "").trim();
    const patch = {
      status: RequestStatus.CANCELLED,
      rejectionReason: data.category || note || REJECTED_CANCEL_REASON,
      rejectionNote: note,
      workflow_data: { cancelReason: REJECTED_CANCEL_REASON },
    };
    try {
      const updated = await patchRequest?.(request.id, patch, `Indeferida por ${currentUser.name}${note ? `. Observação: ${note}` : ""}`);
      if (!updated) return actionFailure(fallback);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      showToast?.(buildActionNotice("Solicitação indeferida", updated));
      return { ok: true };
    } catch (failure) { return actionFailure(fallback, failure); }
  }

  async function confirmSpecialRequest(request: AnyRecord, data: AnyRecord = {}): Promise<ProcessActionResult> {
    const fallback = "Não foi possível confirmar o processo.";
    const note = String(data.note || "").trim();
    const patch: AnyRecord = { status: RequestStatus.COMPLETED };
    if (note) patch.workflow_data = { complaintResolutionNote: note };
    try {
      const updated = await patchRequest?.(request.id, patch, `Confirmado por ${currentUser.name}${note ? `. Conclusão: ${note}` : ""}`);
      if (!updated) return actionFailure(fallback);
      setPreviewRequest((current) => current?.id === request.id ? normalizeRequest(updated) : current);
      const title = specialConfirmTitles[request.request_type || request.type] || "Processo confirmado";
      showToast?.(buildActionNotice(title, updated));
      return { ok: true };
    } catch (failure) { return actionFailure(fallback, failure); }
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
