import { useId, useRef, useState } from "react";
import { ProcedureAction, canApplyProcedureAction, holdsSchedulePlace } from "../../../shared/request-procedure-contract.js";
import { RequestOrigin, RequestStatus } from "../../../shared/request-contract.js";
import { DocumentPreviewModal, generateProcessReportPdf } from "../../App";
import { useModalFocus } from "../../components/modal-focus";
import { RequestType, displayText, getItemMunicipalityId, normalizeRequest, normalizeRequestType, requestTypeDomainLabels, requestTypeLabel } from "../../domain";
import type { AnyRecord } from "../../types";
import { getUserUploadedProcessDocuments } from "../../utils";
import { neighborhoodNames } from "../neighborhoods/neighborhoods";
import { getSpecialRequestSection, specialRequestConfirmLabel } from "../request-analysis-sections";
import { TutorDataTab } from "../tutor-data/tutor-data-tab";
import { AttachmentsTab } from "./attachments-tab";
import { buildAttachmentRows, isBlockingAttachment, isPendingAttachment } from "./attachment-rows";
import type { AttachmentRow } from "./attachment-rows";
import { AssignDialog, CancelScheduleDialog, NoteDialog, RejectDialog, UnsavedChangesDialog } from "./process-dialogs";
import { requestDocumentTypes } from "./process-documents";
import { ProcessFooter } from "./process-footer";
import { ProcessHeader } from "./process-header";
import { ProcessTab, plural } from "./process-labels";
import { PrescriptionDialog } from "./prescription-dialog";
import { getPrescriptionMunicipality } from "./prescription-print";
import { ProceduresTab } from "./procedures-tab";
import { RescheduleDialog } from "./reschedule-dialog";
import { useAttachmentActions } from "./use-attachment-actions";
import { useProcessProcedures } from "./use-process-procedures";

enum Dialog { ASSIGN, REJECT, REJECT_PROCESS, RESCHEDULE, CANCEL_SCHEDULE, PRESCRIPTION, REJECT_DOCUMENT, COMPLAINT, UNSAVED }

const REQUEST_DOCUMENT_KINDS: Record<string, string> = {
  [RequestType.TUTOR_TRANSFER]: "tutor-transfer-request",
  [RequestType.ANIMAL_DEATH]: "death-registration-request",
  [RequestType.COMPLAINT]: "complaint-request",
};

// The work area of one process: its documents, the procedures of each of its animals and the tutor's data.
export function ProcessModal({ request, readOnly = true, neighborhoods = [], requestTypes = [], documentTypes = [], sectors = [], users = [], municipalities = [], currentUserName = "",
  returnFocus, onClose, onTutorSaved, onAssign, onAssume, onRejectProcess, onConfirmSpecial, onProcedureAction, onUpdateDocuments }: AnyRecord) {
  const normalized = normalizeRequest(request);
  const municipality = municipalities.find((item: AnyRecord) => item.id === normalized.municipalityId) || null;
  const matchesMunicipality = (item: AnyRecord) => !getItemMunicipalityId(item) || getItemMunicipalityId(item) === normalized.municipalityId;
  const localTypes = requestTypes.filter(matchesMunicipality);
  const localSectors = sectors.filter(matchesMunicipality);
  const localUsers = users.filter(matchesMunicipality);
  const specialSection = getSpecialRequestSection(normalized);
  const isSpecial = Boolean(specialSection);
  const kind = normalizeRequestType(normalized.request_type || normalized.type);
  const [tab, setTab] = useState(ProcessTab.ATTACHMENTS);
  const panelId = useId();
  const overlay = useRef<HTMLDivElement>(null);
  const attachmentTrigger = useRef<HTMLButtonElement | null>(null);
  useModalFocus(overlay, true, returnFocus);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [cancelledSchedule, setCancelledSchedule] = useState<{ date: string; occurrenceKey: string; time: string; locationName: string; updatedAt: string } | null>(null);
  const [rejectingDocument, setRejectingDocument] = useState<AttachmentRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [tutorSlot, setTutorSlot] = useState<HTMLDivElement | null>(null);
  const procedures = useProcessProcedures(request, localTypes);
  const attachments = useAttachmentActions(request, municipality, onUpdateDocuments);
  const pending = busy || Boolean(attachments.busyId) || attachments.uploadingEvidence;

  const requestDocument = { kind: REQUEST_DOCUMENT_KINDS[kind] || "request", label: requestTypeDomainLabels[kind] || "Requerimento municipal", protocol: normalized.protocol };
  const rows = buildAttachmentRows({
    uploads: getUserUploadedProcessDocuments(request.documents),
    documentTypes: requestDocumentTypes(request, localTypes, documentTypes.filter(matchesMunicipality)),
    requestDocument,
  });
  const blocking = rows.filter(isBlockingAttachment);
  const pendingAttachmentCount = rows.filter(isPendingAttachment).length;
  const documentsBlock = blocking.length ? `Resolva os documentos obrigatórios: ${blocking.map((row) => row.title).join(", ")}` : "";
  const hasAssignment = Boolean(normalized.assignedSectorId && normalized.assignedUserId);
  const assignmentBlock = !hasAssignment && normalized.origin !== RequestOrigin.INTERNAL ? "Atribua um setor e um usuário ao processo antes de continuar" : "";
  const processOpen = normalized.status === RequestStatus.NEW || (!isSpecial && normalized.status === RequestStatus.SCHEDULED);
  const procedureTabLabel = isSpecial ? requestTypeLabel(normalized) : "Procedimento e saúde";
  const { animal, procedure, animalIndex } = procedures;
  const subject = procedure ? `${procedure.name} de ${displayText(animal?.name) || `animal ${animalIndex + 1}`}` : "";

  async function act(action: string, data: AnyRecord, message: string) {
    if (!procedure || readOnly || pending) return false;
    const draft = { animalIndex, requestTypeId: procedure.requestTypeId, edits: procedures.currentEdits };
    setBusy(true);
    try {
      const done = await onProcedureAction(request, { action, animalIndex, requestTypeId: draft.requestTypeId, data: { ...data, edits: draft.edits } }, message);
      if (done) {
        procedures.clearDraft(draft);
        setDialog(null);
      }
      return done;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraftsAndClose() {
    if (pending || readOnly) return;
    setBusy(true);
    try {
      for (const [index, draft] of procedures.drafts.entries()) {
        const last = index === procedures.drafts.length - 1;
        const saved = await onProcedureAction(request, {
          action: ProcedureAction.SAVE, animalIndex: draft.animalIndex, requestTypeId: draft.requestTypeId, data: { edits: draft.edits },
        }, last ? "Alterações salvas" : "");
        if (!saved) return;
        procedures.clearDraft(draft);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport() {
    setReportLoading(true);
    setReportError("");
    try {
      const report = await generateProcessReportPdf(request, requestDocument.kind, municipality, localTypes);
      const anchor = window.document.createElement("a");
      anchor.href = report.dataUrl;
      anchor.download = report.fileName;
      anchor.click();
    } catch {
      setReportError("Não foi possível gerar o relatório do processo agora. Tente novamente em instantes.");
    } finally {
      setReportLoading(false);
    }
  }

  const close = () => (procedures.drafts.length ? setDialog(Dialog.UNSAVED) : onClose());
  const closeDialog = () => { if (!pending) setDialog(null); };

  return (
    <div className="modal-backdrop" data-managed-dialog="" ref={overlay}>
      <div className="prm-modal tw:[--ui-action:#020817] tw:[--ui-action-hover:#111827]" role="dialog" aria-modal="true" aria-labelledby={`${panelId}-title`}>
        <ProcessHeader
          protocol={normalized.protocol}
          title={isSpecial ? requestTypeLabel(normalized) : "Atendimento de animais"}
          subtitle={[`Tutor: ${displayText(normalized.tutor)}`, !isSpecial && plural(procedures.animals.length, "animal", "animais")].filter(Boolean).join(" · ")}
          status={normalized.status}
          reportLoading={reportLoading}
          tabs={[{ id: ProcessTab.ATTACHMENTS, label: "Anexos", count: pendingAttachmentCount }, { id: ProcessTab.PROCEDURES, label: procedureTabLabel }, { id: ProcessTab.TUTOR, label: "Dados do tutor" }]}
          activeTab={tab}
          panelId={panelId}
          busy={pending}
          onTab={setTab}
          onReport={downloadReport}
          onClose={close}
        />
        <div className="prm-body" role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${tab}`}>
          {reportError && <p className="form-error" role="alert">{reportError}</p>}
          {tab === ProcessTab.ATTACHMENTS && (
            <AttachmentsTab rows={rows} pendingCount={pendingAttachmentCount} canReview={!readOnly && processOpen} canAttach={!readOnly} reviewBlockedReason={assignmentBlock} busyId={attachments.busyId}
              uploadingEvidence={attachments.uploadingEvidence} error={attachments.error}
              onPreview={(row, trigger) => { attachmentTrigger.current = trigger; void attachments.open(row); }} onDownload={attachments.save}
              onApprove={attachments.approve} onReject={(row) => { setRejectingDocument(row); setDialog(Dialog.REJECT_DOCUMENT); }} onEvidence={attachments.attachEvidence} />
          )}
          {tab === ProcessTab.PROCEDURES && isSpecial && specialSection?.({ request: normalized })}
          {tab === ProcessTab.PROCEDURES && !isSpecial && (
            <ProceduresTab animals={procedures.animals} animalIndex={animalIndex} procedure={procedure} health={procedures.health} microchip={procedures.microchip} readOnly={readOnly || pending}
              onAnimal={procedures.selectAnimal} onProcedure={procedures.selectProcedure} onHealth={procedures.changeHealth} onMicrochip={procedures.changeMicrochip} />
          )}
          {tab === ProcessTab.TUTOR && (
            <TutorDataTab requestId={normalized.id} municipalityId={normalized.municipalityId} neighborhoodNames={neighborhoodNames(neighborhoods.filter(matchesMunicipality))} readOnly={readOnly} onSaved={onTutorSaved} actionsSlot={tutorSlot} />
          )}
        </div>
        <ProcessFooter
          tab={tab} readOnly={readOnly} isSpecial={isSpecial} processOpen={processOpen} hasAssignment={hasAssignment} assignmentBlock={assignmentBlock}
          documentsBlock={documentsBlock} hasPendingAttachments={pendingAttachmentCount > 0}
          procedure={procedure} procedureTabLabel={procedureTabLabel} specialConfirmLabel={specialRequestConfirmLabel(normalized)} busy={pending} currentChanged={procedures.currentChanged}
          canAssume={Boolean(onAssume) && localSectors.length > 0} tutorSlot={setTutorSlot}
          on={{
            assign: () => setDialog(Dialog.ASSIGN),
            assume: () => onAssume?.(request),
            showProcedures: () => setTab(ProcessTab.PROCEDURES),
            noShow: () => act(ProcedureAction.NO_SHOW, {}, "Não comparecimento registrado"),
            reject: () => setDialog(Dialog.REJECT),
            save: () => act(ProcedureAction.SAVE, {}, "Alterações salvas"),
            reschedule: () => setDialog(Dialog.RESCHEDULE),
            cancelSchedule: () => {
              const schedule = procedure?.schedule;
              if (!schedule?.date) return;
              setCancelledSchedule({
                date: schedule.date, occurrenceKey: schedule.occurrenceKey || "", time: schedule.slotTime || "",
                locationName: schedule.locationName || "", updatedAt: procedure.updatedAt || "",
              });
              setDialog(Dialog.CANCEL_SCHEDULE);
            },
            prescription: () => setDialog(Dialog.PRESCRIPTION),
            confirmSchedule: () => act(ProcedureAction.CONFIRM_SCHEDULE, {}, "Agenda confirmada"),
            attend: () => act(ProcedureAction.ATTEND, {}, "Atendimento confirmado"),
            rejectProcess: () => setDialog(Dialog.REJECT_PROCESS),
            confirmSpecial: () => (kind === RequestType.COMPLAINT ? setDialog(Dialog.COMPLAINT) : onConfirmSpecial?.(request)),
          }}
        />
      </div>

      {attachments.preview && <DocumentPreviewModal document={attachments.preview} onClose={attachments.closePreview} returnFocus={attachmentTrigger.current} />}
      {dialog === Dialog.ASSIGN && (
        <AssignDialog sectors={localSectors} users={localUsers} initial={{ sectorId: normalized.assignedSectorId || localSectors[0]?.id || "", userId: normalized.assignedUserId || "" }}
          onClose={closeDialog} busy={busy} onConfirm={async (assignment) => {
            setBusy(true);
            try { if (await onAssign?.(request, assignment)) setDialog(null); }
            finally { setBusy(false); }
          }} />
      )}
      {dialog === Dialog.REJECT && <RejectDialog title="Indeferir procedimento" subject={subject} busy={busy} onClose={closeDialog} onConfirm={(rejection) => act(ProcedureAction.REJECT, rejection, "Procedimento indeferido")} />}
      {dialog === Dialog.REJECT_PROCESS && <RejectDialog title="Indeferir solicitação" subject="" busy={busy} onClose={() => setDialog(null)} onConfirm={({ reason, note }) => { onRejectProcess?.(request, { category: reason, note }); setDialog(null); }} />}
      {dialog === Dialog.COMPLAINT && (
        <NoteDialog title="Deferir denúncia" label="Conclusão da apuração" placeholder="Descreva o que foi apurado..." confirmLabel="Confirmar deferimento" busy={false} maxLength={2000}
          onClose={() => setDialog(null)} onConfirm={(note) => { onConfirmSpecial?.(request, { note }); setDialog(null); }} />
      )}
      {dialog === Dialog.REJECT_DOCUMENT && rejectingDocument && (
        <NoteDialog title={`Indeferir ${rejectingDocument.title}`} label="Justificativa do indeferimento" placeholder="Explique o motivo do indeferimento." confirmLabel="Indeferir documento"
          busy={attachments.busyId === rejectingDocument.id} maxLength={500} onClose={closeDialog} onConfirm={async (note) => {
            if (await attachments.reject(rejectingDocument, note)) setDialog(null);
          }} />
      )}
      {dialog === Dialog.RESCHEDULE && procedure && (
        <RescheduleDialog municipalityId={normalized.municipalityId} subject={subject} currentDate={procedure.schedule?.date || ""} busy={busy} onClose={closeDialog}
          reservedSlots={animal.procedures.filter(holdsSchedulePlace).map((item: AnyRecord) => item.schedule)}
          onConfirm={({ reason, ...schedule }) => act(ProcedureAction.RESCHEDULE, { schedule, reason }, `Horário selecionado para ${schedule.date}`)} />
      )}
      {dialog === Dialog.CANCEL_SCHEDULE && cancelledSchedule && (
        <CancelScheduleDialog subject={subject} date={cancelledSchedule.date} time={cancelledSchedule.time} locationName={cancelledSchedule.locationName}
          busy={busy} onClose={closeDialog} onConfirm={() => {
            const { date, occurrenceKey, time, updatedAt } = cancelledSchedule;
            return act(ProcedureAction.CANCEL_SCHEDULE, { schedule: { date, occurrenceKey, time, updatedAt } }, "Agendamento cancelado");
          }} />
      )}
      {dialog === Dialog.PRESCRIPTION && procedure && (
        <PrescriptionDialog request={request} animal={animal} procedure={procedure} municipality={getPrescriptionMunicipality(request, municipalities)} defaultProfessionalName={currentUserName}
          canSave={!readOnly && canApplyProcedureAction(procedure.status, ProcedureAction.PRESCRIPTION)} busy={busy}
          onClose={closeDialog} onSave={(prescription) => act(ProcedureAction.PRESCRIPTION, { prescription }, "Receita registrada")} />
      )}
      {dialog === Dialog.UNSAVED && <UnsavedChangesDialog busy={busy} onClose={closeDialog} onDiscard={onClose} onSave={saveDraftsAndClose} />}
    </div>
  );
}
