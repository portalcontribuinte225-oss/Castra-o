import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { Button } from "../../components/button";

const filterButtonStyle = "tw:min-w-0 tw:flex-1 tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:data-[active=true]:border-ui-accent tw:data-[active=true]:bg-[var(--selected-bg)] tw:data-[active=true]:text-[color:var(--selected-ink)]";
const filterCountStyle = "tw:rounded-full tw:bg-[var(--ink-200)] tw:px-1.5 tw:py-0.5 tw:text-xs tw:text-ui-text tw:tabular-nums";

interface RequestFiltersToolbarProps {
  sectionLabel?: string;
  todayOnly: boolean;
  todayCount: number;
  activePillCount: number;
  drawerOpen: boolean;
  onToggleToday: () => void;
  onOpenDrawer: () => void;
}

export function RequestFiltersToolbar({
  sectionLabel = "Solicitações",
  todayOnly,
  todayCount,
  activePillCount,
  drawerOpen,
  onToggleToday,
  onOpenDrawer,
}: RequestFiltersToolbarProps) {
  return (
    <nav className="tw:flex tw:flex-wrap tw:gap-2 tw:max-[760px]:w-full" aria-label={`Filtros de ${sectionLabel.toLowerCase()}`}>
      <Button variant="custom" className={filterButtonStyle} data-active={todayOnly} aria-pressed={todayOnly} onClick={onToggleToday}>
        <CalendarDays size={14} aria-hidden="true" />
        Hoje
        <span className={filterCountStyle}>{todayCount}</span>
      </Button>
      <Button
        variant="custom"
        className={filterButtonStyle}
        data-active={activePillCount > 0}
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        onClick={onOpenDrawer}
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filtros
        {activePillCount > 0 && <span className={filterCountStyle}>{activePillCount}</span>}
      </Button>
    </nav>
  );
}
