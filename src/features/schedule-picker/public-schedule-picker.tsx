import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "../../components/button";
import type { AnyRecord } from "../../types";
import { isPastScheduleDay, parseScheduleDate } from "../../domain";
import { getAvailableScheduleSlot } from "../registered-animals/use-schedule-availability";
import { buildMonthCalendarDays, buildScheduleMonths, formatMonthYear, getCurrentScheduleMonthKey } from "./schedule-months";

function ScheduleDayButton({
  hasVacancy,
  selected,
  mutirao = false,
  disabled,
  onClick,
  children,
}: AnyRecord) {
  return (
    <button
      className={[
        "calendar-day-button",
        hasVacancy ? "has-vacancy" : "",
        selected ? "selected" : "",
        mutirao ? "mutirao-day" : "",
      ].filter(Boolean).join(" ")}
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function PublicSchedulePicker({
  scheduleDays = [],
  selectedDate = "",
  selectedOccurrenceKey = "",
  onSelect,
  pendingReservation = null,
  title = "",
  hint = "",
  external = false,
  internal = false,
}) {
  const [scheduleMonthIndex, setScheduleMonthIndex] = useState(0);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const monthSelector = useRef<HTMLDivElement>(null);
  const requiredVacancies = Math.max(Number(pendingReservation?.count) || 1, 1);
  const scheduleWithUsage = scheduleDays.filter((day) => day.active !== false).map((day) => {
    const confirmed = Math.max(day.vacancies - day.remaining, 0);
    const pending = pendingReservation?.date === day.date && (!selectedOccurrenceKey || selectedOccurrenceKey === day.occurrenceKey) ? (pendingReservation.count || 0) : 0;
    const used = confirmed + pending;
    const offeredSlot = getAvailableScheduleSlot(day, requiredVacancies);
    const confirmedRemaining = Math.max(day.vacancies - confirmed, 0);
    return {
      ...day,
      used,
      remaining: Math.max(day.vacancies - used, 0),
      hasEnoughVacancies: confirmedRemaining >= requiredVacancies && Boolean(offeredSlot),
      offeredSlot,
      isPast: isPastScheduleDay(day.date),
    };
  });
  const scheduleMonths = buildScheduleMonths(scheduleWithUsage);
  const activeScheduleMonth = scheduleMonths[scheduleMonthIndex] || "";
  const chosenDay = scheduleWithUsage.find((day) => day.date === selectedDate && (!selectedOccurrenceKey || day.occurrenceKey === selectedOccurrenceKey));
  const chosenTime = chosenDay ? chosenDay.offeredSlot?.time || chosenDay.startTime || "" : "";
  const scheduleByDate = new Map();
  scheduleWithUsage.forEach((day) => {
    const previous = scheduleByDate.get(day.date);
    if (!previous || day.occurrenceKey === selectedOccurrenceKey || (!previous.hasEnoughVacancies && day.hasEnoughVacancies)) scheduleByDate.set(day.date, day);
  });
  const visibleScheduleDays = buildMonthCalendarDays(activeScheduleMonth).map((calendarDay) => {
    if (calendarDay.offset) return calendarDay;
    const configuredDay = scheduleByDate.get(calendarDay.date);
    return configuredDay
      ? { ...configuredDay, calendarDay: calendarDay.day, available: true }
      : {
          ...calendarDay,
          weekday: calendarDay.weekday,
          vacancies: 0,
          remaining: 0,
          used: 0,
          isPast: isPastScheduleDay(calendarDay.date),
          available: false,
        };
  });

  useEffect(() => {
    setScheduleMonthIndex(Math.max(scheduleMonths.indexOf(getCurrentScheduleMonthKey()), 0));
  }, [scheduleMonths.join("|")]);

  const MonthButton = internal ? Button : "button";
  const hasMonthChoice = scheduleMonths.length > 1;

  function closeMonthDropdown() {
    setMonthDropdownOpen(false);
    monthSelector.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  return (
    <section className="panel public-schedule-picker">
      <div className="schedule-picker-controls">
        {title && <span className="form-sub-card-title">{title}</span>}
        {hint && <p className="form-hint">{hint}</p>}
        <div className="sched-month-selector" ref={internal ? monthSelector : undefined} onBlur={internal ? (event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMonthDropdownOpen(false);
        } : undefined} onKeyDown={(event) => {
          if (!internal || !hasMonthChoice || !monthDropdownOpen || event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          closeMonthDropdown();
        }}>
          <MonthButton
            type="button"
            variant={internal ? "custom" : undefined}
            className={internal ? "tw:border-card-border tw:bg-card-page tw:font-semibold tw:text-ui-ink tw:hover:bg-[var(--accent-blue-soft)] tw:[&>svg:first-child]:text-[color:var(--blue)]" : "sched-month-trigger"}
            aria-expanded={internal && hasMonthChoice ? monthDropdownOpen : undefined}
            onClick={() => setMonthDropdownOpen((open) => !open)}
          >
            <CalendarDays size={14} />
            <span>{formatMonthYear(activeScheduleMonth)}</span>
            {hasMonthChoice && <ChevronDown size={14} className={monthDropdownOpen ? "sched-chevron-open" : ""} />}
          </MonthButton>
          {hasMonthChoice && monthDropdownOpen && (
            <div className="sched-month-dropdown">
              {scheduleMonths.map((month, i) => (
                <MonthButton
                  key={month}
                  type="button"
                  variant={internal ? "custom" : undefined}
                  className={internal
                    ? "tw:w-full tw:whitespace-normal tw:border-card-border tw:bg-card-surface tw:px-2 tw:font-medium tw:text-ui-text tw:hover:bg-[var(--accent-blue-soft)] tw:aria-pressed:border-[color:var(--blue)] tw:aria-pressed:bg-[var(--accent-blue-soft)] tw:aria-pressed:text-[color:var(--blue)]"
                    : `sched-month-tab${i === scheduleMonthIndex ? " is-active" : ""}`}
                  aria-pressed={internal ? i === scheduleMonthIndex : undefined}
                  onClick={() => { setScheduleMonthIndex(i); closeMonthDropdown(); }}
                >
                  {formatMonthYear(month)}
                </MonthButton>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="schedule-picker-calendar">
        <div className="calendar-weekdays" aria-hidden="true">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>
        <div className="calendar-availability">
          {visibleScheduleDays.length === 0 && (
            <div className="calendar-empty-month">Nenhuma data configurada para {formatMonthYear(activeScheduleMonth)}.</div>
          )}
          {visibleScheduleDays.map((day, index) =>
            day.offset
              ? <div key={`offset-${index}`} className="calendar-day-button calendar-day-offset" aria-hidden="true" />
              : (
                <ScheduleDayButton
                  key={day.date}
                  selected={selectedDate === day.date}
                  mutirao={day.kind === "Mutirao"}
                  hasVacancy={day.available && !day.isPast && day.hasEnoughVacancies}
                  disabled={!day.available || !day.hasEnoughVacancies || day.isPast}
                  onClick={() => onSelect(day.date, day.occurrenceKey || "")}
                >
                  <strong>{String(day.calendarDay || day.date.slice(0, 2)).padStart(2, "0")}</strong>
                  <small>{!day.available ? "Sem atendimento" : day.isPast ? "Já passou" : day.hasEnoughVacancies ? `${day.offeredSlot?.time || day.startTime || ""} · ${day.remaining} vagas` : "Sem vagas suficientes"}</small>
                  {day.kind === "Mutirao" && <em>Mutirão</em>}
                </ScheduleDayButton>
              )
          )}
        </div>
      </div>
      {chosenDay && <p className="schedule-chosen" role="status">Você escolheu {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(parseScheduleDate(chosenDay.date)))}{chosenTime ? `, às ${chosenTime}` : ""}.</p>}
      {selectedDate && scheduleWithUsage.filter((day) => day.date === selectedDate).length > 1 && (
        <div className="schedule-occurrence-options" role="group" aria-label="Local e horário">
          <p>Escolha o local desta data:</p>
          {scheduleWithUsage.filter((day) => day.date === selectedDate).map((day) => {
            const selected = selectedOccurrenceKey === day.occurrenceKey;
            const remaining = Math.max(day.vacancies - (day.used - (selected ? requiredVacancies : 0)), 0);
            const label = `${day.locationName || "Local de atendimento"} · ${day.offeredSlot?.time || day.startTime} · ${remaining} vagas`;
            const disabled = !day.hasEnoughVacancies || day.isPast;
            const onClick = () => onSelect(day.date, day.occurrenceKey || "");
            return external
              ? <Button key={day.occurrenceKey || day.id} variant={selected ? "primary" : "outline"} aria-pressed={selected} className="tw:whitespace-normal tw:text-center" disabled={disabled} onClick={onClick}>{label}</Button>
              : <button type="button" key={day.occurrenceKey || day.id} className={selected ? "primary-action" : "ghost-button"} disabled={disabled} onClick={onClick}>{label}</button>;
          })}
        </div>
      )}
    </section>
  );
}
