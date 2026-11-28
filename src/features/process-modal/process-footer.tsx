import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, Save, User, UserX } from "lucide-react";
import { Button } from "../../components/button";
import { ProcessTab } from "./process-labels";

interface ProcessFooterProps {
  tab: ProcessTab;
  busy: boolean;
  readOnly: boolean;
  closed: boolean;
  responsible: string;
  dirty: boolean;
  confirmed: boolean;
  canSchedule: boolean;
  canClose: boolean;
  canMarkAbsent: boolean;
  scheduleBlocked: string;
  onAssign: () => void;
  onSave: () => void;
  onSchedule: () => void;
  onAbsent: () => void;
  onFinish: () => void;
  actionsSlot: (element: HTMLDivElement | null) => void;
  specialActions?: ReactNode;
}

function ScheduleMenu({ closed, confirmed, busy, canClose, canSchedule, canMarkAbsent, scheduleBlocked, onSchedule, onAbsent, onFinish }:
  Pick<ProcessFooterProps, "closed" | "confirmed" | "busy" | "canClose" | "canSchedule" | "canMarkAbsent" | "scheduleBlocked" | "onSchedule" | "onAbsent" | "onFinish">) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [position, setPosition] = useState<{ right: number; bottom: number } | null>(null);
  const open = Boolean(position);
  const managed = confirmed || canClose;
  const items = managed ? [
    { label: "Reagendar", icon: CalendarDays, disabled: !canSchedule, run: onSchedule, title: scheduleBlocked },
    { label: "Atendimento Encerrado", icon: Check, disabled: !canClose, run: onFinish, title: "Classifique todos os procedimentos antes de concluir" },
    { label: "Não compareceu", icon: UserX, disabled: !canMarkAbsent, run: onAbsent, title: "" },
  ] : [{ label: "Agendar", icon: CalendarDays, disabled: !canSchedule, run: onSchedule, title: scheduleBlocked }];

  function show(focus = false) {
    clearTimeout(timer.current);
    const bounds = trigger.current?.getBoundingClientRect();
    if (!bounds || closed || busy) return;
    setPosition({ right: Math.max(8, window.innerWidth - bounds.right), bottom: window.innerHeight - bounds.top + 5 });
    if (focus) requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus());
  }

  function leave() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!panel.current?.contains(document.activeElement)) setPosition(null);
    }, 180);
  }

  useEffect(() => {
    if (!open) return;
    const dismiss = () => setPosition(null);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) dismiss();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  return <>
    <Button ref={trigger} aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={closed || busy}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); }} onPointerLeave={leave}
      onClick={(event) => {
        if (open && event.detail !== 0 && !window.matchMedia("(hover: hover)").matches) setPosition(null);
        else show(event.detail === 0);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); show(true); }
        if (event.key === "Escape" && open) { event.preventDefault(); setPosition(null); }
      }}>
      <CalendarDays size={15} aria-hidden="true" /> {closed ? "Atendimento concluído" : managed ? "Gerenciar agendamento" : "Agendar"} <ChevronDown size={13} aria-hidden="true" />
    </Button>
    {open && <div ref={panel} id={id} role="menu" aria-label="Gerenciar agendamento" className="prm-schedule-menu" style={position || undefined}
      onPointerEnter={() => clearTimeout(timer.current)} onPointerLeave={leave} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) setPosition(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); setPosition(null); trigger.current?.focus(); }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") || []);
        if (!buttons.length) return;
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}>
      {items.map(({ label, icon: Icon, disabled, run, title }) => (
        <button type="button" role="menuitem" key={label} title={disabled ? title : undefined} disabled={disabled || busy}
          onClick={() => { setPosition(null); trigger.current?.focus(); run(); }}><Icon size={16} aria-hidden="true" /> {label}</button>
      ))}
    </div>}
  </>;
}

export function ProcessFooter(props: ProcessFooterProps) {
  const { tab, readOnly, closed, busy, responsible, onAssign, onSave, dirty, actionsSlot, specialActions } = props;
  return (
    <footer className="prm-footer" aria-label="Ações do processo">
      <div className="prm-footer-start">
        <Button variant="outline" disabled={readOnly || closed || busy} title={responsible} onClick={onAssign}><User size={15} aria-hidden="true" /> Definir responsável</Button>
      </div>
      {tab === ProcessTab.TUTOR && <div className="prm-footer-end" ref={actionsSlot} />}
      {tab === ProcessTab.PROCEDURES && (
        <div className="prm-footer-end">
          {specialActions ?? (!readOnly && <>
            <Button variant="outline" disabled={busy || closed || !dirty} onClick={onSave}><Save size={15} aria-hidden="true" /> Salvar</Button>
            <ScheduleMenu {...props} />
          </>)}
        </div>
      )}
    </footer>
  );
}
