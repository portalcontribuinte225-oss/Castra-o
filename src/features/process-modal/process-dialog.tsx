import { useId, useRef } from "react";
import type { ReactNode } from "react";
import { CloseButton } from "../../components/close-button";
import { useModalFocus } from "../../components/modal-focus";

interface ProcessDialogProps {
  title: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  busy: boolean;
  className?: string;
}

export function ProcessDialog({ title, children, actions, onClose, busy, className = "" }: ProcessDialogProps) {
  const overlay = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalFocus(overlay);
  return (
    <div className="assign-modal-overlay" ref={overlay} data-managed-dialog="" onClick={(event) => {
      if (!busy && event.target === event.currentTarget) onClose();
    }}>
      <div className={`assign-modal prm-dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
        <div className="assign-modal-header">
          <strong id={titleId}>{title}</strong>
          <CloseButton disabled={busy} onClick={onClose} />
        </div>
        {children}
        <div className="assign-modal-actions">{actions}</div>
      </div>
    </div>
  );
}
