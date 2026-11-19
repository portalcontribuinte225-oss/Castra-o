import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProcedureStatus } from "../../../shared/request-procedure-contract.js";
import { ProcessFooter } from "./process-footer";
import { ProcessTab } from "./process-labels";
import { ProcessModal } from "./process-modal";
import { ProceduresTab } from "./procedures-tab";

const noop = () => {};

const procedure = { requestTypeId: "castration", name: "Castração", status: ProcedureStatus.WAITING, schedule: { date: "20/11/2026" } };
const microchip = { ...procedure, requestTypeId: "chip", name: "Microchipagem" };

describe("ProcessModal", () => {
  it("opens on attachments and shows the required documents of a legacy single-procedure request", () => {
    const html = renderToStaticMarkup(<ProcessModal
      request={{ id: "request-a", protocol: "123/2026", status: "NOVA", tutor_name: "Maria Silva", request_type: "Castração",
        workflow_data: { requestTypeId: "castration" }, animals: [{ name: "Bidu" }] }}
      requestTypes={[{ id: "castration", name: "Castração", documents: [{ id: "identity", name: "Identidade" }] }]}
      onClose={noop}
    />);
    const tabs = [...html.matchAll(/(<button\b[^>]*role="tab"[^>]*>)([^<]+)/g)];
    expect(tabs.map((match) => match[2])).toEqual(["Anexos", "Procedimento e saúde", "Dados do tutor"]);
    expect(tabs[0][1]).toContain('aria-selected="true"');
    expect(tabs.every((match) => !match[1].includes("disabled"))).toBe(true);
    expect(html).toContain("Processo 123/2026");
    expect(html).toContain("Tutor: Maria Silva · 1 animal");
    expect(html).toContain("Identidade");
    expect(html).toContain("Pendência documental");
    expect(html).toContain('class="prm-tab-count">1</span>');
  });
});

const footerProps: ComponentProps<typeof ProcessFooter> = {
  tab: ProcessTab.PROCEDURES,
  readOnly: false,
  isSpecial: false,
  processOpen: true,
  hasAssignment: true,
  assignmentBlock: "",
  documentsBlock: "",
  procedure,
  procedureTabLabel: "Procedimento e saúde",
  specialConfirmLabel: "Confirmar solicitação",
  busy: false,
  currentChanged: true,
  canAssume: true,
  tutorSlot: noop,
  on: { assign: noop, assume: noop, showProcedures: noop, noShow: noop, reject: noop, save: noop, reschedule: noop, prescription: noop,
    confirmSchedule: noop, attend: noop, rejectProcess: noop, confirmSpecial: noop },
};

const footer = (overrides: Partial<ComponentProps<typeof ProcessFooter>> = {}) => renderToStaticMarkup(<ProcessFooter {...footerProps} {...overrides} />);

describe("ProcessFooter", () => {
  it("shows assignment and navigation on attachments", () => {
    const html = footer({ tab: ProcessTab.ATTACHMENTS, hasAssignment: false, documentsBlock: "Identidade pendente" });
    expect(html).toContain("Atribuir");
    expect(html).toContain("Assumir");
    expect(html).toContain("Aguardando conferência dos anexos");
    expect(html).toContain("Ver procedimentos");
    expect(html).not.toContain("Confirmar agenda");
  });

  it("offers confirmation of the appointment while waiting and attendance after scheduling", () => {
    const waiting = footer();
    expect(waiting).toContain("Confirmar agenda");
    expect(waiting).toContain("Salvar alterações");
    expect(waiting).toContain("Reagendar");
    expect(waiting).toContain("Emitir receita");
    expect(waiting).toContain("Indeferir");
    expect(waiting).not.toContain("Não compareceu");
    expect(waiting).not.toContain("Confirmar atendimento");

    const scheduled = footer({ procedure: { ...procedure, status: ProcedureStatus.SCHEDULED } });
    expect(scheduled).toContain("Confirmar atendimento");
    expect(scheduled).toContain("Não compareceu");
    expect(scheduled).not.toContain("Confirmar agenda");
  });

  it("disables scheduling controls until required documents are cleared", () => {
    const html = footer({ documentsBlock: "Resolva a identidade" });
    expect(html.match(/<button\b(?=[^>]*title="Resolva a identidade")(?=[^>]*disabled="")[^>]*>/g)).toHaveLength(2);
    expect(html).toContain("Confirmar agenda");
    expect(html).toContain("Reagendar");
    expect(html.match(/<button\b[^>]*title="Indeferir este procedimento"[^>]*>/)?.[0]).not.toContain("disabled");
  });

  it.each([ProcedureStatus.DONE, ProcedureStatus.NO_SHOW, ProcedureStatus.REJECTED])("keeps a recorded prescription accessible after closure (%s)", (status) => {
    const html = footer({ procedure: { ...procedure, status, prescription: { text: "Cuidados registrados" } } });
    expect(html).toContain("Consultar receita");
    for (const action of ["Confirmar agenda", "Confirmar atendimento", "Salvar alterações", "Reagendar", "Indeferir"]) expect(html).not.toContain(action);
  });

  it("does not offer a new prescription for a closed procedure", () => {
    expect(footer({ procedure: { ...procedure, status: ProcedureStatus.DONE } })).not.toContain("<button");
  });

  it("hides editing controls in read-only mode", () => {
    expect(footer({ readOnly: true })).not.toContain("<button");
    expect(footer({ tab: ProcessTab.ATTACHMENTS, readOnly: true })).not.toMatch(/Atribuir|Assumir/);
  });
});

const animals = [
  { name: "Bidu", species: "Canina", sex: "Macho", procedures: [procedure, microchip] },
  { name: "Mel", species: "Felina", sex: "Fêmea", procedures: [procedure] },
];

function procedures(overrides: Partial<ComponentProps<typeof ProceduresTab>> = {}) {
  return renderToStaticMarkup(<ProceduresTab animals={animals} animalIndex={0} procedure={procedure}
    health={{ doencas: "Displasia", alergias: "Penicilina" }} microchip="ABC012"
    readOnly={false} onAnimal={noop} onProcedure={noop} onHealth={noop} onMicrochip={noop} {...overrides} />);
}

describe("ProceduresTab", () => {
  it("lists animals and their procedures and keeps the health inputs for the selected animal", () => {
    const html = procedures();
    expect(html).toContain("Bidu");
    expect(html).toContain("Mel");
    expect(html).toContain("2 procedimentos");
    expect(html).toContain("Microchipagem");
    expect(html).toMatch(/Doenças preexistentes.*Displasia.*Alergias conhecidas.*Penicilina/);
    expect(html).not.toMatch(/Código do microchip aplicado ou lido|Data do agendamento|Observação do atendimento/);
    expect(html.match(/<textarea\b/g)).toHaveLength(2);
  });

  it("shows the microchip field for the microchip procedure only", () => {
    const html = procedures({ procedure: microchip });
    expect(html).toContain("Código do microchip aplicado ou lido");
    expect(html).toMatch(/<input\b[^>]*value="ABC012"/);
  });

  it("renders closed and read-only procedures with read-only fields", () => {
    for (const html of [procedures({ readOnly: true }), procedures({ procedure: { ...procedure, status: ProcedureStatus.DONE } })]) {
      expect(html.match(/<textarea\b[^>]*readonly=""/g)).toHaveLength(2);
    }
  });
});
