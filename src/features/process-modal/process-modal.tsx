import { useId, useRef, useState } from "react";
import { CalendarDays, History } from "lucide-react";
import {
  CLOSED_WITHOUT_ATTENDANCE, POSITIVE_CLOSURE, ProcedureAction, ProcedureActionErrorCode, ProcedureStatus, REQUESTED_SCHEDULE_KEY,
  appointmentNumberOfAnimals, distinctProcedureSchedules, isClosedRequest, isOpenProcedure, openProcedureSelections, scheduleFromRequest,
} from "../../../shared/request-procedure-contract.js";
import { RequestOrigin, RequestStatus } from "../../../shared/request-contract.js";
import { displayScheduleDate, procedureGroupScheduleSelection, scheduleDate, scheduleLocalDate } from "../../../shared/schedule-contract.js";
import { Button } from "../../components/button";
import { DocumentPreviewModal } from "../../components/document-preview-modal";
import { useModalFocus } from "../../components/modal-focus";
import { StatusBadge } from "../../components/ui";
import { RequestType, displayText, getItemMunicipalityId, normalizeRequest, normalizeRequestType, requestTypeDomainLabels, requestTypeLabel } from "../../domain";
import type { AnyRecord } from "../../types";
import { getUserUploadedProcessDocuments } from "../../utils";
import { neighborhoodNames } from "../neighborhoods/neighborhoods";
import { TutorDataTab } from "../tutor-data/tutor-data-tab";
import type { TutorData } from "../tutor-data/tutor-data";
import { generateProcessReportPdf } from "../process-report/process-report-pdf";
import { AttachmentsTab } from "./attachments-tab";
import { buildAttachmentRows, isBlockingAttachment } from "./attachment-rows";
import type { AttachmentRow } from "./attachment-rows";
import { AbsenceDialog, FinishAttendanceDialog } from "./process-attendance-dialogs";
import { AssignDialog, NoteDialog, RejectDialog, UnsavedChangesDialog } from "./process-dialogs";
import { downloadProcessFile } from "./process-document-preview";
import { requestDocumentTypes } from "./process-documents";
import { ProcessFooter } from "./process-footer";
import { ProcessHeader } from "./process-header";
import { ProcessHistoryTab } from "./process-history-tab";
import { ProcessTab } from "./process-labels";
import { procedureTargetKey } from "./process-types";
import type { AppointmentSlot, ProcedureActionResult, ProcedureOperation, ProcedureTarget } from "./process-types";
import { PrescriptionDialog } from "./prescription-dialog";
import { processAnimalLabel, ProceduresTab } from "./procedures-tab";
import { RescheduleDialog } from "./reschedule-dialog";
import { getSpecialRequestSection, specialRequestConfirmLabel } from "./special-request-sections";
import { useAttachmentActions } from "./use-attachment-actions";
import { useProcessProcedures } from "./use-process-procedures";

enum DialogKind { ASSIGN, RESCHEDULE, ABSENCE, REMOVE, FINISH, PRESCRIPTION, REJECT_DOCUMENT, SPECIAL_REJECT, COMPLAINT, UNSAVED }
type Dialog = { kind: DialogKind.REMOVE; target: ProcedureTarget } | { kind: DialogKind.REJECT_DOCUMENT; row: AttachmentRow }
  | { kind: Exclude<DialogKind, DialogKind.REMOVE | DialogKind.REJECT_DOCUMENT> };
type Assignment = { sectorId: string; userId: string };

interface ProcessModalProps {
  request: AnyRecord;
  readOnly?: boolean;
  neighborhoods?: AnyRecord[];
  requestTypes?: AnyRecord[];
  documentTypes?: AnyRecord[];
  sectors?: AnyRecord[];
  users?: AnyRecord[];
  municipalities?: AnyRecord[];
  currentUserId?: string;
  currentUserName?: string;
  returnFocus?: HTMLElement | null;
  onClose: () => void;
  onTutorSaved?: (tutor: TutorData) => void | Promise<void>;
  onAssign?: (request: AnyRecord, assignment: Assignment) => Promise<boolean | undefined>;
  onRejectProcess?: (request: AnyRecord, data: { category: string; note: string }) => Promise<boolean | undefined>;
  onConfirmSpecial?: (request: AnyRecord, data?: { note: string }) => Promise<boolean | undefined>;
  onProcedureAction?: (request: AnyRecord, operation: ProcedureOperation, message: string) => Promise<ProcedureActionResult | null>;
  onUpdateDocuments?: (request: AnyRecord, patch: AnyRecord, note: string) => Promise<boolean>;
}

function slotLabel(slot: AppointmentSlot) {
  const dateTime = [displayScheduleDate(slot.date) || slot.date, slot.slotTime && `às ${slot.slotTime}`].filter(Boolean).join(" ");
  return [dateTime, slot.locationName].filter(Boolean).join(" · ");
}

function AppointmentSummary({ requested, current, status, tone }: { requested: AppointmentSlot | null; current: AppointmentSlot[]; status: string; tone: string }) {
  const changed = current.length !== 1 || scheduleDate(current[0].date) !== scheduleDate(requested?.date) || current[0].slotTime !== requested?.slotTime
    || (current[0].occurrenceKey || "") !== (requested?.occurrenceKey || "")
    || (current[0].locationName || "") !== (requested?.locationName || "");
  return <div className="prm-appointment-summary">
    <CalendarDays size={14} aria-hidden="true" />
    {requested && <span>Solicitado: {slotLabel(requested)}</span>}
    {changed && current.length > 0 && <span>· Agendamento atual: {current.map(slotLabel).join(" / ")}</span>}
    <span className="prm-appointment-status" data-tone={tone}>· {status}</span>
  </div>;
}

export function ProcessModal({ request, readOnly = true, neighborhoods = [], requestTypes = [], documentTypes = [], sectors = [], users = [], municipalities = [],
  currentUserId = "", currentUserName = "", returnFocus, onClose, onTutorSaved, onAssign, onRejectProcess, onConfirmSpecial,
  onProcedureAction, onUpdateDocuments }: ProcessModalProps) {
  const normalized = normalizeRequest(request);
  const workflow = request.workflow_data || request.workflowData || {};
  const municipality = municipalities.find((item) => item.id === normalized.municipalityId) || null;
  const local = (item: AnyRecord) => !getItemMunicipalityId(item) || getItemMunicipalityId(item) === normalized.municipalityId;
  const localTypes = requestTypes.filter(local);
  const localSectors = sectors.filter(local);
  const localUsers = users.filter(local);
  const SpecialSection = getSpecialRequestSection(normalized);
  const internal = normalized.origin === RequestOrigin.INTERNAL;
  const kind = normalizeRequestType(normalized.request_type || normalized.type);
  const [tab, setTab] = useState(SpecialSection ? ProcessTab.PROCEDURES : ProcessTab.ATTACHMENTS);
  const [tutorVisited, setTutorVisited] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reservationFailure, setReservationFailure] = useState<{ version: string; message: string }>();
  const [historyCount, setHistoryCount] = useState<number>();
  const [tutorSlot, setTutorSlot] = useState<HTMLDivElement | null>(null);
  const panelId = useId();
  const overlay = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const attachmentTrigger = useRef<HTMLButtonElement | null>(null);
  const writing = useRef(false);
  useModalFocus(overlay, true, returnFocus);

  const procedures = useProcessProcedures(request, localTypes);
  const attachments = useAttachmentActions(request, municipality, onUpdateDocuments);
  const pending = busy || tutorBusy || Boolean(attachments.busyId) || attachments.uploadingEvidence;
  const closed = isClosedRequest(request);
  const editable = !readOnly && !closed;
  const { animals, scheduled, marked, batch } = procedures;
  const all = animals.flatMap((animal, animalIndex) => animal.procedures.map((procedure) => ({ animalIndex, procedure })));
  const canClose = all.length > 0 && all.every(({ animalIndex, procedure }) =>
    !isOpenProcedure(procedure) || marked.has(procedureTargetKey({ animalIndex, requestTypeId: procedure.requestTypeId })));
  const anyDone = batch.results.length > 0 || all.some(({ procedure }) => procedure.status === ProcedureStatus.DONE);
  const confirmed = scheduled.length > 0 || normalized.status === RequestStatus.SCHEDULED;
  const current = distinctProcedureSchedules(animals);
  const animalCount = appointmentNumberOfAnimals(animals);
  const requestVersion = `${normalized.id}:${request.updated_at || normalized.updatedAt}`;
  const selection = procedureGroupScheduleSelection(current);
  let reservationUnavailable = "";
  if (!confirmed && animalCount > 0) {
    if (!selection) reservationUnavailable = "A reserva atual não identifica um único horário.";
    else if (selection.date < scheduleLocalDate()) reservationUnavailable = "A data da reserva já passou.";
    else if (reservationFailure?.version === requestVersion) reservationUnavailable = reservationFailure.message;
  }
  const originalSchedule = workflow[REQUESTED_SCHEDULE_KEY];
  const requested = originalSchedule === undefined ? scheduleFromRequest(request) : originalSchedule;
  const retainedSchedules = current.length ? current : distinctProcedureSchedules(animals, () => true);
  const localDocumentTypes = documentTypes.filter(local);
  const documentDefinitions = requestDocumentTypes(request, localTypes, localDocumentTypes);
  const pendingDocumentIds = new Set(requestDocumentTypes({ created_at: request.created_at, animals: openProcedureSelections(animals) },
    localTypes, localDocumentTypes).filter((document) => document.required !== false).map((document) => document.id));
  const rows = buildAttachmentRows({ uploads: getUserUploadedProcessDocuments(request.documents),
    documentTypes: documentDefinitions.map((document) => ({
      ...document, required: !internal && (SpecialSection ? document.required !== false : pendingDocumentIds.has(document.id)),
    })),
    requestDocument: { label: SpecialSection ? requestTypeDomainLabels[kind] || "Requerimento municipal" : "Procedimento", protocol: normalized.protocol },
  });
  const assignmentRequired = !internal && !(normalized.assignedSectorId && normalized.assignedUserId);
  const documentsBlocked = rows.some(isBlockingAttachment);
  const scheduleBlocked = batch.results.length ? "Salve os procedimentos marcados antes de alterar a agenda."
    : documentsBlocked ? "Aprove os documentos obrigatórios do processo."
      : assignmentRequired ? "Defina o setor e o responsável pelo processo." : "";

  async function perform(action: () => Promise<unknown> | undefined) {
    if (pending || !editable || writing.current) return false;
    writing.current = true;
    setBusy(true);
    try {
      const result = await action();
      if (!result) return false;
      setDialog(null);
      setHistoryCount(undefined);
      return true;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  async function act(operation: ProcedureOperation, message: string) {
    const saved = await perform(async () => {
      const result = await onProcedureAction?.(request, operation, message);
      if (result?.ok === false) {
        if (result.code === ProcedureActionErrorCode.RESERVATION_UNAVAILABLE) {
          setReservationFailure({ version: requestVersion, message: result.message });
        } else if (result.code === ProcedureActionErrorCode.RESERVATION_AVAILABLE) {
          setReservationFailure(undefined);
          setDialog(null);
        }
      }
      return result?.ok;
    });
    if (saved && (operation.action === ProcedureAction.SAVE || operation.action === ProcedureAction.CLOSE)) procedures.clearDrafts();
    return saved;
  }

  async function downloadReport() {
    setReportLoading(true);
    setReportError("");
    try {
      const report = await generateProcessReportPdf(request, municipality, localTypes);
      downloadProcessFile(report.dataUrl, report.fileName);
    } catch {
      setReportError("Não foi possível gerar o relatório do processo agora. Tente novamente em instantes.");
    } finally {
      setReportLoading(false);
    }
  }

  function changeTab(next: ProcessTab) {
    if (next === ProcessTab.TUTOR) setTutorVisited(true);
    if (body.current) body.current.scrollTop = 0;
    setTab(next);
  }

  const closeDialog = () => { if (!pending) setDialog(null); };
  const save = () => act({ action: ProcedureAction.SAVE, data: batch }, "Alterações salvas");
  const selectedForAbsence = scheduled.find((item) => item.animalIndex === procedures.animalIndex
    && item.requestTypeId === procedures.selectedProcedure?.requestTypeId) || scheduled[0];
  const removal = dialog?.kind === DialogKind.REMOVE ? all.find(({ animalIndex, procedure }) =>
    animalIndex === dialog.target.animalIndex && procedure.requestTypeId === dialog.target.requestTypeId) : undefined;
  const specialTitle = SpecialSection ? requestTypeLabel(normalized) : "Atendimento de animais";

  return (
    <>
      <div className="modal-backdrop prm-backdrop" data-managed-dialog="" ref={overlay}>
        <div className="prm-modal" role="dialog" aria-modal="true" aria-labelledby={`${panelId}-title`}>
          <ProcessHeader protocol={normalized.protocol} title={specialTitle} subtitle={`Tutor: ${displayText(normalized.tutor)}`}
            appointment={SpecialSection ? <StatusBadge status={normalized.status} /> : <AppointmentSummary requested={requested} current={retainedSchedules}
              tone={normalized.status === RequestStatus.CANCELLED ? "negative" : confirmed || closed ? "positive" : "neutral"}
              status={closed ? normalized.status === RequestStatus.COMPLETED ? POSITIVE_CLOSURE : CLOSED_WITHOUT_ATTENDANCE : confirmed ? "Confirmado" : "Aguardando confirmação"} />}
            tabs={[{ id: ProcessTab.ATTACHMENTS, label: "Análise de documentos" },
              { id: ProcessTab.PROCEDURES, label: SpecialSection ? specialTitle : "Procedimento e saúde" },
              { id: ProcessTab.TUTOR, label: "Dados do tutor" },
              ...(!readOnly ? [{ id: ProcessTab.HISTORY, label: "Histórico", count: historyCount ?? (normalized.rawHistory.length + 1), icon: <History size={15} aria-hidden="true" /> }] : [])]}
            activeTab={tab} panelId={panelId} busy={pending} reportLoading={reportLoading} onTab={changeTab} onReport={downloadReport}
            onClose={() => procedures.dirty ? setDialog({ kind: DialogKind.UNSAVED }) : onClose()} />
          <div ref={body} className="prm-body" role="tabpanel" id={panelId} aria-labelledby={`${panelId}-${tab}`}>
            {reportError && <p className="form-error" role="alert">{reportError}</p>}
            {tab === ProcessTab.ATTACHMENTS && <AttachmentsTab rows={rows} reviewRequired={!internal} canReview={editable} canAttach={editable} busy={pending}
              uploadingEvidence={attachments.uploadingEvidence} error={attachments.error}
              onPreview={(row, trigger) => { attachmentTrigger.current = trigger; void attachments.open(row); }} onDownload={attachments.save}
              onApprove={attachments.approve} onReject={(row) => setDialog({ kind: DialogKind.REJECT_DOCUMENT, row })} onEvidence={attachments.attachEvidence} />}
            {tab === ProcessTab.PROCEDURES && (SpecialSection ? <SpecialSection request={normalized} /> :
              <ProceduresTab animals={animals} animalIndex={procedures.animalIndex} selectedType={procedures.selectedProcedure?.requestTypeId || ""}
                health={procedures.health} marked={marked} scheduled={scheduled} readOnly={!editable} busy={pending}
                onAnimal={procedures.selectAnimal} onHealth={procedures.changeHealth} onMark={procedures.toggleResults}
                onRemove={(target) => setDialog({ kind: DialogKind.REMOVE, target })} onPrescriptions={() => setDialog({ kind: DialogKind.PRESCRIPTION })} />)}
            {tutorVisited && <div hidden={tab !== ProcessTab.TUTOR}>
              <TutorDataTab requestId={normalized.id} municipalityId={normalized.municipalityId} neighborhoodNames={neighborhoodNames(neighborhoods.filter(local))}
                readOnly={!editable} busy={busy} onBusy={setTutorBusy} onSaved={async (tutor) => { await onTutorSaved?.(tutor); setHistoryCount(undefined); }} actionsSlot={tutorSlot} />
            </div>}
            {tab === ProcessTab.HISTORY && !readOnly && <ProcessHistoryTab requestId={normalized.id} onCount={setHistoryCount} />}
          </div>
          <ProcessFooter tab={tab} busy={pending} readOnly={readOnly} closed={closed}
            responsible={`Setor: ${normalized.assignedSectorName || "Não definido"} · Responsável: ${normalized.responsible || "Não atribuído"}`}
            dirty={procedures.dirty} confirmed={confirmed} canClose={canClose} hasOpenProcedures={animalCount > 0}
            canMarkAbsent={scheduled.length > 0 && batch.results.length === 0} scheduleBlocked={scheduleBlocked}
            reservationUnavailable={reservationUnavailable} actionsSlot={setTutorSlot}
            onAssign={() => setDialog({ kind: DialogKind.ASSIGN })} onSave={save}
            onConfirmSchedule={() => act({ action: ProcedureAction.CONFIRM_SCHEDULE }, "Agendamento confirmado")}
            onReschedule={() => setDialog({ kind: DialogKind.RESCHEDULE })}
            onAbsent={() => setDialog({ kind: DialogKind.ABSENCE })} onFinish={() => setDialog({ kind: DialogKind.FINISH })}
            specialActions={SpecialSection ? (editable ? <>
              <Button variant="danger" disabled={pending || assignmentRequired} onClick={() => setDialog({ kind: DialogKind.SPECIAL_REJECT })}>Indeferir</Button>
              <Button disabled={pending || assignmentRequired} onClick={() => kind === RequestType.COMPLAINT ? setDialog({ kind: DialogKind.COMPLAINT })
                : void perform(() => onConfirmSpecial?.(request))}>{specialRequestConfirmLabel(normalized)}</Button>
            </> : false) : undefined} />
        </div>
      </div>

      {attachments.preview && <DocumentPreviewModal document={attachments.preview} onClose={attachments.closePreview} returnFocus={attachmentTrigger.current} />}
      {dialog?.kind === DialogKind.ASSIGN && <AssignDialog sectors={localSectors} users={localUsers} initial={{ sectorId: normalized.assignedSectorId, userId: normalized.assignedUserId }}
        currentUserId={currentUserId} busy={pending} onClose={closeDialog} onConfirm={(assignment) => void perform(() => onAssign?.(request, assignment))} />}
      {dialog?.kind === DialogKind.REJECT_DOCUMENT && <NoteDialog title={`Indeferir ${dialog.row.title}`} label="Justificativa do indeferimento"
        placeholder="Explique o motivo do indeferimento." confirmLabel="Indeferir documento" busy={pending} maxLength={500} onClose={closeDialog}
        onConfirm={async (note) => { if (await attachments.reject(dialog.row, note)) { setDialog(null); setHistoryCount(undefined); } }} />}
      {dialog?.kind === DialogKind.RESCHEDULE && <RescheduleDialog requestId={normalized.id} municipalityId={normalized.municipalityId} schedules={current}
        animalCount={animalCount} busy={pending} onClose={closeDialog}
        onConfirm={(schedule, reason) => act({ action: ProcedureAction.RESCHEDULE, data: { schedule, reason } },
          confirmed ? "Agendamento atualizado" : "Reserva atualizada. Aguardando confirmação.")} />}
      {dialog?.kind === DialogKind.ABSENCE && selectedForAbsence && <AbsenceDialog animals={animals} scheduled={scheduled} initial={selectedForAbsence} busy={pending}
        onClose={closeDialog} onConfirm={(results) => act({ action: ProcedureAction.NO_SHOW, data: { results } }, "Não comparecimento registrado")} />}
      {dialog?.kind === DialogKind.REMOVE && removal && <NoteDialog title="Remover procedimento"
        description={`${processAnimalLabel(animals[removal.animalIndex], removal.animalIndex)} · ${removal.procedure.name}. O procedimento será preservado no histórico.`}
        label="Motivo da remoção *" placeholder="Informe o motivo" confirmLabel="Confirmar remoção" busy={pending} maxLength={1000} showCancel={false}
        onClose={closeDialog} onConfirm={(reason) => act({ action: ProcedureAction.REMOVE, data: { target: dialog.target, reason } }, "Procedimento removido")} />}
      {dialog?.kind === DialogKind.FINISH && <FinishAttendanceDialog animals={animals} marked={marked} title={anyDone ? POSITIVE_CLOSURE : CLOSED_WITHOUT_ATTENDANCE}
        busy={pending} onClose={closeDialog} onConfirm={() => act({ action: ProcedureAction.CLOSE, data: batch }, "Atendimento encerrado")} />}
      {dialog?.kind === DialogKind.PRESCRIPTION && <PrescriptionDialog request={request} animals={animals} municipality={municipality} defaultProfessionalName={currentUserName}
        readOnly={!editable} busy={pending} onClose={closeDialog}
        onSave={(prescriptions) => act({ action: ProcedureAction.PRESCRIPTION, data: { prescriptions } }, "Receitas atualizadas")} />}
      {dialog?.kind === DialogKind.SPECIAL_REJECT && <RejectDialog title="Indeferir solicitação" subject="" busy={pending} onClose={closeDialog}
        onConfirm={({ reason, note }) => perform(() => onRejectProcess?.(request, { category: reason, note }))} />}
      {dialog?.kind === DialogKind.COMPLAINT && <NoteDialog title="Deferir denúncia" label="Conclusão da apuração" placeholder="Descreva o que foi apurado..."
        confirmLabel="Confirmar deferimento" busy={pending} maxLength={2000} onClose={closeDialog} onConfirm={(note) => perform(() => onConfirmSpecial?.(request, { note }))} />}
      {dialog?.kind === DialogKind.UNSAVED && <UnsavedChangesDialog busy={pending} onClose={closeDialog} onDiscard={onClose}
        onSave={async () => { if (await save()) onClose(); }} />}
    </>
  );
}
