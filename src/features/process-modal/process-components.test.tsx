import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocumentReviewStatus } from "../../../shared/document-reuse-contract.js";
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

describe("ProcessModal", () => {
  it("opens in the v31 clinical tab and preserves the four tabs and the header actions", () => {
    const html = renderToStaticMarkup(<ProcessModal
      request={{ id: "request-a", protocol: "123/2026", status: "NOVA", tutor_name: "Maria Silva", request_type: "Castração",
        animals: [{ name: "Bidu", requestTypeIds: ["castration"] }] }}
      requestTypes={[{ id: "castration", name: "Castração" }]}
      readOnly={false}
      onClose={noop}
    />);
    expect(html).toContain("Processo 123/2026");
    expect(html).toContain("Tutor: Maria Silva");
    expect(html).toContain("Análise de documentos");
    expect(html).toMatch(/aria-selected="true"[^>]*>Procedimento e saúde/);
    expect(html).toContain("Dados do tutor");
    expect(html).toContain("Histórico");
    expect(html).toContain('aria-label="Baixar relatório"');
    expect(html).toContain('aria-label="Fechar"');
    expect(html).toContain("Definir responsável");
    expect(html).toContain("Animais e procedimentos");
    expect(html).toContain("Todos realizados");
    expect(html).toContain("Receita unificada");
    expect(html).toContain("Agendar");
    expect(html).not.toContain("Ver procedimentos");
  });

  it("keeps special requests in their own flow", () => {
    const html = renderToStaticMarkup(<ProcessModal request={{ id: "death", status: "NOVA", origin: "INTERNA", request_type: "ANIMAL_OBITO" }}
      readOnly={false} onClose={noop} />);
    expect(html).toContain("Óbito do animal");
    expect(html).toContain("Confirmar óbito");
    expect(html).not.toContain("Todos realizados");
    expect(html).not.toContain("Gerenciar agendamento");
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
    confirmed: true, canSchedule: true, canClose: false, canMarkAbsent: true, scheduleBlocked: "",
    onAssign: noop, onSave: noop, onSchedule: noop, onAbsent: noop, onFinish: noop, actionsSlot: noop,
  };
  it("keeps assignment in every tab and shows agenda actions in the clinical tab", () => {
    for (const tab of Object.values(ProcessTab)) {
      const html = renderToStaticMarkup(<ProcessFooter {...props} tab={tab} />);
      expect(html).toContain("Definir responsável");
      expect(html.includes("Gerenciar agendamento")).toBe(tab === ProcessTab.PROCEDURES);
    }
  });
  it("blocks a closed process and busy assignments", () => {
    const html = renderToStaticMarkup(<ProcessFooter {...props} closed busy />);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[\s\S]*Atendimento concluído/);
    expect(html).not.toContain("Cancelar agendamento");
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
  const html = renderToStaticMarkup(<AttachmentsTab rows={rows} canReview canAttach busy={false} uploadingEvidence={false} error=""
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
