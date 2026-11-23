import { useId, useMemo, useRef, useState } from "react";
import { RequestTag } from "../../../shared/request-contract.js";
import {
  CalendarDays, ChevronLeft, ChevronRight,
  Clock, MapPin,
} from "lucide-react";
import type { AnyRecord } from "../../types";
import { Button } from "../../components/button";
import { Card } from "../../components/card";
import { CloseButton } from "../../components/close-button";
import { useModalFocus } from "../../components/modal-focus";
import {
  normalizeRequest,
  normalizeScheduleDateText,
  requestHasTag,
  requestResultLabel,
  requestTypeLabel,
  requestTypeLabels,
} from "../../domain";
import { ToastContainer } from "../../components/toast-container";
import { ProcessModal } from "../process-modal/process-modal";
import { canEditRequests, useRequestActions } from "../request-actions/request-actions";


const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

type ViewMode = "month" | "week" | "day" | "year" | "list";
type OpenDay = (date: string, trigger: HTMLButtonElement) => void;
type OpenProcess = (request: AnyRecord, trigger: HTMLButtonElement) => void;

const calendarFocus = "tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-ui-accent";
const calendarCellAction = `tw:appearance-none tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:text-inherit tw:touch-manipulation ${calendarFocus}`;
const agendaCardAction = `tw:w-full tw:text-left tw:touch-manipulation tw:hover:border-ui-accent tw:hover:bg-card-page ${calendarFocus}`;

function dateToStr(date: Date): string {
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
}

function strToDate(str: string): Date | null {
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function sameMonth(date: Date, year: number, month: number): boolean {
  return date.getFullYear() === year && date.getMonth() === month;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(lastDay);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}

function requestDateStr(r: AnyRecord): string {
  return normalizeScheduleDateText(r.appointment || r.preferredSchedule || r.schedule_date || "");
}

function occupancyLevel(pct: number): "low" | "mid" | "high" | "full" {
  if (pct >= 100) return "full";
  if (pct >= 80)  return "high";
  if (pct >= 50)  return "mid";
  return "low";
}

function initials(name: string): string {
  const parts = String(name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function statusTone(request: AnyRecord): "success" | "danger" | "info" | "pending" | "neutral" {
  if (request.status === "REALIZADA") return "success";
  if (request.status === "CANCELADA") return "danger";
  if (requestHasTag(request, RequestTag.RESCHEDULED)) return "info";
  if (request.status === "AGENDADA") return "pending";
  return "neutral";
}

const STATUS_TONE_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  pending: { bg: "#ccfbf1", color: "#0f766e", dot: "#14b8a6" },
  neutral: { bg: "#fef3c7", color: "#b45309", dot: "#f59e0b" },
  success: { bg: "#f1f5f9", color: "#475569", dot: "#94a3b8" },
  danger: { bg: "#ffe4e6", color: "#be123c", dot: "#f43f5e" },
  info: { bg: "#dbeafe", color: "#1d4ed8", dot: "#3b82f6" },
};

function statusColors(request: AnyRecord) {
  return STATUS_TONE_COLORS[statusTone(request)] || STATUS_TONE_COLORS.neutral;
}

function AgendaStatusBadge({ request }: { request: AnyRecord }) {
  const label = requestResultLabel(request);
  return <span className={`ag-badge ag-badge--${statusTone(request)}`}>{label}</span>;
}


export function AgendaView({
  requests = [],
  scheduleDays = [],
  requestTypes = [],
  documentTypes = [],
  setSelectedId,
  patchRequest,
  runProcedureAction,
  currentUser,
  teams = { sectors: [], users: [] },
  municipalities = [],
  neighborhoods = [],
  refreshRequests,
}: AnyRecord) {
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [toasts, setToasts] = useState<AnyRecord[]>([]);
  const activeViewButton = useRef<HTMLButtonElement>(null);
  const dayPanelReturnFocus = useRef<HTMLButtonElement>(null);
  const processReturnFocus = useRef<HTMLButtonElement>(null);

  function showToast(message: string, type: "success" | "error" | "info" | "warning" = "success") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), type === "error" ? 6000 : 4000);
  }

  const {
    previewRequest,
    openRequest,
    closePreview,
    updatePreviewTutor,
    activeSectors,
    activeUsers,
    applyProcedureAction,
    updateDocuments,
    assignFromPreview,
    assumeFromPreview,
    rejectRequestFromProcess,
    confirmSpecialRequest,
  } = useRequestActions({ patchRequest, runProcedureAction, currentUser, teams, showToast, setSelectedId });

  function openDay(date: string, trigger: HTMLButtonElement) {
    dayPanelReturnFocus.current = trigger;
    setSelectedDay(date);
  }

  function openProcess(request: AnyRecord, trigger: HTMLButtonElement) {
    processReturnFocus.current = trigger;
    openRequest(request);
  }

  function closeProcess() {
    if (!processReturnFocus.current?.isConnected) activeViewButton.current?.focus();
    processReturnFocus.current = null;
    closePreview();
  }

  const normalized = useMemo(() => requests.map(normalizeRequest), [requests]);

  const filtered = useMemo(() => {
    let list = normalized;
    if (filterType) {
      list = list.filter((r) => requestTypeLabels(r).includes(filterType));
    }
    if (filterStatus === "cancelada") list = list.filter((r) => r.status === "CANCELADA");
    else if (filterStatus === "agendada") list = list.filter((r) => r.status === "AGENDADA");
    else if (filterStatus === "realizada") list = list.filter((r) => r.status === "REALIZADA");
    else if (filterStatus === "analise") list = list.filter((r) => r.status === "NOVA");
    return list;
  }, [normalized, filterType, filterStatus]);

  const scheduleDaysByDate = useMemo(() => {
    const map: Record<string, AnyRecord[]> = {};
    for (const day of scheduleDays) {
      const k = normalizeScheduleDateText(day.date);
      if (!map[k]) map[k] = [];
      map[k].push(day);
    }
    return map;
  }, [scheduleDays]);

  const requestsByDate = useMemo(() => {
    const map: Record<string, AnyRecord[]> = {};
    for (const r of filtered) {
      const ds = requestDateStr(r);
      if (!ds) continue;
      if (!map[ds]) map[ds] = [];
      map[ds].push(r);
    }
    return map;
  }, [filtered]);

  function getDayInfo(dateStr: string) {
    const sdays = scheduleDaysByDate[dateStr] || [];
    const reqs = requestsByDate[dateStr] || [];
    const totalVacancies = sdays.reduce((sum, d) => sum + (Number(d.vacancies) || 0), 0);
    const occupied = reqs.length;
    const available = Math.max(totalVacancies - occupied, 0);
    const pct = totalVacancies > 0 ? Math.round((occupied / totalVacancies) * 100) : 0;
    return { sdays, reqs, totalVacancies, occupied, available, pct };
  }

  function prev() {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() - 1);
    else if (view === "week") d.setDate(d.getDate() - 7);
    else if (view === "day") d.setDate(d.getDate() - 1);
    else if (view === "year") d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  }

  function next() {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + 1);
    else if (view === "week") d.setDate(d.getDate() + 7);
    else if (view === "day") d.setDate(d.getDate() + 1);
    else if (view === "year") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  }

  const todayStr = dateToStr(new Date());

  const summaryStats = useMemo(() => {
    const now = new Date();
    const todayS = dateToStr(now);
    const weekStart = startOfWeek(now);
    const weekEnd = addDays(weekStart, 6);
    const todayReqs = (requestsByDate[todayS] || []).length;
    const weekReqs = filtered.filter((r) => {
      const d = strToDate(requestDateStr(r));
      return d && d >= weekStart && d <= weekEnd;
    }).length;
    const canceladas = filtered.filter((r) => r.status === "CANCELADA").length;
    const compareceram = filtered.filter((r) => r.status === "REALIZADA").length;
    return { todayReqs, weekReqs, canceladas, compareceram };
  }, [filtered, requestsByDate]);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const r of normalized) requestTypeLabels(r).forEach((label) => types.add(label));
    return Array.from(types);
  }, [normalized]);

  const viewTabs: { id: ViewMode; label: string }[] = [
    { id: "month", label: "Mês" },
    { id: "week", label: "Semana" },
    { id: "day", label: "Dia" },
    { id: "year", label: "Ano" },
    { id: "list", label: "Lista" },
  ];

  const currentYear = currentDate.getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);
  const summaryCards = [
    { label: "hoje", value: summaryStats.todayReqs, valueStyle: "tw:text-ui-ink" },
    { label: "semana", value: summaryStats.weekReqs, valueStyle: "tw:text-ui-ink" },
    { label: "realizados", value: summaryStats.compareceram, valueStyle: "tw:text-ui-accent-strong" },
    { label: "cancelados", value: summaryStats.canceladas, valueStyle: "tw:text-ui-danger" },
  ];

  function goToMonth(month: number, year: number) {
    setCurrentDate(new Date(year, month, 1));
  }

  return (
    <section className="ag-root">
      <div className="page-toolbar ag-header-row">
        <div className="ag-filter-stack">
          <select className="ag-select ag-select--borderless" value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Tipo de atendimento">
            <option value="">Todos os tipos</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select className="ag-select ag-select--borderless" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Status operacional">
            <option value="">Todos os status</option>
            <option value="analise">Nova</option>
            <option value="agendada">Agendada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="ag-month-jump">
          <select className="ag-select" aria-label="Mês" value={currentDate.getMonth()} onChange={(e) => goToMonth(Number(e.target.value), currentYear)}>
            {MONTHS_FULL.map((label, index) => (
              <option key={label} value={index}>{label}</option>
            ))}
          </select>
          <select className="ag-select" aria-label="Ano" value={currentYear} onChange={(e) => goToMonth(currentDate.getMonth(), Number(e.target.value))}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Button variant="outline" className="tw:size-10 tw:shrink-0 tw:px-0" onClick={prev} aria-label="Anterior"><ChevronLeft size={13} aria-hidden="true" /></Button>
          <Button variant="outline" className="tw:size-10 tw:shrink-0 tw:px-0" onClick={next} aria-label="Próximo"><ChevronRight size={13} aria-hidden="true" /></Button>
        </div>

        <div className="ag-header-fill" />

        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:max-[900px]:w-full tw:max-[900px]:justify-center" role="group" aria-label="Visualização da agenda">
          {viewTabs.map((tab) => (
            <Button
              key={tab.id}
              ref={view === tab.id ? activeViewButton : undefined}
              variant="outline"
              className="tw:aria-pressed:border-ui-accent tw:aria-pressed:bg-ui-accent-soft tw:aria-pressed:text-ui-accent-strong"
              aria-pressed={view === tab.id}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="ag-summary-row">
        {summaryCards.map(({ label, value, valueStyle }) => (
          <Card key={label} className="tw:grid tw:h-[clamp(66px,11vh,96px)] tw:content-center tw:justify-items-center tw:gap-1.5 tw:p-2 tw:text-center">
            <strong className={`tw:text-[clamp(1.65rem,2.4vw,2.15rem)] tw:leading-none tw:font-semibold tw:tabular-nums ${valueStyle}`}>{value}</strong>
            <span className="tw:text-[0.68rem] tw:leading-none tw:font-medium tw:text-ui-muted">{label}</span>
          </Card>
        ))}
      </div>

      <div className="ag-canvas">
        {view === "month" && (
          <MonthView currentDate={currentDate} todayStr={todayStr} selectedDay={selectedDay} getDayInfo={getDayInfo} onDayClick={openDay} />
        )}
        {view === "week" && (
          <WeekView currentDate={currentDate} todayStr={todayStr} getDayInfo={getDayInfo} onDayClick={openDay} />
        )}
        {view === "day" && (
          <DayView currentDate={currentDate} getDayInfo={getDayInfo} onOpenRequest={openProcess} />
        )}
        {view === "year" && (
          <YearView
            currentDate={currentDate}
            todayStr={todayStr}
            getDayInfo={getDayInfo}
            onDayClick={(ds: string) => {
              const d = strToDate(ds);
              if (d) setCurrentDate(d);
              setView("month");
              requestAnimationFrame(() => activeViewButton.current?.focus());
            }}
          />
        )}
        {view === "list" && (
          <ListView filtered={filtered} onOpenRequest={openProcess} />
        )}
      </div>

      {selectedDay && (
        <DayPanel
          dateStr={selectedDay}
          getDayInfo={getDayInfo}
          returnFocus={dayPanelReturnFocus.current}
          onClose={() => setSelectedDay(null)}
          onOpenRequest={(r: AnyRecord) => {
            processReturnFocus.current = activeViewButton.current;
            setSelectedDay(null);
            openRequest(r);
          }}
        />
      )}

      {previewRequest && (
        <ProcessModal
          key={previewRequest.id}
          request={previewRequest}
          readOnly={!canEditRequests(currentUser?.role)}
          neighborhoods={neighborhoods}
          onTutorSaved={(tutor) => { updatePreviewTutor(tutor); refreshRequests?.(); }}
          requestTypes={requestTypes}
          documentTypes={documentTypes}
          sectors={activeSectors}
          users={activeUsers}
          municipalities={municipalities}
          currentUserName={currentUser?.name || ""}
          returnFocus={processReturnFocus.current}
          onClose={closeProcess}
          onRejectProcess={rejectRequestFromProcess}
          onAssign={assignFromPreview}
          onAssume={assumeFromPreview}
          onConfirmSpecial={confirmSpecialRequest}
          onProcedureAction={applyProcedureAction}
          onUpdateDocuments={updateDocuments}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t: AnyRecord) => t.id !== id))} />
    </section>
  );
}


function MonthView({ currentDate, todayStr, selectedDay, getDayInfo, onDayClick }: AnyRecord & { onDayClick: OpenDay }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = buildMonthGrid(year, month);

  return (
    <div className="ag-month">
      <div className="ag-month-wds">
        {WEEKDAYS.map((wd, i) => (
          <div key={wd} className={`ag-month-wd${i === 0 || i === 6 ? " is-weekend" : ""}`}>{wd}</div>
        ))}
      </div>
      <div className="ag-month-grid">
        {days.map((date) => {
          const str = dateToStr(date);
          const inMonth = sameMonth(date, year, month);
          const isToday = str === todayStr;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const { reqs, totalVacancies, occupied, available, pct } = getDayInfo(str);
          const isLotado = totalVacancies > 0 && available === 0;
          const isQuase = totalVacancies > 0 && pct >= 80 && available > 0;
          const level = occupancyLevel(pct);

          return (
            <button
              key={str}
              type="button"
              className={[
                "ag-cell",
                calendarCellAction,
                !inMonth && "is-other",
                isWeekend && inMonth && "is-weekend",
                isLotado && inMonth && "is-full",
                isQuase && inMonth && "is-busy",
                str === selectedDay && "is-selected",
              ].filter(Boolean).join(" ")}
              aria-label={`Abrir agenda de ${str}${totalVacancies > 0 && inMonth ? `, ${occupied} de ${totalVacancies} vagas ocupadas` : ""}`}
              aria-current={isToday ? "date" : undefined}
              aria-haspopup="dialog"
              onClick={(event) => onDayClick(str, event.currentTarget)}
            >
              <span className="ag-cell-top">
                <span className={`ag-cell-day${isToday ? " is-today" : ""}`}>{date.getDate()}</span>
                {totalVacancies > 0 && inMonth && (
                  <span className={`ag-cell-occ is-${level}`}>{occupied}/{totalVacancies}</span>
                )}
              </span>

              {totalVacancies > 0 && inMonth && (
                <span className="ag-cell-prog">
                  <span
                    className="ag-cell-fill tw:block"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: pct >= 80 ? "#f43f5e" : pct >= 50 ? "#f59e0b" : "#14b8a6",
                    }}
                  />
                </span>
              )}

              {reqs.length > 0 && inMonth && (
                <span className="ag-cell-events">
                  {reqs.slice(0, 2).map((r: AnyRecord) => (
                    <span
                      key={r.id}
                      className="ag-ev"
                      style={{ "--c": statusColors(r).dot } as React.CSSProperties}
                    >
                      {(r.scheduleSlotTime || r.scheduleTime) && (
                        <span className="ag-ev-time">{(r.scheduleSlotTime || r.scheduleTime).slice(0, 5)}</span>
                      )}
                      <span className="ag-ev-name">{r.tutor || "Tutor"}</span>
                    </span>
                  ))}
                  {reqs.length > 2 && (
                    <span className="ag-ev-more">+{reqs.length - 2} mais</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function WeekView({ currentDate, todayStr, getDayInfo, onDayClick }: AnyRecord & { onDayClick: OpenDay }) {
  const start = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="ag-week">
      <div className="ag-week-head">
        <div className="ag-week-gut" />
        {weekDays.map((date) => {
          const str = dateToStr(date);
          const isToday = str === todayStr;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const { reqs, totalVacancies, available, pct } = getDayInfo(str);
          const level = occupancyLevel(pct);
          return (
            <button
              key={str}
              type="button"
              className={["ag-week-col", calendarCellAction, isToday && "is-today", isWeekend && "is-weekend"].filter(Boolean).join(" ")}
              aria-label={`Abrir agenda de ${str}${totalVacancies > 0 ? `, ${available} vagas disponíveis` : ""}`}
              aria-current={isToday ? "date" : undefined}
              aria-haspopup="dialog"
              onClick={(event) => onDayClick(str, event.currentTarget)}
            >
              <span className="ag-week-wd">{WEEKDAYS[date.getDay()]}</span>
              <span className={`ag-week-dn${isToday ? " is-today" : ""}`}>{date.getDate()}</span>
              {totalVacancies > 0 && (
                <span className={`ag-week-occ is-${level}`}>{available}v</span>
              )}
              {reqs.length > 0 && (
                <span className="ag-week-count">{reqs.length}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="ag-week-scroll">
        {HOURS.map((hour) => (
          <div key={hour} className="ag-week-row">
            <div className="ag-week-time">{hour}</div>
            {weekDays.map((date) => {
              const str = dateToStr(date);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const { reqs } = getDayInfo(str);
              const hNum = parseInt(hour);
              const hourReqs = reqs.filter((r: AnyRecord) => {
                const t = r.scheduleSlotTime || r.scheduleTime || "";
                return t.startsWith(String(hNum).padStart(2, "0"));
              });
              return (
                <button
                  key={str}
                  type="button"
                  className={`ag-week-cell ${calendarCellAction}${isWeekend ? " is-weekend" : ""}`}
                  aria-label={`Abrir agenda de ${str}, horário ${hour}`}
                  aria-haspopup="dialog"
                  onClick={(event) => onDayClick(str, event.currentTarget)}
                >
                  {hourReqs.map((r: AnyRecord) => (
                    <span
                      key={r.id}
                      className="ag-wev"
                      style={{ "--c": statusColors(r).dot } as React.CSSProperties}
                    >
                      {r.tutor || "Tutor"}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


function DayView({ currentDate, getDayInfo, onOpenRequest }: AnyRecord & { onOpenRequest: OpenProcess }) {
  const str = dateToStr(currentDate);
  const { reqs, totalVacancies, occupied, available, pct, sdays } = getDayInfo(str);
  const locationName = sdays[0]?.locationName || sdays[0]?.location_name || "";
  const level = occupancyLevel(pct);

  const unscheduled = reqs.filter((r: AnyRecord) => {
    const t = r.scheduleSlotTime || r.scheduleTime || "";
    return !t || !HOURS.some((h) => t.startsWith(h.slice(0, 2)));
  });

  return (
    <div className="ag-day">
      {(locationName || totalVacancies > 0) && (
        <div className="ag-day-bar">
          {locationName && (
            <span className="ag-day-loc"><MapPin size={12} /> {locationName}</span>
          )}
          {totalVacancies > 0 && (
            <div className="ag-day-occ">
              <div className="ag-prog-lg">
                <div
                  className="ag-prog-fill"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    background: pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : pct >= 50 ? "#f59e0b" : "#10b981",
                  }}
                />
              </div>
              <span className={`ag-occ-tag is-${level}`}>{occupied}/{totalVacancies} · {available} vagas</span>
            </div>
          )}
        </div>
      )}
      <div className="ag-day-tl">
        {HOURS.map((hour) => {
          const hNum = parseInt(hour);
          const hourReqs = reqs.filter((r: AnyRecord) => {
            const t = r.scheduleSlotTime || r.scheduleTime || "";
            return t.startsWith(String(hNum).padStart(2, "0"));
          });
          return (
            <div key={hour} className="ag-tl-row">
              <div className="ag-tl-hour">{hour}</div>
              <div className="ag-tl-events">
                {hourReqs.map((r: AnyRecord) => (
                  <DayCard key={r.id} request={r} onOpenRequest={onOpenRequest} />
                ))}
              </div>
            </div>
          );
        })}
        {unscheduled.length > 0 && (
          <div className="ag-tl-row">
            <div className="ag-tl-hour ag-tl-hour--muted">—</div>
            <div className="ag-tl-events">
              {unscheduled.map((r: AnyRecord) => (
                <DayCard key={r.id} request={r} onOpenRequest={onOpenRequest} />
              ))}
            </div>
          </div>
        )}
        {reqs.length === 0 && (
          <div className="ag-empty">
            <CalendarDays size={28} strokeWidth={1.2} />
            <span>Nenhum agendamento para este dia.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DayCard({ request, onOpenRequest }: { request: AnyRecord; onOpenRequest: OpenProcess }) {
  const color = statusColors(request).dot;
  return (
    <Card
      as="button"
      className={`ag-day-card tw:p-0 ${agendaCardAction}`}
      style={{ "--c": color } as React.CSSProperties}
      aria-haspopup="dialog"
      onClick={(event) => onOpenRequest(request, event.currentTarget)}
    >
      <span className="ag-day-card-accent" aria-hidden="true" />
      <span className="ag-day-card-body">
        <span className="ag-day-card-top">
          <span className="ag-day-card-name">{request.tutor || "Tutor"}</span>
          <AgendaStatusBadge request={request} />
        </span>
        <span className="ag-day-card-meta">
          <span>{(request.animals || []).map((a: AnyRecord) => a.name).filter(Boolean).join(", ") || "Animal"}</span>
          <span className="ag-sep">·</span>
          <span>{requestTypeLabel(request)}</span>
          {(request.scheduleSlotTime || request.scheduleTime) && (
            <>
              <span className="ag-sep">·</span>
              <span className="ag-day-card-time"><Clock size={10} />{request.scheduleSlotTime || request.scheduleTime}</span>
            </>
          )}
        </span>
      </span>
    </Card>
  );
}


function YearView({ currentDate, todayStr, getDayInfo, onDayClick }: AnyRecord) {
  const year = currentDate.getFullYear();

  return (
    <div className="ag-year">
      {Array.from({ length: 12 }, (_, m) => {
        const days = buildMonthGrid(year, m);
        const monthTotal = days
          .filter((d) => sameMonth(d, year, m))
          .reduce((sum, d) => sum + getDayInfo(dateToStr(d)).reqs.length, 0);

        return (
          <div key={m} className="ag-yr-month">
            <div className="ag-yr-month-head">
              <span>{MONTHS_SHORT[m]}</span>
              {monthTotal > 0 && <span className="ag-yr-badge">{monthTotal}</span>}
            </div>
            <div className="ag-yr-grid">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="ag-yr-wd">{wd[0]}</div>
              ))}
              {days.map((date) => {
                const ds = dateToStr(date);
                const inMonth = sameMonth(date, year, m);
                const isToday = ds === todayStr;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const { reqs, totalVacancies, available } = getDayInfo(ds);
                const isLotado = totalVacancies > 0 && available === 0;
                const hasReqs = reqs.length > 0;
                if (!inMonth) return <span key={ds} className="ag-yr-day is-other" aria-hidden="true">{date.getDate()}</span>;

                return (
                  <button
                    key={ds}
                    type="button"
                    className={[
                      "ag-yr-day",
                      calendarCellAction,
                      isToday && "is-today",
                      isWeekend && "is-weekend",
                      isLotado && "is-full",
                      hasReqs && !isLotado && "has-events",
                    ].filter(Boolean).join(" ")}
                    title={`${ds}: ${reqs.length} agendamento(s)`}
                    aria-label={`Abrir mês de ${ds}, ${reqs.length} agendamento(s) neste dia`}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onDayClick(ds)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}


function formatListGroupLabel(dateStr: string): string {
  const date = strToDate(dateStr);
  if (!date) return dateStr;
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} de ${MONTHS_FULL[date.getMonth()]}`;
}

function ListView({ filtered, onOpenRequest }: AnyRecord & { onOpenRequest: OpenProcess }) {
  const sorted = [...filtered].sort((a, b) =>
    requestDateStr(a).localeCompare(requestDateStr(b))
  );

  if (!sorted.length) {
    return (
      <div className="ag-empty">
        <CalendarDays size={32} strokeWidth={1.2} />
        <span>Nenhum agendamento encontrado.</span>
      </div>
    );
  }

  const groups: { date: string; items: AnyRecord[] }[] = [];
  for (const r of sorted) {
    const ds = requestDateStr(r) || "—";
    const last = groups[groups.length - 1];
    if (last && last.date === ds) last.items.push(r);
    else groups.push({ date: ds, items: [r] });
  }

  return (
    <div className="ag-list">
      {groups.map((group) => (
        <div key={group.date} className="ag-list-group">
          <div className="ag-list-group-label">{formatListGroupLabel(group.date)}</div>
          <div className="tw:grid tw:gap-2">
            {group.items.map((r) => (
              <Card
                key={r.id}
                as="button"
                className={`tw:flex tw:items-center tw:gap-3.5 tw:px-4 tw:py-3 ${agendaCardAction}`}
                aria-haspopup="dialog"
                onClick={(event) => onOpenRequest(r, event.currentTarget)}
              >
                <span className="ag-list-row-main tw:flex-wrap">
                  <span className="ag-list-time">{r.scheduleSlotTime || r.scheduleTime || "—"}</span>
                  <span className="ag-list-name">{r.tutor || "—"}</span>
                  <span className="ag-list-sub">
                    {(r.animals || []).map((a: AnyRecord) => a.name).filter(Boolean).join(", ") || "—"}
                  </span>
                  <span className="ag-type-chip">{requestTypeLabel(r)}</span>
                </span>
                <AgendaStatusBadge request={r} />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


function DayPanel({ dateStr, getDayInfo, onClose, onOpenRequest, returnFocus }: AnyRecord) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(panelRef, true, returnFocus);
  const { reqs, sdays, totalVacancies, occupied, pct } = getDayInfo(dateStr);
  const locationName = sdays[0]?.locationName || sdays[0]?.location_name || "";
  const date = strToDate(dateStr);
  const weekday = date ? WEEKDAYS[date.getDay()] : "";
  const dateLabel = date
    ? `${date.getDate()} de ${MONTHS_FULL[date.getMonth()]} de ${date.getFullYear()}`
    : dateStr;

  return (
    <div ref={panelRef} data-managed-dialog="" className="tw:contents">
      <div className="ag-drawer-overlay" aria-hidden="true" onClick={onClose} />
      <aside className="ag-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ag-drawer-head">
          <div className="ag-drawer-head-info">
            <span className="ag-drawer-kicker">{weekday}</span>
            <h3 className="ag-drawer-date" id={titleId}>{dateLabel}</h3>
            {locationName && (
              <span className="ag-drawer-loc"><MapPin size={11} /> {locationName}</span>
            )}
          </div>
          <CloseButton aria-label="Fechar detalhes do dia" onClick={onClose} />
        </div>

        {totalVacancies > 0 && (
          <div className="ag-drawer-occ">
            <div className="ag-prog-lg">
              <div
                className="ag-prog-fill"
                style={{
                  width: `${Math.min(pct, 100)}%`,
                  background: pct >= 100 ? "#ef4444" : pct >= 80 ? "#f97316" : pct >= 50 ? "#f59e0b" : "#10b981",
                }}
              />
            </div>
            <span className="ag-drawer-occ-label">{occupied}/{totalVacancies} vagas</span>
          </div>
        )}

        <div className="ag-drawer-list">
          {reqs.length === 0 && (
            <div className="ag-empty">
              <CalendarDays size={22} strokeWidth={1.2} />
              <span>Nenhum agendamento neste dia.</span>
            </div>
          )}
          {reqs.map((r: AnyRecord) => (
            <Card
              key={r.id}
              as="button"
              className={`ag-drawer-card ${agendaCardAction}`}
              aria-haspopup="dialog"
              onClick={() => onOpenRequest(r)}
            >
              <span
                className="ag-drawer-card-avatar"
                aria-hidden="true"
                style={{ background: statusColors(r).bg, color: statusColors(r).color }}
              >
                {initials(r.tutor) || "?"}
              </span>
              <span className="ag-drawer-card-body">
                <span className="ag-drawer-card-top">
                  <span className="ag-drawer-card-name">{r.tutor || "Tutor"}</span>
                  {(r.scheduleSlotTime || r.scheduleTime) && (
                    <span className="ag-drawer-card-time">{r.scheduleSlotTime || r.scheduleTime}</span>
                  )}
                </span>
                <span className="ag-drawer-card-meta">
                  {(r.animals || []).map((a: AnyRecord) => a.name).filter(Boolean).join(", ") || "Animal"}
                  {" · "}
                  {requestTypeLabel(r)}
                </span>
              </span>
              <AgendaStatusBadge request={r} />
            </Card>
          ))}
        </div>
      </aside>
    </div>
  );
}
