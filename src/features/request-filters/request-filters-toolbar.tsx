import { CalendarDays, SlidersHorizontal } from "lucide-react";

interface RequestFiltersToolbarProps {
  todayOnly: boolean;
  todayCount: number;
  activePillCount: number;
  drawerOpen: boolean;
  onToggleToday: () => void;
  onOpenDrawer: () => void;
}

export function RequestFiltersToolbar({
  todayOnly,
  todayCount,
  activePillCount,
  drawerOpen,
  onToggleToday,
  onOpenDrawer,
}: RequestFiltersToolbarProps) {
  return (
    <nav className="request-nav" aria-label="Filtros de solicitações">
      <div className="request-today-segment">
        <button
          type="button"
          className={todayOnly ? "selected" : ""}
          aria-pressed={todayOnly}
          onClick={onToggleToday}
        >
          <CalendarDays size={14} />
          Hoje
          <span>{todayCount}</span>
        </button>
        <button
          type="button"
          className={activePillCount > 0 ? "selected" : ""}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={onOpenDrawer}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activePillCount > 0 && <span>{activePillCount}</span>}
        </button>
      </div>
    </nav>
  );
}
