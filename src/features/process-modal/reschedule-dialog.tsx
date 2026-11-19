import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { scheduleDate } from "../../../shared/schedule-contract.js";
import { PublicSchedulePicker } from "../../App";
import { isPastScheduleDay } from "../../domain";
import { getAvailableScheduleSlot, selectScheduleOccurrence, useScheduleAvailability } from "../registered-animals/use-schedule-availability";

export interface RescheduleSelection {
  date: string;
  occurrenceKey: string;
  time: string;
  reason: string;
}

interface RescheduleDialogProps {
  municipalityId: string;
  subject: string;
  currentDate: string;
  reservedSlots: { date: string; occurrenceKey?: string; slotTime?: string }[];
  busy: boolean;
  onConfirm: (selection: RescheduleSelection) => void;
  onClose: () => void;
}

function maskScheduleDate(value: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isValidScheduleDate(value: string) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [day, month, year] = value.split("/").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day && !isPastScheduleDay(value);
}

// The window to move one procedure to another date: one place for its animal, at a location and time with vacancy.
export function RescheduleDialog({ municipalityId, subject, currentDate, reservedSlots, busy, onConfirm, onClose }: RescheduleDialogProps) {
  const [date, setDate] = useState("");
  const [typedDate, setTypedDate] = useState("");
  const [occurrenceKey, setOccurrenceKey] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const availability = useScheduleAvailability(municipalityId, date);
  const days = availability.days.map((day) => {
    const times = reservedSlots
      .filter((item) => scheduleDate(item.date) === scheduleDate(day.date) && item.occurrenceKey === day.occurrenceKey)
      .map((item) => item.slotTime);
    const slots = day.slots.map((slot) => slot.remaining < 1 && times.includes(slot.time)
      ? { ...slot, remaining: 1, reserved: true }
      : { ...slot, reserved: false });
    return { ...day, slots, remaining: slots.reduce((sum, slot) => sum + slot.remaining, 0) };
  });
  const day = selectScheduleOccurrence(days, date, occurrenceKey, 1);
  const slot = day?.slots?.find((item) => item.time === time && item.remaining >= 1);

  function chooseDate(nextDate: string, nextOccurrence: string) {
    setDate(nextDate);
    setTypedDate(nextDate);
    setOccurrenceKey(nextOccurrence);
    setTime(getAvailableScheduleSlot(selectScheduleOccurrence(days, nextDate, nextOccurrence, 1), 1)?.time || "");
  }

  function typeDate(value: string) {
    const next = maskScheduleDate(value);
    setTypedDate(next);
    setDate(isValidScheduleDate(next) ? next : "");
    setOccurrenceKey("");
    setTime("");
  }

  return (
    <div className="modal-backdrop">
      <div className="prm-modal prm-modal--reschedule" role="dialog" aria-modal="true">
        <header className="prm-header">
          <div className="prm-header-identity">
            <div className="prm-header-identity-text">
              <span className="prm-eyebrow">Reagendar</span>
              <h2 className="prm-headline-name">{subject}</h2>
            </div>
            <div className="prm-header-actions">
              <button className="prm-close-btn" type="button" aria-label="Fechar" onClick={onClose}><X size={17} /></button>
            </div>
          </div>
        </header>
        <div className="prm-body">
          <div className="prm-inline-panel">
            <div className="prm-inline-panel-heading">
              <strong className="prm-inline-panel-title"><CalendarDays size={14} /> Nova data</strong>
              <div className="prm-reschedule-date-group">
                <span className="prm-reschedule-current">Atual: {currentDate || "-"}</span>
                <input className="prm-reschedule-date-input" value={typedDate} onChange={(event) => typeDate(event.target.value)} placeholder="dd/mm/aaaa" inputMode="numeric" aria-label="Data específica" />
              </div>
            </div>
            <label className="field prm-reschedule-reason">
              <textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Motivo do reagendamento (opcional)" aria-label="Motivo do reagendamento" />
            </label>
            {availability.loading && <p role="status">Carregando vagas disponíveis...</p>}
            {availability.error && <p role="alert" className="form-error">{availability.error} <button type="button" className="ghost-button" onClick={availability.refresh}>Tentar novamente</button></p>}
            <PublicSchedulePicker scheduleDays={days} selectedDate={date} selectedOccurrenceKey={occurrenceKey} pendingReservation={{ date, count: 1 }} onSelect={chooseDate} />
            {occurrenceKey && day && (
              <label className="field">
                <span>Horário no local selecionado</span>
                <select value={time} onChange={(event) => setTime(event.target.value)}>
                  <option value="">Escolha o horário</option>
                  {day.slots.map((item) => <option key={item.time} value={item.time} disabled={item.remaining < 1}>
                    {item.time} · {item.reserved ? "Vaga reservada para este animal" : item.remaining === 1 ? "1 vaga" : `${item.remaining} vagas`}
                  </option>)}
                </select>
              </label>
            )}
          </div>
        </div>
        <footer className="prm-footer">
          <button className="ghost-button" type="button" onClick={onClose}>Cancelar</button>
          <button className="primary-action" type="button" disabled={busy || !availability.ready || !occurrenceKey || !slot} onClick={() => onConfirm({ date, occurrenceKey, time, reason: reason.trim() })}>
            {busy ? "Reagendando..." : "Confirmar reagendamento"}
          </button>
        </footer>
      </div>
    </div>
  );
}
