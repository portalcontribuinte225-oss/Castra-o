import { useMemo, useState } from "react";
import {
  CalendarCheck2, CalendarDays, ChevronLeft, ChevronRight,
  Clock, MapPin, Search, SlidersHorizontal, X,
} from "lucide-react";
import type { AnyRecord } from "../types";
import {
  normalizeRequest,
  normalizeScheduleDateText,
  requestHasTag,
  requestResultLabel,
  requestTypeLabel,
} from "../domain";
import { RequestPreviewModal, ToastContainer } from "../App";
import { useRequestActions } from "./request-actions";


const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const HOURS = Array.from({ length: 14 }, (_, i) => `${String(i + 7).padStart(2, "0")}:00`);

type ViewMode = "month" | "week" | "day" | "year" | "list";

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

const LEGEND_ITEMS = [
  { label: "Confirmado", tone: "pending" },
  { label: "Pendente", tone: "neutral" },
  { label: "Realizado", tone: "success" },
  { label: "Cancelado", tone: "danger" },
];


function statusTone(request: AnyRecord): "success" | "danger" | "info" | "pending" | "neutral" {
  if (request.status === "REALIZADA") return "success";
  if (request.status === "CANCELADA") return "danger";
  if (requestHasTag(request, "REAGENDADA")) return "info";
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
  setSelectedId,
  patchRequest,
  currentUser,
  teams = { sectors: [], users: [] },
}: AnyRecord) {
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<AnyRecord[]>([]);

  function showToast(message: string, type: "success" | "error" | "info" | "warning" = "success") {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), type === "error" ? 6000 : 4000);
  }

  const {
    previewRequest,
    openRequest,
    closePreview,
    activeSectors,
    activeUsers,
    activeScheduleDays,
    approveRequest,
    archiveWithTag,
    rescheduleFromPreview,
    assignFromPreview,
    rejectRequestFromProcess,
    confirmAttendanceFromProcess,
  } = useRequestActions({ patchRequest, currentUser, teams, requests, scheduleDays, showToast, setSelectedId });

  const normalized = useMemo(() => requests.map(normalizeRequest), [requests]);

  const filtered = useMemo(() => {
    let list = normalized;
    if (filterType) {
      list = list.filter((r) =>
        (r.type || r.requestTypeId || "").toLowerCase().includes(filterType.toLowerCase())
      );
    }
    if (filterStatus === "cancelada") list = list.filter((r) => r.status === "CANCELADA");
    else if (filterStatus === "agendada") list = list.filter((r) => r.status === "AGENDADA");
    else if (filterStatus === "realizada") list = list.filter((r) => r.status === "REALIZADA");
    else if (filterStatus === "analise") list = list.filter((r) => r.status === "NOVA");
    if (search) {
      const key = search.toLowerCase();
      list = list.filter((r) =>
        (r.tutor || "").toLowerCase().includes(key) ||
        (r.cpf || "").includes(key) ||
        (r.protocol || "").toLowerCase().includes(key) ||
        (r.animals || []).some((a: AnyRecord) => (a.name || "").toLowerCase().includes(key))
      );
    }
    return list;
  }, [normalized, filterType, filterStatus, search]);

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

  function periodLabel(): string {
    if (view === "year") return String(currentDate.getFullYear());
    if (view === "day") {
      return `${WEEKDAYS[currentDate.getDay()]}, ${String(currentDate.getDate()).padStart(2, "0")} de ${MONTHS_FULL[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    }
    if (view === "week") {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()}–${end.getDate()} de ${MONTHS_FULL[start.getMonth()]} de ${start.getFullYear()}`;
      }
      return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} – ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
    }
    return `${MONTHS_FULL[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
  }

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
    for (const r of normalized) {
      const t = r.type || r.requestTypeId || "";
      if (t) types.add(t);
    }
    return Array.from(types);
  }, [normalized]);

  const viewTabs: { id: ViewMode; label: string }[] = [
    { id: "month", label: "Mês" },
    { id: "week", label: "Semana" },
    { id: "day", label: "Dia" },
    { id: "year", label: "Ano" },
    { id: "list", label: "Lista" },
  ];

  const hasFilters = filterType || filterStatus || search;

  return (
    <section className="ag-root">
      <div className="page-toolbar ag-header-row">
        <div className="ag-nav">
          <button className="ag-nav-btn" onClick={prev} aria-label="Anterior"><ChevronLeft size={13} /></button>
          <button className="ag-nav-today" onClick={() => setCurrentDate(new Date())}>Hoje</button>
          <button className="ag-nav-btn" onClick={next} aria-label="Próximo"><ChevronRight size={13} /></button>
        </div>

        <div className="ag-header-fill" />

        <div className="ag-views">
          {viewTabs.map((tab) => (
            <button
              key={tab.id}
              className={`ag-view-btn${view === tab.id ? " is-active" : ""}`}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ag-legend">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.tone} className="ag-legend-item">
            <span className={`ag-legend-dot ag-legend-dot--${item.tone}`} />
            {item.label}
          </span>
        ))}
        <span className="ag-legend-sep">·</span>
        <span className="ag-legend-note">Capacidade de acordo com a agenda configurada</span>
      </div>

      <div className="ag-workspace">
        <aside className="ag-side">
          <div className="ag-side-controls">
            <div className="ag-side-head">
              <span><SlidersHorizontal size={15} /> Controle</span>
              {hasFilters && <button onClick={() => { setFilterType(""); setFilterStatus(""); setSearch(""); }}>Resetar</button>}
            </div>

            <label className="ag-search">
              <Search size={15} className="ag-search-icon" />
              <input
                type="search"
                placeholder="Buscar tutor, CPF, animal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="ag-search-clear" onClick={() => setSearch("")} aria-label="Limpar">
                  <X size={13} />
                </button>
              )}
            </label>

            <div className="ag-filter-stack">
              <label className="ag-filter">
                <span>Tipo de atendimento</span>
                <select className="ag-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">Todos os tipos</option>
                  {allTypes.map((t) => (
                    <option key={t} value={t}>{requestTypeLabel({ type: t })}</option>
                  ))}
                </select>
              </label>

              <label className="ag-filter">
                <span>Status operacional</span>
                <select className="ag-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">Todos os status</option>
                  <option value="analise">Nova</option>
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>
            </div>
          </div>

          <div className="ag-side-summary">
            <div className="ag-side-stat"><strong>{summaryStats.todayReqs}</strong><span>hoje</span></div>
            <div className="ag-side-stat"><strong>{summaryStats.weekReqs}</strong><span>semana</span></div>
            <div className="ag-side-stat is-ok"><strong>{summaryStats.compareceram}</strong><span>realizados</span></div>
            <div className="ag-side-stat is-warn"><strong>{summaryStats.canceladas}</strong><span>cancelados</span></div>
          </div>

        </aside>

        <div className="ag-canvas">
        {view === "month" && (
          <MonthView currentDate={currentDate} todayStr={todayStr} selectedDay={selectedDay} getDayInfo={getDayInfo} onDayClick={setSelectedDay} />
        )}
        {view === "week" && (
          <WeekView currentDate={currentDate} todayStr={todayStr} getDayInfo={getDayInfo} onDayClick={setSelectedDay} />
        )}
        {view === "day" && (
          <DayView currentDate={currentDate} getDayInfo={getDayInfo} onOpenRequest={openRequest} />
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
            }}
          />
        )}
        {view === "list" && (
          <ListView filtered={filtered} onOpenRequest={openRequest} />
        )}
        </div>
      </div>

      {selectedDay && (
        <DayPanel
          dateStr={selectedDay}
          getDayInfo={getDayInfo}
          onClose={() => setSelectedDay(null)}
          onOpenRequest={(r: AnyRecord) => { setSelectedDay(null); openRequest(r); }}
        />
      )}

      {previewRequest && (
        <RequestPreviewModal
          request={previewRequest}
          requestTypes={requestTypes}
          scheduleDays={activeScheduleDays}
          sectors={activeSectors}
          users={activeUsers}
          onClose={closePreview}
          onApprove={approveRequest}
          onReject={rejectRequestFromProcess}
          onArchive={archiveWithTag}
          onAttendance={confirmAttendanceFromProcess}
          onReschedule={rescheduleFromPreview}
          onAssign={assignFromPreview}
          patchRequest={patchRequest}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((t: AnyRecord) => t.id !== id))} />
    </section>
  );
}


function MonthView({ currentDate, todayStr, selectedDay, getDayInfo, onDayClick }: AnyRecord) {
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
            <div
              key={str}
              className={[
                "ag-cell",
                !inMonth && "is-other",
                isWeekend && inMonth && "is-weekend",
                isLotado && inMonth && "is-full",
                isQuase && inMonth && "is-busy",
                str === selectedDay && "is-selected",
              ].filter(Boolean).join(" ")}
              onClick={() => onDayClick(str)}
            >
              <div className="ag-cell-top">
                <span className={`ag-cell-day${isToday ? " is-today" : ""}`}>{date.getDate()}</span>
                {totalVacancies > 0 && inMonth && (
                  <span className={`ag-cell-occ is-${level}`}>{occupied}/{totalVacancies}</span>
                )}
              </div>

              {totalVacancies > 0 && inMonth && (
                <div className="ag-cell-prog">
                  <div
                    className="ag-cell-fill"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: pct >= 80 ? "#f43f5e" : pct >= 50 ? "#f59e0b" : "#14b8a6",
                    }}
                  />
                </div>
              )}

              {reqs.length > 0 && inMonth && (
                <div className="ag-cell-events">
                  {reqs.slice(0, 2).map((r: AnyRecord) => (
                    <div
                      key={r.id}
                      className="ag-ev"
                      style={{ "--c": statusColors(r).dot } as React.CSSProperties}
                    >
                      {(r.scheduleSlotTime || r.scheduleTime) && (
                        <span className="ag-ev-time">{(r.scheduleSlotTime || r.scheduleTime).slice(0, 5)}</span>
                      )}
                      <span className="ag-ev-name">{r.tutor || "Tutor"}</span>
                    </div>
                  ))}
                  {reqs.length > 2 && (
                    <div className="ag-ev-more">+{reqs.length - 2} mais</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function WeekView({ currentDate, todayStr, getDayInfo, onDayClick }: AnyRecord) {
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
            <div
              key={str}
              className={["ag-week-col", isToday && "is-today", isWeekend && "is-weekend"].filter(Boolean).join(" ")}
              onClick={() => onDayClick(str)}
            >
              <span className="ag-week-wd">{WEEKDAYS[date.getDay()]}</span>
              <span className={`ag-week-dn${isToday ? " is-today" : ""}`}>{date.getDate()}</span>
              {totalVacancies > 0 && (
                <span className={`ag-week-occ is-${level}`}>{available}v</span>
              )}
              {reqs.length > 0 && (
                <span className="ag-week-count">{reqs.length}</span>
              )}
            </div>
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
                <div
                  key={str}
                  className={`ag-week-cell${isWeekend ? " is-weekend" : ""}`}
                  onClick={() => onDayClick(str)}
                >
                  {hourReqs.map((r: AnyRecord) => (
                    <div
                      key={r.id}
                      className="ag-wev"
                      style={{ "--c": statusColors(r).dot } as React.CSSProperties}
                    >
                      {r.tutor || "Tutor"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


function DayView({ currentDate, getDayInfo, onOpenRequest }: AnyRecord) {
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
                  <DayCard key={r.id} request={r} onClick={() => onOpenRequest(r)} />
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
                <DayCard key={r.id} request={r} onClick={() => onOpenRequest(r)} />
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

function DayCard({ request, onClick }: { request: AnyRecord; onClick: () => void }) {
  const color = statusColors(request).dot;
  return (
    <div className="ag-day-card" style={{ "--c": color } as React.CSSProperties} onClick={onClick}>
      <div className="ag-day-card-accent" />
      <div className="ag-day-card-body">
        <div className="ag-day-card-top">
          <span className="ag-day-card-name">{request.tutor || "Tutor"}</span>
          <AgendaStatusBadge request={request} />
        </div>
        <div className="ag-day-card-meta">
          <span>{(request.animals || []).map((a: AnyRecord) => a.name).filter(Boolean).join(", ") || "Animal"}</span>
          <span className="ag-sep">·</span>
          <span>{requestTypeLabel(request)}</span>
          {(request.scheduleSlotTime || request.scheduleTime) && (
            <>
              <span className="ag-sep">·</span>
              <span className="ag-day-card-time"><Clock size={10} />{request.scheduleSlotTime || request.scheduleTime}</span>
            </>
          )}
        </div>
      </div>
    </div>
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
                const hasReqs = reqs.length > 0 && inMonth;

                return (
                  <div
                    key={ds}
                    className={[
                      "ag-yr-day",
                      !inMonth && "is-other",
                      isToday && "is-today",
                      isWeekend && inMonth && "is-weekend",
                      isLotado && inMonth && "is-full",
                      hasReqs && !isLotado && "has-events",
                    ].filter(Boolean).join(" ")}
                    title={inMonth ? `${ds}: ${reqs.length} agendamento(s)` : ""}
                    onClick={() => inMonth && onDayClick(ds)}
                  >
                    {date.getDate()}
                  </div>
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

function ListView({ filtered, onOpenRequest }: AnyRecord) {
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
          <div className="ag-list-box">
            {group.items.map((r) => (
              <div key={r.id} className="ag-list-row" onClick={() => onOpenRequest(r)}>
                <div className="ag-list-row-main">
                  <span className="ag-list-time">{r.scheduleSlotTime || r.scheduleTime || "—"}</span>
                  <span className="ag-list-name">{r.tutor || "—"}</span>
                  <span className="ag-list-sub">
                    {(r.animals || []).map((a: AnyRecord) => a.name).filter(Boolean).join(", ") || "—"}
                  </span>
                  <span className="ag-type-chip">{requestTypeLabel(r)}</span>
                </div>
                <AgendaStatusBadge request={r} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}


function DayPanel({ dateStr, getDayInfo, onClose, onOpenRequest }: AnyRecord) {
  const { reqs, sdays, totalVacancies, occupied, pct } = getDayInfo(dateStr);
  const locationName = sdays[0]?.locationName || sdays[0]?.location_name || "";
  const date = strToDate(dateStr);
  const weekday = date ? WEEKDAYS[date.getDay()] : "";
  const dateLabel = date
    ? `${date.getDate()} de ${MONTHS_FULL[date.getMonth()]} de ${date.getFullYear()}`
    : dateStr;

  return (
    <>
      <div className="ag-drawer-overlay" onClick={onClose} />
      <aside className="ag-drawer">
        <div className="ag-drawer-head">
          <div className="ag-drawer-head-info">
            <span className="ag-drawer-kicker">{weekday}</span>
            <h3 className="ag-drawer-date">{dateLabel}</h3>
            {locationName && (
              <span className="ag-drawer-loc"><MapPin size={11} /> {locationName}</span>
            )}
          </div>
          <button className="ag-drawer-close" onClick={onClose} aria-label="Fechar"><X size={15} /></button>
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
            <div
              key={r.id}
              className="ag-drawer-card"
              onClick={() => onOpenRequest(r)}
            >
              <span
                className="ag-drawer-card-avatar"
                style={{ background: statusColors(r).bg, color: statusColors(r).color }}
              >
                {initials(r.tutor) || "?"}
              </span>
              <div className="ag-drawer-card-body">
                <div className="ag-drawer-card-top">
                  <span className="ag-drawer-card-name">{r.tutor || "Tutor"}</span>
                  {(r.scheduleSlotTime || r.scheduleTime) && (
                    <span className="ag-drawer-card-time">{r.scheduleSlotTime || r.scheduleTime}</span>
                  )}
                </div>
                <div className="ag-drawer-card-meta">
                  {(r.animals || []).map((a: AnyRecord) => a.name).filter(Boolean).join(", ") || "Animal"}
                  {" · "}
                  {requestTypeLabel(r)}
                </div>
              </div>
              <AgendaStatusBadge request={r} />
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
