import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { Button } from "../../components/button";

const filterButtonStyle = "tw:min-w-0 tw:flex-1 tw:border-card-border tw:bg-card-surface tw:font-medium tw:text-ui-text tw:hover:bg-card-page tw:data-[active=true]:border-ui-accent tw:data-[active=true]:bg-[var(--selected-bg)] tw:data-[active=true]:text-[color:var(--selected-ink)]";
const filterCountStyle = "tw:rounded-full tw:bg-[var(--ink-200)] tw:px-1.5 tw:py-0.5 tw:text-xs tw:text-ui-text tw:tabular-nums";

interface TodayFilterToggle {
  active: boolean;
  count: number;
  onToggle: () => void;
}

interface RequestFiltersToolbarProps {
  sectionLabel?: string;
  today?: TodayFilterToggle;
  activePillCount: number;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}

export function RequestFiltersToolbar({
  sectionLabel = "Solicitações",
  today,
  activePillCount,
  drawerOpen,
  onOpenDrawer,
}: RequestFiltersToolbarProps) {
  return (
    <nav className="tw:flex tw:flex-wrap tw:gap-2 tw:max-[760px]:w-full" aria-label={`Filtros de ${sectionLabel.toLowerCase()}`}>
      {today && (
        <Button variant="custom" className={filterButtonStyle} data-active={today.active} aria-pressed={today.active} onClick={today.onToggle}>
          <CalendarDays size={14} aria-hidden="true" />
          Hoje
          <span className={filterCountStyle}>{today.count}</span>
        </Button>
      )}
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
