import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";
import { RequestOrigin } from "../../../shared/request-contract.js";
import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { AttachmentsTab } from "./attachments-tab";
import { buildAttachmentRows } from "./attachment-rows";
import { ProcessModal } from "./process-modal";
import { ProcessFooter } from "./process-footer";
import { ProcessHistoryTimeline } from "./process-history-tab";
import { ProcessTab } from "./process-labels";
import { ProceduresTab } from "./procedures-tab";
import { AssignDialog } from "./process-dialogs";
import { procedureTargetKey } from "./process-types";

const noop = () => {};
const castration = { requestTypeId: "castration", name: "Castração", status: ProcedureStatus.DONE };
const microchip = { requestTypeId: "chip", name: "Microchipagem", status: ProcedureStatus.SCHEDULED };
const removed = { ...castration, requestTypeId: "removed", name: "Procedimento removido", status: ProcedureStatus.REMOVED };
const animals = [
  { name: "Bidu", species: "Canina", sex: "Macho", procedures: [castration, microchip, removed] },
  { name: "Mel", species: "Felina", sex: "Fêmea", procedures: [castration] },
];
const chipTarget = { animalIndex: 0, requestTypeId: "chip" };
const pendingRequest = {
  id: "request-a", protocol: "123/2026", status: "NOVA", origin: RequestOrigin.PUBLIC, tutor_name: "Maria Silva", request_type: "Castração",
  schedule_date: `${new Date().getFullYear() + 1}-01-12`, schedule_location_name: "Unidade Centro",
  animals: [{ name: "Bidu", requestTypeIds: ["castration"] }],
  workflow_data: { assignedSectorId: "clinic", assignedUserId: "operator", scheduleOccurrenceKey: "day:centro", scheduleSlotTime: "08:00" },
};
const buttonMarkup = (html: string, label: string) => html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find((button) => button.endsWith(`${label}</button>`));
const scheduleTrigger = (html: string) => html.match(/<button\b[^>]*aria-haspopup="menu"[^>]*>[\s\S]*?<\/button>/)?.[0];
const scheduleActions = ["Confirmar Agenda", "Reagendar", "Atendimento Encerrado", "Não compareceu"];

describe("ProcessModal", () => {
  it("opens in document analysis and preserves the four tabs and the header actions", () => {
    const html = renderToStaticMarkup(<ProcessModal
      request={pendingRequest}
      requestTypes={[{ id: "castration", name: "Castração" }]}
      readOnly={false}
      onClose={noop}
    />);
    expect(html).toContain("Processo 123/2026");
    expect(html).toContain("Tutor: Maria Silva");
    expect(html).toMatch(/aria-selected="true"[^>]*>Análise de documentos/);
    expect(html).toContain("Procedimento e saúde");
    expect(html).toContain("Dados do tutor");
    expect(html).toContain("Histórico");
    expect(html).toContain('aria-label="Baixar relatório"');
    expect(html).toContain('aria-label="Fechar"');
    expect(html).toContain("Definir responsável");
    expect(html).toContain("Conferência de documentos");
    expect(scheduleTrigger(html)).toContain("Gerir agendamento");
    expect(buttonMarkup(html, "Confirmar Agenda")).toContain('role="menuitem"');
    expect(buttonMarkup(html, "Confirmar Agenda")).not.toContain("disabled");
    expect(html).toContain("08:00 · Unidade Centro");
    for (const action of scheduleActions.slice(1)) expect(buttonMarkup(html, action)).toContain("disabled");
    expect(html).not.toContain("Agenda de atendimento");
    expect(html).not.toContain("Ver procedimentos");
  });

  it("blocks confirmation and explains missing required documents or a missing assignee", () => {
    const documents = renderToStaticMarkup(<ProcessModal request={pendingRequest}
      requestTypes={[{ id: "castration", name: "Castração", documents: [{ id: "identity", name: "Identidade", required: true }] }]}
      readOnly={false} onClose={noop} />);
    expect(buttonMarkup(documents, "Confirmar Agenda")).toContain("disabled");
    expect(documents).toContain("Aprove os documentos obrigatórios do processo.");

    const unassigned = { ...pendingRequest, workflow_data: { ...pendingRequest.workflow_data, assignedUserId: "" } };
    const assignment = renderToStaticMarkup(<ProcessModal request={unassigned} readOnly={false} onClose={noop} />);
    expect(buttonMarkup(assignment, "Confirmar Agenda")).toContain("disabled");
    expect(assignment).toContain("Defina o setor e o responsável pelo processo.");
  });

  it("keeps internal attachments available without a review decision or a scheduling block", () => {
    const documents = [{ documentId: "identity", documentName: "Identidade", fileName: "identidade.pdf",
      attachmentId: "identity-upload", status: DocumentReviewStatus.ATTACHED }];
    const requestTypes = [{ id: "castration", name: "Castração", documents: [
      { id: "identity", name: "Identidade", required: true },
      { id: "proof", name: "Comprovante de residência", required: true },
    ] }];
    const internal = renderToStaticMarkup(<ProcessModal request={{ ...pendingRequest, origin: RequestOrigin.INTERNAL, documents }}
      requestTypes={requestTypes} readOnly={false} onClose={noop} />);
    expect(internal).toMatch(/aria-selected="true"[^>]*>Análise de documentos/);
    expect(internal).toContain('aria-label="Visualizar identidade.pdf"');
    expect(internal).toContain('aria-label="Baixar identidade.pdf"');
    expect(internal).toContain('aria-label="Adicionar documentos complementares"');
    expect(internal).not.toContain("Deferir Identidade");
    expect(internal).not.toContain("Indeferir Identidade");
    expect(internal).not.toContain("Pendente de análise");
    expect(internal).not.toContain("Pendência documental");
    expect(buttonMarkup(internal, "Confirmar Agenda")).not.toContain("disabled");

    const external = renderToStaticMarkup(<ProcessModal request={{ ...pendingRequest, documents }}
      requestTypes={requestTypes} readOnly={false} onClose={noop} />);
    expect(external).toContain('aria-label="Deferir Identidade"');
    expect(external).toContain('aria-label="Indeferir Identidade"');
    expect(buttonMarkup(external, "Confirmar Agenda")).toContain("disabled");
  });

  it("requires a named assignee to approve an attached document", () => {
    const request = { ...pendingRequest, documents: [{ documentId: "identity", documentName: "Identidade",
      attachmentId: "identity-upload", status: DocumentReviewStatus.ATTACHED }] };
    const unassigned = { ...request, workflow_data: { ...request.workflow_data, assignedUserId: "" } };
    const blocked = renderToStaticMarkup(<ProcessModal request={unassigned} readOnly={false} onClose={noop} />);
    expect(buttonMarkup(blocked, "Deferir")).toContain("disabled");
    expect(buttonMarkup(blocked, "Indeferir")).toBeDefined();
    expect(buttonMarkup(blocked, "Indeferir")).not.toContain("disabled");
    expect(blocked).toContain("Atribua um usuário ao processo antes de deferir documentos.");

    const assigned = renderToStaticMarkup(<ProcessModal request={request} readOnly={false} onClose={noop} />);
    expect(buttonMarkup(assigned, "Deferir")).toBeDefined();
    expect(buttonMarkup(assigned, "Deferir")).not.toContain("disabled");
  });

  it("offers the explicit reschedule action for an expired reservation", () => {
    const html = renderToStaticMarkup(<ProcessModal request={{ ...pendingRequest, schedule_date: "01/01/2000" }} readOnly={false} onClose={noop} />);
    expect(html).toContain("A data da reserva já passou.");
    expect(scheduleTrigger(html)).toContain("Gerir agendamento");
    expect(buttonMarkup(html, "Confirmar Agenda")).toContain("disabled");
    expect(buttonMarkup(html, "Reagendar")).toContain('role="menuitem"');
    expect(buttonMarkup(html, "Reagendar")).not.toContain("disabled");
    expect(html).not.toContain("Agenda de atendimento");
  });

  it("keeps special requests in their own flow", () => {
    const html = renderToStaticMarkup(<ProcessModal request={{ id: "death", status: "NOVA", origin: "INTERNA", request_type: "ANIMAL_OBITO" }}
      readOnly={false} onClose={noop} />);
    expect(html).toContain("Óbito do animal");
    expect(html).toContain("Confirmar óbito");
    expect(html).not.toContain("Todos realizados");
    expect(scheduleTrigger(html)).toBeUndefined();
  });

  it("shows distinct legacy appointments at the same time in different locations", () => {
    const slot = { date: "2026-12-03", slotTime: "08:00" };
    const html = renderToStaticMarkup(<ProcessModal request={{ id: "legacy", request_type: "Castração", status: "AGENDADA",
      animals: ["Unidade Centro", "Unidade Norte"].map((locationName, index) => ({
        name: `Animal ${index + 1}`, requestTypeIds: ["castration"],
        procedures: [{ ...castration, status: ProcedureStatus.SCHEDULED, schedule: { ...slot, locationName } }],
      })),
    }} readOnly={false} onClose={noop} />);
    expect(html).toContain("Agendamento atual: 03/12/2026 às 08:00 · Unidade Centro / 03/12/2026 às 08:00 · Unidade Norte");
  });
});

describe("ProcessFooter", () => {
  const props: ComponentProps<typeof ProcessFooter> = {
    tab: ProcessTab.PROCEDURES, busy: false, readOnly: false, closed: false, responsible: "Setor: Clínica", dirty: true,
    confirmed: true, hasOpenProcedures: true, canClose: false, canMarkAbsent: true, scheduleBlocked: "", reservationUnavailable: "",
    onAssign: noop, onSave: noop, onConfirmSchedule: noop, onReschedule: noop, onAbsent: noop, onFinish: noop, actionsSlot: noop,
  };
  it("shows the same four booking actions before and after confirmation in both operational tabs", () => {
    for (const tab of Object.values(ProcessTab)) {
      const html = renderToStaticMarkup(<ProcessFooter {...props} tab={tab} />);
      const unconfirmed = renderToStaticMarkup(<ProcessFooter {...props} tab={tab} confirmed={false} canMarkAbsent={false} />);
      const hasScheduleAction = tab === ProcessTab.PROCEDURES || tab === ProcessTab.ATTACHMENTS;
      expect(html).toContain("Definir responsável");
      expect(Boolean(scheduleTrigger(html))).toBe(hasScheduleAction);
      expect(Boolean(scheduleTrigger(unconfirmed))).toBe(hasScheduleAction);
      for (const action of scheduleActions) {
        expect(Boolean(buttonMarkup(html, action))).toBe(hasScheduleAction);
        expect(Boolean(buttonMarkup(unconfirmed, action))).toBe(hasScheduleAction);
      }
      if (hasScheduleAction) {
        expect(buttonMarkup(html, "Confirmar Agenda")).toContain("disabled");
        expect(buttonMarkup(html, "Reagendar")).not.toContain("disabled");
        expect(buttonMarkup(html, "Não compareceu")).not.toContain("disabled");
        expect(buttonMarkup(unconfirmed, "Reagendar")).toContain("disabled");
      }
      expect(Boolean(buttonMarkup(html, "Salvar"))).toBe(tab === ProcessTab.PROCEDURES);
    }
  });
  it("allows closure after all procedure results are recorded", () => {
    const closure = renderToStaticMarkup(<ProcessFooter {...props} confirmed={false} hasOpenProcedures={false} canMarkAbsent={false} canClose />);
    expect(scheduleTrigger(closure)).toContain("Gerir agendamento");
    expect(buttonMarkup(closure, "Atendimento Encerrado")).toContain('role="menuitem"');
    expect(buttonMarkup(closure, "Atendimento Encerrado")).not.toContain("disabled");
    expect(buttonMarkup(closure, "Confirmar Agenda")).toContain("disabled");
  });
  it.each([{ closed: true }, { busy: true }])("keeps the menu available with disabled actions when %j", (state) => {
    const html = renderToStaticMarkup(<ProcessFooter {...props} {...state} />);
    expect(scheduleTrigger(html)).toContain("Gerir agendamento");
    expect(scheduleTrigger(html)).not.toContain("disabled");
    expect(buttonMarkup(html, "Definir responsável")).toContain("disabled");
    for (const action of scheduleActions) expect(buttonMarkup(html, action)).toContain("disabled");
  });
});

it("allows assigning only a sector and lists the current operator among eligible staff", () => {
  const html = renderToStaticMarkup(<AssignDialog sectors={[{ id: "clinic", name: "Clínica" }]}
    users={[{ id: "operator", name: "Equipe", sectorIds: ["clinic"] }, { id: "outside", name: "Outra equipe", sectorIds: ["other"] }]}
    initial={{ sectorId: "clinic", userId: "" }} currentUserId="operator" busy={false} onConfirm={noop} onClose={noop} />);
  expect(html).toContain("Sem responsável — fila do setor");
  expect(html).toContain("Eu — assumir atendimento");
  expect(html).not.toContain("Outra equipe");
});

it("shows document decisions for the pending version and disables completed reviews", () => {
  const rows = buildAttachmentRows({
    documentTypes: [{ id: "identity", name: "Identidade" }],
    requestDocument: { label: "Procedimento", protocol: "123" },
    uploads: [
      { documentId: "identity", documentName: "Identidade", attachmentId: "pending", status: DocumentReviewStatus.ATTACHED },
      { documentId: "address", documentName: "Comprovante de Residência", attachmentId: "reviewed", status: DocumentReviewStatus.REJECTED, review: { note: "Envie a página completa" } },
    ],
  });
  const html = renderToStaticMarkup(<AttachmentsTab rows={rows} reviewRequired canReview hasAssignedUser canAttach busy={false} uploadingEvidence={false} error=""
    onPreview={noop} onDownload={noop} onApprove={noop} onReject={noop} onEvidence={noop} />);
  expect(html).toMatch(/<button\b(?![^>]*\bdisabled\b)[^>]*aria-label="Deferir Identidade"/);
  expect(html).toMatch(/<button\b(?=[^>]*\bdisabled\b)[^>]*aria-label="Indeferir Comprovante de Residência"/);
  expect(html).toContain("Envie a página completa");
  expect(html).toContain("Documentos complementares");
  expect(html).toContain("multiple");
});

it("keeps the removed procedure out of the active list and shows health for the selected animal", () => {
  const html = renderToStaticMarkup(<ProceduresTab animals={animals} animalIndex={0} selectedType="chip" marked={new Set([procedureTargetKey(chipTarget)])}
    scheduled={[chipTarget]} health={{ doencas: "Displasia", alergias: "Penicilina", microchip: "ABC012" }} readOnly={false} busy={false}
    onAnimal={noop} onHealth={noop} onMark={noop} onRemove={noop} onPrescriptions={noop} />);
  expect(html).toContain("2 animais");
  expect(html).toContain("3/3 realizados");
  expect(html).toContain("Bidu");
  expect(html).toContain("Mel");
  expect(html).not.toContain("Procedimento removido");
  expect(html).toContain("Número do microchip");
  expect(html).toContain("ABC012");
  expect(html).toMatch(/Doenças preexistentes[\s\S]*Displasia[\s\S]*Alergias conhecidas[\s\S]*Penicilina/);
});

it("keeps the group checkboxes clear when a procedure was missed", () => {
  const withAbsence = [{ ...animals[0], procedures: [{ ...castration, status: ProcedureStatus.NO_SHOW }, microchip] }];
  const html = renderToStaticMarkup(<ProceduresTab animals={withAbsence} animalIndex={0} selectedType="chip" marked={new Set([procedureTargetKey(chipTarget)])}
    scheduled={[chipTarget]} health={{ doencas: "", alergias: "", microchip: "" }} readOnly={false} busy={false}
    onAnimal={noop} onHealth={noop} onMark={noop} onRemove={noop} onPrescriptions={noop} />);
  const checkboxes = html.match(/<input type="checkbox"[^>]*>/g) || [];
  expect(checkboxes).toHaveLength(4);
  expect(checkboxes[0]).not.toContain('checked=""');
  expect(checkboxes[1]).not.toContain('checked=""');
  expect(checkboxes[3]).toContain('checked=""');
  expect(html).toContain("1 não realizado");
});

it("groups dated actions newest first and shows a closure with no recorded date", () => {
  const html = renderToStaticMarkup(<ProcessHistoryTimeline events={[
    { kind: "start", at: "2026-11-20T12:00:00.000Z", label: "Solicitação registrada", actor: "Formulário público" },
    { kind: "event", at: "2026-11-20T13:30:00.000Z", label: "Documento deferido", actor: "Ana Silva" },
    { kind: "end", at: null, label: "Processo concluído", actor: null },
  ]} />);
  expect(html.match(/<li\b/g)).toHaveLength(3);
  expect(html).toContain('<time dateTime="2026-11-20T13:30:00.000Z">');
  expect(html).toContain("Ana Silva");
  expect(html.indexOf("Documento deferido")).toBeLessThan(html.indexOf("Solicitação registrada"));
  expect(html).toContain("Data não registrada");
});
