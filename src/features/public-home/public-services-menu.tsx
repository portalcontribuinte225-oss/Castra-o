import { forwardRef } from "react";
import { Menu, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../components/button";
import { SidePanel } from "../../components/side-panel";

// The public pages on a phone, also lying down: the services leave the header for the ☰ menu (the same condition is in styles.css).
export const PUBLIC_PHONE_QUERY = "(max-width: 820px), (max-height: 480px)";

export interface PublicService {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}

interface PublicServiceButtonsProps {
  services: PublicService[];
  activeServiceId: string | null;
  fullWidth?: boolean;
  onSelect: (serviceId: string) => void;
  onEnter: () => void;
}

// The services and the sign-in, in the header of a wide screen and in the ☰ menu of a phone.
export function PublicServiceButtons({ services, activeServiceId, fullWidth = false, onSelect, onEnter }: PublicServiceButtonsProps) {
  const layout = fullWidth ? " tw:w-full tw:justify-start" : "";
  return (
    <>
      {services.map(({ id, label, icon: Icon, danger }) => (
        <Button
          key={id}
          variant="menu"
          aria-current={activeServiceId === id || undefined}
          className={`tw:text-[color:var(--ink-700)]${layout}`}
          onClick={() => onSelect(id)}
        >
          <Icon size={14} aria-hidden="true" className={danger ? "tw:shrink-0 tw:text-[#b5482f]" : "tw:shrink-0 tw:text-[color:var(--ui-action)]"} />
          <span>{label}</span>
        </Button>
      ))}
      <Button variant="menu" className={`tw:text-[color:var(--selected-ink)]${layout}`} onClick={onEnter}>
        <User size={15} aria-hidden="true" />
        Entrar
      </Button>
    </>
  );
}

interface PublicMenuButtonProps {
  expanded: boolean;
  onClick: () => void;
}

export const PublicMenuButton = forwardRef<HTMLButtonElement, PublicMenuButtonProps>(function PublicMenuButton({ expanded, onClick }, ref) {
  return (
    <Button ref={ref} variant="outline" className="tw:shrink-0" aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick}>
      <Menu size={18} aria-hidden="true" />
      Menu
    </Button>
  );
});

interface PublicServicesMenuProps extends Omit<PublicServiceButtonsProps, "fullWidth"> {
  returnFocus?: HTMLElement | null;
  onClose: () => void;
}

// The side panel of the ☰. It is rendered outside the header: the header's backdrop-filter would hold a fixed panel inside it.
export function PublicServicesMenu({ returnFocus, onClose, ...buttons }: PublicServicesMenuProps) {
  return (
    <SidePanel title="Menu" closeLabel="Fechar menu" onClose={onClose} returnFocus={returnFocus}>
      <nav className="tw:grid tw:gap-2.5" aria-label="Serviços públicos">
        <PublicServiceButtons {...buttons} fullWidth />
      </nav>
    </SidePanel>
  );
}
