import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, FileText, Save, User, UserCheck } from "lucide-react";
import { ProcedureAction, canApplyProcedureAction } from "../../../shared/request-procedure-contract.js";
import { Button } from "../../components/button";
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
  hasPendingAttachments: boolean;
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

const rejectActionStyle = "tw:border-rose-700 tw:bg-rose-700 tw:font-semibold tw:text-white tw:enabled:hover:border-rose-800 tw:enabled:hover:bg-rose-800";
const noShowActionStyle = "tw:border-card-border tw:bg-card-page tw:font-semibold tw:text-blue-600 tw:enabled:hover:bg-orange-100";

function procedureActions({ procedure, busy, currentChanged, assignmentBlock, documentsBlock, on }: ProcessFooterProps) {
  const status = procedure?.status;
  if (!procedure) return <Note>Selecione um procedimento.</Note>;
  if (!canApplyProcedureAction(status, ProcedureAction.SAVE)) {
    return procedure.prescription
      ? <div className="prm-footer-end"><Button variant="outline" disabled={busy} onClick={on.prescription}><FileText size={15} aria-hidden="true" /> Consultar receita</Button></div>
      : <Note>Procedimento encerrado.</Note>;
  }
  const scheduleBlock = assignmentBlock || documentsBlock;
  return (
    <>
      <div className="prm-footer-start">
        {canApplyProcedureAction(status, ProcedureAction.NO_SHOW) && <Button variant="custom" className={noShowActionStyle} disabled={busy} onClick={on.noShow}>Não compareceu</Button>}
        <Button variant="custom" className={rejectActionStyle} disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || "Indeferir este procedimento"} onClick={on.reject}><AlertCircle size={15} aria-hidden="true" /> Indeferir</Button>
      </div>
      <div className="prm-footer-end">
        <Button variant="outline" disabled={busy || !currentChanged} onClick={on.save}><Save size={15} aria-hidden="true" /> Salvar alterações</Button>
        <Button variant="outline" disabled={busy || Boolean(documentsBlock)} title={documentsBlock || "Reagendar este procedimento"} onClick={on.reschedule}><CalendarDays size={15} aria-hidden="true" /> Reagendar</Button>
        <Button variant="outline" disabled={busy} onClick={on.prescription}><FileText size={15} aria-hidden="true" /> Emitir receita</Button>
        {canApplyProcedureAction(status, ProcedureAction.CONFIRM_SCHEDULE) ? (
          <Button disabled={busy || Boolean(scheduleBlock)} title={scheduleBlock || "Confirmar a agenda deste procedimento"} onClick={on.confirmSchedule}><CheckCircle2 size={15} aria-hidden="true" /> Confirmar agenda</Button>
        ) : (
          <Button disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || "Registrar a realização deste procedimento"} onClick={on.attend}><CheckCircle2 size={15} aria-hidden="true" /> Confirmar atendimento</Button>
        )}
      </div>
    </>
  );
}

// The fixed bottom of the process: the actions of the tab on screen, and of the chosen procedure.
export function ProcessFooter(props: ProcessFooterProps) {
  const { tab, readOnly, isSpecial, processOpen, hasAssignment, assignmentBlock, hasPendingAttachments, procedureTabLabel, specialConfirmLabel, busy, canAssume, tutorSlot, on } = props;
  let content;
  if (tab === ProcessTab.TUTOR) {
    content = readOnly ? <Note>Visualização somente leitura.</Note> : <div className="prm-footer-end" ref={tutorSlot} />;
  } else if (tab === ProcessTab.ATTACHMENTS) {
    content = (
      <>
        {!readOnly && processOpen && (
          <div className="prm-footer-start">
            <Button variant="outline" disabled={busy} onClick={on.assign}><User size={15} aria-hidden="true" /> {hasAssignment ? "Reatribuir" : "Atribuir"}</Button>
            {canAssume && <Button variant="outline" disabled={busy} onClick={on.assume}><UserCheck size={15} aria-hidden="true" /> Assumir</Button>}
          </div>
        )}
        <div className="prm-footer-end">
          <span className="prm-muted-note">{hasPendingAttachments ? "Aguardando conferência dos anexos" : "Documentos conferidos"}</span>
          <Button variant="outline" disabled={busy} onClick={on.showProcedures}>Ver {isSpecial ? procedureTabLabel.toLowerCase() : "procedimentos"} <ArrowRight size={15} aria-hidden="true" /></Button>
        </div>
      </>
    );
  } else if (readOnly) {
    content = <Note>Visualização somente leitura.</Note>;
  } else if (isSpecial) {
    content = processOpen ? (
      <>
        <div className="prm-footer-start">
          <Button variant="custom" className={rejectActionStyle} disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || "Indeferir solicitação"} onClick={on.rejectProcess}><AlertCircle size={15} aria-hidden="true" /> Indeferir</Button>
        </div>
        <div className="prm-footer-end">
          <Button disabled={busy || Boolean(assignmentBlock)} title={assignmentBlock || specialConfirmLabel} onClick={on.confirmSpecial}><CheckCircle2 size={15} aria-hidden="true" /> {specialConfirmLabel}</Button>
        </div>
      </>
    ) : <Note>Nenhuma ação pendente.</Note>;
  } else {
    content = procedureActions(props);
  }
  return <footer className="prm-footer">{content}</footer>;
}
