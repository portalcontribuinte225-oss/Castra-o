import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { displayScheduleDate, scheduleDate } from "../../../shared/schedule-contract.js";
import { Button } from "../../components/button";
import { configFieldStyle, configTextareaStyle } from "../../components/ui";
import { isPastScheduleDay } from "../../domain";
import { useScheduleAvailability } from "../registered-animals/use-schedule-availability";
import { buildMonthCalendarDays, formatMonthYear, getCurrentScheduleMonthKey } from "../schedule-picker/schedule-months";
import { ProcessDialog } from "./process-dialog";
import type { AppointmentSlot, ScheduleSelection } from "./process-types";

interface ProcessScheduleDialogProps {
  requestId: string;
  municipalityId: string;
  schedules: AppointmentSlot[];
  animalCount: number;
  reschedule: boolean;
  busy: boolean;
  onConfirm: (selection: ScheduleSelection, reason: string) => void;
  onClose: () => void;
}

const weekDays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function ProcessScheduleDialog({ requestId, municipalityId, schedules, animalCount, reschedule, busy, onConfirm, onClose }: ProcessScheduleDialogProps) {
  const current = schedules[0];
  const sameTime = schedules.length === 1;
  const nextDate = current?.date && !isPastScheduleDay(current.date) ? displayScheduleDate(scheduleDate(current.date)) : "";
  const [month, setMonth] = useState(nextDate ? nextDate.slice(3) : getCurrentScheduleMonthKey());
  const [date, setDate] = useState(reschedule ? "" : nextDate);
  const [location, setLocation] = useState(reschedule ? "" : current?.occurrenceKey || "");
  const [time, setTime] = useState(reschedule ? "" : current?.slotTime || "");
  const [reason, setReason] = useState("");
  const availability = useScheduleAvailability(municipalityId, `01/${month}`, requestId);

  function eligible(day: { date: string; occurrenceKey: string }, slot: { time: string; remaining: number }) {
    return !isPastScheduleDay(day.date) && slot.remaining >= animalCount && !(reschedule && sameTime
      && scheduleDate(day.date) === scheduleDate(current.date) && day.occurrenceKey === current.occurrenceKey && slot.time === current.slotTime);
  }
  const locations = availability.days.filter((day) => day.date === date);
  const selectedDay = locations.find((day) => day.occurrenceKey === location);
  const selected = selectedDay?.slots.some((slot) => slot.time === time && eligible(selectedDay, slot));

  function moveMonth(offset: number) {
    const [m, year] = month.split("/").map(Number);
    const next = new Date(year, m - 1 + offset, 1);
    const today = new Date();
    if (next < new Date(today.getFullYear(), today.getMonth(), 1)) return;
    setMonth(`${String(next.getMonth() + 1).padStart(2, "0")}/${next.getFullYear()}`);
    setDate("");
    setLocation("");
    setTime("");
  }

  function chooseDay(value: string) {
    const choices = availability.days.filter((day) => day.date === value).flatMap((day) =>
      day.slots.filter((slot) => eligible(day, slot)).map((slot) => ({ occurrenceKey: day.occurrenceKey, time: slot.time })));
    setDate(value);
    setLocation(choices.length === 1 ? choices[0].occurrenceKey : "");
    setTime(choices.length === 1 ? choices[0].time : "");
  }

  return (
    <ProcessDialog title={reschedule ? "Reagendar solicitação" : "Agendar solicitação"} className="prm-calendar-dialog" busy={busy} onClose={onClose}
      actions={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button disabled={busy || !availability.ready || !selected} onClick={() => onConfirm({ date, occurrenceKey: location, time }, reason.trim())}>
          {busy ? "Salvando..." : reschedule ? "Confirmar reagendamento" : "Confirmar agendamento"}
        </Button>
      </>}>
      <div className="prm-calendar-meta">
        <span>{schedules.length ? `Agendamento atual: ${schedules.map((slot) => [displayScheduleDate(slot.date), slot.slotTime, slot.locationName].filter(Boolean).join(" · ")).join(" / ")}` : "Selecione uma data e horário"}</span>
        <strong>{animalCount} {animalCount === 1 ? "vaga necessária" : "vagas necessárias"}</strong>
      </div>
      {availability.loading && <p role="status">Carregando vagas disponíveis...</p>}
      {availability.error && <p role="alert" className="form-error">{availability.error} <Button variant="outline" onClick={availability.refresh}>Tentar novamente</Button></p>}
      <section className="prm-calendar-panel" aria-label="Agenda de atendimento">
        <div className="prm-calendar-toolbar">
          <Button variant="outline" className="prm-icon-button" aria-label="Mês anterior" disabled={busy || month === getCurrentScheduleMonthKey()} onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></Button>
          <strong>{formatMonthYear(month)}</strong>
          <Button variant="outline" className="prm-icon-button" aria-label="Próximo mês" disabled={busy} onClick={() => moveMonth(1)}><ChevronRight size={16} /></Button>
        </div>
        <div className="prm-calendar-grid">
          {weekDays.map((day) => <span key={day}>{day}</span>)}
          {buildMonthCalendarDays(month).map(({ offset, day, date: value }, index) => {
            if (offset) return <span key={index} />;
            const configured = availability.days.filter((entry) => entry.date === value);
            const offered = configured.flatMap((entry) => entry.slots.filter((slot) => eligible(entry, slot)));
            const label = isPastScheduleDay(value) ? "Já passou" : offered.length ? offered.length === 1 ? offered[0].time : `${offered.length} horários`
              : configured.length ? "Indisponível" : "Sem atendimento";
            return <button type="button" key={value} aria-label={`${value} · ${label}`} aria-pressed={date === value}
              disabled={busy || !availability.ready || !offered.length} onClick={() => chooseDay(value)}>
              <strong>{String(day).padStart(2, "0")}</strong><small>{label}</small>
            </button>;
          })}
        </div>
        <div className="prm-calendar-slots">
          {date ? locations.flatMap((day) => day.slots.map((slot) => (
            <Button key={`${day.occurrenceKey}:${slot.time}`} variant="outline" aria-pressed={day.occurrenceKey === location && slot.time === time}
              disabled={busy || !eligible(day, slot)} onClick={() => { setLocation(day.occurrenceKey); setTime(slot.time); }}>
              <span>{slot.time}{day.locationName ? ` · ${day.locationName}` : ""}</span>
              <small>{slot.remaining} {slot.remaining === 1 ? "vaga" : "vagas"}</small>
            </Button>
          ))) : <span className="prm-muted-note">Selecione uma data disponível.</span>}
        </div>
      </section>
      {reschedule && <label className={configFieldStyle}>
        <span>Motivo do reagendamento (opcional)</span>
        <textarea data-ui-input="" className={configTextareaStyle} value={reason} disabled={busy} maxLength={1000} rows={2} placeholder="Se houver" onChange={(event) => setReason(event.target.value)} />
      </label>}
    </ProcessDialog>
  );
}
