import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, FileText, Save, User, UserCheck } from "lucide-react";
import { ProcedureAction, canApplyProcedureAction } from "../../../shared/request-procedure-contract.js";
import type { AnyRecord } from "../../types";
import { ProcessTab } from "./process-labels";

interface ProcessFooterProps {
  tab: ProcessTab;
  readOnly: boolean;
  isSpecial: boolean;
  // New or scheduled: still open to assignment and to decisions.
  processOpen: boolean;
  hasAssignment: boolean;
  assignmentBlock: string;
  documentsBlock: string;
  procedure: AnyRecord | null;
  procedureTabLabel: string;
  specialConfirmLabel: string;
  busy: boolean;
  currentChanged: boolean;
  canAssume: boolean;
  tutorSlot: (element: HTMLDivElement | null) => void;
  on: Record<"assign" | "assume" | "showProcedures" | "noShow" | "reject" | "save" | "reschedule" | "prescription" | "confirmSchedule" | "attend" | "rejectProcess" | "confirmSpecial", () => void>;
}

function Note({ children }: { children: string }) {
  return <p className="prm-muted-note">{children}</p>;
}

function procedureActions({ procedure, busy, currentChanged, assignmentBlock, documentsBlock, on }: ProcessFooterProps) {
  const status = procedure?.status;
  if (!procedure) return <Note>Selecione um procedimento.</Note>;
  if (!canApplyProcedureAction(status, ProcedureAction.SAVE)) {
    return procedure.prescription
      ? <div className="prm-footer-end"><button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy} onClick={on.prescription}><FileText size={15} /> Consultar receita</button></div>
      : <Note>Procedimento encerrado.</Note>;
  }
  const scheduleBlock = assignmentBlock || documentsBlock;
  return (
    <>
      <div className="prm-footer-start">
        {canApplyProcedureAction(status, ProcedureAction.NO_SHOW) && <button className="prm-action-btn prm-action-btn--warning" type="button" disabled={busy} onClick={on.noShow}>Não compareceu</button>}
        <button className="prm-action-btn prm-action-btn--danger" type="button" disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || "Indeferir este procedimento"} onClick={on.reject}><AlertCircle size={15} /> Indeferir</button>
      </div>
      <div className="prm-footer-end">
        <button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy || !currentChanged} onClick={on.save}><Save size={15} /> Salvar alterações</button>
        <button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy || Boolean(documentsBlock)} title={documentsBlock || "Reagendar este procedimento"} onClick={on.reschedule}><CalendarDays size={15} /> Reagendar</button>
        <button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy} onClick={on.prescription}><FileText size={15} /> Emitir receita</button>
        {canApplyProcedureAction(status, ProcedureAction.CONFIRM_SCHEDULE) ? (
          <button className="prm-action-btn prm-action-btn--primary" type="button" disabled={busy || Boolean(scheduleBlock)} title={scheduleBlock || "Confirmar a agenda deste procedimento"} onClick={on.confirmSchedule}><CheckCircle2 size={15} /> Confirmar agenda</button>
        ) : (
          <button className="prm-action-btn prm-action-btn--primary" type="button" disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || "Registrar a realização deste procedimento"} onClick={on.attend}><CheckCircle2 size={15} /> Confirmar atendimento</button>
        )}
      </div>
    </>
  );
}

// The fixed bottom of the process: the actions of the tab on screen, and of the chosen procedure.
export function ProcessFooter(props: ProcessFooterProps) {
  const { tab, readOnly, isSpecial, processOpen, hasAssignment, assignmentBlock, documentsBlock, procedureTabLabel, specialConfirmLabel, busy, canAssume, tutorSlot, on } = props;
  let content;
  if (tab === ProcessTab.TUTOR) {
    content = readOnly ? <Note>Visualização somente leitura.</Note> : <div className="prm-footer-end" ref={tutorSlot} />;
  } else if (tab === ProcessTab.ATTACHMENTS) {
    content = (
      <>
        {!readOnly && processOpen && (
          <div className="prm-footer-start">
            <button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy} onClick={on.assign}><User size={15} /> {hasAssignment ? "Reatribuir" : "Atribuir"}</button>
            {canAssume && <button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy} onClick={on.assume}><UserCheck size={15} /> Assumir</button>}
          </div>
        )}
        <div className="prm-footer-end">
          <span className="prm-muted-note">{documentsBlock ? "Aguardando conferência dos anexos" : "Documentos conferidos"}</span>
          <button className="prm-action-btn prm-action-btn--secondary" type="button" disabled={busy} onClick={on.showProcedures}>Ver {isSpecial ? procedureTabLabel.toLowerCase() : "procedimentos"} <ArrowRight size={15} /></button>
        </div>
      </>
    );
  } else if (readOnly) {
    content = <Note>Visualização somente leitura.</Note>;
  } else if (isSpecial) {
    content = processOpen ? (
      <>
        <div className="prm-footer-start">
          <button className="prm-action-btn prm-action-btn--danger" type="button" disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || "Indeferir solicitação"} onClick={on.rejectProcess}><AlertCircle size={15} /> Indeferir</button>
        </div>
        <div className="prm-footer-end">
          <button className="prm-action-btn prm-action-btn--primary" type="button" disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || specialConfirmLabel} onClick={on.confirmSpecial}><CheckCircle2 size={15} /> {specialConfirmLabel}</button>
        </div>
      </>
    ) : <Note>Nenhuma ação pendente.</Note>;
  } else {
    content = procedureActions(props);
  }
  return <footer className="prm-footer">{content}</footer>;
}
