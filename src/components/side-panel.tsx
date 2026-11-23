import { useId, useRef, type ReactNode } from "react";
import { CloseButton } from "./close-button";
import { useModalFocus } from "./modal-focus";

interface SidePanelProps {
  title: string;
  label?: string;
  closeLabel: string;
  onClose: () => void;
  returnFocus?: HTMLElement | null;
  footer?: ReactNode;
  children: ReactNode;
}

// Dialog that slides in on the right side of the screen: the filters and the notifications share it.
export function SidePanel({ title, label, closeLabel, onClose, returnFocus, footer, children }: SidePanelProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(layerRef, true, returnFocus);

  return (
    <div className="tw:contents" data-managed-dialog="" ref={layerRef}>
      <div aria-hidden="true" className="tw:fixed tw:inset-0 tw:z-[210] tw:bg-slate-900/30 tw:backdrop-blur-[3px]" onClick={onClose} />
      <aside
        className="tw:fixed tw:inset-y-0 tw:right-0 tw:z-[211] tw:flex tw:w-full tw:max-w-[420px] tw:flex-col tw:border-l tw:border-solid tw:border-card-border tw:bg-card-surface tw:shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:border-b tw:border-solid tw:border-card-border tw:px-5 tw:pb-4 tw:pt-5">
          <div className="tw:grid tw:gap-1">
            {label && <span className="tw:text-xs tw:font-semibold tw:text-ui-muted">{label}</span>}
            <h3 className="tw:m-0 tw:text-lg tw:font-semibold tw:text-ui-ink" id={titleId}>{title}</h3>
          </div>
          <CloseButton aria-label={closeLabel} onClick={onClose} />
        </div>
        <div className="tw:grid tw:min-h-0 tw:flex-1 tw:content-start tw:gap-5 tw:overflow-y-auto tw:px-5 tw:pb-6 tw:pt-4">
          {children}
        </div>
        {footer && (
          <div className="tw:flex tw:shrink-0 tw:gap-2.5 tw:border-t tw:border-solid tw:border-card-border tw:px-5 tw:pb-[max(0.875rem,env(safe-area-inset-bottom))] tw:pt-3.5">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
