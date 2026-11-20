import { Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MouseEventHandler } from "react";
import { Button } from "./button";

const shortcutIds = new Set(["dashboard", "admin", "agenda", "relatorios"]);
const shortcutStyle = "tw:min-h-[52px] tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5 tw:border-transparent tw:bg-transparent tw:px-1 tw:text-[0.68rem] tw:font-semibold tw:text-ui-muted tw:hover:bg-card-page tw:aria-[current=page]:border-ui-accent tw:aria-[current=page]:bg-ui-accent-soft tw:aria-[current=page]:text-ui-accent-strong";

interface WorkspaceMobileNavigationProps {
  items: { id: string; label: string; icon: LucideIcon }[];
  active: string;
  menuOpen: boolean;
  onNavigate: (id: string) => void;
  onOpenMenu: MouseEventHandler<HTMLButtonElement>;
}

export function WorkspaceMobileNavigation({ items, active, menuOpen, onNavigate, onOpenMenu }: WorkspaceMobileNavigationProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">
      {items.filter(({ id }) => shortcutIds.has(id)).map(({ id, label, icon: Icon }) => (
        <Button
          key={id}
          variant="custom"
          className={shortcutStyle}
          aria-label={label}
          aria-current={active === id ? "page" : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon size={20} aria-hidden="true" />
          <span className="tw:w-full tw:truncate">{label}</span>
        </Button>
      ))}
      <Button variant="custom" className={shortcutStyle} aria-label="Mais opções" aria-controls="workspace-sidebar" aria-expanded={menuOpen} onClick={onOpenMenu}>
        <Menu size={20} aria-hidden="true" />
        <span>Menu</span>
      </Button>
    </nav>
  );
}
